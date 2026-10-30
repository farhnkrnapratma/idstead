import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import * as privateEnv from '$app/env/private';

export const ACCESS_HEADER = 'cf-access-jwt-assertion';
export const DEV_ADMIN_EMAIL = 'admin@localhost';

const TEAM_DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const AUDIENCE = /^[0-9a-f]{64}$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface AccessIdentity {
    email: string;
    subject: string;
    authTime: number;
}

export interface AccessConfig {
    teamDomain: string;
    audience: string;
    adminEmails: string[];
}

export interface AccessOptions {
    dev?: boolean;
    keys?: JWTVerifyGetKey;
    now?: number;
}

function setting(platform: unknown, name: string): string {
    const value =
        (platform as { env?: Record<string, unknown> } | undefined)?.env?.[name]
        ?? (privateEnv as Record<string, string | undefined>)[name]
        ?? process.env[name];
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTeamDomain(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/^https:\/\//, '')
        .replace(/\/+$/, '');
}

export function accessConfig(platform?: unknown): AccessConfig | null {
    const teamDomain = normalizeTeamDomain(setting(platform, 'ACCESS_TEAM_DOMAIN'));
    const audience = setting(platform, 'ACCESS_AUD').toLowerCase();
    if (!TEAM_DOMAIN.test(teamDomain) || !AUDIENCE.test(audience)) return null;
    const adminEmails = setting(platform, 'ADMIN_EMAILS')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);
    return { teamDomain, audience, adminEmails };
}

export function accessConfigured(platform?: unknown): boolean {
    return accessConfig(platform) !== null;
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

function teamKeys(teamDomain: string): JWTVerifyGetKey {
    let keys = remoteKeys.get(teamDomain);
    if (!keys) {
        keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
        remoteKeys.set(teamDomain, keys);
    }
    return keys;
}

export async function verifyAccessToken(
    token: string,
    config: AccessConfig,
    options: AccessOptions = {}
): Promise<AccessIdentity | null> {
    try {
        const { payload } = await jwtVerify(token, options.keys ?? teamKeys(config.teamDomain), {
            issuer: `https://${config.teamDomain}`,
            audience: config.audience,
            algorithms: ['RS256'],
            requiredClaims: ['exp', 'iat', 'sub'],
            currentDate: options.now === undefined ? undefined : new Date(options.now * 1000)
        });
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        if (!email || payload.type !== 'app') return null;
        if (config.adminEmails.length && !config.adminEmails.includes(email)) return null;
        return { email, subject: String(payload.sub), authTime: Number(payload.iat) };
    } catch {
        return null;
    }
}

function isLoopback(request: Request): boolean {
    try {
        return LOOPBACK.has(new URL(request.url).hostname);
    } catch {
        return false;
    }
}

export async function accessIdentity(
    request: Request,
    platform?: unknown,
    options: AccessOptions = {}
): Promise<AccessIdentity | null> {
    const config = accessConfig(platform);
    if (!config) {
        const dev = options.dev ?? import.meta.env.DEV === true;
        if (!dev || !isLoopback(request)) return null;
        const now = options.now ?? Math.floor(Date.now() / 1000);
        return { email: DEV_ADMIN_EMAIL, subject: 'dev', authTime: now };
    }
    const token = request.headers.get(ACCESS_HEADER)?.trim() ?? '';
    if (!token) return null;
    return verifyAccessToken(token, config, options);
}
