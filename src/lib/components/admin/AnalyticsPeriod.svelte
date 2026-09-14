<script lang="ts">
  import {onMount} from 'svelte';
  import {analyticsRanges} from '$lib/adminWorkspace';
  import {analyticsPeriod} from '$lib/adminAnalytics';
  import Dropdown from '../Dropdown.svelte';
  import Input from '../Input.svelte';
  import Button from '../Button.svelte';
  import FieldMessage from '../FieldMessage.svelte';
  let {
    params,
    allowAll = false,
    onchange
  }: {
    params: URLSearchParams;
    allowAll?: boolean;
    onchange: (values: Record<string, string>) => void;
  } = $props();
  let selected = $state('7d');
  let zone = $state('UTC');
  let start = $state('');
  let end = $state('');
  let error = $state('');
  const zones = $derived(
    [
      ...new Set([
        zone,
        'UTC',
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        'Asia/Jakarta',
        'America/New_York',
        'Europe/London'
      ])
    ].map(value => ({value, label: value}))
  );
  function sync() {
    selected = params.get('range') ?? (allowAll ? 'all' : '7d');
    zone =
      params.get('timeZone')
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    start = params.get('start') ?? '';
    end = params.get('end') ?? '';
  }
  function apply() {
    try {
      const values = analyticsPeriod(selected, zone, new Date(), start, end);
      error = '';
      try {
        sessionStorage.setItem('admin-analytics-timezone', zone);
      } catch {}
      onchange({
        ...values,
        start: selected === 'custom' ? start : '',
        end: selected === 'custom' ? end : ''
      });
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : 'Choose a valid period.';
    }
  }
  onMount(() => {
    sync();
    if (!params.has('timeZone')) {
      try {
        zone = sessionStorage.getItem('admin-analytics-timezone') ?? zone;
      } catch {}
      apply();
    }
  });
</script>

<div
  class="flex flex-col gap-2"
  {@attach () => {
    params.toString();
    sync();
  }}>
  <div class="flex flex-wrap items-end gap-2">
    <Dropdown
      label="Period"
      value={selected}
      options={allowAll ?
        [{value: 'all', label: 'All time'}, ...analyticsRanges]
      : analyticsRanges}
      onChange={value => {
        selected = value;
        if (value !== 'custom') apply();
      }} />
    <Dropdown
      label="Time zone"
      value={zone}
      options={zones}
      onChange={value => {
        zone = value;
        if (selected !== 'custom') apply();
      }} />
    {#if selected === 'custom'}
      <Input
        type="date"
        label="Start date"
        size="sm"
        bind:value={start}
        fullWidth={false} />
      <Input
        type="date"
        label="End date"
        size="sm"
        bind:value={end}
        fullWidth={false} />
      <Button
        size="sm"
        onclick={apply}>Apply dates</Button>
    {/if}
  </div>
  {#if error}<FieldMessage message={error} />{/if}
</div>
