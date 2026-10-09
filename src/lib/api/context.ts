interface RequestContext {
  businessId: string | number | null
  branchId: string | number | null
}

const context: RequestContext = {
  businessId: null,
  branchId: null,
}

export function setRequestContext(next: Partial<RequestContext>): void {
  if ('businessId' in next) context.businessId = next.businessId ?? null
  if ('branchId' in next) context.branchId = next.branchId ?? null
}

export function getRequestContext(): Readonly<RequestContext> {
  return context
}

export function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
