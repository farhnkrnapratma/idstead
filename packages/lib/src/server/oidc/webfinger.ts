export const WEBFINGER_RELS = {
    profilePage: 'http://webfinger.net/rel/profile-page',
    avatar: 'http://webfinger.net/rel/avatar',
    issuer: 'http://openid.net/specs/connect/1.0/issuer'
} as const;

export interface WebfingerSubject {
    siteUrl: string;
    username: string;
    email: string;
    hasAvatar: boolean;
    issuer: string | null;
}

export interface WebfingerLink {
    rel: string;
    href: string;
    type?: string;
}

export interface WebfingerDocument {
    subject: string;
    aliases: string[];
    links: WebfingerLink[];
}

function localNames(subject: WebfingerSubject, host: string): Set<string> {
    const names = new Set<string>();
    const username = subject.username.trim().toLowerCase();
    if (username) names.add(username);
    const [local, domain] = subject.email.trim().toLowerCase().split('@');
    if (local && domain === host) names.add(local);
    return names;
}

function sameOrigin(resource: string, siteUrl: string): boolean {
    try {
        const a = new URL(resource);
        const b = new URL(siteUrl);
        return a.origin === b.origin && (a.pathname === '/' || a.pathname === '');
    } catch {
        return false;
    }
}

export function matchesResource(resource: string, subject: WebfingerSubject): boolean {
    const value = resource.trim();
    if (sameOrigin(value, subject.siteUrl)) return true;
    const match = /^acct:([^@\s]+)@([^@\s]+)$/i.exec(value);
    if (!match) return false;
    const host = new URL(subject.siteUrl).host.toLowerCase();
    if (match[2].toLowerCase() !== host) return false;
    return localNames(subject, host).has(match[1].toLowerCase());
}

export function webfingerDocument(
    resource: string,
    rels: string[],
    subject: WebfingerSubject
): WebfingerDocument | null {
    if (!matchesResource(resource, subject)) return null;
    const links: WebfingerLink[] = [
        { rel: WEBFINGER_RELS.profilePage, type: 'text/html', href: subject.siteUrl }
    ];
    if (subject.hasAvatar)
        links.push({
            rel: WEBFINGER_RELS.avatar,
            type: 'image/png',
            href: `${subject.siteUrl}/avatar.png`
        });
    if (subject.issuer) links.push({ rel: WEBFINGER_RELS.issuer, href: subject.issuer });
    return {
        subject: resource.trim(),
        aliases: [subject.siteUrl],
        links: rels.length > 0 ? links.filter(link => rels.includes(link.rel)) : links
    };
}
