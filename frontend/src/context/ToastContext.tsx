import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

// Global toast function for use outside React (e.g. axios interceptors)
let globalShowToast: ((message: string, type?: ToastType) => void) | null = null

export function getGlobalShowToast() {
  return globalShowToast
}

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextType | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 5000)
  }, [removeToast])

  useEffect(() => {
    globalShowToast = showToast
    return () => { globalShowToast = null }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
  error: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fcd34d', color: '#854d0e' },
  info: { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af' },
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const colors = TOAST_COLORS[toast.type]
  return (
    <div style={{
      pointerEvents: 'auto',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      color: colors.color,
      borderRadius: 8,
      padding: '12px 16px',
      minWidth: 280,
      maxWidth: 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: '0.875rem',
      animation: 'toast-in 0.3s ease',
    }}>
      <span>{toast.message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: colors.color,
          opacity: 0.6,
          cursor: 'pointer',
          fontSize: '1.125rem',
          lineHeight: 1,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        &times;
      </button>
    </div>
  )
}
