export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface APIError {
  error: {
    message: string
    code: number
    details?: Record<string, string>
  }
}

export interface SuccessResponse<T = unknown> {
  data: T
  message?: string
}

export interface EmptyResponse {
  message: string
}

export type SortOrder = 'asc' | 'desc'

export interface QueryParams {
  page?: number
  per_page?: number
  sort?: string
  order?: SortOrder
  search?: string
  [key: string]: string | number | boolean | undefined
}
