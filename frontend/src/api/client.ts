import axios from 'axios'
import { getGlobalShowToast } from '@/context/ToastContext'

function formatApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Неизвестная ошибка'
  if (!error.response) return 'Ошибка соединения'
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  switch (error.response.status) {
    case 403: return 'Доступ запрещён'
    case 404: return 'Не найдено'
    case 500: return 'Внутренняя ошибка сервера'
    default: return `Ошибка: ${error.response.status}`
  }
}

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post('/api/auth/refresh', {
          refresh_token: refreshToken,
        })
        const { access_token } = response.data
        localStorage.setItem('accessToken', access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    // Show toast for non-401 errors (401 is handled above)
    if (error.response?.status !== 401) {
      const toast = getGlobalShowToast()
      if (toast) toast(formatApiError(error), 'error')
    }

    return Promise.reject(error)
  },
)

export default apiClient
