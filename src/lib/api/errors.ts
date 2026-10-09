import { AxiosError } from 'axios'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly errors?: Record<string, string[]>
  readonly requestId?: string

  constructor(params: {
    message: string
    status?: number
    code?: string
    errors?: Record<string, string[]>
    requestId?: string
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status ?? 0
    this.code = params.code
    this.errors = params.errors
    this.requestId = params.requestId
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isValidationError(): boolean {
    return this.status === 422 && !!this.errors
  }

  get firstError(): string | undefined {
    if (!this.errors) return undefined
    const first = Object.values(this.errors)[0]
    return first?.[0]
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof AxiosError) {
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED'
      return new ApiError({
        message: isTimeout
          ? 'The request timed out. Please try again.'
          : 'Unable to reach the server. Check your connection.',
        status: 0,
        code: error.code,
      })
    }

    const body = (error.response.data ?? {}) as ApiErrorBody
    return new ApiError({
      message:
        body.message ??
        error.response.statusText ??
        'Something went wrong while processing the request.',
      status: error.response.status,
      code: body.code,
      errors: body.errors,
      requestId: body.request_id ?? error.response.headers?.['x-request-id'],
    })
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message })
  }

  return new ApiError({ message: 'An unexpected error occurred.' })
}
