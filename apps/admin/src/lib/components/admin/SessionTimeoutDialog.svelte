<script lang="ts">
    import {
        SESSION_WARNING_SECONDS,
        countdownTone,
        formatCountdown,
        remainingSeconds,
        shouldAnnounce,
        type CountdownTone
    } from '../../sessionTimeout.ts';
    import Button from '@fkp/ui/components/Button.svelte';
    import Dialog from '@fkp/ui/components/Dialog.svelte';

    const RING_LENGTH = 125.66;
    const toneStyles: Record<CountdownTone, { track: string; arc: string; text: string }> = {
        normal: { track: 'stroke-accent-subtle', arc: 'stroke-accent', text: 'text-accent-text' },
        warning: { track: 'stroke-warning-subtle', arc: 'stroke-warning', text: 'text-warning' },
        danger: { track: 'stroke-danger-subtle', arc: 'stroke-danger', text: 'text-danger' }
    };

    let {
        isOpen,
        deadline,
        extendMinutes,
        isSigningOut = false,
        onExtend,
        onSignOut
    }: {
        isOpen: boolean;
        deadline: number;
        extendMinutes: number;
        isSigningOut?: boolean;
        onExtend: () => void;
        onSignOut: () => void;
    } = $props();

    let now = $state(Date.now());
    let announcement = $state('');

    const remaining = $derived(remainingSeconds(deadline, now));
    const tone = $derived(countdownTone(remaining));
    const styles = $derived(toneStyles[tone]);
    const clock = $derived(formatCountdown(remaining));

    $effect(() => {
        if (!isOpen) return;
        now = Date.now();
        const timer = setInterval(() => {
            now = Date.now();
        }, 250);
        return () => clearInterval(timer);
    });

    $effect(() => {
        if (!isOpen) {
            announcement = '';
            return;
        }
        if (shouldAnnounce(remaining)) announcement = `Signing out in ${remaining} seconds.`;
    });

    $effect(() => {
        if (!isOpen) return;
        const previous = document.title;
        document.title = `Signing out in ${clock} · ${previous}`;
        return () => {
            document.title = previous;
        };
    });
</script>

<Dialog
    {isOpen}
    role="alertdialog"
    onClose={() => {}}
    showCloseButton={false}
    closeOnBackdrop={false}
    closeOnEscape={false}
    title="You're about to be signed out"
    description="You've been inactive for a while. Stay signed in to keep working."
    size="md">
    <div
        class="mt-4 flex items-center gap-4 rounded-md border border-border-subtle bg-surface-card p-4">
        <div class="relative flex size-14 shrink-0 items-center justify-center">
            <svg
                class="size-14 -rotate-90"
                viewBox="0 0 48 48"
                aria-hidden="true">
                <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke-width="4"
                    class={styles.track} />
                <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-dasharray={RING_LENGTH}
                    stroke-dashoffset={RING_LENGTH * (1 - remaining / SESSION_WARNING_SECONDS)}
                    class="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear {styles.arc}" />
            </svg>
            <span
                aria-hidden="true"
                class="absolute font-mono text-sm font-bold tabular-nums {styles.text}"
                >{remaining}</span>
        </div>
        <div class="min-w-0">
            <p class="text-sm font-semibold text-text-primary">
                {#if remaining > 0}
                    Signing out in <span class="font-mono tabular-nums">{clock}</span>
                {:else}
                    Signing out now…
                {/if}
            </p>
            <p class="mt-1 text-xs text-text-secondary">
                Staying signed in gives you {extendMinutes} more minutes before the next inactivity check.
            </p>
        </div>
    </div>

    <p
        role="status"
        aria-live="polite"
        class="sr-only">
        {announcement}
    </p>

    {#snippet footer()}
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
                type="secondary"
                size="md"
                onclick={onSignOut}
                disabled={isSigningOut}>Sign out now</Button>
            <Button
                type="primary"
                size="md"
                data-autofocus
                onclick={onExtend}>Stay signed in</Button>
        </div>
    {/snippet}
</Dialog>
