// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { FolderOpen } from '@lucide/svelte';
import type { SpotlightItem } from './types';

export interface LocalSearchProject {
    name: string;
    desc: string;
    url: string;
    tags?: string[];
}

export interface LocalSearchSource {
    commands: SpotlightItem[];
    dynamicCommands: (query: string) => SpotlightItem[];
    projects: LocalSearchProject[];
    links: SpotlightItem[];
}

export interface LocalSearchMatcher {
    fuzzy: (target: string, query: string) => { matched: boolean; score: number };
    compile: (pattern: string) => RegExp | null;
}

interface Scored {
    item: SpotlightItem;
    score: number;
}

const DYNAMIC_SCORE = 95;
const COMMAND_PREFIX_SCORE = 90;
const REGEX_SCORE = 70;
const REGEX_COMMAND_SCORE = 75;
const SUBTITLE_WEIGHT = 0.5;

function scoreBest(
    title: { matched: boolean; score: number },
    subtitle: { matched: boolean; score: number }
) {
    const titleScore = title.matched ? title.score : 0;
    const subScore = subtitle.matched ? subtitle.score * SUBTITLE_WEIGHT : 0;
    return Math.max(titleScore, subScore);
}

function matchCommands(
    query: string,
    isCommandQuery: boolean,
    isRegexQuery: boolean,
    regex: RegExp | null,
    source: LocalSearchSource,
    matcher: LocalSearchMatcher,
    out: Scored[]
) {
    for (const cmd of source.commands) {
        if (isCommandQuery) {
            const cmdName = cmd.title.toLowerCase();
            const queryLower = query.toLowerCase();
            if (cmdName.startsWith(queryLower) || cmdName.includes(queryLower)) {
                out.push({ item: cmd, score: COMMAND_PREFIX_SCORE });
                continue;
            }
        }
        if (
            isRegexQuery
            && regex
            && (regex.test(cmd.title) || (cmd.subtitle && regex.test(cmd.subtitle)))
        ) {
            out.push({ item: cmd, score: REGEX_COMMAND_SCORE });
            continue;
        }
        const title = matcher.fuzzy(cmd.title, query);
        const subtitle =
            cmd.subtitle ? matcher.fuzzy(cmd.subtitle, query) : { matched: false, score: 0 };
        if (title.matched || subtitle.matched) {
            out.push({ item: cmd, score: scoreBest(title, subtitle) });
        }
    }
}

function matchProjects(
    query: string,
    isRegexQuery: boolean,
    regex: RegExp | null,
    source: LocalSearchSource,
    matcher: LocalSearchMatcher,
    out: Scored[]
) {
    for (const p of source.projects) {
        const projectTags = p.tags ?? [];
        const matchName = matcher.fuzzy(p.name, query);
        const matchDesc = matcher.fuzzy(p.desc, query);
        const tagMatch = projectTags.some(t => matcher.fuzzy(t, query).matched);

        let isMatch = matchName.matched || matchDesc.matched || tagMatch;
        let score = scoreBest(matchName, matchDesc);

        if (
            isRegexQuery
            && regex
            && (regex.test(p.name)
                || (p.desc && regex.test(p.desc))
                || projectTags.some(t => regex.test(t)))
        ) {
            isMatch = true;
            score = REGEX_SCORE;
        }

        if (isMatch) {
            out.push({
                item: {
                    id: `proj-${p.name}`,
                    category: 'projects',
                    title: p.name,
                    subtitle: p.desc || '',
                    url: p.url,
                    tags: projectTags.slice(0, 3),
                    icon: FolderOpen,
                    badge: 'Project'
                },
                score
            });
        }
    }
}

function matchLinks(
    query: string,
    isRegexQuery: boolean,
    regex: RegExp | null,
    source: LocalSearchSource,
    matcher: LocalSearchMatcher,
    out: Scored[]
) {
    for (const link of source.links) {
        const matchTitle = matcher.fuzzy(link.title, query);
        const matchSub = matcher.fuzzy(link.subtitle ?? '', query);
        let score = scoreBest(matchTitle, matchSub);
        let isMatch = matchTitle.matched || matchSub.matched;
        if (isRegexQuery) {
            isMatch = Boolean(regex && (regex.test(link.title) || regex.test(link.subtitle ?? '')));
            score = isMatch ? REGEX_SCORE : 0;
        }
        if (isMatch) out.push({ item: link, score });
    }
}

function rankMatches(query: string, isCommandQuery: boolean, matched: Scored[]): Scored[] {
    if (query === '/') return matched.sort((a, b) => a.item.title.localeCompare(b.item.title));
    return matched.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (isCommandQuery) return a.item.title.localeCompare(b.item.title);
        const lenDiff = a.item.title.length - b.item.title.length;
        if (lenDiff !== 0) return lenDiff;
        return a.item.title.localeCompare(b.item.title);
    });
}

export function searchLocalItems(
    input: string,
    isRegex: boolean,
    source: LocalSearchSource,
    matcher: LocalSearchMatcher
): SpotlightItem[] {
    const query = input.trim();
    if (!query) return [];

    const isCommandQuery = query.startsWith('/');
    const regex = isRegex ? matcher.compile(query) : null;
    const matched: Scored[] = [];

    if (isCommandQuery) {
        for (const dyn of source.dynamicCommands(query)) {
            if (
                !isRegex
                || (regex && (regex.test(dyn.title) || (dyn.subtitle && regex.test(dyn.subtitle))))
            ) {
                matched.push({ item: dyn, score: DYNAMIC_SCORE });
            }
        }
    }
    matchCommands(query, isCommandQuery, isRegex, regex, source, matcher, matched);
    matchProjects(query, isRegex, regex, source, matcher, matched);
    if (!isCommandQuery) matchLinks(query, isRegex, regex, source, matcher, matched);

    return dedupeMatches(rankMatches(query, isCommandQuery, matched).map(entry => entry.item));
}

function dedupeMatches(candidates: SpotlightItem[]): SpotlightItem[] {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: SpotlightItem[] = [];
    for (const item of candidates) {
        const lowerTitle = item.title.toLowerCase();
        if (seenIds.has(item.id) || seenTitles.has(lowerTitle)) continue;
        seenIds.add(item.id);
        seenTitles.add(lowerTitle);
        unique.push(item);
    }
    return unique;
}

export function dedupeItems(candidates: SpotlightItem[]): SpotlightItem[] {
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: SpotlightItem[] = [];
    for (const item of candidates) {
        const lowerTitle = item.title.toLowerCase();
        if (
            seenIds.has(item.id)
            || seenTitles.has(lowerTitle)
            || (item.url && seenUrls.has(item.url))
        ) {
            continue;
        }
        seenIds.add(item.id);
        seenTitles.add(lowerTitle);
        if (item.url) seenUrls.add(item.url);
        unique.push(item);
    }
    return unique;
}

export function mergeResults(
    history: { id: string; title: string }[],
    candidates: SpotlightItem[]
): SpotlightItem[] {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    for (const entry of history) {
        seenIds.add(entry.id);
        seenTitles.add(entry.title.toLowerCase());
    }
    const unique: SpotlightItem[] = [];
    for (const item of candidates) {
        const lowerTitle = item.title.toLowerCase();
        if (seenIds.has(item.id) || seenTitles.has(lowerTitle)) continue;
        if (item.url && seenUrls.has(item.url)) continue;
        seenIds.add(item.id);
        seenTitles.add(lowerTitle);
        if (item.url) seenUrls.add(item.url);
        unique.push(item);
    }
    return unique;
}
