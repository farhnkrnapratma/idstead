// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function apiError(status: number, code: string, message: string, details?: string) {
    return Response.json({ code, message, ...(details ? { details } : {}) }, { status });
}
