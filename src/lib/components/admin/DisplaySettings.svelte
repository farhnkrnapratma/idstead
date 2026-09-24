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
  } from '$lib/adminDateFormat';
  import {adminDisplayStore} from '$lib/stores/adminDisplayStore.svelte';
  import {formatRelativeTime} from '$lib/utils/formatters';
  import Button from '../Button.svelte';
  import Chip from '../Chip.svelte';
  import Dropdown from '../Dropdown.svelte';
  import FormSection from '$lib/layout/FormSection.svelte';

  const HOUR_MS = 60 * 60 * 1000;
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
      : formatAdminDateTime(value, undefined, prefs);
  }

  const previews = $derived([
    {label: 'Activity', text: timestamp(recent)},
    {label: 'Table', text: timestamp(older)},
    {
      label: 'Chart axis',
      text: formatAdminDate(now, undefined, prefs.dateFormat, true)
    }
  ]);
</script>

<FormSection
  title="Display"
  description="How dates and times appear across the admin area. Changes apply instantly on this device.">
  {#snippet headerActions()}
    <Button
      type="ghost"
      size="xs"
      disabled={isDefault}
      onclick={() => adminDisplayStore.reset()}>Reset to defaults</Button>
  {/snippet}

  <dl
    aria-live="polite"
    class="grid gap-x-4 gap-y-2 rounded-md border border-border-subtle bg-surface-card px-4 py-3 text-xs sm:grid-cols-[max-content_1fr]">
    {#each previews as row (row.label)}
      <dt class="text-text-muted">{row.label}</dt>
      <dd class="font-semibold text-text-primary">{row.text}</dd>
    {/each}
  </dl>

  <div class="flex flex-col gap-2">
    <span
      id="display-mode-label"
      class="text-xs font-semibold text-text-primary">Show timestamps as</span>
    <div
      role="group"
      aria-labelledby="display-mode-label"
      class="flex flex-wrap gap-2">
      {#each ADMIN_DATE_MODES as item (item.value)}
        <Chip
          active={prefs.mode === item.value}
          onclick={() => adminDisplayStore.apply({mode: item.value})}
          >{item.label}</Chip>
      {/each}
    </div>
    <p class="text-2xs text-text-muted">
      Relative shows “10 hours ago”. Smart is relative for the last 7 days and
      absolute after that. Charts and the calendar always use absolute dates.
    </p>
  </div>

  <div class="grid gap-3 sm:grid-cols-2">
    <Dropdown
      id="display-date-format"
      label="Date format"
      fullWidth
      options={dateOptions}
      value={prefs.dateFormat}
      onChange={value => adminDisplayStore.apply({dateFormat: value})} />
    <Dropdown
      id="display-time-format"
      label="Time format"
      fullWidth
      options={timeOptions}
      value={prefs.timeFormat}
      onChange={value => adminDisplayStore.apply({timeFormat: value})} />
  </div>
</FormSection>
