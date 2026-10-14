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

export interface CvDocument {
    id?: string;
    filename: string;
    fileUrl: string;
    hash?: string;
    isActive: boolean;
    sortOrder?: number;
    updatedAt?: string;
}

export interface AuthorProfile {
    revision?: number;
    updatedAt?: string;
    avatarVersion?: string | null;
    bannerVersion?: string | null;
    manifestSettings?: import('./siteIdentity').ManifestSettings;
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

export const LINK_LIMITS = { contact: 10, funding: 10, social: 6 } as const;

export function decodeHtmlEntities(str: string | null | undefined): string {
    if (!str) return '';
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#x27;/gi, "'")
        .replace(/&#x22;/gi, '"')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

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

export async function fetchAuthorProfile(
    supabaseClient?: any,
    options?: { includeEmail?: boolean; strict?: boolean }
): Promise<AuthorProfile | null> {
    if (!supabaseClient) return null;

    try {
        const { data, error } = await supabaseClient
            .from('db_profiles')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error && options?.strict) throw error;
        if (error || !data) {
            return null;
        }

        const rawName = decodeHtmlEntities(data.name || '');
        const city = decodeHtmlEntities(data.city || '');
        const postalCode = decodeHtmlEntities(data.postal_code || '');
        const country = decodeHtmlEntities(data.country || '');

        return {
            id: data.id,
            revision: data.profile_revision ?? 0,
            updatedAt: data.updated_at,
            avatarVersion: data.avatar_version,
            manifestSettings: data.manifest_settings,
            name: rawName,
            pronunciation: data.pronunciation || '',
            username: decodeHtmlEntities(data.username || ''),
            email: options?.includeEmail ? decodeHtmlEntities(data.email || '') : '',
            headline: decodeHtmlEntities(data.headline || ''),
            jobTitle: decodeHtmlEntities(data.job_title || ''),
            bio: decodeHtmlEntities(data.bio || ''),
            avatar: decodeHtmlEntities(data.avatar || ''),
            city,
            postalCode,
            country,
            siteUrl: decodeHtmlEntities(data.site_url || ''),
            skills: [],
            socials: {},
            socialLinks: [],
            experience: [],
            education: []
        };
    } catch (e) {
        if (options?.strict) throw e;
        return null;
    }
}

export async function fetchAuthorProfileWithSocials(
    supabaseClient?: any,
    options?: { includeEmail?: boolean; strict?: boolean }
): Promise<AuthorProfile | null> {
    const [profile, socialLinks] = await Promise.all([
        fetchAuthorProfile(supabaseClient, options),
        fetchSocials(supabaseClient)
    ]);
    if (!profile) return null;
    return { ...profile, socialLinks };
}

export async function fetchSocials(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<SocialLink[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_links')
            .select('*')
            .eq('category', 'social')
            .order('sort_order', { ascending: true })
            .limit(LINK_LIMITS.social);

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((item: any) => ({
            id: item.id,
            platform: item.platform,
            url: item.url,
            icon: item.icon || '',
            description: decodeHtmlEntities(item.description || ''),
            sortOrder: item.sort_order
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export interface ProjectRepoRules {
    excluded: string[];
    pinned: string[];
}

export async function fetchProjectRepoRules(supabaseClient?: any): Promise<ProjectRepoRules> {
    if (!supabaseClient) return { excluded: [], pinned: [] };

    try {
        const { data, error } = await supabaseClient
            .from('db_project_repo_rules')
            .select('rule_type, repo_name')
            .order('sort_order', { ascending: true });

        if (error || !data) return { excluded: [], pinned: [] };

        const excluded: string[] = [];
        const pinned: string[] = [];
        for (const item of data as { rule_type: string; repo_name: string }[]) {
            if (item.rule_type === 'exclude') excluded.push(item.repo_name);
            else if (item.rule_type === 'pin') pinned.push(item.repo_name);
        }
        return { excluded, pinned };
    } catch (e) {
        return { excluded: [], pinned: [] };
    }
}

export async function fetchSkills(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<SkillItem[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_categories')
            .select('id, category, sort_order, db_items(id, name, sort_order)')
            .order('sort_order', { ascending: true });

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((cat: any) => ({
            id: cat.id,
            category: decodeHtmlEntities(cat.category || ''),
            skills: (cat.db_items || [])
                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((item: any) => decodeHtmlEntities(item.name || '')),
            sortOrder: cat.sort_order
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchGroupedSkills(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<SkillCategoryGroup[]> {
    const items = await fetchSkills(supabaseClient, options);
    if (!items || items.length === 0) return [];

    return items.map(item => ({
        id: item.id,
        category: item.category,
        items: item.skills || [],
        sortOrder: item.sortOrder
    }));
}

export async function fetchExperiences(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<ExperienceItem[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_experiences')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((item: any) => ({
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
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchEducation(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<EducationItem[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_educations')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((item: any) => ({
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
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchEducations(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<EducationItem[]> {
    return fetchEducation(supabaseClient, options);
}

export async function fetchCvEntries(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<{ experience: ExperienceItem[]; education: EducationItem[] }> {
    const [experience, education] = await Promise.all([
        fetchExperiences(supabaseClient, options),
        fetchEducation(supabaseClient, options)
    ]);
    return { experience, education };
}

export async function fetchSponsorship(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<SponsorshipLink[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_links')
            .select('*')
            .eq('category', 'funding')
            .order('sort_order', { ascending: true })
            .limit(LINK_LIMITS.funding);

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((item: any) => ({
            id: item.id,
            platform: decodeHtmlEntities(item.platform || ''),
            displayValue: decodeHtmlEntities(item.display_value || ''),
            url: decodeHtmlEntities(item.url || ''),
            icon: decodeHtmlEntities(item.icon || ''),
            description: decodeHtmlEntities(item.description || ''),
            sortOrder: item.sort_order
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchFundingLinks(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<SponsorshipLink[]> {
    return fetchSponsorship(supabaseClient, options);
}

export async function fetchContactInfo(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<ContactInfo[]> {
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('db_links')
            .select('*')
            .eq('category', 'contact')
            .order('sort_order', { ascending: true })
            .limit(LINK_LIMITS.contact);

        if (error && options?.strict) throw error;
        if (error || !data) return [];

        return data.map((item: any) => ({
            id: item.id,
            platform: decodeHtmlEntities(item.platform || item.label || ''),
            displayValue: decodeHtmlEntities(item.display_value || item.value || ''),
            href: decodeHtmlEntities(item.url || item.href || ''),
            icon: decodeHtmlEntities(item.icon || ''),
            description: decodeHtmlEntities(item.description || ''),
            sortOrder: item.sort_order
        }));
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchActiveCvDocument(
    supabaseClient?: any,
    fetchFn: typeof fetch = fetch,
    options?: { strict?: boolean }
): Promise<CvDocument | null> {
    if (!supabaseClient) return null;

    try {
        const { data, error } = await supabaseClient
            .from('db_documents')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (error && options?.strict) throw error;
        if (error || !data) {
            return null;
        }

        let fullHash = data.hash || '';
        if (fullHash.length < 64 && data.file_url) {
            try {
                const shaRes = await fetchFn(`${data.file_url}.sha256`);
                if (shaRes.ok) {
                    const shaText = await shaRes.text();
                    const match = shaText.trim().match(/^[a-fA-F0-9]{64}/);
                    if (match) {
                        fullHash = match[0];
                        await supabaseClient
                            .from('db_documents')
                            .update({ hash: fullHash })
                            .eq('id', data.id);
                    }
                }
            } catch (err) {
                console.error('Error fetching sha256 file:', err);
            }
        }

        return {
            id: data.id,
            filename: data.filename || '',
            fileUrl: data.file_url || '',
            hash: fullHash,
            isActive: data.is_active ?? true,
            sortOrder: data.sort_order,
            updatedAt: data.updated_at
        };
    } catch (e) {
        if (options?.strict) throw e;
        return null;
    }
}
