// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { RESUME_CHECKSUM_ALGORITHMS, type ResumeChecksums } from './resumeChecksums';
import { decodeHtmlEntities } from './entities';
import { isFingerprint, safeKeyserverUrl, type PublicOpenPgpKey } from './openpgpKey';

export interface ManifestSettings {
    theme_color: string;
    background_color: string;
    display: 'standalone' | 'minimal-ui' | 'browser' | 'fullscreen';
}

export interface ExperienceItem {
    id?: string;
    title: string;
    type: string;
    company: string;
    startMonth: string;
    startYear: number | null;
    endMonth?: string | null;
    endYear?: number | null;
    currentlyIn: boolean;
    location: string;
    locType: string;
    description: string;
    sortOrder?: number;
}

export interface EducationItem {
    id?: string;
    institution: string;
    degree: string;
    field: string;
    startMonth: string;
    startYear: number | null;
    endMonth?: string | null;
    endYear?: number | null;
    currentlyIn: boolean;
    grade: string;
    activities?: string;
    description: string;
    sortOrder?: number;
}

export interface SkillItem {
    id?: string;
    category: string;
    skills: string[];
    sortOrder?: number;
}

export interface SkillCategoryGroup {
    id?: string;
    category: string;
    items: string[];
    sortOrder?: number;
}

export interface SocialLink {
    id?: string;
    platform: string;
    url: string;
    icon: string;
    description?: string;
    sortOrder?: number;
}

export interface SponsorshipLink {
    id?: string;
    platform: string;
    displayValue: string;
    url: string;
    icon: string;
    description: string;
    sortOrder?: number;
}

export interface ContactInfo {
    id?: string;
    platform: string;
    displayValue: string;
    href: string;
    icon: string;
    description?: string;
    sortOrder?: number;
}

export interface ResumeDocument {
    id?: string;
    filename: string;
    fileUrl: string;
    hash?: string;
    version?: string | null;
    signedAt?: string | null;
    signerFingerprint?: string | null;
    checksums?: ResumeChecksums | null;
    isActive: boolean;
    sortOrder?: number;
    updatedAt?: string;
}

export interface AuthorProfile {
    revision?: number;
    createdAt?: string;
    updatedAt?: string;
    avatarVersion?: string | null;
    bannerVersion?: string | null;
    manifestSettings?: ManifestSettings;
    id?: string;
    name: string;
    pronunciation?: string;
    username: string;
    headline: string;
    jobTitle: string;
    bio: string;
    avatar: string;
    email: string;
    city: string;
    postalCode: string;
    country: string;
    siteUrl: string;
    skills?: (string | SkillCategoryGroup)[];
    socials?: Record<string, string>;
    socialLinks?: SocialLink[];
    experience?: ExperienceItem[];
    education?: EducationItem[];
}

export interface ProjectRepoRules {
    excluded: string[];
    pinned: string[];
}

type Row = Record<string, any>;

export const LINK_LIMITS = { contact: 10, funding: 10, social: 10 } as const;

export function formatMonthFull(month: string | null | undefined): string {
    if (!month) return '';
    const decoded = decodeHtmlEntities(month).trim();
    if (!decoded) return '';
    const m = decoded.toLowerCase().replace(/\./g, '');
    const map: Record<string, string> = {
        jan: 'January',
        january: 'January',
        '01': 'January',
        '1': 'January',
        feb: 'February',
        february: 'February',
        '02': 'February',
        '2': 'February',
        mar: 'March',
        march: 'March',
        '03': 'March',
        '3': 'March',
        apr: 'April',
        april: 'April',
        '04': 'April',
        '4': 'April',
        may: 'May',
        '05': 'May',
        '5': 'May',
        jun: 'June',
        june: 'June',
        '06': 'June',
        '6': 'June',
        jul: 'July',
        july: 'July',
        '07': 'July',
        '7': 'July',
        aug: 'August',
        august: 'August',
        '08': 'August',
        '8': 'August',
        sep: 'September',
        september: 'September',
        '09': 'September',
        '9': 'September',
        oct: 'October',
        october: 'October',
        '10': 'October',
        nov: 'November',
        november: 'November',
        '11': 'November',
        dec: 'December',
        december: 'December',
        '12': 'December'
    };
    return map[m] || decoded.charAt(0).toUpperCase() + decoded.slice(1).toLowerCase();
}

export function formatMonthAbbrev(month: string | null | undefined): string {
    if (!month) return '';
    const decoded = decodeHtmlEntities(month).trim();
    if (!decoded) return '';
    const m = decoded.toLowerCase().replace(/\./g, '');
    const map: Record<string, string> = {
        jan: 'Jan',
        january: 'Jan',
        '01': 'Jan',
        '1': 'Jan',
        feb: 'Feb',
        february: 'Feb',
        '02': 'Feb',
        '2': 'Feb',
        mar: 'Mar',
        march: 'Mar',
        '03': 'Mar',
        '3': 'Mar',
        apr: 'Apr',
        april: 'Apr',
        '04': 'Apr',
        '4': 'Apr',
        may: 'May',
        '05': 'May',
        '5': 'May',
        jun: 'Jun',
        june: 'Jun',
        '06': 'Jun',
        '6': 'Jun',
        jul: 'Jul',
        july: 'Jul',
        '07': 'Jul',
        '7': 'Jul',
        aug: 'Aug',
        august: 'Aug',
        '08': 'Aug',
        '8': 'Aug',
        sep: 'Sep',
        september: 'Sep',
        '09': 'Sep',
        '9': 'Sep',
        oct: 'Oct',
        october: 'Oct',
        '10': 'Oct',
        nov: 'Nov',
        november: 'Nov',
        '11': 'Nov',
        dec: 'Dec',
        december: 'Dec',
        '12': 'Dec'
    };
    return map[m] || decoded.charAt(0).toUpperCase() + decoded.slice(1, 3).toLowerCase();
}

export function normalizeIconInput(raw: string | undefined | null): string {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    if (/^[A-Z]/.test(trimmed)) return `<${trimmed} />`;

    const cleaned = trimmed.replace(/[^a-zA-Z0-9_\-\s]/g, '');
    if (cleaned.startsWith('bi bi-')) return cleaned;
    if (cleaned.startsWith('bi-')) return `bi ${cleaned}`;
    return `bi bi-${cleaned}`;
}

const ALLOWED_LUCIDE_PROPS = new Set(['size', 'strokeWidth', 'absoluteStrokeWidth', 'color']);

export function parseLucideTag(
    tag: string
): { name: string; props: Record<string, string | number | boolean> } | null {
    const inner = tag.trim().replace(/^<\/?|\/?>$/g, '');
    const nameMatch = inner.match(/^[A-Za-z][A-Za-z0-9]*/);
    if (!nameMatch) return null;

    const name = nameMatch[0];
    const rest = inner.slice(name.length);
    const props: Record<string, string | number | boolean> = {};
    const attrRe = /([a-zA-Z][a-zA-Z0-9]*)(?:=(?:\{([^}]*)\}|"([^"]*)"))?/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rest))) {
        const [, attr, braced, quoted] = m;
        if (!attr || !ALLOWED_LUCIDE_PROPS.has(attr)) continue;
        if (braced === undefined && quoted === undefined) {
            props[attr] = true;
        } else {
            const val = braced !== undefined ? braced.trim() : (quoted as string);
            if (/^-?\d+(\.\d+)?$/.test(val)) props[attr] = Number(val);
            else if (val === 'true' || val === 'false') props[attr] = val === 'true';
            else props[attr] = val;
        }
    }

    return { name, props };
}

export function profileFromRow(
    data: Row,
    { includeEmail = false }: { includeEmail?: boolean } = {}
): AuthorProfile {
    return {
        id: data.id,
        revision: data.profile_revision ?? 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        avatarVersion: data.avatar_version,
        bannerVersion: data.banner_version ?? null,
        manifestSettings: data.manifest_settings,
        name: decodeHtmlEntities(data.name || ''),
        pronunciation: data.pronunciation || '',
        username: decodeHtmlEntities(data.username || ''),
        email: includeEmail ? decodeHtmlEntities(data.email || '') : '',
        headline: decodeHtmlEntities(data.headline || ''),
        jobTitle: decodeHtmlEntities(data.job_title || ''),
        bio: decodeHtmlEntities(data.bio || ''),
        avatar: decodeHtmlEntities(data.avatar || ''),
        city: decodeHtmlEntities(data.city || ''),
        postalCode: decodeHtmlEntities(data.postal_code || ''),
        country: decodeHtmlEntities(data.country || ''),
        siteUrl: decodeHtmlEntities(data.site_url || ''),
        skills: [],
        socials: {},
        socialLinks: [],
        experience: [],
        education: []
    };
}

export function socialLinkFromRow(item: Row): SocialLink {
    return {
        id: item.id,
        platform: item.platform,
        url: item.url,
        icon: item.icon || '',
        description: decodeHtmlEntities(item.description || ''),
        sortOrder: item.sort_order
    };
}

export function fundingLinkFromRow(item: Row): SponsorshipLink {
    return {
        id: item.id,
        platform: decodeHtmlEntities(item.platform || ''),
        displayValue: decodeHtmlEntities(item.display_value || ''),
        url: decodeHtmlEntities(item.url || ''),
        icon: decodeHtmlEntities(item.icon || ''),
        description: decodeHtmlEntities(item.description || ''),
        sortOrder: item.sort_order
    };
}

export function contactLinkFromRow(item: Row): ContactInfo {
    return {
        id: item.id,
        platform: decodeHtmlEntities(item.platform || item.label || ''),
        displayValue: decodeHtmlEntities(item.display_value || item.value || ''),
        href: decodeHtmlEntities(item.url || item.href || ''),
        icon: decodeHtmlEntities(item.icon || ''),
        description: decodeHtmlEntities(item.description || ''),
        sortOrder: item.sort_order
    };
}

export function experienceFromRow(item: Row): ExperienceItem {
    return {
        id: item.id,
        title: decodeHtmlEntities(item.title || ''),
        type: decodeHtmlEntities(item.type || ''),
        company: decodeHtmlEntities(item.company || ''),
        startMonth: formatMonthFull(item.start_month),
        startYear: item.start_year || new Date().getFullYear(),
        endMonth: item.end_month ? formatMonthFull(item.end_month) : null,
        endYear: item.end_year ?? null,
        currentlyIn: item.currently_in ?? false,
        location: decodeHtmlEntities(item.location || ''),
        locType: decodeHtmlEntities(item.loc_type || ''),
        description: decodeHtmlEntities(item.description || ''),
        sortOrder: item.sort_order
    };
}

export function educationFromRow(item: Row): EducationItem {
    return {
        id: item.id,
        institution: decodeHtmlEntities(item.institution || ''),
        degree: decodeHtmlEntities(item.degree || ''),
        field: decodeHtmlEntities(item.field || ''),
        startMonth: formatMonthFull(item.start_month),
        startYear: item.start_year || new Date().getFullYear(),
        endMonth: item.end_month ? formatMonthFull(item.end_month) : null,
        endYear: item.end_year ?? null,
        currentlyIn: item.currently_in ?? false,
        grade: decodeHtmlEntities(item.grade || ''),
        activities: decodeHtmlEntities(item.activities || ''),
        description: decodeHtmlEntities(item.description || ''),
        sortOrder: item.sort_order
    };
}

export function skillItemFromRow(cat: Row): SkillItem {
    return {
        id: cat.id,
        category: decodeHtmlEntities(cat.category || ''),
        skills: ((cat.db_items || []) as Row[])
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(item => decodeHtmlEntities(item.name || '')),
        sortOrder: cat.sort_order
    };
}

export function skillGroupFromItem(item: SkillItem): SkillCategoryGroup {
    return {
        id: item.id,
        category: item.category,
        items: item.skills || [],
        sortOrder: item.sortOrder
    };
}

export function resumeChecksumsFrom(value: unknown): ResumeChecksums | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const entries = RESUME_CHECKSUM_ALGORITHMS.map(({ ext }) => [ext, record[ext]] as const);
    return entries.every(([, digest]) => typeof digest === 'string' && /^[0-9a-f]+$/.test(digest)) ?
            (Object.fromEntries(entries) as ResumeChecksums)
        :   null;
}

export function resumeDocumentFromRow(data: Row, hash: string): ResumeDocument {
    return {
        id: data.id,
        filename: data.filename || '',
        fileUrl: data.file_url || '',
        hash,
        version: data.version ?? null,
        signedAt: data.signed_at ?? null,
        signerFingerprint: data.signer_fingerprint ?? null,
        checksums: resumeChecksumsFrom(data.checksums),
        isActive: data.is_active ?? true,
        sortOrder: data.sort_order,
        updatedAt: data.updated_at
    };
}

function openPgpList<T>(value: unknown, pick: (item: Record<string, unknown>) => T | null): T[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const picked = pick(item as Record<string, unknown>);
        return picked ? [picked] : [];
    });
}

export function openPgpKeyFromRow(data: Row): PublicOpenPgpKey | null {
    if (!isFingerprint(data.fingerprint)) return null;
    return {
        fingerprint: data.fingerprint,
        armored: data.armored,
        algorithm: data.algorithm || '',
        createdAt: data.key_created_at ?? null,
        expiresAt: data.expires_at ?? null,
        userIds: openPgpList(data.user_ids, item => ({
            name: typeof item.name === 'string' ? item.name : '',
            email: typeof item.email === 'string' ? item.email : ''
        })),
        keyservers: openPgpList(data.keyservers, item => {
            const url = safeKeyserverUrl(item.url);
            return url ?
                    { label: typeof item.label === 'string' ? item.label : new URL(url).host, url }
                :   null;
        })
    };
}

export function projectRepoRulesFromRows(
    rows: Array<{ rule_type: string; repo_name: string }>
): ProjectRepoRules {
    const excluded: string[] = [];
    const pinned: string[] = [];
    for (const item of rows) {
        if (item.rule_type === 'exclude') excluded.push(item.repo_name);
        else if (item.rule_type === 'pin') pinned.push(item.repo_name);
    }
    return { excluded, pinned };
}
