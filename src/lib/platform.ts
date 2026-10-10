export type Platform = 'mac' | 'windows' | 'linux' | 'other';

export interface NavigatorLike {
    userAgentData?: { platform?: string } | null;
    platform?: string;
    userAgent?: string;
}

export function detectPlatform(nav: NavigatorLike | null | undefined): Platform {
    if (!nav) return 'other';
    const hint = [nav.userAgentData?.platform, nav.platform, nav.userAgent]
        .filter(Boolean)
        .join(' ');
    if (/mac|iphone|ipad|ipod/i.test(hint)) return 'mac';
    if (/win/i.test(hint)) return 'windows';
    if (/linux|x11|cros/i.test(hint)) return 'linux';
    return 'other';
}
