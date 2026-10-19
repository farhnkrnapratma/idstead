<script lang="ts">
    import { untrack } from 'svelte';
    import {
        formatRelativeTime,
        getRelativeTimeNextUpdateMs,
        formatExactDateTime
    } from '@fkp/domain/formatters.ts';

    interface Props {
        date: string | Date | null | undefined;
        class?: string;
        tag?: 'span' | 'time';
        titlePrefix?: string;
        prefix?: string;
        title?: string;
    }

    let {
        date,
        class: className = '',
        tag = 'span',
        titlePrefix,
        prefix = '',
        title
    }: Props = $props();

    let now = $state(new Date());

    let text = $derived((prefix ? `${prefix} ` : '') + formatRelativeTime(date, now));
    let exact = $derived(formatExactDateTime(date));
    let titleAttr = $derived(
        title ? title
        : exact ?
            titlePrefix !== undefined ?
                `${titlePrefix}${exact}`
            :   exact
        :   undefined
    );

    $effect(() => {
        void date;
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            now = new Date();
            timer = setTimeout(tick, getRelativeTimeNextUpdateMs(date, now));
        };
        const currentNow = untrack(() => now);
        timer = setTimeout(tick, getRelativeTimeNextUpdateMs(date, currentNow));
        return () => clearTimeout(timer);
    });
</script>

{#if tag === 'time'}
    <time
        datetime={typeof date === 'string' ? date : date?.toISOString()}
        title={titleAttr}
        class={className}>{text}</time>
{:else}
    <span
        title={titleAttr}
        class={className}>{text}</span>
{/if}
