export function apiError(status: number, code: string, message: string, details?: string) {
    return Response.json({ code, message, ...(details ? { details } : {}) }, { status });
}
