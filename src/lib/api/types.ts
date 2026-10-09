export interface ApiEnvelope<T> {
  data: T
  message?: string
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
  links?: PaginationLinks
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number | null
  to?: number | null
}

export interface PaginationLinks {
  first?: string | null
  last?: string | null
  prev?: string | null
  next?: string | null
}

export type SortDirection = 'asc' | 'desc'

export interface ListQuery {
  page?: number
  per_page?: number
  search?: string
  sort?: string
  direction?: SortDirection
  [key: string]: string | number | boolean | undefined
}

export interface ApiErrorBody {
  message?: string
  code?: string
  errors?: Record<string, string[]>
  request_id?: string
}
