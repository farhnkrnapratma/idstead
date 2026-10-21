<script lang="ts">
    import { onMount } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        host?: string;
        code?: string;
        class?: string;
    }

    let { host = '', code = '', class: className = '' }: Props = $props();

    const pageUrl = $derived(`https://${host}`);
    const widgetSrc = $derived(
        `https://api.dashboard.instatus.com/widget?host=${encodeURIComponent(host)}&code=${encodeURIComponent(code)}&locale=en`
    );

    const statuses = {
        UP: { label: 'All systems operational', dot: 'bg-success' },
        HASISSUES: { label: 'Experiencing issues', dot: 'bg-danger' },
        UNDERMAINTENANCE: { label: 'Under maintenance', dot: 'bg-warning' },
        UNKNOWN: { label: 'Status unavailable', dot: 'bg-text-muted' }
    } as const;

    let status = $state<keyof typeof statuses | null>(null);

    onMount(() => {
        if (!/^[a-z0-9-]+\.instatus\.com$/i.test(host)) return;
        const controller = new AbortController();

        fetch(`${pageUrl}/summary.json`, {
            signal: controller.signal,
            referrerPolicy: 'no-referrer'
        })
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                const value = data?.page?.status;
                status =
                    typeof value === 'string' && Object.hasOwn(statuses, value) ?
                        (value as keyof typeof statuses)
                    :   'UNKNOWN';
            })
            .catch(() => {
                if (!controller.signal.aborted) status = 'UNKNOWN';
            });

        if (code && !document.querySelector(`script[src="${widgetSrc}"]`)) {
            const script = document.createElement('script');
            script.src = widgetSrc;
            script.async = true;
            document.body.appendChild(script);
        }

        return () => controller.abort();
    });
</script>

{#if status}
    <a
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        class={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            className
        )}>
        <span
            aria-hidden="true"
            class={cn(
                'size-2 shrink-0 rounded-full motion-safe:animate-pulse',
                statuses[status].dot
            )}></span>
        <span class="truncate">{statuses[status].label}</span>
    </a>
{/if}
