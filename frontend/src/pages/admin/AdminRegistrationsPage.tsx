import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  searchB24Contacts,
  searchB24Companies,
  createB24Contact,
  createB24Company,
  adminRegisterPartner,
  type RegistrationRequest,
  type B24Contact,
  type B24Company,
} from '@/api/admin'
import { useToast } from '@/hooks/useToast'

type B24Mode = 'create_contact' | 'create_company' | 'link_contact' | 'link_company' | 'skip'

export default function AdminRegistrationsPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)
  const [rejectModal, setRejectModal] = useState<RegistrationRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const { showToast } = useToast()

  // Approve modal state
  const [approveModal, setApproveModal] = useState<RegistrationRequest | null>(null)
  const [b24Mode, setB24Mode] = useState<B24Mode>('skip')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(B24Contact | B24Company)[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number; name: string } | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', last_name: '', phone: '', email: '', title: '' })

  // Register partner modal
  const [registerModal, setRegisterModal] = useState(false)
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', company: '' })
  const [registering, setRegistering] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const data = await getPendingRegistrations()
      setRequests(data)
    } catch {
      showToast('Не удалось загрузить заявки', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const doSearch = useCallback(async (query: string, mode: B24Mode) => {
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      if (mode === 'link_contact') setSearchResults(await searchB24Contacts(query))
      else if (mode === 'link_company') setSearchResults(await searchB24Companies(query))
    } catch { showToast('Ошибка поиска', 'error') }
    finally { setSearching(false) }
  }, [showToast])

  useEffect(() => {
    if (b24Mode !== 'link_contact' && b24Mode !== 'link_company') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(searchQuery, b24Mode), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, b24Mode, doSearch])

  const openApproveModal = (req: RegistrationRequest) => {
    setApproveModal(req)
    setB24Mode('skip')
    setSearchQuery('')
    setSearchResults([])
    setSelectedEntity(null)
    setCreateForm({
      name: req.name.split(' ')[0] || req.name,
      last_name: req.name.split(' ').slice(1).join(' ') || '',
      phone: req.phone || '',
      email: req.email,
      title: req.company || '',
    })
  }

  const handleApprove = async () => {
    if (!approveModal) return
    setProcessing(approveModal.id)
    try {
      let b24Data: { b24_entity_type?: string; b24_entity_id?: number; b24_entity_name?: string } | undefined
      if (b24Mode === 'create_contact') {
        const contact = await createB24Contact({ name: createForm.name, last_name: createForm.last_name || undefined, phone: createForm.phone || undefined, email: createForm.email || undefined })
        b24Data = { b24_entity_type: 'contact', b24_entity_id: contact.id, b24_entity_name: `${contact.name} ${contact.last_name || ''}`.trim() }
      } else if (b24Mode === 'create_company') {
        const company = await createB24Company({ title: createForm.title, phone: createForm.phone || undefined, email: createForm.email || undefined })
        b24Data = { b24_entity_type: 'company', b24_entity_id: company.id, b24_entity_name: company.title }
      } else if ((b24Mode === 'link_contact' || b24Mode === 'link_company') && selectedEntity) {
        b24Data = { b24_entity_type: selectedEntity.type, b24_entity_id: selectedEntity.id, b24_entity_name: selectedEntity.name }
      }
      await approveRegistration(approveModal.id, b24Data)
      showToast('Заявка одобрена', 'success')
      setApproveModal(null)
      await fetchRequests()
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Ошибка при одобрении', 'error')
    } finally { setProcessing(null) }
  }

  const openRejectModal = (req: RegistrationRequest) => {
    setRejectModal(req)
    setRejectionReason('')
  }

  const handleReject = async () => {
    if (!rejectModal) return
    setProcessing(rejectModal.id)
    try {
      await rejectRegistration(rejectModal.id, rejectionReason || undefined)
      showToast('Заявка отклонена', 'success')
      setRejectModal(null)
      await fetchRequests()
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Ошибка при отклонении', 'error')
    } finally { setProcessing(null) }
  }

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password) { showToast('Заполните обязательные поля', 'error'); return }
    if (registerForm.password.length < 6) { showToast('Пароль должен быть не менее 6 символов', 'error'); return }
    setRegistering(true)
    try {
      await adminRegisterPartner({ name: registerForm.name, email: registerForm.email, password: registerForm.password, company: registerForm.company || undefined })
      showToast('Партнёр зарегистрирован', 'success')
      setRegisterModal(false)
      setRegisterForm({ name: '', email: '', password: '', company: '' })
      await fetchRequests()
    } catch (err: any) { showToast(err?.response?.data?.detail || 'Ошибка регистрации', 'error') }
    finally { setRegistering(false) }
  }

  const selectContact = (c: B24Contact) => setSelectedEntity({ type: 'contact', id: c.id, name: `${c.name} ${c.last_name || ''}`.trim() })
  const selectCompany = (c: B24Company) => setSelectedEntity({ type: 'company', id: c.id, name: c.title })

  const isApproveDisabled = () => {
    if (!approveModal || processing === approveModal.id) return true
    if (b24Mode === 'link_contact' || b24Mode === 'link_company') return !selectedEntity
    if (b24Mode === 'create_contact') return !createForm.name
    if (b24Mode === 'create_company') return !createForm.title
    return false
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Заявки на регистрацию</h1>
        <button style={styles.btnRegister} onClick={() => setRegisterModal(true)}>Зарегистрировать партнёра</button>
      </div>

      {loading ? (
        <div style={styles.loader}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={styles.empty}>Нет заявок на рассмотрении</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Имя</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Компания</th>
                <th style={styles.th}>Телефон</th>
                <th style={styles.th}>Дата регистрации</th>
                <th style={styles.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>{r.email}</td>
                  <td style={styles.td}>{r.company || '\u2014'}</td>
                  <td style={styles.td}>{r.phone || '\u2014'}</td>
                  <td style={styles.td}>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnApprove} disabled={processing === r.id} onClick={() => openApproveModal(r)}>Одобрить</button>
                      <button style={styles.btnReject} disabled={processing === r.id} onClick={() => openRejectModal(r)}>Отклонить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve modal with B24 linking */}
      {approveModal && (
        <div style={styles.modalOverlay} onClick={() => setApproveModal(null)}>
          <div style={styles.modalContentWide} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Одобрение заявки: {approveModal.name}</h3>
              <button style={styles.modalClose} onClick={() => setApproveModal(null)}>&times;</button>
            </div>
            <p style={{ fontSize: '14px', color: '#5f6368', marginBottom: '16px' }}>Выберите способ привязки к Bitrix24:</p>
            <div style={styles.radioGroup}>
              {([
                { value: 'create_contact' as B24Mode, label: 'Создать контакт' },
                { value: 'create_company' as B24Mode, label: 'Создать компанию' },
                { value: 'link_contact' as B24Mode, label: 'Привязать существующий контакт' },
                { value: 'link_company' as B24Mode, label: 'Привязать существующую компанию' },
                { value: 'skip' as B24Mode, label: 'Пропустить B24' },
              ]).map(opt => (
                <label key={opt.value} style={styles.radioLabel}>
                  <input type="radio" name="b24mode" value={opt.value} checked={b24Mode === opt.value}
                    onChange={() => { setB24Mode(opt.value); setSearchQuery(''); setSearchResults([]); setSelectedEntity(null) }} />
                  <span style={{ marginLeft: '8px' }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {(b24Mode === 'link_contact' || b24Mode === 'link_company') && (
              <div style={styles.searchSection}>
                <input style={styles.input} type="text" value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedEntity(null) }}
                  placeholder={b24Mode === 'link_contact' ? 'Поиск контакта по имени...' : 'Поиск компании по названию...'} />
                {searching && <div style={styles.searchHint}>Поиск...</div>}
                {selectedEntity && <div style={styles.selectedBadge}>Выбрано: {selectedEntity.name} (ID: {selectedEntity.id})</div>}
                {searchResults.length > 0 && !selectedEntity && (
                  <div style={styles.resultsList}>
                    {searchResults.map(item => {
                      const isContact = b24Mode === 'link_contact'
                      const contact = item as B24Contact; const company = item as B24Company
                      return (
                        <div key={item.id} style={styles.resultItem} onClick={() => isContact ? selectContact(contact) : selectCompany(company)}>
                          <div style={styles.resultName}>{isContact ? `${contact.name} ${contact.last_name || ''}` : company.title}</div>
                          <div style={styles.resultMeta}>ID: {item.id}{item.phone ? ` | ${item.phone}` : ''}{item.email ? ` | ${item.email}` : ''}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && <div style={styles.searchHint}>Ничего не найдено</div>}
              </div>
            )}
            {b24Mode === 'create_contact' && (
              <div style={styles.createForm}>
                <div style={styles.formRow}>
                  <div style={styles.field}><label style={styles.label}>Имя *</label><input style={styles.input} type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} /></div>
                  <div style={styles.field}><label style={styles.label}>Фамилия</label><input style={styles.input} type="text" value={createForm.last_name} onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })} /></div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.field}><label style={styles.label}>Телефон</label><input style={styles.input} type="text" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} /></div>
                  <div style={styles.field}><label style={styles.label}>Email</label><input style={styles.input} type="text" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
                </div>
              </div>
            )}
            {b24Mode === 'create_company' && (
              <div style={styles.createForm}>
                <div style={styles.field}><label style={styles.label}>Название компании *</label><input style={styles.input} type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} /></div>
                <div style={styles.formRow}>
                  <div style={styles.field}><label style={styles.label}>Телефон</label><input style={styles.input} type="text" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} /></div>
                  <div style={styles.field}><label style={styles.label}>Email</label><input style={styles.input} type="text" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
                </div>
              </div>
            )}
            <div style={styles.modalActions}>
              <button style={styles.btnApproveConfirm} disabled={isApproveDisabled()} onClick={handleApprove}>{processing === approveModal.id ? 'Одобрение...' : 'Одобрить'}</button>
              <button style={styles.btnCancel} onClick={() => setApproveModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div style={styles.modalOverlay} onClick={() => setRejectModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Отклонить заявку</h3>
              <button style={styles.modalClose} onClick={() => setRejectModal(null)}>&times;</button>
            </div>
            <p style={{ fontSize: '14px', color: '#5f6368', marginBottom: '12px' }}>Отклонить заявку от <strong>{rejectModal.name}</strong> ({rejectModal.email})?</p>
            <div style={styles.field}>
              <label style={styles.label}>Причина отклонения (необязательно)</label>
              <textarea style={styles.textarea} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Укажите причину..." rows={3} />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.btnRejectConfirm} disabled={processing === rejectModal.id} onClick={handleReject}>{processing === rejectModal.id ? '...' : 'Отклонить'}</button>
              <button style={styles.btnCancel} onClick={() => setRejectModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Register partner modal */}
      {registerModal && (
        <div style={styles.modalOverlay} onClick={() => setRegisterModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Регистрация партнёра</h3>
              <button style={styles.modalClose} onClick={() => setRegisterModal(false)}>&times;</button>
            </div>
            <div style={styles.field}><label style={styles.label}>Имя *</label><input style={styles.input} type="text" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} placeholder="Имя партнёра" /></div>
            <div style={styles.field}><label style={styles.label}>Email *</label><input style={styles.input} type="email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="email@example.com" /></div>
            <div style={styles.field}><label style={styles.label}>Пароль * (мин. 6 символов)</label><input style={styles.input} type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} placeholder="Пароль" /></div>
            <div style={styles.field}><label style={styles.label}>Компания</label><input style={styles.input} type="text" value={registerForm.company} onChange={e => setRegisterForm({ ...registerForm, company: e.target.value })} placeholder="Название компании (необязательно)" /></div>
            <div style={styles.modalActions}>
              <button style={styles.btnApproveConfirm} disabled={registering} onClick={handleRegister}>{registering ? 'Регистрация...' : 'Зарегистрировать'}</button>
              <button style={styles.btnCancel} onClick={() => setRegisterModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '24px', fontWeight: 600, margin: 0 },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', color: '#5f6368', fontSize: '16px' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: '8px' },
  btnApprove: { padding: '6px 14px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnReject: { padding: '6px 14px', background: '#fff', color: '#d93025', border: '1px solid #d93025', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnRegister: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%', maxHeight: '90vh', overflowY: 'auto' as const },
  modalContentWide: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' as const },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: { fontSize: '18px', fontWeight: 600, margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  textarea: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' },
  modalActions: { display: 'flex', gap: '10px' },
  btnRejectConfirm: { flex: 1, padding: '10px', background: '#d93025', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  btnCancel: { flex: 1, padding: '10px', background: '#fff', color: '#5f6368', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  btnApproveConfirm: { flex: 1, padding: '10px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  radioLabel: { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#202124', cursor: 'pointer' },
  searchSection: { marginBottom: '16px' },
  searchHint: { fontSize: '13px', color: '#5f6368', marginTop: '8px' },
  selectedBadge: { marginTop: '8px', padding: '8px 12px', background: '#e6f4ea', borderRadius: '6px', fontSize: '13px', color: '#137333', fontWeight: 500 },
  resultsList: { marginTop: '8px', border: '1px solid #dadce0', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' as const },
  resultItem: { padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f4' },
  resultName: { fontSize: '14px', fontWeight: 500, color: '#202124' },
  resultMeta: { fontSize: '12px', color: '#5f6368', marginTop: '2px' },
  createForm: { marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' },
  formRow: { display: 'flex', gap: '12px' },
}
