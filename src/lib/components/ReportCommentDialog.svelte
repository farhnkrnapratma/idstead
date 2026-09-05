<script lang="ts">
  import {
    ShieldAlert,
    MessageSquareWarning,
    Siren,
    Ban,
    HeartCrack,
    UserX,
    FileX,
    Newspaper,
    HelpCircle,
    Circle,
    CircleDot
  } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';
  import FormField from './FormField.svelte';
  import Textarea from './Textarea.svelte';
  import {
    turnstileWidget,
    executeTurnstile,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import {cn} from '$lib/utils/cn';

  interface CommentInfo {
    id: string;
    author_name?: string;
    content: string;
  }

  interface Props {
    isOpen?: boolean;
    comment: CommentInfo | null;
    onClose?: () => void;
  }

  let {isOpen = $bindable(false), comment = null, onClose}: Props = $props();

  type ReasonType =
    | 'spam'
    | 'harassment'
    | 'violence_or_illegal'
    | 'sexual_content'
    | 'self_harm'
    | 'impersonation'
    | 'removal_request'
    | 'misinformation'
    | 'other';

  const REASONS: {
    id: ReasonType;
    label: string;
    description: string;
    icon: typeof ShieldAlert;
    colorClass: string;
  }[] = [
    {
      id: 'spam',
      label: 'Spam / Phishing',
      description: 'Commercial advertisements, scam links, or repetitive spam',
      icon: ShieldAlert,
      colorClass: 'text-danger'
    },
    {
      id: 'harassment',
      label: 'Harassment / Hate',
      description: 'Abusive language, insults, harassment, or hate speech',
      icon: MessageSquareWarning,
      colorClass: 'text-amber-500'
    },
    {
      id: 'violence_or_illegal',
      label: 'Violence / Illegal',
      description:
        'Threats of violence, promotion of crime, or dangerous weapons',
      icon: Siren,
      colorClass: 'text-orange-500'
    },
    {
      id: 'sexual_content',
      label: 'Sexual Content',
      description: 'Sexually explicit content or exploitation of a minor',
      icon: Ban,
      colorClass: 'text-rose-500'
    },
    {
      id: 'self_harm',
      label: 'Self-Harm / Suicide',
      description: 'Content that encourages or depicts self-harm or suicide',
      icon: HeartCrack,
      colorClass: 'text-fuchsia-400'
    },
    {
      id: 'impersonation',
      label: 'Impersonation',
      description: 'Pretending to be someone else or using a deceptive name',
      icon: UserX,
      colorClass: 'text-purple-400'
    },
    {
      id: 'removal_request',
      label: 'Content / Privacy',
      description:
        'Request removal of private, sensitive, or copyrighted content',
      icon: FileX,
      colorClass: 'text-blue-400'
    },
    {
      id: 'misinformation',
      label: 'Misinformation',
      description: 'False claims, defamation, or election misinformation',
      icon: Newspaper,
      colorClass: 'text-cyan-500'
    },
    {
      id: 'other',
      label: 'Other Violation',
      description: 'Any other violation not covered above',
      icon: HelpCircle,
      colorClass: 'text-text-muted'
    }
  ];

  let selectedReason = $state<ReasonType>('spam');
  const selectedReasonInfo = $derived(
    REASONS.find(r => r.id === selectedReason)
  );
  let details = $state('');
  let isSubmitting = $state(false);
  let turnstileEl = $state<HTMLDivElement | null>(null);

  function resetForm() {
    selectedReason = 'spam';
    details = '';
    isSubmitting = false;
    resetTurnstile(turnstileEl);
  }

  function handleClose() {
    resetForm();
    isOpen = false;
    onClose?.();
  }

  async function submitReport() {
    if (!comment?.id) return;

    let turnstileToken = '';
    if (turnstileSiteKey) {
      turnstileToken = await executeTurnstile(turnstileEl);
      if (!turnstileToken) {
        toastStore.error('Please complete security verification.');
        return;
      }
    }

    isSubmitting = true;

    try {
      const res = await fetch('/api/internal/blog/comments/report', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          commentId: comment.id,
          reason: selectedReason,
          details: details.trim(),
          turnstileToken
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toastStore.error(
          data?.error?.message
            || data?.message
            || 'Failed to submit report. Please try again.'
        );
        resetTurnstile(turnstileEl);
        isSubmitting = false;
        return;
      }

      toastStore.success(
        'Report submitted. Thank you for keeping our community safe.'
      );
      handleClose();
    } catch {
      toastStore.error('Network error while submitting report.');
      resetTurnstile(turnstileEl);
      isSubmitting = false;
    }
  }
</script>

<Dialog
  bind:isOpen
  title="Report Comment"
  description="Select the reason that best describes why this comment violates policy."
  size="lg"
  onClose={handleClose}>
  {#if comment}
    <div class="flex flex-col gap-4">
      <div
        class="rounded-md border border-border-subtle bg-surface-card/60 p-2.5 text-xs text-text-secondary">
        <span class="font-semibold text-text-primary"
          >{comment.author_name || 'Author'}:</span>
        <p class="mt-0.5 line-clamp-2 text-text-muted italic">
          "{comment.content}"
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <div
          class="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Report reason">
          {#each REASONS as r, idx (r.id)}
            <label
              class={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all select-none',
                idx === REASONS.length - 1 && REASONS.length % 2 !== 0 ?
                  'sm:col-span-2'
                : '',
                selectedReason === r.id ?
                  'border-accent bg-accent/10'
                : 'border-border-subtle/70 bg-surface-card/60 hover:border-accent/40 hover:bg-surface-card'
              )}>
              <input
                type="radio"
                name="report-reason"
                value={r.id}
                checked={selectedReason === r.id}
                onchange={() => (selectedReason = r.id)}
                class="sr-only" />
              <div
                class={cn(
                  'shrink-0 transition-transform group-hover:scale-105',
                  r.colorClass
                )}>
                <r.icon class="size-3.5" />
              </div>
              <span
                class="min-w-0 flex-1 truncate text-2xs font-semibold text-text-primary transition-colors group-hover:text-accent">
                {r.label}
              </span>
              <span
                class="relative flex size-3.5 shrink-0 items-center justify-center">
                <Circle
                  class={cn(
                    'absolute size-3.5 transition-all duration-200',
                    selectedReason === r.id ?
                      'scale-0 opacity-0'
                    : 'scale-100 text-text-muted opacity-100 group-hover:text-text-secondary'
                  )} />
                <CircleDot
                  class={cn(
                    'absolute size-3.5 transition-all duration-200',
                    selectedReason === r.id ?
                      'scale-100 text-accent opacity-100'
                    : 'scale-0 opacity-0'
                  )} />
              </span>
            </label>
          {/each}
        </div>

        {#if selectedReasonInfo}
          <p class="text-2xs leading-relaxed text-text-muted">
            {selectedReasonInfo.description}
          </p>
        {/if}
      </div>

      <FormField
        id="report-details"
        label="Additional details (optional)"
        variant="floating"
        maxlength={500}
        currentLength={details.length}
        counter={`${details.length}/500`}>
        <Textarea
          id="report-details"
          rows={1}
          maxlength={500}
          bind:value={details} />
      </FormField>

      {#if turnstileSiteKey}
        <div
          bind:this={turnstileEl}
          class="cf-turnstile select-none"
          data-sitekey={turnstileSiteKey}
          data-action="report-comment"
          data-size="flexible"
          data-theme="auto"
          data-appearance="interaction-only"
          data-execution="execute"
          use:turnstileWidget={{
            sitekey: turnstileSiteKey,
            action: 'report-comment',
            size: 'flexible',
            theme: 'auto',
            appearance: 'interaction-only',
            execution: 'execute'
          }}>
        </div>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button
      type="secondary"
      size="sm"
      disabled={isSubmitting}
      onclick={handleClose}>
      Cancel
    </Button>
    <Button
      type="danger"
      size="sm"
      disabled={isSubmitting}
      onclick={submitReport}>
      {isSubmitting ? 'Submitting…' : 'Submit Report'}
    </Button>
  {/snippet}
</Dialog>
