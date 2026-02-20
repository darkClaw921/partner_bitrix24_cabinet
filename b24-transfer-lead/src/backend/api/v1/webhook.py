"""Webhook endpoints for Bitrix24 events."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.backend.core.database import get_main_db
from src.backend.models.workflow import Workflow
from src.backend.models.lead import Lead
from src.backend.models.lead_field import LeadField
from src.backend.models.workflow_field_mapping import WorkflowFieldMapping
from src.backend.services.database import database_service
from src.backend.services.bitrix24 import Bitrix24Service

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)


def parse_nested_key(key: str, value: str, result: dict):
    """Recursively parse nested keys like 'data[FIELDS][ID]' into nested dict.
    
    Args:
        key: Key like 'data[FIELDS][ID]' or '[FIELDS][ID]' (for recursive calls)
        value: Value to assign
        result: Dictionary to update
    """
    # Handle case when key starts with '[' (from recursive call)
    if key.startswith("["):
        key = key[1:]  # Remove leading '['
    
    # If key ends with ']' but has no '[', it's a malformed key like 'ID]'
    # Extract the actual key name before ']'
    if key.endswith("]") and "[" not in key:
        key = key.rstrip("]")
        result[key] = value
        return
    
    if "[" not in key or "]" not in key:
        result[key] = value
        return
    
    # Split on first '[' to get outer key and the rest
    parts = key.split("[", 1)
    outer_key = parts[0]
    
    # If outer_key is empty (happens when key starts with '['), skip it
    if not outer_key:
        # Key starts with '[', parse the rest
        rest = parts[1]
        bracket_pos = rest.find("]")
        if bracket_pos == -1:
            result[key] = value
            return
        inner_key = rest[:bracket_pos]
        remaining = rest[bracket_pos + 1:]
        if remaining.startswith("["):
            parse_nested_key(remaining, value, result)
        else:
            result[inner_key] = value
        return
    
    # Find the matching closing bracket for the first level
    rest = parts[1]
    bracket_pos = rest.find("]")
    if bracket_pos == -1:
        # No closing bracket, treat as simple key
        result[key] = value
        return
    
    inner_key = rest[:bracket_pos]
    remaining = rest[bracket_pos + 1:]
    
    if outer_key not in result:
        result[outer_key] = {}
    
    # If there's more nesting (starts with '['), recurse
    if remaining.startswith("["):
        parse_nested_key(remaining, value, result[outer_key])
    elif remaining:
        # There's something after ']' but it doesn't start with '['
        # This shouldn't happen in valid Bitrix24 keys, but handle it
        result[outer_key][inner_key] = value
    else:
        # No more nesting, assign value
        result[outer_key][inner_key] = value


def extract_auth_field(data: dict, field_name: str) -> str | None:
    """Extract auth field from webhook data.
    
    Bitrix24 sends auth data in different formats:
    - As nested dict: data['auth']['domain']
    - As flat keys: data['auth[domain]']
    
    Args:
        data: Webhook data dictionary
        field_name: Field name (e.g., 'domain', 'application_token')
        
    Returns:
        Field value or None if not found
    """
    # Try nested format first
    if "auth" in data and isinstance(data["auth"], dict):
        return data["auth"].get(field_name)
    
    # Try flat format: auth[field_name]
    flat_key = f"auth[{field_name}]"
    if flat_key in data:
        return data[flat_key]
    
    return None


def extract_id_from_nested_dict(data: dict) -> str | None:
    """Extract ID from nested dictionary structure.
    
    Handles cases like:
    - data['FIELDS']['ID']
    - data['']['ID'] (parsing issue)
    - data['ID']
    - data['ID]'] (malformed key from parsing)
    
    Args:
        data: Dictionary that may contain ID
        
    Returns:
        ID value or None if not found
    """
    if not isinstance(data, dict):
        return None
    
    # Try direct ID
    if "ID" in data:
        return str(data["ID"])
    
    # Try malformed key 'ID]' (from parsing issue)
    if "ID]" in data:
        return str(data["ID]"])
    
    # Try FIELDS['ID']
    if "FIELDS" in data and isinstance(data["FIELDS"], dict):
        if "ID" in data["FIELDS"]:
            return str(data["FIELDS"]["ID"])
        if "ID]" in data["FIELDS"]:
            return str(data["FIELDS"]["ID]"])
    
    # Try any nested dict that contains ID
    for value in data.values():
        if isinstance(value, dict):
            if "ID" in value:
                return str(value["ID"])
            if "ID]" in value:
                return str(value["ID]"])
            # Recursively check nested dicts
            nested_id = extract_id_from_nested_dict(value)
            if nested_id:
                return nested_id
    
    return None


@router.post("")
async def handle_bitrix24_webhook(
    request: Request,
    db: Session = Depends(get_main_db),
):
    """Handle webhook events from Bitrix24.
    
    Automatically determines workflow by domain from event and verifies application token.
    Bitrix24 sends data as form-data (application/x-www-form-urlencoded), not JSON.
    """
    # Get webhook data - Bitrix24 sends form-data (application/x-www-form-urlencoded), not JSON
    try:
        logger.info(f"Request headers: {request.headers}")
        content_type = request.headers.get("content-type", "")
        
        if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
            # Bitrix24 sends form-data
            form_data = await request.form()
            # Convert form data to dict
            raw_data = dict(form_data)
            logger.debug(f"Raw form data keys: {list(raw_data.keys())}")
            
            # Parse nested keys like "auth[domain]" and "data[FIELDS][ID]" into nested structure
            parsed_data = {}
            for key, value in raw_data.items():
                parse_nested_key(key, value, parsed_data)
            
            data = parsed_data
            logger.debug(f"Parsed data structure: event={data.get('event')}, has_data={bool(data.get('data'))}, has_auth={bool(data.get('auth'))}")
            logger.debug(f"Full parsed data: {data}")
        else:
            # Fallback to JSON
            try:
                data = await request.json()
                logger.debug("Parsed webhook data as JSON")
            except Exception:
                # If JSON parsing fails, try form data anyway
                logger.debug("JSON parsing failed, trying form data")
                form_data = await request.form()
                raw_data = dict(form_data)
                
                # Use same recursive parsing function
                parsed_data = {}
                for key, value in raw_data.items():
                    parse_nested_key(key, value, parsed_data)
                data = parsed_data
    except Exception as e:
        logger.error(f"Failed to parse webhook data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid webhook data: {str(e)}",
        )

    # Extract domain from event
    domain = extract_auth_field(data, "domain")
    if not domain:
        logger.warning("Webhook event missing domain in auth data")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing domain in webhook event",
        )

    # Find all workflows by domain
    workflows = db.query(Workflow).filter(Workflow.bitrix24_domain == domain).all()
    if not workflows:
        logger.warning(f"Workflow not found for domain: {domain}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found for this domain",
        )

    # Verify application token if configured — filter by app_token if present in event
    app_token_from_event = extract_auth_field(data, "application_token")
    matching_workflows = []
    for wf in workflows:
        if wf.app_token:
            if app_token_from_event and app_token_from_event == wf.app_token:
                matching_workflows.append(wf)
        else:
            matching_workflows.append(wf)

    if not matching_workflows:
        logger.warning(f"No workflow matched application token for domain: {domain}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid application token",
        )

    # Use first matching workflow as default; will search others if lead not found
    workflow = matching_workflows[0]

    # Handle different event types
    event = data.get("event", "")
    event_data = data.get("data", {})
    
    
    logger.info(f"Processing webhook event: {event}, workflow_id={workflow.id}")
    logger.debug(f"Event data structure: {event_data}")
    
    # Extract FIELDS from data[FIELDS] or use data directly
    if isinstance(event_data, dict):
        fields = event_data.get("FIELDS", {})
        logger.debug(f"Extracted fields from event_data: {fields}")
        
        # Handle case when FIELDS is nested under empty key (parsing issue)
        if not fields:
            # Check if there's a nested dict with empty key that might contain FIELDS
            for key, value in event_data.items():
                if isinstance(value, dict) and "ID" in value:
                    # This might be the actual fields data
                    fields = value
                    logger.debug(f"Found fields under key '{key}': {fields}")
                    break
            
            # If still no fields, use event_data directly
            if not fields and event_data:
                fields = event_data
                logger.debug(f"Using event_data as fields: {fields}")
    else:
        fields = {}
        logger.debug("event_data is not a dict, fields is empty")

    lead_update = None

    if "ONCRMLEADUPDATE" in event or "ONCRMLEADADD" in event:
        # Handle lead events - need to fetch STATUS_ID from Bitrix24 API
        bitrix_lead_id = extract_id_from_nested_dict(event_data) or extract_id_from_nested_dict(fields)

        logger.info(f"Lead event: bitrix_lead_id={bitrix_lead_id}")

        if bitrix_lead_id:
            try:
                # Fetch lead data from Bitrix24 to get STATUS_ID
                bitrix_service = Bitrix24Service(workflow.bitrix24_webhook_url)
                lead_data = await bitrix_service.get_lead(int(bitrix_lead_id))
                status_id = lead_data.get("STATUS_ID")

                if status_id:
                    # Search for the lead across all matching workflows
                    lead = None
                    workflow_db = None
                    for wf in matching_workflows:
                        wf_db = next(database_service.get_workflow_session(wf.id))
                        found = wf_db.query(Lead).filter(Lead.bitrix24_lead_id == str(bitrix_lead_id)).first()
                        if found:
                            lead = found
                            workflow_db = wf_db
                            workflow = wf
                            logger.info(f"Found lead {bitrix_lead_id} in workflow {wf.id}")
                            break

                    if lead:
                        old_status = lead.status
                        previous_semantic_id = lead.status_semantic_id
                        lead.status = status_id

                        # Update status_semantic_id from STATUS_SEMANTIC_ID
                        status_semantic_id = lead_data.get("STATUS_SEMANTIC_ID")
                        new_semantic_id = str(status_semantic_id) if status_semantic_id else None
                        if new_semantic_id:
                            lead.status_semantic_id = new_semantic_id

                        # Update assigned_by_name from ASSIGNED_BY_ID
                        assigned_by_id = lead_data.get("ASSIGNED_BY_ID")
                        if assigned_by_id:
                            try:
                                user_data = await bitrix_service.get_user(int(assigned_by_id))
                                if user_data:
                                    name = user_data.get("NAME", "").strip()
                                    last_name = user_data.get("LAST_NAME", "").strip()
                                    if name or last_name:
                                        assigned_by_name = f"{name} {last_name}".strip()
                                        lead.assigned_by_name = assigned_by_name
                                        logger.debug(f"Updated assigned_by_name = {assigned_by_name} for lead {lead.id}")
                                    else:
                                        lead.assigned_by_name = None
                                else:
                                    lead.assigned_by_name = None
                            except Exception as e:
                                logger.warning(f"Failed to get user {assigned_by_id} for lead {lead.id}: {e}")
                                lead.assigned_by_name = None
                        else:
                            lead.assigned_by_name = None

                        # Update mapped fields if update_on_event is enabled
                        field_mappings = db.query(WorkflowFieldMapping).filter(
                            WorkflowFieldMapping.workflow_id == workflow.id,
                            WorkflowFieldMapping.entity_type == "lead",
                            WorkflowFieldMapping.update_on_event == True,
                        ).all()

                        for mapping in field_mappings:
                            bitrix_field_id = mapping.bitrix24_field_id
                            field_value = lead_data.get(bitrix_field_id)

                            if field_value is not None:
                                # Convert to string for storage
                                field_value_str = str(field_value)

                                # Find existing lead field or create new one
                                lead_field = workflow_db.query(LeadField).filter(
                                    LeadField.lead_id == lead.id,
                                    LeadField.field_name == mapping.field_name,
                                ).first()

                                if lead_field:
                                    lead_field.field_value = field_value_str
                                    logger.debug(f"Updated field {mapping.field_name} = {field_value_str} for lead {lead.id}")
                                else:
                                    lead_field = LeadField(
                                        lead_id=lead.id,
                                        field_name=mapping.field_name,
                                        field_value=field_value_str,
                                    )
                                    workflow_db.add(lead_field)
                                    logger.debug(f"Created field {mapping.field_name} = {field_value_str} for lead {lead.id}")

                        workflow_db.commit()
                        logger.info(f"Updated lead {bitrix_lead_id} status from {old_status} to {status_id} (STATUS_ID) for workflow {workflow.id}")

                        # Resolve human-readable status name
                        status_name = status_id
                        try:
                            statuses = await bitrix_service.get_lead_statuses()
                            for s in statuses:
                                if s.get("id") == status_id:
                                    status_name = s.get("name", status_id)
                                    break
                        except Exception as e:
                            logger.warning(f"Failed to resolve lead status name: {e}")

                        # Lead becoming "quality" (S) means it was converted to a deal,
                        # NOT that the deal is won. Notification should only come from deal events.
                        became_successful = False

                        # When lead becomes "quality" (S), fetch associated deal
                        if new_semantic_id == "S":
                            try:
                                deals = await bitrix_service.get_deals_by_lead_id(int(bitrix_lead_id))
                                if deals:
                                    deal = deals[0]  # Take the first (most recent) deal
                                    deal_id = str(deal.get("ID", ""))
                                    deal_opportunity = deal.get("OPPORTUNITY", "")
                                    deal_stage_id = deal.get("STAGE_ID", "")

                                    lead.deal_id = deal_id
                                    lead.deal_amount = str(deal_opportunity) if deal_opportunity else None
                                    lead.deal_status = deal_stage_id

                                    # Resolve deal stage name
                                    deal_stage_name = deal_stage_id
                                    try:
                                        category_id = deal.get("CATEGORY_ID", 0)
                                        stages = await bitrix_service.get_deal_stages(int(category_id) if category_id else 0)
                                        for s in stages:
                                            if s.get("id") == deal_stage_id:
                                                deal_stage_name = s.get("name", deal_stage_id)
                                                break
                                    except Exception as e:
                                        logger.warning(f"Failed to resolve deal stage name: {e}")

                                    lead.deal_status_name = deal_stage_name
                                    workflow_db.commit()
                                    logger.info(f"Updated lead {bitrix_lead_id} with deal info: deal_id={deal_id}, amount={deal_opportunity}, stage={deal_stage_id}")
                            except Exception as e:
                                logger.warning(f"Failed to fetch deal for lead {bitrix_lead_id}: {e}")

                        lead_update = {
                            "bitrix24_lead_id": str(bitrix_lead_id),
                            "workflow_id": workflow.id,
                            "status": status_id,
                            "status_name": status_name,
                            "status_semantic_id": new_semantic_id or lead.status_semantic_id,
                            "became_successful": became_successful,
                            "opportunity": lead.deal_amount or lead_data.get("OPPORTUNITY"),
                            "deal_id": lead.deal_id,
                        }
                    else:
                        logger.warning(f"Lead with bitrix24_lead_id={bitrix_lead_id} not found in any workflow. Searched {len(matching_workflows)} workflows.")
                else:
                    logger.warning(f"STATUS_ID not found in lead data from Bitrix24 for lead {bitrix_lead_id}")
            except Exception as e:
                logger.error(f"Failed to fetch lead data from Bitrix24 for lead {bitrix_lead_id}: {e}", exc_info=True)
        else:
            logger.warning(f"Missing bitrix_lead_id in event data")

    elif "ONCRMDEALUPDATE" in event or "ONCRMDEALADD" in event:
        # Handle deal events - need to fetch STAGE_ID from Bitrix24 API
        logger.debug(f"Deal event data: {event_data}, fields: {fields}")
        bitrix_deal_id = extract_id_from_nested_dict(event_data) or extract_id_from_nested_dict(fields)

        logger.info(f"Deal event: bitrix_deal_id={bitrix_deal_id}")

        if bitrix_deal_id:
            try:
                # Fetch deal data from Bitrix24 to get STAGE_ID
                bitrix_service = Bitrix24Service(workflow.bitrix24_webhook_url)
                deal_data = await bitrix_service.get_deal(int(bitrix_deal_id))

                stage_id = deal_data.get("STAGE_ID")

                if stage_id:
                    # Search for the lead across all matching workflows
                    # First try by bitrix24_lead_id == deal_id (for deal-type workflows)
                    # Then try by deal's LEAD_ID (for lead-type workflows where deal was created from lead)
                    lead = None
                    workflow_db = None
                    deal_lead_id = deal_data.get("LEAD_ID")

                    for wf in matching_workflows:
                        wf_db = next(database_service.get_workflow_session(wf.id))
                        # First: direct match (deal-type workflows store deal ID as bitrix24_lead_id)
                        found = wf_db.query(Lead).filter(Lead.bitrix24_lead_id == str(bitrix_deal_id)).first()
                        if found:
                            lead = found
                            workflow_db = wf_db
                            workflow = wf
                            logger.info(f"Found deal {bitrix_deal_id} by direct match in workflow {wf.id}")
                            break
                        # Second: match by deal's LEAD_ID (lead-type workflows)
                        if deal_lead_id:
                            found = wf_db.query(Lead).filter(Lead.bitrix24_lead_id == str(deal_lead_id)).first()
                            if found:
                                lead = found
                                workflow_db = wf_db
                                workflow = wf
                                logger.info(f"Found lead {deal_lead_id} (from deal {bitrix_deal_id} LEAD_ID) in workflow {wf.id}")
                                break

                    if lead:
                        # Determine if lead was found via LEAD_ID (lead-type workflow)
                        found_via_lead_id = deal_lead_id and lead.bitrix24_lead_id == str(deal_lead_id)

                        stage_semantic_id = deal_data.get("STAGE_SEMANTIC_ID")
                        new_deal_semantic = str(stage_semantic_id) if stage_semantic_id else None

                        if found_via_lead_id:
                            # Lead-type workflow: DON'T overwrite lead.status with deal stage
                            # Only update deal-specific fields
                            old_deal_status = lead.deal_status
                            logger.info(f"Lead-type workflow: updating deal fields only (not overwriting lead status)")
                        else:
                            # Deal-type workflow: update lead.status with deal stage
                            old_status = lead.status
                            previous_semantic_id = lead.status_semantic_id
                            lead.status = stage_id
                            if new_deal_semantic:
                                lead.status_semantic_id = new_deal_semantic

                        # Update assigned_by_name from ASSIGNED_BY_ID
                        assigned_by_id = deal_data.get("ASSIGNED_BY_ID")
                        if assigned_by_id:
                            try:
                                user_data = await bitrix_service.get_user(int(assigned_by_id))
                                if user_data:
                                    name = user_data.get("NAME", "").strip()
                                    last_name = user_data.get("LAST_NAME", "").strip()
                                    if name or last_name:
                                        assigned_by_name = f"{name} {last_name}".strip()
                                        lead.assigned_by_name = assigned_by_name
                                        logger.debug(f"Updated assigned_by_name = {assigned_by_name} for deal {lead.id}")
                                    else:
                                        lead.assigned_by_name = None
                                else:
                                    lead.assigned_by_name = None
                            except Exception as e:
                                logger.warning(f"Failed to get user {assigned_by_id} for deal {lead.id}: {e}")
                                lead.assigned_by_name = None
                        else:
                            lead.assigned_by_name = None

                        # Update mapped fields if update_on_event is enabled
                        field_mappings = db.query(WorkflowFieldMapping).filter(
                            WorkflowFieldMapping.workflow_id == workflow.id,
                            WorkflowFieldMapping.entity_type == "deal",
                            WorkflowFieldMapping.update_on_event == True,
                        ).all()

                        for mapping in field_mappings:
                            bitrix_field_id = mapping.bitrix24_field_id
                            field_value = deal_data.get(bitrix_field_id)

                            if field_value is not None:
                                field_value_str = str(field_value)
                                lead_field = workflow_db.query(LeadField).filter(
                                    LeadField.lead_id == lead.id,
                                    LeadField.field_name == mapping.field_name,
                                ).first()

                                if lead_field:
                                    lead_field.field_value = field_value_str
                                    logger.debug(f"Updated field {mapping.field_name} = {field_value_str} for deal {lead.id}")
                                else:
                                    lead_field = LeadField(
                                        lead_id=lead.id,
                                        field_name=mapping.field_name,
                                        field_value=field_value_str,
                                    )
                                    workflow_db.add(lead_field)
                                    logger.debug(f"Created field {mapping.field_name} = {field_value_str} for deal {lead.id}")

                        # Always update deal info on the lead
                        old_deal_status_val = lead.deal_status
                        lead.deal_id = str(bitrix_deal_id)
                        deal_opportunity = deal_data.get("OPPORTUNITY")
                        if deal_opportunity:
                            lead.deal_amount = str(deal_opportunity)
                        lead.deal_status = stage_id

                        # Resolve human-readable deal stage name
                        status_name = stage_id
                        try:
                            category_id = deal_data.get("CATEGORY_ID") or workflow.deal_category_id or 0
                            stages = await bitrix_service.get_deal_stages(int(category_id) if category_id else 0)
                            for s in stages:
                                if s.get("id") == stage_id:
                                    status_name = s.get("name", stage_id)
                                    break
                        except Exception as e:
                            logger.warning(f"Failed to resolve deal stage name: {e}")

                        lead.deal_status_name = status_name

                        workflow_db.commit()
                        logger.info(f"Updated deal {bitrix_deal_id} for lead {lead.bitrix24_lead_id} in workflow {workflow.id}: stage={stage_id}, amount={deal_opportunity}, found_via_lead_id={found_via_lead_id}")

                        # Compute became_successful based on deal semantic transition
                        if found_via_lead_id:
                            # For lead-type: deal became successful when deal semantic goes to "S"
                            # We don't have previous deal semantic stored, so check if deal was not in a success stage before
                            became_successful = new_deal_semantic == "S" and old_deal_status_val != stage_id
                        else:
                            # For deal-type: standard lead semantic transition
                            became_successful = (
                                previous_semantic_id != "S"
                                and new_deal_semantic == "S"
                            )

                        lead_update = {
                            "bitrix24_lead_id": str(deal_lead_id or bitrix_deal_id),
                            "workflow_id": workflow.id,
                            "status": stage_id,
                            "status_name": status_name,
                            "status_semantic_id": new_deal_semantic or lead.status_semantic_id,
                            "became_successful": became_successful,
                            "opportunity": deal_data.get("OPPORTUNITY"),
                            "deal_id": str(bitrix_deal_id),
                        }
                    else:
                        logger.warning(f"Deal {bitrix_deal_id} (LEAD_ID={deal_lead_id}) not found in any workflow. Searched {len(matching_workflows)} workflows.")
                else:
                    logger.warning(f"STAGE_ID not found in deal data from Bitrix24 for deal {bitrix_deal_id}")
            except Exception as e:
                logger.error(f"Failed to fetch deal data from Bitrix24 for deal {bitrix_deal_id}: {e}", exc_info=True)
        else:
            logger.warning(f"Missing bitrix_deal_id in event data")
    else:
        logger.warning(f"Unknown event type: {event}")

    response = {"status": "ok"}
    if lead_update:
        response["lead_update"] = lead_update
    return response

