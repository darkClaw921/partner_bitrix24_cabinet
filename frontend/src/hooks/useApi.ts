import { useState, useCallback } from 'react'
import axios from 'axios'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (apiCall: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

function formatError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const detail = e.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (e.response?.status === 403) return 'Доступ запрещён'
    if (e.response?.status === 404) return 'Не найдено'
    if (e.response?.status === 500) return 'Внутренняя ошибка сервера'
    if (!e.response) return 'Ошибка соединения'
  }
  if (e instanceof Error) return e.message
  return 'Неизвестная ошибка'
}

export function useApi<T>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    setState({ data: null, loading: true, error: null })
    try {
      const data = await apiCall()
      setState({ data, loading: false, error: null })
      return data
    } catch (e) {
      const error = formatError(e)
      setState({ data: null, loading: false, error })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}
