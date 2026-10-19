import {
    contactLinkFromRow,
    cvDocumentFromRow,
    educationFromRow,
    experienceFromRow,
    fundingLinkFromRow,
    LINK_LIMITS,
    openPgpKeyFromRow,
    profileFromRow,
    projectRepoRulesFromRows,
    skillGroupFromItem,
    skillItemFromRow,
    socialLinkFromRow,
    type AuthorProfile,
    type ContactInfo,
    type CvDocument,
    type EducationItem,
    type ExperienceItem,
    type ProjectRepoRules,
    type SkillCategoryGroup,
    type SkillItem,
    type SocialLink,
    type SponsorshipLink
} from '@fkp/domain/author.ts';
import type { PublicOpenPgpKey } from '@fkp/domain/openpgpKey.ts';

export * from '@fkp/domain/author.ts';

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

        return profileFromRow(data, { includeEmail: options?.includeEmail });
    } catch (e) {
        if (options?.strict) throw e;
        return null;
    }
}

export interface IdentityVersionMeta {
    source: 'custom' | 'generated';
    fingerprint: string | null;
}

export async function fetchIdentityMeta(
    supabaseClient: any,
    profile: { avatarVersion?: string | null; bannerVersion?: string | null } | null
): Promise<{ avatar: IdentityVersionMeta | null; banner: IdentityVersionMeta | null }> {
    const ids = [profile?.avatarVersion, profile?.bannerVersion].filter(Boolean);
    if (!supabaseClient || !ids.length) return { avatar: null, banner: null };
    const { data, error } = await supabaseClient
        .from('db_identity_versions')
        .select(
            'id, kind, source, fingerprint, avatar_source, avatar_fingerprint, banner_source, banner_fingerprint'
        )
        .in('id', ids);
    if (error) throw error;
    const find = (kind: 'avatar' | 'banner', id?: string | null): IdentityVersionMeta | null => {
        const row = (data ?? []).find((entry: { id: string }) => entry.id === id);
        if (!row) return null;
        if (row.kind !== 'identity')
            return { source: row.source, fingerprint: row.fingerprint ?? null };
        return {
            source: row[`${kind}_source`] ?? 'custom',
            fingerprint: row[`${kind}_fingerprint`] ?? null
        };
    };
    return {
        avatar: find('avatar', profile?.avatarVersion),
        banner: find('banner', profile?.bannerVersion)
    };
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

        return data.map(socialLinkFromRow);
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
}

export async function fetchProjectRepoRules(supabaseClient?: any): Promise<ProjectRepoRules> {
    if (!supabaseClient) return { excluded: [], pinned: [] };

    try {
        const { data, error } = await supabaseClient
            .from('db_project_repo_rules')
            .select('rule_type, repo_name')
            .order('sort_order', { ascending: true });

        if (error || !data) return { excluded: [], pinned: [] };
        return projectRepoRulesFromRows(data);
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

        return data.map(skillItemFromRow);
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

    return items.map(skillGroupFromItem);
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

        return data.map(experienceFromRow);
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

        return data.map(educationFromRow);
    } catch (e) {
        if (options?.strict) throw e;
        return [];
    }
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

        return data.map(fundingLinkFromRow);
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

        return data.map(contactLinkFromRow);
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
                    if (match) fullHash = match[0];
                }
            } catch (err) {
                console.error('Error fetching sha256 file:', err);
            }
        }

        return cvDocumentFromRow(data, fullHash);
    } catch (e) {
        if (options?.strict) throw e;
        return null;
    }
}

export async function fetchActiveOpenPgpKey(
    supabaseClient?: any,
    options?: { strict?: boolean }
): Promise<PublicOpenPgpKey | null> {
    if (!supabaseClient) return null;
    try {
        const { data, error } = await supabaseClient
            .from('db_openpgp_keys')
            .select(
                'fingerprint, armored, user_ids, algorithm, key_created_at, expires_at, keyservers'
            )
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
        if (error && options?.strict) throw error;
        if (error || !data) return null;
        return openPgpKeyFromRow(data);
    } catch (e) {
        if (options?.strict) throw e;
        return null;
    }
}
