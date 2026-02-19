import { useState, useCallback, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getPendingCount } from '@/api/paymentRequests'
import { getAdminChatUnreadCount } from '@/api/chat'
import './Layout.css'

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Обзор', icon: DashboardIcon, end: true },
  { to: '/admin/partners', label: 'Партнёры', icon: UsersIcon },
  { to: '/admin/reports', label: 'Отчёты', icon: ReportIcon },
  { to: '/admin/payment-requests', label: 'Запросы на выплату', icon: WalletIcon, badge: 'payment' as const },
  { to: '/admin/chat', label: 'Чат', icon: ChatIcon, badge: 'chat' as const },
  { to: '/admin/notifications', label: 'Уведомления', icon: BellIcon },
  { to: '/admin/b24', label: 'B24 Transfer Lead', icon: ExternalIcon },
]

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Панель администратора',
  '/admin/partners': 'Партнёры',
  '/admin/reports': 'Отчёты',
  '/admin/payment-requests': 'Запросы на выплату',
  '/admin/chat': 'Чат с партнёрами',
  '/admin/notifications': 'Уведомления',
  '/admin/b24': 'B24 Transfer Lead',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/admin/partners/')) return 'Детали партнёра'
  return 'Администрирование'
}

export default function AdminLayout() {
  const { partner, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingBadge, setPendingBadge] = useState(0)
  const [chatBadge, setChatBadge] = useState(0)

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const handleNavClick = useCallback(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const [pending, chat] = await Promise.all([
          getPendingCount(),
          getAdminChatUnreadCount(),
        ])
        setPendingBadge(pending)
        setChatBadge(chat)
      } catch { /* ignore */ }
    }
    fetchBadges()
    const interval = setInterval(fetchBadges, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="layout">
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} style={{ background: '#1a1a2e' }}>
        <div className="sidebar-logo">Админ-панель</div>

        <nav className="sidebar-nav">
          {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={handleNavClick}
              style={{ position: 'relative' }}
            >
              <Icon />
              {label}
              {badge === 'payment' && pendingBadge > 0 && (
                <span style={badgeStyle}>{pendingBadge}</span>
              )}
              {badge === 'chat' && chatBadge > 0 && (
                <span style={badgeStyle}>{chatBadge}</span>
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
          <span className="header-user">{partner?.name}</span>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const badgeStyle: React.CSSProperties = {
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

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
