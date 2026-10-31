// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import biIcons from 'bootstrap-icons/font/bootstrap-icons.json';

type IconNode = [string, Record<string, string>];

const ICON_ATTR_RE = /\bicon="([^"]*)"/gi;
const ICON_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORCED_ICON_RE = /^(lucide|bi)-(.+)$/;

const bootstrapNames = new Set(Object.keys(biIcons));

let lucideNodes: Promise<Record<string, IconNode[]>> | null = null;

function loadLucideNodes(): Promise<Record<string, IconNode[]>> {
    lucideNodes ??= import('lucide-static/icon-nodes.json').then(
        module => module.default as unknown as Record<string, IconNode[]>,
        error => {
            lucideNodes = null;
            throw error;
        }
    );
    return lucideNodes;
}

function toInlineSvg(nodes: IconNode[], name: string): string {
    const inner = nodes
        .map(([tag, attrs]) => {
            const attributes = Object.entries(attrs)
                .filter(([key]) => key !== 'key')
                .map(([key, value]) => ` ${key}="${value}"`)
                .join('');
            return `<${tag}${attributes}/>`;
        })
        .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-${name}" aria-hidden="true">${inner}</svg>`;
}

async function lucideMarkup(name: string): Promise<string> {
    if (!ICON_NAME_RE.test(name)) return '';
    const nodes = (await loadLucideNodes())[name];
    return Array.isArray(nodes) ? toInlineSvg(nodes, name) : '';
}

function bootstrapMarkup(name: string): string {
    if (!bootstrapNames.has(name)) return '';
    return `<i class="mdrs-icon bi bi-${name}" aria-hidden="true"></i>`;
}

export async function resolveIconMarkup(value: string): Promise<string> {
    const key = value.trim().toLowerCase();
    const forced = key.match(FORCED_ICON_RE);
    if (forced) {
        return forced[1] === 'lucide' ? lucideMarkup(forced[2]) : bootstrapMarkup(forced[2]);
    }
    return (await lucideMarkup(key)) || bootstrapMarkup(key);
}

function collectIconNames(markdown: string): string[] {
    const names = new Set<string>();
    for (const match of markdown.matchAll(ICON_ATTR_RE)) {
        if (match[1].trim()) names.add(match[1]);
    }
    return [...names];
}

export async function loadIcons(markdown: string): Promise<Map<string, string>> {
    const names = collectIconNames(markdown);
    const markups = await Promise.all(names.map(resolveIconMarkup));
    return new Map(names.map((name, index) => [name, markups[index]]));
}
