<script lang="ts">
    import Dialog from './Dialog.svelte';
    import ShortcutBadge from './ShortcutBadge.svelte';
    import CommandSectionHeading from './CommandSectionHeading.svelte';
    import { page } from '$app/state';
    import { SHORTCUT_SECTIONS, commandSection, actionSection } from '#lib/shortcutCatalog.ts';
    import { shortcutStore } from '../stores/shortcutStore.svelte';
    import {
        CHORD_GROUPS,
        LEADER_COMBO,
        LEADER_FALLBACK_COMBO,
        CATALOG_KEY,
        COMMAND_SHORTCUTS,
        COMMAND_LABELS,
        normalizeKey
    } from '#lib/shortcuts.ts';

    const commandRows = Object.entries(COMMAND_SHORTCUTS)
        .filter(([command]) => COMMAND_LABELS[command])
        .map(([command, combo]) => ({
            id: command,
            label: `${COMMAND_LABELS[command]} or ${command}`,
            section: commandSection(command),
            combo
        }));

    const commandKeys = new Set(Object.values(COMMAND_SHORTCUTS).map(normalizeKey));

    const entries = $derived(shortcutStore.catalogOpen ? shortcutStore.catalogEntries() : []);

    const actionRows = $derived.by(() => {
        const keyOf = (entry: (typeof entries)[number]) =>
            `${entry.scope}|${normalizeKey(entry.combos[0] ?? '')}`;
        return entries.flatMap((entry, index) => {
            if (!entry.group) {
                const combo = entry.combos[0];
                if (
                    !combo
                    || (entry.scope === 'page' && commandKeys.has(normalizeKey(combo)))
                    || entries.findIndex(other => !other.group && keyOf(other) === keyOf(entry))
                        !== index
                )
                    return [];
                return [
                    {
                        id: entry.id,
                        label: entry.label,
                        combo,
                        section: actionSection(entry, page.url.pathname)
                    }
                ];
            }
            const spec = CHORD_GROUPS[entry.group];
            if (!spec || spec.listed === false || !spec.combos[0]) return [];
            return [
                {
                    id: entry.id,
                    label: entry.label,
                    section: actionSection(entry, page.url.pathname),
                    combo: `${spec.combos[0]} ${entry.chordKey ?? ''}`
                }
            ];
        });
    });

    const sections = $derived(
        SHORTCUT_SECTIONS.map(section => ({
            ...section,
            rows: [...actionRows, ...commandRows].filter(row => row.section === section.id)
        })).filter(section => section.rows.length > 0)
    );
</script>

{#snippet row(label: string, badge: string)}
    <div
        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
        <span class="min-w-0 text-xs wrap-break-word text-text-primary">{label}</span>
        <ShortcutBadge
            combo={badge}
            leader />
    </div>
{/snippet}

<Dialog
    isOpen={shortcutStore.catalogOpen}
    title="Keyboard shortcuts"
    description="Browse shortcuts by context. Use the info icons to check where each group works."
    size="2xl"
    scrollBody
    trapShortcuts={false}
    onClose={() => (shortcutStore.catalogOpen = false)}>
    <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-0.5">
            <div
                class="flex flex-col items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover sm:flex-row sm:items-center sm:gap-3">
                <span class="min-w-0 text-xs text-text-primary">Toggle shortcut mode</span>
                <span class="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
                    <ShortcutBadge combo={LEADER_COMBO} />
                    /
                    <ShortcutBadge combo={LEADER_FALLBACK_COMBO} />
                </span>
            </div>
            {@render row('Open this list', CATALOG_KEY)}
        </div>

        <hr class="border-border-subtle" />

        {#each sections as section (section.id)}
            <section aria-label={section.label}>
                <CommandSectionHeading
                    label={section.label}
                    context={section.context} />
                <div class="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                    {#each section.rows as action (action.id)}
                        {@render row(action.label, action.combo)}
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</Dialog>
