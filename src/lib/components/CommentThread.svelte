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
  import type {Snippet} from 'svelte';
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
  import Dropdown from './Dropdown.svelte';
  import {focusScope} from '../utils/focusScope';
  import {shortcut} from '../utils/shortcut.svelte';
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
    focusCommentId?: string | null;
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
    focusCommentId = null,
    onReport,
    onDelete
  }: Props = $props();

  async function handleCopyId(commentId: string) {
    try {
      await navigator.clipboard.writeText(commentId);
      toastStore.success('Comment ID copied to clipboard');
    } catch {
      toastStore.error('Failed to copy Comment ID');
    }
  }

  function handleReport(comment: T) {
    onReport?.(comment);
  }

  function handleDelete(comment: T) {
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

  $effect(() => {
    if (!focusCommentId) return;
    const root = commentTree.find(
      node =>
        node.comment.id === focusCommentId
        || node.children.some(child => child.comment.id === focusCommentId)
    );
    if (root && root.children.length > 0) expandedReplies.add(root.comment.id);
  });

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
  {@const commentScope = `comment-${comment.id}`}

  <div
    id="comment-{comment.id}"
    use:focusScope={commentScope}
    class={cn(
      'comment-row-wrapper flex min-w-0 items-start gap-2.5 rounded-md transition-shadow sm:gap-3',
      focusCommentId === comment.id ?
        'ring-2 ring-accent ring-offset-2 ring-offset-background'
      : ''
    )}>
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
        class="relative inline-block max-w-full rounded-md border border-border-subtle bg-surface-card px-2 py-1.5 text-left">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1">
            <span
              class="truncate text-xs leading-none font-semibold text-text-primary">
              {author}
            </span>
            {#if isAuthorComment(comment)}
              <span
                class="inline-flex shrink-0 items-center text-success"
                title="Verified administrator"
                aria-label="Verified administrator">
                <BadgeCheck class="size-3" />
              </span>
            {/if}
            {#if statusBadge}
              {@render statusBadge(comment)}
            {/if}
          </div>

          {#if isAdmin || !isAuthorComment(comment)}
            <Dropdown
              ariaLabel="Comment options"
              placement="bottom-end"
              shortcutScope={commentScope}
              actions={[
                {
                  label: 'Copy ID',
                  icon: Copy,
                  onSelect: () => handleCopyId(comment.id),
                  shortcut: {
                    combo: 'I',
                    scope: commentScope,
                    label: 'Copy comment ID',
                    placement: 'inline'
                  }
                },
                ...(onReport ?
                  [
                    {
                      label: 'Report',
                      icon: Flag,
                      onSelect: () => handleReport(comment),
                      shortcut: {
                        combo: 'F',
                        scope: commentScope,
                        label: 'Report comment',
                        placement: 'inline' as const
                      }
                    }
                  ]
                : []),
                ...(isAdmin && onDelete ?
                  [
                    {
                      label: 'Delete',
                      icon: Trash,
                      danger: true,
                      onSelect: () => handleDelete(comment)
                    }
                  ]
                : [])
              ]}>
              {#snippet trigger({isOpen, toggle})}
                <IconButton
                  ariaLabel="Comment options"
                  variant="ghost"
                  size="xs"
                  showTooltip={false}
                  class="hover:bg-surface-hover"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  keyboardShortcut="O"
                  shortcutScope={commentScope}
                  shortcutLabel="Comment options"
                  onclick={toggle}>
                  <EllipsisVertical class="size-3.5" />
                </IconButton>
              {/snippet}
            </Dropdown>
          {/if}
        </div>

        <div
          class={cn(
            'mt-0.5 text-xs leading-relaxed font-normal text-text-secondary sm:text-sm',
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
            use:shortcut={{
              combo: 'T',
              scope: commentScope,
              label: 'Toggle replies'
            }}
            class="relative inline-flex cursor-pointer items-center gap-0.5 text-2xs leading-none font-semibold text-text-muted transition-colors hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline"
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
