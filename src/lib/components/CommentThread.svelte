<script
  lang="ts"
  module>
  export interface CommentItem {
    id: string;
    post_id: string;
    parent_id: string | null;
    author_name: string | null;
    is_admin?: boolean;
    content: string;
    created_at: string;
    reply_to_author?: string | null;
  }

  export interface CommentTreeNode<T> {
    comment: T;
    children: CommentTreeNode<T>[];
    reply_to_author?: string;
  }
</script>

<script
  lang="ts"
  generics="T extends CommentItem">
  import {onMount, tick, type Snippet} from 'svelte';
  import {SvelteMap, SvelteSet} from 'svelte/reactivity';
  import {
    EllipsisVertical,
    Copy,
    Flag,
    Trash,
    UserCheck,
    User,
    BadgeCheck,
    ChevronDown,
    ChevronUp
  } from '@lucide/svelte';
  import RelativeTime from './RelativeTime.svelte';
  import IconButton from './IconButton.svelte';
  import {cn} from '../utils/cn';
  import {popoverPosition} from '../utils/popoverPosition';
  import {contentFontStore} from '../stores/contentFontStore.svelte';
  import {decodeHtmlEntities} from '../utils/formatters';
  import {toastStore} from '../stores/toastStore.svelte';

  interface Props {
    class?: string;
    comments: T[];
    replyTo?: T | null;
    authorName?: string;
    useContentFont?: boolean;
    isAdmin?: boolean;
    statusBadge?: Snippet<[comment: T]>;
    actions?: Snippet<[comment: T]>;
    replyForm?: Snippet<[comment: T]>;
    onReport?: (comment: T) => void;
    onDelete?: (comment: T) => void;
  }

  let {
    class: className = '',
    comments = [],
    replyTo = null,
    authorName = '',
    useContentFont = false,
    isAdmin = false,
    statusBadge,
    actions,
    replyForm,
    onReport,
    onDelete
  }: Props = $props();

  let activeMenuId = $state<string | null>(null);

  onMount(() => {
    const handleGlobalClick = () => {
      activeMenuId = null;
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  });

  async function toggleKebabMenu(commentId: string, e: MouseEvent) {
    e.stopPropagation();
    const opening = activeMenuId !== commentId;
    activeMenuId = opening ? commentId : null;
    if (opening) {
      const trigger = e.currentTarget as HTMLElement;
      await tick();
      const menu =
        trigger.parentElement?.querySelector<HTMLElement>('[role="menu"]');
      menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }

  function closeKebabMenu(commentId: string) {
    activeMenuId = null;
    document.getElementById(`comment-menu-trigger-${commentId}`)?.focus();
  }

  function handleMenuKeydown(e: KeyboardEvent, commentId: string) {
    const menu = e.currentTarget as HTMLElement;
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'Escape') {
      e.preventDefault();
      closeKebabMenu(commentId);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    }
  }

  async function handleCopyId(commentId: string) {
    activeMenuId = null;
    try {
      await navigator.clipboard.writeText(commentId);
      toastStore.success('Comment ID copied to clipboard');
    } catch {
      toastStore.error('Failed to copy Comment ID');
    }
  }

  function handleReport(comment: T) {
    activeMenuId = null;
    onReport?.(comment);
  }

  function handleDelete(comment: T) {
    activeMenuId = null;
    onDelete?.(comment);
  }

  function isAuthorComment(comment: T): boolean {
    return Boolean(comment.is_admin);
  }

  function getCommentAuthor(comment: T): string {
    if (comment.is_admin) return 'Administrator';
    if (!comment.author_name) return 'Anonymous';
    return comment.author_name;
  }

  function buildCommentTree(items: T[]): CommentTreeNode<T>[] {
    const map = new SvelteMap<string, CommentTreeNode<T>>();

    for (const item of items) {
      map.set(item.id, {comment: item, children: []});
    }

    const roots: CommentTreeNode<T>[] = [];

    function getRootNode(item: T): CommentTreeNode<T> | null {
      let current: T = item;
      const visited = new SvelteSet<string>([item.id]);

      while (current.parent_id && map.has(current.parent_id)) {
        const parentNode = map.get(current.parent_id)!;
        const parentId = parentNode.comment.id;
        if (visited.has(parentId)) break;

        visited.add(parentId);
        current = parentNode.comment;
      }

      return map.get(current.id) ?? null;
    }

    for (const item of items) {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const directParent = map.get(item.parent_id)!;
        node.reply_to_author = getCommentAuthor(directParent.comment);

        const rootNode = getRootNode(item);
        if (rootNode && rootNode.comment.id !== node.comment.id) {
          rootNode.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    const sortFn = (a: CommentTreeNode<T>, b: CommentTreeNode<T>) =>
      new Date(a.comment.created_at).getTime()
      - new Date(b.comment.created_at).getTime();

    roots.sort(sortFn);
    for (const root of roots) {
      if (root.children.length > 0) {
        root.children.sort(sortFn);
      }
    }
    return roots;
  }

  const commentTree = $derived(buildCommentTree(comments));
  const expandedReplies = new SvelteSet<string>();

  function toggleReplies(commentId: string) {
    if (expandedReplies.has(commentId)) {
      expandedReplies.delete(commentId);
      return;
    }

    expandedReplies.add(commentId);
  }

  function getReplyToggleLabel(count: number, expanded: boolean): string {
    const replyLabel = count === 1 ? 'reply' : 'replies';
    if (expanded) return `Hide ${count} ${replyLabel}`;
    return `View ${count} ${replyLabel}`;
  }
</script>

{#snippet renderNode(
  node: CommentTreeNode<T>,
  showReplyToggle: boolean = false
)}
  {@const comment = node.comment}
  {@const children = node.children}
  {@const hasChildren = children.length > 0}
  {@const isExpanded = expandedReplies.has(comment.id)}
  {@const replyContainerId = `reply-container-${comment.id}`}
  {@const author = getCommentAuthor(comment)}

  <div class="comment-row-wrapper flex min-w-0 items-start gap-2.5 sm:gap-3">
    <div
      class="z-10 flex size-6.5 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary select-none sm:size-7"
      aria-hidden="true">
      {#if isAuthorComment(comment)}
        <UserCheck
          class="size-3.5 sm:size-4"
          strokeWidth={1.25} />
      {:else}
        <User
          class="size-3.5 sm:size-4"
          strokeWidth={1.25} />
      {/if}
    </div>

    <div class="min-w-0 flex-1">
      <div
        class="relative inline-block max-w-full rounded-md border border-border-subtle bg-surface-card px-2.5 py-1.5 text-left sm:px-3 sm:py-2">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1">
            <span
              class="truncate text-xs leading-none font-semibold text-text-primary">
              {author}
            </span>
            {#if isAuthorComment(comment)}
              <span
                class="inline-flex shrink-0 items-center text-success"
                title="Verified Administrator"
                aria-label="Verified Administrator">
                <BadgeCheck class="size-3" />
              </span>
            {/if}
            {#if statusBadge}
              {@render statusBadge(comment)}
            {/if}
          </div>

          {#if !isAuthorComment(comment)}
            <div class="relative shrink-0">
              <IconButton
                id="comment-menu-trigger-{comment.id}"
                ariaLabel="Comment options"
                variant="ghost"
                size="xs"
                showTooltip={false}
                class="hover:bg-surface-hover"
                aria-haspopup="menu"
                aria-expanded={activeMenuId === comment.id}
                onclick={e => toggleKebabMenu(comment.id, e)}>
                <EllipsisVertical class="size-3.5" />
              </IconButton>

              {#if activeMenuId === comment.id}
                <button
                  type="button"
                  class="fixed inset-0 z-40 cursor-default"
                  onclick={() => (activeMenuId = null)}
                  aria-label="Close menu"></button>

                <div
                  use:popoverPosition={{
                    placement: 'bottom-end',
                    offset: 6,
                    padding: 8
                  }}
                  class="absolute z-50 flex min-w-[130px] flex-col popover-surface p-0 text-xs shadow-xl select-none"
                  role="menu"
                  tabindex="-1"
                  onkeydown={e => handleMenuKeydown(e, comment.id)}>
                  <div
                    class="relative z-10 flex flex-col overflow-hidden rounded-md">
                    <button
                      type="button"
                      role="menuitem"
                      class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left font-sans-title text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover hover:text-accent"
                      onclick={() => handleCopyId(comment.id)}>
                      <Copy class="size-3.5" />
                      <span>Copy ID</span>
                    </button>
                    {#if onReport}
                      <button
                        type="button"
                        role="menuitem"
                        class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left font-sans-title text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover hover:text-accent"
                        onclick={() => handleReport(comment)}>
                        <Flag class="size-3.5" />
                        <span>Report</span>
                      </button>
                    {/if}
                    {#if isAdmin && onDelete}
                      <button
                        type="button"
                        role="menuitem"
                        class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left font-sans-title text-xs font-medium text-danger transition-colors hover:bg-danger/10 hover:text-danger"
                        onclick={() => handleDelete(comment)}>
                        <Trash class="size-3.5" />
                        <span>Delete</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div
          class={cn(
            'mt-0.5 text-xs leading-relaxed text-text-primary/90 sm:text-sm',
            useContentFont && `font-content-${contentFontStore.current}`,
            useContentFont
              && contentFontStore.current === 'mono'
              && 'text-[0.78125rem]! sm:text-[0.84375rem]!'
          )}>
          {#if node.reply_to_author}
            <span class="mr-1 font-normal text-accent select-none">
              @{node.reply_to_author}
            </span>
          {/if}
          <span class="whitespace-pre-line"
            >{decodeHtmlEntities(comment.content)}</span>
        </div>
      </div>

      <div
        class="mt-1 ml-1 flex flex-wrap items-center gap-1.5 text-2xs text-text-muted select-none sm:ml-1.5 sm:gap-2">
        {#if actions}
          {@render actions(comment)}
        {:else}
          <RelativeTime
            date={comment.created_at}
            tag="time" />
        {/if}
        {#if showReplyToggle && hasChildren}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-0.5 text-2xs leading-none font-semibold text-text-muted transition-colors hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline"
            aria-expanded={isExpanded}
            aria-controls={replyContainerId}
            onclick={() => toggleReplies(comment.id)}>
            {#if isExpanded}
              <ChevronUp class="size-3 shrink-0" />
            {:else}
              <ChevronDown class="size-3 shrink-0" />
            {/if}
            <span>{getReplyToggleLabel(children.length, isExpanded)}</span>
          </button>
        {/if}
      </div>

      {#if replyTo?.id === comment.id && replyForm}
        <div class="mt-3">
          {@render replyForm(comment)}
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<div
  class={cn('comment-thread-root flex flex-col gap-4.5 sm:gap-5.5', className)}>
  {#each commentTree as rootNode (rootNode.comment.id)}
    {@const rootReplyContainerId = `reply-container-${rootNode.comment.id}`}
    {@const rootExpanded = expandedReplies.has(rootNode.comment.id)}

    <div class="comment-thread-node flex min-w-0 flex-col">
      {@render renderNode(rootNode, true)}

      {#if rootNode.children.length > 0 && rootExpanded}
        <div
          id={rootReplyContainerId}
          class="mt-3 ml-4.5 flex flex-col gap-3 sm:ml-7">
          {#each rootNode.children as childNode (childNode.comment.id)}
            {@render renderNode(childNode)}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>
