<script lang="ts">
    import {
        ADMIN_DATE_FORMATS,
        ADMIN_DATE_MODES,
        ADMIN_TIME_FORMATS,
        DEFAULT_ADMIN_DISPLAY,
        formatAdminDate,
        formatAdminDateTime,
        formatAdminTime,
        isRelativeTimestamp
    } from '#lib/adminDateFormat.ts';
    import { adminDisplayStore } from '#lib/stores/adminDisplayStore.svelte.ts';
    import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
    import { formatRelativeTime } from '@fkp/domain/formatters.ts';
    import { CalendarClock, Moon, RotateCcwClock, Sparkles, Sun, SunMoon } from '@lucide/svelte';
    import Button from '@fkp/ui/components/Button.svelte';
    import Card from '@fkp/ui/components/Card.svelte';
    import Dropdown from '@fkp/ui/components/Dropdown.svelte';
    import FormSection from '@fkp/ui/layout/FormSection.svelte';

    const HOUR_MS = 60 * 60 * 1000;
    const themes = [
        { value: 'auto', label: 'System', icon: SunMoon },
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon }
    ] as const;
    const modeIcons = {
        smart: Sparkles,
        absolute: CalendarClock,
        relative: RotateCcwClock
    } as const;
    const dateModeTabs = (['smart', 'absolute', 'relative'] as const).map(value => ({
        ...ADMIN_DATE_MODES.find(mode => mode.value === value)!,
        icon: modeIcons[value]
    }));
    const now = new Date();
    const recent = new Date(now.getTime() - 10 * HOUR_MS);
    const older = new Date(now.getTime() - 10 * 24 * HOUR_MS);
    const sample = new Date(2026, 8, 24, 9, 44, 12);

    const prefs = $derived(adminDisplayStore.current);
    const isDefault = $derived(
        prefs.mode === DEFAULT_ADMIN_DISPLAY.mode
            && prefs.dateFormat === DEFAULT_ADMIN_DISPLAY.dateFormat
            && prefs.timeFormat === DEFAULT_ADMIN_DISPLAY.timeFormat
    );
    const dateOptions = ADMIN_DATE_FORMATS.map(value => ({
        value,
        label: formatAdminDate(sample, undefined, value)
    }));
    const timeOptions = ADMIN_TIME_FORMATS.map(value => ({
        value,
        label: formatAdminTime(sample, undefined, value)
    }));

    function timestamp(value: Date) {
        return isRelativeTimestamp(value, prefs.mode, now) ?
                formatRelativeTime(value, now)
            :   formatAdminDateTime(value, undefined, prefs);
    }

    const previews = $derived([
        { label: 'Activity', text: timestamp(recent) },
        { label: 'Table', text: timestamp(older) },
        { label: 'Chart axis', text: formatAdminDate(now, undefined, prefs.dateFormat, true) }
    ]);
</script>

<Card
    variant="bordered"
    class="border-border-subtle! bg-surface-card!">
    <FormSection
        title="Theme"
        titleClass="type-card-title"
        description="Choose how the site looks on this device. System follows your device theme."
        bare>
        {#snippet headerActions()}
            <div
                role="tablist"
                aria-label="Theme"
                class="inline-flex w-fit items-center gap-0.5 rounded-md border border-border-subtle/50 bg-surface p-0.5">
                {#each themes as theme (theme.value)}
                    <button
                        type="button"
                        role="tab"
                        aria-selected={themeStore.current === theme.value}
                        onclick={() => themeStore.apply(theme.value)}
                        class="touch-target relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring {(
                            themeStore.current === theme.value
                        ) ?
                            'bg-accent-contrast-bg text-text-on-accent shadow-xs'
                        :   'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}">
                        <theme.icon class="size-3.5" />
                        {theme.label}
                    </button>
                {/each}
            </div>
        {/snippet}
    </FormSection>
</Card>

<Card
    variant="bordered"
    class="border-border-subtle! bg-surface-card!">
    <FormSection
        title="Dates & times"
        titleClass="type-card-title"
        description="How dates and times appear across the admin area. Changes apply instantly on this device."
        bare>
        {#snippet headerActions()}
            <Button
                type="ghost"
                size="xs"
                disabled={isDefault}
                onclick={() => adminDisplayStore.reset()}>Reset to defaults</Button>
        {/snippet}

        <div
            class="grid overflow-hidden rounded-md border border-border-subtle/50 bg-surface-card sm:grid-cols-[1fr_1.3fr]">
            <div class="flex flex-col gap-2 p-3">
                <Dropdown
                    id="display-date-format"
                    label="Date format"
                    fullWidth
                    options={dateOptions}
                    value={prefs.dateFormat}
                    onChange={value => adminDisplayStore.apply({ dateFormat: value })} />
                <Dropdown
                    id="display-time-format"
                    label="Time format"
                    fullWidth
                    options={timeOptions}
                    value={prefs.timeFormat}
                    onChange={value => adminDisplayStore.apply({ timeFormat: value })} />
            </div>
            <dl
                aria-live="polite"
                class="flex flex-col justify-center gap-y-1.5 border-t border-border-subtle/50 p-3 text-xs sm:border-t-0 sm:border-l">
                {#each previews as row (row.label)}
                    <div class="flex items-baseline gap-2">
                        <dt class="w-20 shrink-0 text-text-muted">{row.label}</dt>
                        <dd class="truncate font-semibold text-text-primary">{row.text}</dd>
                    </div>
                {/each}
            </dl>
        </div>

        <div class="flex flex-col gap-2">
            <span
                id="display-mode-label"
                class="text-xs font-semibold text-text-primary">Show timestamps as</span>
            <div
                role="tablist"
                aria-labelledby="display-mode-label"
                class="inline-flex w-fit items-center gap-0.5 self-start rounded-md border border-border-subtle/50 bg-surface p-0.5">
                {#each dateModeTabs as item (item.value)}
                    <button
                        type="button"
                        role="tab"
                        aria-selected={prefs.mode === item.value}
                        onclick={() => adminDisplayStore.apply({ mode: item.value })}
                        class="touch-target relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring {(
                            prefs.mode === item.value
                        ) ?
                            'bg-accent-contrast-bg text-text-on-accent shadow-xs'
                        :   'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}">
                        <item.icon class="size-3.5" />
                        {item.label}
                    </button>
                {/each}
            </div>
            <p class="type-body text-text-muted">
                Relative shows “10 hours ago”. Smart is relative for the last 7 days and absolute
                after that. Charts and the calendar always use absolute dates.
            </p>
        </div>
    </FormSection>
</Card>
