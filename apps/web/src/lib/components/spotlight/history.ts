// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { FolderOpen, Quote } from '@lucide/svelte';
import type { SearchHistoryEntry } from '../../stores/searchHistoryStore.svelte';
import type { SpotlightItem } from './types';
import type { LocalSearchProject } from './localSearch';

export interface HistorySource {
    defaultCommands: SpotlightItem[];
    dynamicCommands: (query: string) => SpotlightItem[];
    projects: LocalSearchProject[];
    results: SpotlightItem[];
}

function sameTitle(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
}

export function resolveHistoryItem(
    entry: SearchHistoryEntry,
    source: HistorySource
): SpotlightItem | null {
    if (entry.id === 'dyn-code-minimal' || sameTitle(entry.title, '/code minimal')) {
        const cleanItem = source
            .dynamicCommands('/code clean')
            .find(d => d.id === 'dyn-code-clean');
        if (cleanItem) return cleanItem;
    }

    const fromDefault = source.defaultCommands.find(
        c => c.id === entry.id || sameTitle(c.title, entry.title)
    );
    if (fromDefault) return fromDefault;

    if (entry.title.startsWith('/')) {
        const matchedDyn = source
            .dynamicCommands(entry.title)
            .find(d => d.id === entry.id || sameTitle(d.title, entry.title));
        if (matchedDyn) return matchedDyn;
    }

    const matchedProject = source.projects.find(
        p => `proj-${p.name}` === entry.id || sameTitle(p.name, entry.title)
    );
    if (matchedProject) {
        return {
            id: `proj-${matchedProject.name}`,
            category: 'projects',
            title: matchedProject.name,
            subtitle: matchedProject.desc,
            url: matchedProject.url,
            icon: FolderOpen,
            badge: 'Project'
        };
    }

    if (entry.category === 'posts' && entry.id.startsWith('post-')) {
        return {
            id: entry.id,
            category: 'posts',
            title: entry.title,
            subtitle: entry.subtitle,
            url: entry.id.replace('post-', ''),
            icon: Quote,
            badge: 'Post'
        };
    }

    return source.results.find(r => r.id === entry.id || sameTitle(r.title, entry.title)) ?? null;
}
