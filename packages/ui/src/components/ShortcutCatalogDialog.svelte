<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { SvelteSet } from 'svelte/reactivity';
    import Dialog from './Dialog.svelte';
    import ShortcutBadge from './ShortcutBadge.svelte';
    import CommandSectionHeading from './CommandSectionHeading.svelte';
    import {
        SHORTCUT_SECTIONS,
        actionSection,
        commandSection,
        compareCombos,
        type ShortcutSection
    } from '../shortcutCatalog.ts';
    import { shortcutStore } from '../stores/shortcutStore.svelte';
    import {
        CHORD_GROUPS,
        LEADER_COMBO,
        LEADER_FALLBACK_COMBO,
        CATALOG_KEY,
        COMMAND_SHORTCUTS,
        COMMAND_LABELS,
        normalizeKey
    } from '../shortcuts.ts';

    interface Props {
        hiddenCommands?: string[];
    }

    interface CatalogRow {
        id: string;
        label: string;
        combo: string;
        section: ShortcutSection;
    }

    let { hiddenCommands = [] }: Props = $props();

    const commandRows: CatalogRow[] = $derived(
        Object.entries(COMMAND_SHORTCUTS)
            .filter(([command]) => COMMAND_LABELS[command] && !hiddenCommands.includes(command))
            .map(([command, combo]) => ({
                id: command,
                label: COMMAND_LABELS[command],
                section: commandSection(command),
                combo
            }))
    );

    const commandKeys = new Set(Object.values(COMMAND_SHORTCUTS).map(normalizeKey));

    const entries = $derived(shortcutStore.catalogOpen ? shortcutStore.catalogEntries() : []);

    const actionRows: CatalogRow[] = $derived.by(() => {
        const seen = new SvelteSet<string>();
        return entries.flatMap(entry => {
            const spec = entry.group ? CHORD_GROUPS[entry.group] : undefined;
            if (entry.group === 'go' || spec?.listed === false) return [];
            const combo =
                spec ? `${spec.combos[0] ?? ''} ${entry.chordKey ?? ''}`.trim() : entry.combos[0];
            if (!combo || (entry.scope === 'page' && !spec && commandKeys.has(normalizeKey(combo))))
                return [];
            const key = `${entry.scope}|${normalizeKey(combo)}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [{ id: entry.id, label: entry.label, combo, section: actionSection(entry) }];
        });
    });

    const listRows: CatalogRow[] = $derived(
        Object.values(CHORD_GROUPS)
            .filter(
                spec =>
                    spec.listed === false
                    && spec.combos[0]
                    && entries.some(entry => entry.group === spec.id)
            )
            .map(spec => ({
                id: `list-${spec.id}`,
                label: `${spec.label}, then the item number`,
                combo: spec.combos[0],
                section: 'lists' as const
            }))
    );

    const sections = $derived(
        SHORTCUT_SECTIONS.map(section => ({
            ...section,
            rows: [...commandRows, ...actionRows, ...listRows]
                .filter(row => row.section === section.id)
                .sort((a, b) => compareCombos(a.combo, b.combo))
        })).filter(section => section.rows.length > 0)
    );
</script>

{#snippet row(label: string, combo: string, leader = true)}
    <div
        class="flex min-w-0 items-center justify-between gap-3 rounded-sm px-2 py-1 text-xs text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg">
        <span class="min-w-0 truncate">{label}</span>
        <ShortcutBadge
            {combo}
            {leader} />
    </div>
{/snippet}

<Dialog
    isOpen={shortcutStore.catalogOpen}
    title="Keyboard shortcuts"
    description="Press ctrl+space, then a key. Keys followed by a second key open a group."
    size="2xl"
    scrollBody
    trapShortcuts={false}
    onClose={() => (shortcutStore.catalogOpen = false)}>
    <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div
                class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm px-2 py-1 text-xs text-fg-secondary">
                <span class="shrink-0">Shortcut mode</span>
                <span class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted">
                    <ShortcutBadge combo={LEADER_COMBO} />
                    <ShortcutBadge combo={LEADER_FALLBACK_COMBO} />
                </span>
            </div>
            {@render row('Open this list', CATALOG_KEY)}
        </div>

        {#each sections as section (section.id)}
            <section aria-label={section.label}>
                <CommandSectionHeading
                    label={section.label}
                    context={section.context} />
                <div class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    {#each section.rows as action (action.id)}
                        {@render row(action.label, action.combo)}
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</Dialog>
