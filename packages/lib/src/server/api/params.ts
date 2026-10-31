// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const API_PARAMS = {
    id: { alias: null, multi: false },
    field: { alias: 'f', multi: true },
    output: { alias: 'o', multi: false },
    query: { alias: 'q', multi: false },
    page: { alias: 'p', multi: false },
    limit: { alias: 'n', multi: false },
    checksum: { alias: 'c', multi: false }
} as const;

export type ApiParam = keyof typeof API_PARAMS;
export const RESUME_FILE_OUTPUTS = [
    'pdf',
    'sha256',
    'sha512',
    'md5',
    'b2',
    'asc',
    'sig',
    'zip'
] as const;
export type ResumeFileOutput = (typeof RESUME_FILE_OUTPUTS)[number];
export type ApiOutput = 'json' | 'md' | 'txt' | ResumeFileOutput;

export class ApiRequestError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: string;

    constructor(status: number, code: string, message: string, details?: string) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const NAME_BY_KEY = new Map<string, ApiParam>(
    Object.entries(API_PARAMS).flatMap(([name, spec]) => [
        [name, name as ApiParam],
        ...(spec.alias ? [[spec.alias, name as ApiParam] as const] : [])
    ])
);

function label(name: ApiParam) {
    const alias = API_PARAMS[name].alias;
    return alias ? `${name}/${alias}` : name;
}

export interface ApiParams {
    has(name: ApiParam): boolean;
    get(name: ApiParam): string | undefined;
    getAll(name: ApiParam): string[];
}

export function parseApiParams(url: URL, allowed: readonly ApiParam[]): ApiParams {
    const values = new Map<ApiParam, string[]>();
    const usedKeys = new Map<ApiParam, Set<string>>();

    for (const [key, raw] of url.searchParams) {
        const name = NAME_BY_KEY.get(key);
        if (!name || !allowed.includes(name))
            throw new ApiRequestError(
                400,
                'UNKNOWN_PARAMETER',
                'The request includes a parameter this endpoint does not accept.',
                `Unknown parameter '${key}'. Accepted: ${allowed.map(label).join(', ') || 'none'}.`
            );
        const keys = usedKeys.get(name) ?? new Set<string>();
        keys.add(key);
        usedKeys.set(name, keys);
        if (keys.size > 1)
            throw new ApiRequestError(
                400,
                'PARAM_CONFLICT',
                'A parameter was given under both its full name and its alias.',
                `Use either '${name}' or '${API_PARAMS[name].alias}', not both.`
            );
        const list = values.get(name) ?? [];
        if (API_PARAMS[name].multi) {
            list.push(
                ...raw
                    .split(',')
                    .map(part => part.trim().toLowerCase())
                    .filter(Boolean)
            );
        } else {
            if (list.length)
                throw new ApiRequestError(
                    400,
                    'PARAM_CONFLICT',
                    'A single-value parameter was given more than once.',
                    `'${key}' accepts one value.`
                );
            list.push(raw.trim());
        }
        values.set(name, list);
    }

    return {
        has: name => values.has(name),
        get: name => values.get(name)?.[0],
        getAll: name => [...new Set(values.get(name) ?? [])]
    };
}

export function resolveOutput(
    params: ApiParams,
    request: Request,
    supported: readonly ApiOutput[],
    fallback: ApiOutput
): ApiOutput {
    const requested = params.get('output')?.toLowerCase();
    if (requested !== undefined) {
        if ((supported as readonly string[]).includes(requested)) return requested as ApiOutput;
        throw new ApiRequestError(
            400,
            'OUTPUT_UNSUPPORTED',
            'This endpoint cannot produce the requested output.',
            `Supported output values: ${supported.join(', ')}.`
        );
    }
    const accept = request.headers.get('accept')?.toLowerCase() ?? '';
    if (supported.includes('md') && /text\/(x-)?markdown/.test(accept)) return 'md';
    if (supported.includes('txt') && accept.includes('text/plain')) return 'txt';
    if (supported.includes('json') && accept.includes('application/json')) return 'json';
    return fallback;
}

export function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
    if (value === undefined || !/^\d+$/.test(value)) return fallback;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) return fallback;
    return Math.min(number, max);
}

export function parseBoolean(params: ApiParams, name: ApiParam, fallback: boolean) {
    const value = params.get(name)?.toLowerCase();
    if (value === undefined) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new ApiRequestError(
        400,
        'PARAM_INVALID',
        'A parameter has an invalid value.',
        `'${label(name)}' must be true or false.`
    );
}
