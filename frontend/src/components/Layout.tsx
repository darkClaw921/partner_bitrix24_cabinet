import { useState, useCallback, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getPartnerUnreadCount } from '@/api/chat'
import NotificationBell from '@/components/NotificationBell'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Дашборд', icon: HomeIcon },
  { to: '/links', label: 'Ссылки', icon: LinkIcon },
  { to: '/clients', label: 'Клиенты', icon: UsersIcon },
  { to: '/landings', label: 'Лендинги', icon: LayoutIcon },
  { to: '/analytics', label: 'Аналитика', icon: ChartIcon },
  { to: '/reports', label: 'Отчёты', icon: ReportIcon },
  { to: '/payment-requests', label: 'Выплаты', icon: WalletIcon },
  { to: '/chat', label: 'Чат', icon: ChatIcon },
  { to: '/bitrix-settings', label: 'Bitrix24', icon: SettingsIcon },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Дашборд',
  '/links': 'Ссылки',
  '/clients': 'Клиенты',
  '/landings': 'Лендинги',
  '/analytics': 'Аналитика',
  '/reports': 'Отчёты',
  '/payment-requests': 'Выплаты',
  '/chat': 'Чат с поддержкой',
  '/bitrix-settings': 'Настройки Bitrix24',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/links/')) return 'Детали ссылки'
  if (pathname.startsWith('/landings/') && pathname.endsWith('/edit')) return 'Редактор лендинга'
  return 'Партнёрский портал'
}

export default function Layout() {
  const { partner, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatBadge, setChatBadge] = useState(0)

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const handleNavClick = useCallback(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    const fetchChatUnread = async () => {
      try {
        const count = await getPartnerUnreadCount()
        setChatBadge(count)
      } catch { /* ignore */ }
    }
    fetchChatUnread()
    const interval = setInterval(fetchChatUnread, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="layout">
      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Логотип" className="sidebar-logo-img" />
          Партнёрский портал
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={handleNavClick}
              style={{ position: 'relative' }}
            >
              <Icon />
              {label}
              {to === '/chat' && chatBadge > 0 && (
                <span style={chatBadgeStyle}>{chatBadge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">{partner?.name || partner?.email}</div>
          <button className="sidebar-logout" onClick={logout}>
            <LogoutIcon />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="header-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </button>
            <span className="header-title">{getPageTitle(location.pathname)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />
            <span className="header-user">{partner?.name}</span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const chatBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: '#d93025',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '10px',
  minWidth: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 5px',
}

/* SVG Icons as components */

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
