import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import { env } from '@/lib/env'
import { getToken } from '@/lib/auth-token'
import { getRequestContext, createClientRequestId } from './context'
import { normalizeError } from './errors'

export const AUTH_UNAUTHORIZED_EVENT = 'salesmgt:unauthorized'

export const client: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
  withCredentials: false,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const ctx = getRequestContext()
  if (ctx.businessId != null) config.headers['X-Business-Id'] = String(ctx.businessId)
  if (ctx.branchId != null) config.headers['X-Branch-Id'] = String(ctx.branchId)

  // Idempotency key for every outgoing mutation/request.
  if (!config.headers['X-Client-Request-Id']) {
    config.headers['X-Client-Request-Id'] = createClientRequestId()
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeError(error)
    if (normalized.status === 401) {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
    }
    return Promise.reject(normalized)
  },
)

async function request<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  try {
    const response: AxiosResponse<T> = await client.request<T>(config)
    return response.data
  } catch (error) {
    throw normalizeError(error)
  }
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),
}
