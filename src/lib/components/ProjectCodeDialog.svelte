<script lang="ts">
  import {SquareArrowOutUpRight, FolderArchive} from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';
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
    void codeBlockPrefsStore.current;
    codeControls?.applyPrefs();
  });
</script>

<Dialog
  bind:isOpen
  title="Clone {project?.name ?? 'Repository'}"
  description="Use the command below to clone this repository to your local machine."
  size="md"
  class={className}
  {onClose}>
  {#if project}
    <div class="flex flex-col gap-4">
      <div
        class="flex rounded-sm border border-border-subtle bg-surface-base/50 p-0.5 text-xs font-semibold">
        {#each [['https', 'HTTPS'], ['ssh', 'SSH'], ['cli', 'GitHub CLI']] as const as [key, label] (key)}
          <button
            type="button"
            onclick={() => (activeTab = key)}
            class="flex-1 cursor-pointer rounded-sm py-1.5 transition-colors {(
              activeTab === key
            ) ?
              'bg-copilot text-white shadow-xs'
            : 'text-text-secondary hover:text-text-primary'}">
            {label}
          </button>
        {/each}
      </div>

      <div
        class="code-block-container flex flex-col overflow-hidden rounded-sm border border-border-subtle shadow-2xs">
        <div
          class="code-header-bar hljs flex min-h-[1.75rem] items-center gap-2 border-b border-border-subtle bg-surface-base/80 px-3 py-0.5 text-xs font-semibold text-text-secondary select-none {(
            codeBlockPrefsStore.current.minimal
          ) ?
            'justify-end'
          : 'justify-between'}">
          {#if !codeBlockPrefsStore.current.minimal}
            <span
              class="font-sans-title text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              Shell
            </span>
          {/if}
          <div
            use:mountCodeControls
            class="flex items-center gap-1">
          </div>
        </div>
        <div
          class="code-body hljs flex w-full flex-row items-stretch overflow-hidden bg-surface-base/50">
          {#if !codeBlockPrefsStore.current.minimal}
            <div
              class="code-line-numbers shrink-0 border-r border-border-subtle/30 bg-transparent py-1.5 font-mono text-[0.8rem] leading-snug select-none">
              <div class="pr-1.5 pl-3 font-mono font-normal text-copilot">
                $
              </div>
            </div>
          {/if}
          <pre
            class="m-0 min-w-0 flex-1 overflow-x-auto py-1.5 pr-3.5 pl-2 {(
              codeBlockPrefsStore.current.wrap
            ) ?
              'break-all whitespace-pre-wrap'
            : 'whitespace-pre'}"><code
              class="font-mono text-xs text-text-secondary select-all"
              >{currentCommand}</code></pre>
        </div>
      </div>

      <div
        class="flex flex-col gap-2 border-t border-border-subtle/60 pt-3 sm:flex-row">
        {#if project.zipUrl}
          <Button
            href={project.zipUrl}
            type="secondary"
            size="sm"
            class="flex-1 justify-center">
            {#snippet leading()}
              <FolderArchive class="size-3.5 text-text-muted" />
            {/snippet}
            <span>Download ZIP</span>
          </Button>
        {/if}

        <Button
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="flex-1 justify-center">
          <span>Open on GitHub</span>
          {#snippet trailing()}
            <SquareArrowOutUpRight class="size-3 text-text-muted" />
          {/snippet}
        </Button>
      </div>
    </div>
  {/if}
</Dialog>
