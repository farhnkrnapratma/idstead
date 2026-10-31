<script lang="ts">
    import { onMount } from 'svelte';
    import { CircleCheck, CircleQuestionMark, TriangleAlert, Wrench } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import { SERVICE_STATUSES, serviceStatus, type ServiceStatus } from '../serviceStatus';

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

    const icons = {
        check: CircleCheck,
        alert: TriangleAlert,
        maintenance: Wrench,
        unknown: CircleQuestionMark
    };

    const tones = {
        success: 'text-fg-success',
        danger: 'text-fg-danger',
        warning: 'text-fg-warning',
        muted: 'text-fg-muted'
    };

    let status = $state<ServiceStatus | null>(null);
    const current = $derived(status ? SERVICE_STATUSES[status] : null);
    const StatusIcon = $derived(current ? icons[current.icon] : null);

    onMount(() => {
        if (!/^[a-z0-9-]+\.instatus\.com$/i.test(host)) return;
        const controller = new AbortController();

        fetch(`${pageUrl}/summary.json`, {
            signal: controller.signal,
            referrerPolicy: 'no-referrer'
        })
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                status = serviceStatus(data?.page?.status);
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

{#if current && StatusIcon}
    <a
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={current.label}
        class={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-subtle bg-surface px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            className
        )}>
        <StatusIcon
            aria-hidden="true"
            class={cn('size-3.5 shrink-0', tones[current.tone])} />
        <span class="truncate">{current.label}</span>
    </a>
{/if}
