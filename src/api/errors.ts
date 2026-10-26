export type ValidationPayload = Record<string, string[]>

export const API_ERRORS = {
  400: { type: 'BadRequestException', message: 'Bad request.' },
  401: { type: 'AuthenticationException', message: 'Unauthenticated.' },
  404: { type: 'NotFoundException', message: 'Not found.' },
  419: { type: 'TokenMismatchException', message: 'CSRF token mismatch.' },
  422: { type: 'ValidationException', message: 'The given data was invalid.' },
} as const

export type ApiErrorStatus = keyof typeof API_ERRORS
export type ApiErrorType = (typeof API_ERRORS)[ApiErrorStatus]['type']

export type ApiErrorBody = {
  error: {
    type: ApiErrorType
    message: string
    payload?: ValidationPayload
  }
}

export function apiErrorBody(status: 422, payload: ValidationPayload, message?: string): ApiErrorBody
export function apiErrorBody(status: Exclude<ApiErrorStatus, 422>, message?: string): ApiErrorBody
export function apiErrorBody(
  status: ApiErrorStatus,
  payloadOrMessage?: ValidationPayload | string,
  message?: string,
): ApiErrorBody {
  const { type, message: defaultMessage } = API_ERRORS[status]
  if (status === 422) {
    return { error: { type, message: message ?? defaultMessage, payload: payloadOrMessage as ValidationPayload } }
  }
  return { error: { type, message: (payloadOrMessage as string | undefined) ?? defaultMessage } }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  const error = (value as ApiErrorBody | null)?.error
  return typeof error?.type === 'string' && typeof error.message === 'string'
}

export class ApiError extends Error {
  readonly status: number
  readonly type: ApiErrorType | 'UnknownError'
  readonly payload?: ValidationPayload

  constructor(status: number, body: unknown) {
    const error = isApiErrorBody(body) ? body.error : undefined
    super(error?.message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.type = error?.type ?? 'UnknownError'
    this.payload = error?.payload
  }

  static async fromResponse(response: Response) {
    const body = await response.json().catch(() => null)
    return new ApiError(response.status, body)
  }

  fieldError(field: string): string | undefined {
    return this.payload?.[field]?.[0]
  }
}
