import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminProtectedRoute from '@/components/AdminProtectedRoute'
import Layout from '@/components/Layout'
import AdminLayout from '@/components/AdminLayout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import LinksPage from '@/pages/LinksPage'
import LinkDetailPage from '@/pages/LinkDetailPage'
import LandingsPage from '@/pages/LandingsPage'
import LandingEditorPage from '@/pages/LandingEditorPage'
import ClientsPage from '@/pages/ClientsPage'
import DashboardPage from '@/pages/DashboardPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import BitrixSettingsPage from '@/pages/BitrixSettingsPage'
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminPartnersPage from '@/pages/admin/AdminPartnersPage'
import AdminPartnerDetailPage from '@/pages/admin/AdminPartnerDetailPage'
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage'
import AdminB24Page from '@/pages/admin/AdminB24Page'
import AdminPaymentRequestsPage from '@/pages/admin/AdminPaymentRequestsPage'
import PaymentRequestsPage from '@/pages/PaymentRequestsPage'
import ReportsPage from '@/pages/ReportsPage'
import AdminReportsPage from '@/pages/admin/AdminReportsPage'
import ChatPage from '@/pages/ChatPage'
import AdminChatPage from '@/pages/admin/AdminChatPage'
import NotFoundPage from '@/pages/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Admin routes */}
            <Route element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/partners" element={<AdminPartnersPage />} />
              <Route path="/admin/partners/:id" element={<AdminPartnerDetailPage />} />
              <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/payment-requests" element={<AdminPaymentRequestsPage />} />
              <Route path="/admin/b24" element={<AdminB24Page />} />
              <Route path="/admin/chat" element={<AdminChatPage />} />
            </Route>

            {/* Protected routes with Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/links" element={<LinksPage />} />
              <Route path="/links/:id" element={<LinkDetailPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/landings" element={<LandingsPage />} />
              <Route path="/landings/:id/edit" element={<LandingEditorPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/payment-requests" element={<PaymentRequestsPage />} />
              <Route path="/bitrix-settings" element={<BitrixSettingsPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
