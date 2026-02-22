# Партнёрский кабинет Bitrix24 — Архитектура

## Общее описание

Веб-приложение «Партнёрский кабинет» для управления партнёрскими ссылками, лендингами, клиентами и аналитикой с интеграцией в Bitrix24 через сервис b24-transfer-lead. Включает админ-панель для управления всеми партнёрами, систему in-app уведомлений, генерацию QR-кодов, UTM-метки, систему запросов на выплату и чат между партнёром и админом.

## Стек технологий

- **Backend:** Python 3.11, FastAPI 0.109, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, bcrypt, fpdf2 (PDF-генерация)
- **Frontend:** React 18, TypeScript, Vite 5, React Router 6, Axios, Recharts, qrcode.react
- **БД:** SQLite (aiosqlite)
- **b24-transfer-lead:** Python 3.12, FastAPI, SQLAlchemy (sync), SQLite, httpx
- **Инфраструктура:** Docker, docker-compose.dev.yml

## Структура проекта

```
partner_bitrix24_cabinet/
├── docker-compose.dev.yml          # Docker Compose (backend:8003, frontend:5173, b24-service:7860, b24-frontend:3000, telegram-bot)
├── architecture.md                 # Описание архитектуры проекта
├── data/                           # Директория для SQLite БД (volume)
│   └── app.db                      # Файл БД (создаётся автоматически)
├── b24-transfer-lead/              # Сервис для создания лидов/сделок в Bitrix24
│   ├── Dockerfile.backend          # Docker-образ (python:3.12-slim, uv, порт 7860)
│   └── src/backend/
│       ├── main.py                 # FastAPI app, startup: init_db, миграции, авто-создание admin
│       ├── core/
│       │   ├── config.py           # Settings: INTERNAL_API_KEY, ADMIN_USERNAME/PASSWORD и др.
│       │   └── database.py         # SQLAlchemy engine, сессии (main + per-workflow БД)
│       ├── api/v1/
│       │   ├── dependencies.py     # get_current_user (session cookie + X-Internal-API-Key bypass)
│       │   ├── workflows.py        # CRUD workflows, settings, funnels, stages, statuses, token, stats
│       │   ├── leads.py            # CRUD leads, upload/export CSV
│       │   ├── public.py           # Публичный API: создание лидов по api_token
│       │   ├── auth.py             # Login/logout (session-based)
│       │   ├── users.py            # Управление пользователями
│       │   └── webhook.py          # Вебхуки из Bitrix24 (возвращает lead_update с инфо о статусе, became_successful и opportunity)
│       ├── models/                 # User, Workflow, Lead, LeadField, WorkflowFieldMapping
│       └── services/               # AuthService, Bitrix24Service, DatabaseService
├── backend/
│   ├── Dockerfile                  # Docker-образ backend (python:3.11-slim, fonts-dejavu-core для PDF)
│   ├── requirements.txt            # Python-зависимости
│   ├── alembic.ini                 # Конфигурация Alembic
│   ├── alembic/
│   │   ├── env.py                  # Настройка async-миграций с подключением всех моделей
│   │   ├── script.py.mako          # Шаблон миграций
│   │   └── versions/               # Файлы миграций
│   ├── landing_template/
│   │   └── index.html              # Jinja2 шаблон лендинга: слайдер, CRM-форма, responsive
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # FastAPI app: lifespan, CORS, статика /uploads, миграции, ensure_admin_exists()
│       ├── config.py               # Settings: DATABASE_URL, SECRET_KEY, B24_SERVICE_URL, DEFAULT_REWARD_PERCENTAGE, ADMIN_EMAIL, ADMIN_PASSWORD, B24_SERVICE_FRONTEND_URL
│       ├── database.py             # Async engine, AsyncSessionLocal, Base, get_db()
│       ├── dependencies.py         # FastAPI Depends: get_db(), get_current_user() (JWT + OAuth2), get_admin_user() (role check)
│       ├── models/
│       │   ├── __init__.py         # Реэкспорт всех моделей для Alembic
│       │   ├── partner.py          # Partner — партнёр (email, password_hash, partner_code, role, reward_percentage, payment_details (JSON: saved_payment_methods), workflow_id, b24_api_token, approval_status, rejection_reason)
│       │   ├── link.py             # PartnerLink — партнёрская ссылка (link_type, link_code, target_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
│       │   ├── click.py            # LinkClick — клик по ссылке (ip_address, user_agent, referer)
│       │   ├── client.py           # Client — клиент (source, name, phone, email, webhook_sent, deal_amount, partner_reward, is_paid, paid_at, payment_comment, deal_status, deal_status_name)
│       │   ├── landing.py          # LandingPage + LandingImage — лендинги с изображениями
│       │   ├── notification.py     # Notification (title, message, created_by, target_partner_id, file_path, file_name) + NotificationRead (notification_id, partner_id, read_at)
│       │   ├── payment_request.py  # PaymentRequest (partner_id, status, total_amount, client_ids, comment, payment_details, admin_comment, processed_at, processed_by)
│       │   └── chat_message.py    # ChatMessage (partner_id, sender_id, message, file_path, file_name, is_read, created_at)
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py             # RegisterRequest, LoginRequest, TokenResponse, PartnerResponse (с полями role, saved_payment_methods), SavedPaymentMethod, AddPaymentMethodRequest
│       │   ├── link.py             # LinkCreateRequest, LinkUpdateRequest, LinkResponse, EmbedCodeResponse (с UTM-полями и redirect_url_with_utm)
│       │   ├── client.py           # ClientCreateRequest, ClientResponse (с deal_amount, partner_reward, is_paid, deal_status, deal_status_name), PublicFormRequest
│       │   ├── landing.py          # LandingCreateRequest, LandingUpdateRequest, LandingImageResponse, LandingResponse
│       │   ├── analytics.py        # SummaryResponse, LinkStatsResponse, BitrixStatsResponse
│       │   ├── admin.py            # ClientPaymentUpdateRequest, PartnerPaymentSummaryResponse, AdminOverviewResponse, PartnerStatsResponse, AdminPartnerDetailResponse, AdminConfigResponse, PartnerRewardPercentageUpdateRequest, GlobalRewardPercentageResponse, GlobalRewardPercentageUpdateRequest, RegistrationRequestResponse, RejectRegistrationRequest
│       │   ├── notification.py     # NotificationCreateRequest, NotificationResponse (file_url, file_name), PartnerNotificationResponse (file_url, file_name), UnreadCountResponse
│       │   ├── payment_request.py  # PaymentRequestCreate (с payment_details), PaymentRequestResponse (с payment_details), PaymentRequestAdminAction, PendingCountResponse
│       │   ├── chat.py             # ChatMessageSend, ChatMessageResponse (с file_url, file_name), ChatConversationPreview, ChatUnreadCountResponse
│       │   └── report.py           # PartnerReportMetrics (с полями конверсий: total_deals, total_successful_deals, total_lost_deals, conversion_leads_to_deals, conversion_deals_to_successful), PartnerReportResponse, AllPartnersReportRow, AllPartnersReportResponse
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py             # POST /register, /login, /refresh, /payment-methods; GET /me; DELETE /payment-methods/{id}
│       │   ├── links.py            # CRUD /api/links
│       │   ├── clients.py          # CRUD /api/clients
│       │   ├── landings.py         # CRUD /api/landings
│       │   ├── analytics.py        # GET /api/analytics/summary, /links, /clients/stats; POST /bitrix/fetch
│       │   ├── bitrix_settings.py  # POST /api/bitrix/setup, GET|PUT /settings, GET /funnels, /stages, /lead-statuses, /leads, /stats
│       │   ├── admin.py            # GET /api/admin/overview, /partners, /partners/{id}, /config, /partners/{id}/payments, /reward-percentage, /registrations, /registrations/count; POST /registrations/{id}/approve, /registrations/{id}/reject; PUT /api/admin/clients/{id}/payment, /partners/{id}/reward-percentage, /partners/{id}/toggle-active, /reward-percentage; POST|GET|DELETE /api/admin/notifications
│       │   ├── notifications.py    # GET /api/notifications/, /unread-count; POST /notifications/{id}/read, /read-all
│       │   ├── payment_requests.py # POST|GET /api/payment-requests; GET /api/payment-requests/{id}; GET|PUT /api/admin/payment-requests; GET /api/admin/payment-requests/pending-count
│       │   ├── chat.py             # GET|POST /api/chat/messages, POST /api/chat/messages/file, GET /api/chat/unread-count, POST /api/chat/read; GET /api/admin/chat/conversations, GET|POST /api/admin/chat/conversations/{id}/messages, POST /api/admin/chat/conversations/{id}/messages/file, GET /api/admin/chat/unread-count, POST /api/admin/chat/conversations/{id}/read
│       │   ├── reports.py          # GET /api/reports, /reports/pdf (партнёр); GET /api/admin/reports, /admin/reports/pdf (админ)
│       │   └── public.py           # Публичные: GET /r/{code} (с UTM-параметрами), /landing/{code}, POST /form/{code}, POST /webhook/b24 (прокси + обновление deal_status + авто-расчёт deal_amount/partner_reward из opportunity + уведомление с суммой и комиссией)
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth_service.py     # register_partner(), login_partner(), refresh_tokens(), create_partner_workflow()
│       │   ├── link_service.py     # create_link(), get_links(), get_link(), update_link(), delete_link(), get_embed_code(), _build_url_with_utm()
│       │   ├── client_service.py   # create_client_manual(), create_client_from_form()
│       │   ├── external_api.py     # send_client_webhook(), fetch_bitrix_stats(), check_client_status()
│       │   ├── b24_integration_service.py # HTTP-клиент для b24-transfer-lead (httpx, X-Internal-API-Key)
│       │   ├── landing_service.py  # create_landing(), get_landings(), update_landing(), delete_landing()
│       │   ├── analytics_service.py # get_summary(), get_links_stats(), get_bitrix_stats()
│       │   ├── admin_service.py    # get_admin_overview(), get_partners_stats(), get_partner_detail(), update_client_payment() (авто-расчёт partner_reward), bulk_update_client_payments(), get_partner_payment_summary(), update_partner_reward_percentage(), _get_effective_reward_percentage(), toggle_partner_active(), get_pending_registrations(), get_pending_registrations_count(), approve_registration(), reject_registration()
│       │   ├── notification_service.py # create_notification() (с file upload), _save_notification_upload(), get_all_notifications() (с file_url), delete_notification() (удаляет файл), get_partner_notifications() (фильтрация по target_partner_id, с file_url), get_unread_count(), mark_as_read(), mark_all_as_read()
│       │   ├── payment_request_service.py # create_payment_request(), get_pending_count(), get_partner_requests(), get_all_requests(), get_request_detail(), process_request()
│       │   ├── chat_service.py    # send_message_partner(), send_message_with_file_partner(), get_partner_messages(), get_partner_unread_count(), mark_partner_messages_read(), get_conversations(), get_conversation_messages(), send_message_admin(), send_message_with_file_admin(), get_admin_total_unread_count(), mark_admin_messages_read()
│       │   ├── report_service.py  # generate_partner_report(), generate_all_partners_report(), _compute_partner_metrics(), _get_partner_clients_detail()
│       │   └── pdf_service.py     # generate_partner_report_pdf(), generate_all_partners_report_pdf() — генерация PDF через fpdf2 с DejaVu шрифтами
│       └── utils/
│           ├── __init__.py
│           ├── migrate_db.py       # migrate_partner_b24_fields(), migrate_partner_role_field(), migrate_client_payment_fields(), migrate_partner_reward_percentage(), migrate_link_utm_fields(), migrate_notification_target_partner(), migrate_notification_file_fields(), migrate_client_deal_status_fields(), migrate_chat_messages_table(), migrate_chat_file_fields(), migrate_partner_approval_fields(), migrate_partner_payment_details(), migrate_payment_request_details()
│           ├── create_admin.py     # ensure_admin_exists() — создание/обновление админа из env vars при старте
│           └── security.py         # hash_password(), verify_password(), create_access/refresh_token()
└── frontend/
    ├── Dockerfile                  # Docker-образ frontend (node:20-alpine)
    ├── package.json                # npm-зависимости (react, axios, recharts, react-router-dom, qrcode.react)
    ├── vite.config.ts              # Vite: proxy /api → backend:8000, alias @ → src/
    ├── tsconfig.json               # TypeScript strict, paths @/* → src/*
    ├── tsconfig.node.json          # TS config для vite.config.ts
    ├── index.html                  # Точка входа HTML с div#root
    └── src/
        ├── main.tsx                # ReactDOM.createRoot, рендер App, импорт стилей
        ├── App.tsx                 # BrowserRouter + Routes (Layout, AdminLayout, ProtectedRoute, AdminProtectedRoute)
        ├── vite-env.d.ts           # Типы Vite
        ├── styles/
        │   └── index.css           # CSS reset, CSS-переменные, утилитарные классы
        ├── api/
        │   ├── client.ts           # Axios instance с JWT interceptors
        │   ├── auth.ts             # register(), login(), refresh(), getMe(), logout(), addPaymentMethod(), deletePaymentMethod(); Partner interface (с role, saved_payment_methods), SavedPaymentMethod
        │   ├── links.ts            # getLinks(), createLink(), updateLink(), deleteLink(); интерфейсы Link, CreateLinkData, UpdateLinkData с UTM-полями
        │   ├── clients.ts          # getClients(), getClient(), createClient(); Client interface с deal_amount, partner_reward, is_paid, deal_status, deal_status_name
        │   ├── landings.ts         # getLandings(), createLanding(), updateLanding(), deleteLanding()
        │   ├── analytics.ts        # getSummary(), getLinksStats(), fetchBitrixStats()
        │   ├── bitrix.ts           # setupBitrix(), getBitrixSettings(), updateBitrixSettings(), getFunnels(), getStages(), getLeads(), getStats()
        │   ├── admin.ts            # getAdminOverview(), getAdminPartners(), getAdminPartnerDetail(), getAdminConfig(), updateClientPayment(), getPartnerPaymentSummary(), updatePartnerRewardPercentage(), togglePartnerActive(), getGlobalRewardPercentage(), updateGlobalRewardPercentage(), createNotification(), getAdminNotifications(), deleteNotification(), getPendingRegistrations(), getPendingRegistrationsCount(), approveRegistration(), rejectRegistration()
        │   ├── notifications.ts    # getNotifications(), getUnreadCount(), markAsRead(), markAllAsRead()
        │   ├── paymentRequests.ts  # createPaymentRequest(), getPartnerPaymentRequests(), getPartnerPaymentRequest(), getAdminPaymentRequests(), getAdminPaymentRequest(), processPaymentRequest(), getPendingCount()
        │   ├── chat.ts             # getPartnerMessages(), sendPartnerMessage(), sendPartnerFile(), getPartnerUnreadCount(), markPartnerMessagesRead(), getAdminConversations(), getAdminConversationMessages(), sendAdminMessage(), sendAdminFile(), getAdminChatUnreadCount(), markAdminMessagesRead()
        │   └── reports.ts          # getPartnerReport(), downloadPartnerReportPDF(), getAdminReport(), downloadAdminReportPDF()
        ├── context/
        │   ├── AuthContext.tsx      # AuthProvider: partner state, login/register/logout/refreshAuth, isAdmin
        │   └── ToastContext.tsx     # ToastProvider: toast-уведомления
        ├── hooks/
        │   ├── useAuth.ts          # Custom hook для доступа к AuthContext
        │   ├── useToast.ts         # Custom hook для доступа к ToastContext
        │   └── useApi.ts           # Обобщённый hook для API-запросов
        ├── components/
        │   ├── Layout.tsx          # Sidebar (навигация партнёра + пункты «Отчёты», «Выплаты», «Чат» с badge), Header с NotificationBell, Content
        │   ├── Layout.css          # Стили Layout: sidebar, header, responsive
        │   ├── AdminLayout.tsx     # Sidebar (навигация админа: Обзор, Заявки с badge, Партнёры, Отчёты, Запросы на выплату с badge, Чат с badge, Уведомления, B24 Transfer Lead)
        │   ├── DateRangePicker.tsx # Компонент выбора периода (два input[date] + пресеты: Сегодня, Неделя, Месяц, Квартал, Год, Всё время)
        │   ├── ProtectedRoute.tsx   # Редирект на /login если не аутентифицирован
        │   ├── AdminProtectedRoute.tsx # Проверка isAdmin, редирект на /dashboard если не админ
        │   ├── NotificationBell.tsx # Колокольчик с badge, выпадающий список, поллинг каждые 30 сек
        │   ├── QRCodeBlock.tsx     # QR-код для ссылки (QRCodeCanvas + QRCodeSVG), кнопки «Скачать PNG» / «Скачать SVG»
        │   ├── LinkGenerator.tsx    # Embed-код с копированием
        │   ├── CrmForm.tsx          # Форма добавления клиента
        │   ├── ClientsTable.tsx     # Таблица клиентов с пагинацией и колонкой «Статус сделки»
        │   ├── StatsCard.tsx        # Карточка метрики
        │   ├── ClickChart.tsx       # Recharts AreaChart кликов
        │   └── BitrixStats.tsx      # Данные Bitrix24: конверсия, статус-бейджи
        └── pages/
            ├── LoginPage.tsx        # Форма входа (редирект admin → /admin, partner → /dashboard)
            ├── RegisterPage.tsx     # Форма регистрации
            ├── LinksPage.tsx        # Список ссылок + кнопка QR (модалка) + UTM-метки в форме создания
            ├── LinkDetailPage.tsx   # Детали ссылки + QR-код + UTM-метки (отображение/редактирование)
            ├── ClientsPage.tsx      # Страница клиентов
            ├── LandingsPage.tsx     # Список лендингов
            ├── LandingEditorPage.tsx # Редактор лендинга
            ├── DashboardPage.tsx    # Дашборд: метрики, график кликов
            ├── AnalyticsPage.tsx    # Детальная аналитика
            ├── ReportsPage.tsx      # Отчёт партнёра: DateRangePicker, StatsCard-метрики, таблица клиентов, скачать PDF
            ├── PaymentRequestsPage.tsx # Запросы партнёра на выплату: таблица + модалка с выбором клиентов
            ├── ChatPage.tsx         # Чат партнёра с поддержкой: пузыри сообщений, ввод, авто-скролл, поллинг 30с
            ├── BitrixSettingsPage.tsx # Настройки Bitrix24
            ├── NotFoundPage.tsx     # Страница 404
            └── admin/
                ├── AdminDashboardPage.tsx    # Обзорная статистика по всем партнёрам + таблица
                ├── AdminPartnersPage.tsx     # Полная таблица всех партнёров с детализацией
                ├── AdminPartnerDetailPage.tsx # Детальная информация об одном партнёре (ссылки, клиенты)
                ├── AdminNotificationsPage.tsx # Создание и управление уведомлениями для партнёров
                ├── AdminReportsPage.tsx      # Сводный отчёт админа: DateRangePicker, выбор партнёра, StatsCard-метрики, таблица по партнёрам, скачать PDF
                ├── AdminRegistrationsPage.tsx    # Управление заявками на регистрацию: таблица pending-заявок, одобрение/отклонение с причиной
                ├── AdminPaymentRequestsPage.tsx # Управление запросами на выплату: таблица, фильтр по статусу, одобрение/отклонение
                ├── AdminChatPage.tsx         # Двухпанельный чат админа: список переписок слева, сообщения справа, поллинг 30с
                └── AdminB24Page.tsx          # B24 Transfer Lead в iframe внутри админ-панели
```

## Модели данных

### Partner (partners)
Партнёр или администратор системы. Поля: email, password_hash, name, company, partner_code (uuid[:8]), role ("partner" | "admin"), is_active, approval_status ("pending" | "approved" | "rejected"), rejection_reason (nullable), reward_percentage (nullable, индивидуальный % вознаграждения), payment_details (JSON-массив сохранённых способов оплаты: [{id, label, value}], свойство saved_payment_methods), workflow_id, b24_api_token.
Связи: links (1:N), clients (1:N), landings (1:N).

### PartnerLink (partner_links)
Партнёрская ссылка. Типы: direct, iframe, landing. Поля: title, link_type, link_code (uuid[:10]), target_url, landing_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term.
Связи: partner (N:1), clicks (1:N), clients (1:N), landing (N:1).

### LinkClick (link_clicks)
Клик по ссылке. Поля: link_id, ip_address, user_agent, referer.
Связи: link (N:1).

### Client (clients)
Клиент партнёра. Источник: form или manual. Поля: name, phone, email, company, comment, external_id, webhook_sent, deal_amount, partner_reward, is_paid, paid_at, payment_comment, deal_id (ID сделки в Bitrix24), deal_status, deal_status_name.
Связи: partner (N:1), link (N:1).

### LandingPage (landing_pages)
Лендинг партнёра. Поля: title, description, header_text, button_text, theme_color, is_active.
Связи: partner (N:1), images (1:N cascade), links (1:N).

### LandingImage (landing_images)
Изображение лендинга. Поля: landing_id, file_path, sort_order.
Связи: landing (N:1, ondelete CASCADE).

### Notification (notifications)
Уведомление от администратора. Поля: title, message, created_by (FK partners.id), target_partner_id (FK partners.id, nullable — если NULL, broadcast всем; если задан, только конкретному партнёру), file_path (String(500), nullable — относительный путь к файлу в uploads/notifications/), file_name (String(255), nullable — оригинальное имя файла), created_at. Допустимые форматы файлов: jpg, jpeg, png, gif, webp, mp4, mov, avi, pdf, doc, docx, xls, xlsx, csv, txt. Макс. размер: 50 МБ.

### NotificationRead (notification_reads)
Запись о прочтении уведомления. Поля: notification_id (FK notifications.id, CASCADE), partner_id (FK partners.id), read_at.

### PaymentRequest (payment_requests)
Запрос партнёра на выплату вознаграждения. Поля: partner_id (FK partners.id), status ("pending" | "approved" | "rejected" | "paid"), total_amount, client_ids (JSON-массив ID клиентов), comment (партнёра), payment_details (реквизиты для выплаты), admin_comment, created_at, processed_at, processed_by (FK partners.id, nullable). Жизненный цикл: pending → approved → paid (или pending → rejected). При approved клиенты НЕ помечаются оплаченными; при paid — is_paid=True, paid_at=now.

### ChatMessage (chat_messages)
Сообщение в чате между партнёром и админом. Поля: partner_id (FK partners.id — к какому партнёру относится переписка), sender_id (FK partners.id — кто отправил), message (Text), file_path (String(500), nullable — относительный путь к файлу в uploads/), file_name (String(255), nullable — оригинальное имя файла), is_read (Boolean, default False), created_at. Индекс по partner_id. Группировка по partner_id даёт одну беседу на партнёра. Файлы сохраняются в uploads/chat/{partner_id}/{uuid}.{ext}.

## API эндпоинты

### Аутентификация
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| POST   | /api/auth/register                    | Регистрация партнёра                  | Нет  |
| POST   | /api/auth/login                       | Логин, получение JWT-токенов          | Нет  |
| POST   | /api/auth/refresh                     | Обновление access token               | Нет  |
| GET    | /api/auth/me                          | Текущий партнёр (с полем role, saved_payment_methods) | Да   |
| POST   | /api/auth/payment-methods             | Добавить сохранённый способ оплаты    | Да   |
| DELETE | /api/auth/payment-methods/{id}        | Удалить сохранённый способ оплаты     | Да   |

### Ссылки
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/links/                           | Список ссылок партнёра                | Да   |
| POST   | /api/links/                           | Создание ссылки (с UTM-полями)        | Да   |
| GET    | /api/links/{id}                       | Детали ссылки (с UTM-полями)          | Да   |
| PUT    | /api/links/{id}                       | Обновление ссылки (с UTM-полями)      | Да   |
| DELETE | /api/links/{id}                       | Деактивация ссылки                    | Да   |
| GET    | /api/links/{id}/embed-code            | Embed-код ссылки (с redirect_url_with_utm) | Да   |

### Лендинги
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/landings/                        | Список лендингов партнёра             | Да   |
| POST   | /api/landings/                        | Создание лендинга                     | Да   |
| GET    | /api/landings/{id}                    | Детали лендинга                       | Да   |
| PUT    | /api/landings/{id}                    | Обновление лендинга                   | Да   |
| DELETE | /api/landings/{id}                    | Деактивация лендинга                  | Да   |
| POST   | /api/landings/{id}/images             | Загрузка изображения                  | Да   |
| DELETE | /api/landings/{id}/images/{image_id}  | Удаление изображения                  | Да   |

### Клиенты
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/clients/                         | Список клиентов партнёра (пагинация)  | Да   |
| POST   | /api/clients/                         | Ручное создание клиента + webhook     | Да   |
| GET    | /api/clients/{id}                     | Детали клиента                        | Да   |

### Запросы на выплату (партнёр)
| Метод  | URL                                   | Описание                              | Auth    |
|--------|---------------------------------------|---------------------------------------|---------|
| POST   | /api/payment-requests/                | Создать запрос на выплату             | Partner |
| GET    | /api/payment-requests/                | Список своих запросов                 | Partner |
| GET    | /api/payment-requests/{id}            | Детали запроса                        | Partner |

### Аналитика
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/analytics/summary                | Общая статистика                      | Да   |
| GET    | /api/analytics/links                  | Статистика по каждой ссылке           | Да   |
| GET    | /api/analytics/links/{id}/clicks      | Клики по дням для ссылки              | Да   |
| GET    | /api/analytics/clients/stats          | Клиенты по дням                       | Да   |
| POST   | /api/analytics/bitrix/fetch           | Запрос данных из Bitrix24             | Да   |

### Bitrix24 настройки
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| POST   | /api/bitrix/setup                     | Первоначальная настройка Bitrix24     | Да   |
| GET    | /api/bitrix/settings                  | Получение настроек workflow            | Да   |
| PUT    | /api/bitrix/settings                  | Обновление настроек                    | Да   |
| GET    | /api/bitrix/funnels                   | Список воронок из Bitrix24            | Да   |
| GET    | /api/bitrix/stages                    | Список этапов воронки                  | Да   |
| GET    | /api/bitrix/lead-statuses             | Список статусов лидов                  | Да   |
| GET    | /api/bitrix/leads                     | Список лидов из b24-transfer-lead     | Да   |
| GET    | /api/bitrix/stats                     | Статистика конверсии                   | Да   |

### Отчёты (партнёр)
| Метод  | URL                                   | Описание                              | Auth    |
|--------|---------------------------------------|---------------------------------------|---------|
| GET    | /api/reports                          | JSON-отчёт партнёра за период         | Partner |
| GET    | /api/reports/pdf                      | Скачать PDF-отчёт партнёра            | Partner |

### Публичные
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/public/r/{code}                  | Публичный редирект + запись клика (с UTM-параметрами) | Нет  |
| GET    | /api/public/landing/{code}            | Публичная страница лендинга (Jinja2)  | Нет  |
| POST   | /api/public/form/{code}               | Приём формы лендинга, создание клиента| Нет  |
| POST   | /api/public/webhook/b24               | Прокси webhook из Bitrix24 в b24-transfer-lead + обновление deal_status + авто-расчёт deal_amount/partner_reward + уведомление с суммой и комиссией | Нет  |

### Админ-панель (требуют role=admin)
| Метод  | URL                                   | Описание                              | Auth   |
|--------|---------------------------------------|---------------------------------------|--------|
| GET    | /api/admin/registrations              | Список pending-заявок на регистрацию  | Admin  |
| GET    | /api/admin/registrations/count        | Количество pending-заявок (для badge) | Admin  |
| POST   | /api/admin/registrations/{id}/approve | Одобрить заявку на регистрацию        | Admin  |
| POST   | /api/admin/registrations/{id}/reject  | Отклонить заявку (с причиной)         | Admin  |
| GET    | /api/admin/overview                   | Агрегированная статистика             | Admin  |
| GET    | /api/admin/partners                   | Статистика по каждому партнёру        | Admin  |
| GET    | /api/admin/partners/{id}              | Детали одного партнёра                | Admin  |
| PUT    | /api/admin/clients/{id}/payment       | Обновить данные оплаты клиента        | Admin  |
| PUT    | /api/admin/clients/bulk-payment       | Массовое обновление оплаты клиентов   | Admin  |
| GET    | /api/admin/partners/{id}/payments     | Итоги выплат по партнёру              | Admin  |
| PUT    | /api/admin/partners/{id}/toggle-active | Переключить активность партнёра        | Admin  |
| PUT    | /api/admin/partners/{id}/reward-percentage | Установить индивидуальный % вознаграждения | Admin  |
| GET    | /api/admin/reward-percentage          | Получить глобальный % вознаграждения  | Admin  |
| PUT    | /api/admin/reward-percentage          | Изменить глобальный % вознаграждения  | Admin  |
| GET    | /api/admin/config                     | Конфиг (URL b24, default_reward_percentage) | Admin  |
| POST   | /api/admin/notifications              | Создать уведомление (multipart: Form title, message + File) | Admin  |
| GET    | /api/admin/notifications              | Все уведомления                       | Admin  |
| DELETE | /api/admin/notifications/{id}         | Удалить уведомление                   | Admin  |
| GET    | /api/admin/payment-requests           | Все запросы на выплату                | Admin  |
| GET    | /api/admin/payment-requests/{id}      | Детали запроса на выплату             | Admin  |
| PUT    | /api/admin/payment-requests/{id}      | Одобрить / Отклонить запрос           | Admin  |
| GET    | /api/admin/payment-requests/pending-count | Количество pending-запросов (для badge) | Admin  |
| GET    | /api/admin/reports                    | JSON сводный отчёт по всем/одному партнёру | Admin  |
| GET    | /api/admin/reports/pdf                | Скачать PDF сводный отчёт             | Admin  |

### Чат (партнёр)
| Метод  | URL                                   | Описание                              | Auth    |
|--------|---------------------------------------|---------------------------------------|---------|
| GET    | /api/chat/messages                    | Сообщения переписки партнёра          | Partner |
| POST   | /api/chat/messages                    | Отправить сообщение админу            | Partner |
| POST   | /api/chat/messages/file               | Отправить файл (multipart: file + message) | Partner |
| GET    | /api/chat/unread-count                | Непрочитанные (для badge)             | Partner |
| POST   | /api/chat/read                        | Пометить прочитанными                 | Partner |

### Чат (админ)
| Метод  | URL                                             | Описание                          | Auth  |
|--------|-------------------------------------------------|-----------------------------------|-------|
| GET    | /api/admin/chat/conversations                   | Список переписок                  | Admin |
| GET    | /api/admin/chat/conversations/{id}/messages      | Сообщения переписки               | Admin |
| POST   | /api/admin/chat/conversations/{id}/messages      | Ответить партнёру                 | Admin |
| POST   | /api/admin/chat/conversations/{id}/messages/file | Отправить файл партнёру (multipart) | Admin |
| GET    | /api/admin/chat/unread-count                    | Всего непрочитанных               | Admin |
| POST   | /api/admin/chat/conversations/{id}/read          | Пометить прочитанными             | Admin |

### Уведомления партнёра
| Метод  | URL                                   | Описание                              | Auth |
|--------|---------------------------------------|---------------------------------------|------|
| GET    | /api/notifications/                   | Уведомления с is_read (фильтрация по target_partner_id) | Да   |
| GET    | /api/notifications/unread-count       | Кол-во непрочитанных                  | Да   |
| POST   | /api/notifications/{id}/read          | Прочитать одно                        | Да   |
| POST   | /api/notifications/read-all           | Прочитать все                         | Да   |

## Маршруты фронтенда

| URL                       | Компонент                    | Layout       | Auth    |
|---------------------------|------------------------------|--------------|---------|
| /                         | → /dashboard                 | —            | —       |
| /login                    | LoginPage                    | Нет          | Нет     |
| /register                 | RegisterPage                 | Нет          | Нет     |
| /dashboard                | DashboardPage                | Layout       | Partner |
| /links                    | LinksPage                    | Layout       | Partner |
| /links/:id                | LinkDetailPage               | Layout       | Partner |
| /clients                  | ClientsPage                  | Layout       | Partner |
| /landings                 | LandingsPage                 | Layout       | Partner |
| /landings/:id/edit        | LandingEditorPage            | Layout       | Partner |
| /analytics                | AnalyticsPage                | Layout       | Partner |
| /reports                  | ReportsPage                  | Layout       | Partner |
| /payment-requests         | PaymentRequestsPage          | Layout       | Partner |
| /chat                     | ChatPage                     | Layout       | Partner |
| /bitrix-settings          | BitrixSettingsPage           | Layout       | Partner |
| /admin                    | AdminDashboardPage           | AdminLayout  | Admin   |
| /admin/registrations      | AdminRegistrationsPage       | AdminLayout  | Admin   |
| /admin/partners           | AdminPartnersPage            | AdminLayout  | Admin   |
| /admin/partners/:id       | AdminPartnerDetailPage       | AdminLayout  | Admin   |
| /admin/reports            | AdminReportsPage             | AdminLayout  | Admin   |
| /admin/payment-requests   | AdminPaymentRequestsPage     | AdminLayout  | Admin   |
| /admin/chat               | AdminChatPage                | AdminLayout  | Admin   |
| /admin/notifications      | AdminNotificationsPage       | AdminLayout  | Admin   |
| /admin/b24                | AdminB24Page                 | AdminLayout  | Admin   |
| *                         | NotFoundPage                 | Нет          | Нет     |

## Система ролей

- **partner** (по умолчанию) — доступ к партнёрскому кабинету
- **admin** — доступ к админ-панели, создаётся автоматически при старте из ADMIN_EMAIL/ADMIN_PASSWORD (env vars)

Проверка роли — через `get_admin_user()` dependency (403 если role != "admin").

## Система уведомлений

- In-app уведомления от админа для всех партнёров (broadcast) или для конкретного партнёра (targeted через target_partner_id)
- Таблица `notifications` — уведомления с опциональным target_partner_id, `notification_reads` — записи прочтения
- Если `target_partner_id` = NULL — broadcast всем партнёрам (текущее поведение)
- Если `target_partner_id` задан — уведомление видно только этому партнёру
- Партнёрский UI: колокольчик с badge (непрочитанные), поллинг каждые 30 сек
- Поддержка файлов: изображения, видео, документы (хранение в uploads/notifications/{uuid}.{ext})
- Админский UI: форма создания с file input + превью + список с удалением (📎 индикатор)
- Партнёрский UI (bell): изображения inline (thumbnail), видео/документы как ссылки
- Telegram-бот: скачивание файла через get_raw_bytes() + отправка send_photo/send_video/send_document

## Система запросов на выплату

- Партнёр выбирает клиентов с рассчитанным вознаграждением (partner_reward != NULL) и создаёт запрос на выплату
- Валидация: клиенты принадлежат партнёру, вознаграждение рассчитано, клиенты не в другом pending-запросе
- Сумма автоматически рассчитывается как сумма partner_reward выбранных клиентов
- Админ видит badge с количеством pending-запросов на пункте «Запросы на выплату» в сайдбаре (поллинг каждые 30 сек)
- Админ может одобрить или отклонить запрос с комментарием
- Двухэтапная выплата: при одобрении партнёр получает уведомление "одобрен, ожидайте 1-3 дня"; при переводе в статус "paid" клиенты помечаются оплаченными (is_paid=True), партнёр получает уведомление "выплата выполнена"
- При обработке запроса создаётся адресное уведомление для партнёра (через target_partner_id)

## Чат партнёр-админ

- У каждого партнёра — одна переписка с админом, группировка по partner_id в chat_messages
- Поддержка отправки файлов (изображения, документы) — допустимые форматы: jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, csv, txt; макс. 10 МБ
- Файлы сохраняются в uploads/chat/{partner_id}/{uuid}.{ext}, отдаются через /uploads/
- Партнёр: полноэкранный чат с пузырями (партнёр справа #1a73e8, админ слева #f1f3f4), ввод + отправка текста/файлов, авто-скролл, поллинг 30 сек
- Админ: двухпанельный layout — слева список переписок (имя, превью, badge), справа выбранная переписка с отправкой текста/файлов, поллинг 30 сек
- Telegram-бот: обработка фото и документов в ChatStates.active — скачивание из Telegram API, загрузка на backend через multipart
- Фронтенд: изображения показываются inline (max-width: 300px, кликабельные), документы — ссылкой на скачивание
- Badge в сайдбаре партнёра (Layout) — непрочитанные сообщения от админа
- Badge в сайдбаре админа (AdminLayout) — всего непрочитанных сообщений от партнёров
- Mark-read при открытии чата (партнёр) и при выборе переписки (админ)
- is_read отслеживается раздельно: для партнёра — сообщения от админа (sender_id != partner_id), для админа — сообщения от партнёра (sender_id == partner_id)

## Система отчётов (PDF)

- Генерация отчётов с ключевыми бизнес-метриками: лиды, сделки, конверсии (лиды→сделки, сделки→успешные), продажи, комиссия, выплаты, клики, запросы на выплату
- Партнёр: отчёт по себе за выбранный период (JSON + PDF)
- Админ: сводный отчёт по всем партнёрам или по конкретному (JSON + PDF)
- PDF-генерация через fpdf2 с DejaVu шрифтами (Unicode/русский текст)
- Dockerfile устанавливает `fonts-dejavu-core` для доступа к шрифтам в контейнере
- Структура PDF: заголовок, период, блок метрик (таблица 2 колонки), таблица клиентов/партнёров
- `report_service.py` — агрегация данных из Client, LinkClick, PaymentRequest
- `pdf_service.py` — генерация PDF с таблицами через `table()` context manager fpdf2
- Лиды в работе: deal_status NOT IN ('WON', 'LOSE', 'C:WON', 'C:LOSE') OR deal_status IS NULL
- Конверсия лиды → сделки: клиенты с deal_status != NULL или deal_amount > 0 / total_leads
- Конверсия сделки → успешные: клиенты с deal_status IN ('WON', 'C:WON') / total_deals
- Метрики конверсии: total_deals, total_successful_deals, total_lost_deals, conversion_leads_to_deals (%), conversion_deals_to_successful (%)
- Компонент DateRangePicker: два input[date] + пресеты (Сегодня, Неделя, Месяц, Квартал, Год, Всё время)

## QR-коды

- Генерация QR-кодов полностью на фронтенде (библиотека qrcode.react)
- QR-код кодирует URL `/api/public/r/{link_code}` (полный URL с origin)
- Компонент QRCodeBlock: QRCodeCanvas для отображения, QRCodeSVG для экспорта
- Кнопки «Скачать PNG» и «Скачать SVG»
- Доступен на странице деталей ссылки (LinkDetailPage) и через кнопку «QR» в таблице ссылок (LinksPage, модалка)

## UTM-метки

- 5 опциональных UTM-полей на PartnerLink: utm_source, utm_medium, utm_campaign, utm_content, utm_term
- Задаются при создании/редактировании ссылки
- При redirect через `/api/public/r/{code}` UTM-параметры автоматически добавляются к target_url
- EmbedCodeResponse включает redirect_url_with_utm с полным URL включая UTM-параметры
- Хелпер `_build_url_with_utm()` корректно мержит UTM с существующими query-параметрами URL

## Инфраструктура

- **docker-compose.dev.yml** — четыре сервиса (b24-service, b24-frontend, backend, frontend) в одной сети
- **b24-service:** b24-transfer-lead API, порт 7860 (только внутри docker-сети), volume b24-data для SQLite и workflows
- **b24-frontend:** b24-transfer-lead UI (Vite dev server), порт 3000 (только внутри docker-сети), base=/b24/, проксируется через frontend Vite
- **Backend:** порт 8003, volume ./backend:/app и ./data:/app/data, depends_on b24-service
  - Env: DATABASE_URL, SECRET_KEY, CORS_ORIGINS, B24_SERVICE_URL, B24_INTERNAL_API_KEY, B24_WEBHOOK_URL, B24_ENTITY_TYPE, B24_DEAL_CATEGORY_ID, B24_DEAL_STAGE_ID, B24_LEAD_STATUS_ID, B24_FIELD_MAPPINGS, DEFAULT_REWARD_PERCENTAGE, ADMIN_EMAIL, ADMIN_PASSWORD, B24_SERVICE_FRONTEND_URL
- **Frontend:** порт 5173, proxy /api → backend:8003, depends_on backend
- **SQLite:** файл data/app.db, персистентность через Docker volume
- **Uploads:** директория backend/uploads для загруженных изображений лендингов

## Система одобрения регистрации

- При регистрации партнёр создаётся с `is_active=False`, `approval_status="pending"` — без доступа к системе
- Админ видит заявки в разделе «Заявки» в сайдбаре с badge (количество pending), поллинг каждые 30 сек
- Одобрение: `approval_status="approved"`, `is_active=True`, создание B24 workflow
- Отклонение: `approval_status="rejected"`, сохранение причины в `rejection_reason`
- При попытке входа: pending → сообщение "ожидает рассмотрения", rejected → сообщение с причиной, is_active=False → "деактивирован"
- Существующие партнёры при миграции получают `approval_status="approved"` автоматически

## Интеграция с b24-transfer-lead

```
Partner Cabinet (backend:8000)  --HTTP-->  b24-transfer-lead (b24-service:7860)  --API-->  Bitrix24
       │                                           │
   Partner model                            Workflow per partner
   (workflow_id, b24_api_token)             (leads DB, webhooks, stats)
```

- Сервис-к-сервису: заголовок `X-Internal-API-Key` (bypass сессионной auth в b24-transfer-lead)
- При одобрении регистрации партнёра автоматически создаётся workflow с настройками из env:
  - `B24_WEBHOOK_URL` — единый webhook URL для всех партнёров
  - `B24_ENTITY_TYPE` — тип сущности (lead/deal)
  - `B24_DEAL_CATEGORY_ID`, `B24_DEAL_STAGE_ID`, `B24_LEAD_STATUS_ID` — параметры создания
  - `B24_FIELD_MAPPINGS` — JSON-массив маппинга полей (field_name → bitrix24_field_id)
- Клиенты передаются как лиды/сделки через API b24-transfer-lead
- Статистика и конверсия получаются через API b24-transfer-lead
- `B24IntegrationService` (`b24_integration_service.py`) — HTTP-клиент (httpx, таймаут 120s для создания лидов) для всех операций
- Ссылка на UI b24-transfer-lead доступна в админ-панели (B24_SERVICE_FRONTEND_URL)

## Telegram-бот для партнёров

Telegram-бот — чистый API-клиент на aiogram 3.x, вызывает те же REST-эндпоинты, что и React-фронтенд. Отдельный Docker-сервис, без прямого доступа к БД.

```
Telegram API  <-->  telegram-bot (aiogram 3.x)  --HTTP/JWT-->  backend:8003
```

### Стек: Python 3.11, aiogram 3.25, httpx, pydantic-settings, qrcode[pil]

### Структура telegram_bot/

```
telegram_bot/
├── Dockerfile                     # python:3.11-slim, pip install, CMD python -m bot.main
├── requirements.txt               # aiogram, httpx, pydantic, pydantic-settings
├── bot/
│   ├── __init__.py
│   ├── main.py                    # Entry point: Bot + Dispatcher + polling + фоновый poller уведомлений
│   ├── config.py                  # Settings (TELEGRAM_BOT_TOKEN, BACKEND_URL, NOTIFICATION_POLL_INTERVAL)
│   ├── api_client/
│   │   ├── __init__.py
│   │   ├── base.py                # httpx AsyncClient с JWT auth + auto-refresh на 401, get_bytes() для PDF, post_file() для multipart upload, get_raw_bytes() для загрузки файлов с root URL
│   │   ├── auth.py                # login(), get_me()
│   │   ├── analytics.py           # get_summary(), get_links_stats()
│   │   ├── links.py               # get_links(), get_link(), create_link()
│   │   ├── clients.py             # get_clients(), get_client(), create_client()
│   │   ├── reports.py             # get_report(), get_report_pdf() (bytes)
│   │   ├── payment_requests.py    # get_payment_requests(), get_payment_request(), create_payment_request()
│   │   ├── chat.py                # get_messages(), send_message(), send_file(), get_unread_count(), mark_read()
│   │   └── notifications.py       # get_notifications(), get_unread_count(), mark_as_read(), mark_all_as_read()
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── start.py               # /start, /help, /cancel
│   │   ├── auth.py                # /login (FSM: email → password), /logout
│   │   ├── dashboard.py           # Кнопка «Дашборд» — метрики из /api/analytics/summary
│   │   ├── analytics.py           # Кнопка «Аналитика» — расширенная аналитика
│   │   ├── links.py               # Кнопка «Ссылки» — список, детали, QR-код (генерация PNG через qrcode), создание (FSM: title → type → url → utm → confirm)
│   │   ├── clients.py             # Кнопка «Клиенты» — список, детали, создание (FSM: name → phone → email → company → comment → confirm)
│   │   ├── reports.py             # Кнопка «Отчёты» — пресеты периодов, кастомные даты FSM, метрики, PDF-скачивание
│   │   ├── payment_requests.py    # Кнопка «Выплаты» — список, создание (FSM: выбор клиентов → реквизиты → комментарий → confirm)
│   │   ├── chat.py                # Кнопка «Чат» — просмотр, отправка текста и файлов (фото/документ), mark_read
│   │   ├── notifications.py       # Кнопка «Уведомления» — список, детали, mark_read, mark_all
│   │   └── profile.py             # Кнопка «Профиль» — инфо, добавление/удаление способов оплаты (FSM)
│   ├── keyboards/
│   │   ├── __init__.py
│   │   ├── main_menu.py           # ReplyKeyboard: Дашборд, Ссылки, Клиенты, Аналитика, Отчёты, Выплаты, Чат, Уведомления, Профиль
│   │   ├── inline.py              # InlineKeyboard builders: списки с пагинацией, link_detail_keyboard (QR-код), выбор клиентов, способы оплаты, подтверждение, пропуск
│   │   └── callbacks.py           # CallbackData-классы: MenuCB, PaginationCB, LinkCB, ClientCB, PaymentCB, ReportCB, ChatCB, NotifCB, ProfileCB, ClientSelectCB, PayMethodCB, ConfirmCB
│   ├── states/
│   │   ├── __init__.py
│   │   ├── auth.py                # LoginStates (email, password)
│   │   ├── link.py                # CreateLinkStates (title, link_type, target_url, utm_source, utm_medium, utm_campaign, confirm)
│   │   ├── client.py              # CreateClientStates (name, phone, email, company, comment, link_id, confirm)
│   │   ├── payment_request.py     # CreatePaymentStates (select_clients, select_payment_method, new_payment_label, new_payment_value, comment, confirm)
│   │   ├── report.py              # ReportStates (date_from, date_to)
│   │   └── chat.py                # ChatStates (composing)
│   ├── middlewares/
│   │   ├── __init__.py
│   │   └── auth.py                # AuthMiddleware: проверка сессии, инъекция api_client + session в data хендлера
│   ├── services/
│   │   ├── __init__.py
│   │   ├── session_manager.py     # In-memory dict[telegram_user_id → UserSession] (access_token, refresh_token, partner_id, partner_name, partner_email)
│   │   └── notification_poller.py # Фоновый asyncio task: поллинг unread notifications + chat, push в Telegram при увеличении счётчика
│   └── utils/
│       ├── __init__.py
│       ├── formatters.py          # Форматирование API-данных в HTML-сообщения: dashboard, link, client, analytics, report, payment_request, notification, chat, profile; get_notification_file_type() (image/video/document)
│       └── pagination.py          # Хелпер пагинации
```

### Docker-интеграция

- Сервис `telegram-bot` в docker-compose.dev.yml
- Env: `TELEGRAM_BOT_TOKEN`, `BACKEND_URL=http://backend:8003`, `NOTIFICATION_POLL_INTERVAL` (default 60)
- depends_on: backend, restart: unless-stopped
- Volume: ./telegram_bot:/app (hot-reload при разработке)

### Архитектурные решения

- **Чистый API-клиент**: вся бизнес-логика в backend, бот только вызывает REST API
- **JWT авторизация**: при /login бот получает access+refresh токены, хранит in-memory по telegram_user_id
- **Auto-refresh**: при 401 автоматически обновляет токен через POST /api/auth/refresh
- **FSM (Finite State Machine)**: aiogram StatesGroup для многошаговых потоков (создание ссылки, клиента, запроса на выплату, отчёта)
- **CallbackData**: type-safe маршрутизация inline-кнопок через aiogram CallbackData классы с prefix
- **Auth middleware**: на всех protected роутерах проверяет сессию, инъектирует api_client + session
- **Фоновый поллинг**: asyncio.create_task для периодической проверки новых уведомлений и сообщений чата
- **Пагинация**: inline-клавиатуры с навигацией ⬅️/➡️ для всех списков
