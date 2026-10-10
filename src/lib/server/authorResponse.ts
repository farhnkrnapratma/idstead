import { json } from '@sveltejs/kit';
import { apiError } from './apiError';
import { supabase } from '#lib/supabase.ts';
import {
    fetchAuthorProfile,
    fetchCvEntries,
    fetchFundingLinks,
    fetchContactInfo,
    fetchGroupedSkills,
    fetchSocials
} from '#lib/author.ts';

import { sanitizePublicApiData, generateAuthorMarkdown } from '#lib/authorApi.ts';

export async function handleAuthorJsonRequest(url: URL, locals: any, request?: Request) {
    const supabaseClient = locals?.supabase || supabase;
    const searchParams = url.searchParams;

    const fieldsParam = searchParams.get('fields');
    const requestedFields = new Set<string>();

    if (fieldsParam) {
        fieldsParam.split(',').forEach(f => requestedFields.add(f.trim().toLowerCase()));
    }

    const validKeys = ['profile', 'cv', 'funding', 'contact', 'skills', 'socials', 'sponsorship'];
    validKeys.forEach(key => {
        if (searchParams.has(key)) {
            requestedFields.add(key === 'sponsorship' ? 'funding' : key);
        }
    });

    const fetchAll = requestedFields.size === 0;

    const tasks: Record<string, Promise<any>> = {};

    if (fetchAll || requestedFields.has('profile')) {
        tasks.profile = fetchAuthorProfile(supabaseClient, { includeEmail: true, strict: true });
    }
    if (fetchAll || requestedFields.has('cv')) {
        tasks.cv = fetchCvEntries(supabaseClient, { strict: true });
    }
    if (fetchAll || requestedFields.has('funding')) {
        tasks.funding = fetchFundingLinks(supabaseClient, { strict: true });
    }
    if (fetchAll || requestedFields.has('contact')) {
        tasks.contact = fetchContactInfo(supabaseClient, { strict: true });
    }
    if (fetchAll || requestedFields.has('skills')) {
        tasks.skills = fetchGroupedSkills(supabaseClient, { strict: true });
    }
    if (fetchAll || requestedFields.has('socials')) {
        tasks.socials = fetchSocials(supabaseClient, { strict: true });
    }

    const keys = Object.keys(tasks);
    let results: unknown[];
    try {
        results = await Promise.all(Object.values(tasks));
    } catch {
        return apiError(500, 'AUTHOR_FETCH_FAILED', 'Could not fetch author information.');
    }

    const rawData: Record<string, any> = {};
    keys.forEach((key, index) => {
        rawData[key] = results[index];
    });

    const responseData = sanitizePublicApiData(rawData);
    if (responseData.profile) {
        const p = responseData.profile;
        const email =
            typeof rawData.profile?.email === 'string' ? rawData.profile.email : undefined;

        const orderedProfile: Record<string, any> = {};
        if ('name' in p) orderedProfile.name = p.name;
        if ('pronunciation' in p) orderedProfile.pronunciation = p.pronunciation;
        if ('username' in p) orderedProfile.username = p.username;
        if (email) orderedProfile.email = email;
        if ('headline' in p) orderedProfile.headline = p.headline;
        if ('jobTitle' in p) orderedProfile.jobTitle = p.jobTitle;
        if ('bio' in p) orderedProfile.bio = p.bio;
        if ('avatar' in p) orderedProfile.avatar = p.avatar;
        if ('city' in p) orderedProfile.city = p.city;
        if ('postalCode' in p) orderedProfile.postalCode = p.postalCode;
        if ('country' in p) orderedProfile.country = p.country;
        if ('siteUrl' in p) orderedProfile.siteUrl = p.siteUrl;

        for (const [k, v] of Object.entries(p)) {
            if (!(k in orderedProfile)) {
                orderedProfile[k] = v;
            }
        }

        responseData.profile = orderedProfile;
    }

    const format = searchParams.get('format')?.toLowerCase();
    const acceptHeader = request?.headers.get('accept')?.toLowerCase() || '';

    const wantsMarkdown =
        format === 'md'
        || format === 'markdown'
        || format === 'text'
        || acceptHeader.includes('text/markdown')
        || acceptHeader.includes('text/x-markdown');

    if (wantsMarkdown) {
        const markdownText = generateAuthorMarkdown(responseData);
        return new Response(markdownText, {
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
                'X-Robots-Tag': 'index, follow'
            }
        });
    }

    return json(responseData, {
        headers: {
            'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
            'X-Robots-Tag': 'index, follow'
        }
    });
}
