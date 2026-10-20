<script lang="ts">
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import MailingForm from './MailingForm.svelte';
    import type { MailingCommand } from '#lib/mailing.ts';

    let { request, onClose }: { request: MailingCommand | null; onClose: () => void } = $props();
</script>

{#if request}
    <Dialog
        isOpen
        title={request.action === 'subscribe' ? 'Subscribe' : 'Unsubscribe'}
        size="sm"
        {onClose}>
        <MailingForm
            action={request.action}
            initialEmail={request.email}
            autoSubmit={Boolean(request.email)}
            onSuccess={onClose}
            onCancel={onClose} />
    </Dialog>
{/if}
