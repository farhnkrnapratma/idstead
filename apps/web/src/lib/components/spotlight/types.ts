// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Search } from '@lucide/svelte';

export type ItemCategory =
    | 'pages'
    | 'posts'
    | 'projects'
    | 'actions'
    | 'commands'
    | 'skills'
    | 'social'
    | 'contact'
    | 'funding';

export interface SpotlightItem {
    id: string;
    category: ItemCategory;
    title: string;
    subtitle?: string;
    description?: string;
    url?: string;
    action?: () => void;
    icon?: any;
    badge?: string;
    shortcut?: string;
    requiresArgs?: boolean;
    validArgs?: string[];
    autocompleteQuery?: string;
    author?: string;
    slug?: string;
    tags?: string[];
    date?: string;
    snippet?: string;
    topics?: string[];
    meta?: Record<string, unknown>;
}

export interface HelpCommandSpec {
    command: string;
    argHint: string;
    description: string;
    validArgs: string[];
    actionQuery?: string;
    icon: typeof Search;
}

export interface HelpCategory {
    id: string;
    label: string;
    icon: typeof Search;
    commands: HelpCommandSpec[];
}
