<script lang="ts">
  import Dialog from './Dialog.svelte';
  import {createCodeActionControls} from '$lib/utils/codeBlocks';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import type {Project} from '$lib/types';

  interface Props {
    isOpen: boolean;
    project: Project | null;
    onClose: () => void;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    project,
    onClose,
    class: className = ''
  }: Props = $props();

  let activeTab = $state<'https' | 'ssh' | 'cli'>('https');
  let codeControls: ReturnType<typeof createCodeActionControls> | null = null;

  function getCommand(p: Project | null, tab: 'https' | 'ssh' | 'cli'): string {
    if (!p) return '';
    switch (tab) {
      case 'https':
        return `git clone ${p.cloneUrl}`;
      case 'ssh':
        return `git clone ${p.sshUrl}`;
      case 'cli':
        return `gh repo clone ${p.fullName}`;
    }
  }

  const currentCommand = $derived(getCommand(project, activeTab));

  function mountCodeControls(node: HTMLElement) {
    codeControls = createCodeActionControls({
      getCodeText: () => currentCommand,
      getDownloadFilename: () => `clone-${project?.name ?? 'repo'}.sh`,
      downloadLabel: 'Download ZIP',
      onDownload: () => {
        if (project?.zipUrl) {
          const a = document.createElement('a');
          a.href = project.zipUrl;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      },
      shouldHideLineNumbers: () => true,
      triggerToast: toastStore.success
    });
    node.appendChild(codeControls.controls);
    codeControls.applyPrefs();

    return {
      destroy() {
        codeControls = null;
      }
    };
  }

  $effect(() => {
    if (isOpen) {
      activeTab = 'https';
    }
  });

  $effect(() => {
    void codeBlockPrefsStore.current;
    codeControls?.applyPrefs();
  });
</script>

<Dialog
  bind:isOpen
  title="CLONE REPOSITORY"
  size="md"
  class={className}
  {onClose}>
  {#if project}
    <div class="flex flex-col gap-3">
      <div
        class="markdown-tabs-container group/codemin relative m-0 flex flex-col overflow-hidden rounded-md border border-border-subtle shadow-2xs"
        data-code-theme={codeBlockPrefsStore.current.colorScheme !== 'auto' ?
          codeBlockPrefsStore.current.colorScheme
        : undefined}>
        <div
          class="markdown-tabs-header hljs relative flex min-h-8 items-end justify-between rounded-t-md border-b border-border-subtle px-3 pt-0 pb-0 select-none"
          role="tablist">
          <div
            class="markdown-tabs-nav m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none]">
            {#each [['https', 'HTTPS'], ['ssh', 'SSH'], ['cli', 'GitHub CLI']] as const as [key, label] (key)}
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onclick={() => (activeTab = key)}
                class="markdown-tab-button relative -mb-px inline-flex shrink-0 cursor-pointer items-center justify-center border-b-[2.5px] px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all select-none {(
                  activeTab === key
                ) ?
                  'active-tab border-b-accent font-bold text-accent'
                : 'border-b-transparent text-text-muted hover:text-text-primary'}">
                {label}
              </button>
            {/each}
          </div>

          <div
            use:mountCodeControls
            class="markdown-tabs-actions ml-2 flex shrink-0 items-center gap-1 self-center pb-0.5">
          </div>
        </div>

        <div
          class="code-body hljs relative flex w-full flex-row items-center overflow-hidden rounded-b-md bg-surface-base/50">
          <span
            class="pointer-events-none absolute top-1/2 right-3.5 z-10 -translate-y-1/2 font-mono text-[11px] text-text-muted/70 lowercase select-none">
            bash
          </span>
          <div
            class="code-line-numbers shrink-0 bg-transparent py-1.5 font-mono text-[0.8rem] leading-snug select-none">
            <div
              class="flex flex-col justify-start pr-0.5 pl-3 text-right font-mono font-normal text-accent select-none">
              $
            </div>
          </div>
          <pre
            class="m-0 min-w-0 flex-1 overflow-x-auto py-1.5 pr-14 pl-1.5 {(
              codeBlockPrefsStore.current.wrap
            ) ?
              'break-all whitespace-pre-wrap'
            : 'whitespace-pre'}"><code
              class="font-mono text-xs text-text-secondary select-all"
              >{currentCommand}</code></pre>
        </div>
      </div>
    </div>
  {/if}
</Dialog>
