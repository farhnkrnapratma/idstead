<!-- @format -->
<script lang="ts" module>
  export interface CommentItem {
    id: string
    post_id: string
    parent_id: string | null
    author_name: string | null
    is_anonymous?: boolean
    content: string
    created_at: string
    reply_to_author?: string | null
  }

  export interface CommentTreeNode<T> {
    comment: T
    children: CommentTreeNode<T>[]
    reply_to_author?: string
  }
</script>

<script lang="ts" generics="T extends CommentItem">
  import type {Snippet} from 'svelte'
  import {SvelteMap, SvelteSet} from 'svelte/reactivity'
  import {formatBlogDate} from '../../utils/formatters'

  interface Props {
    comments: T[]
    replyTo?: T | null
    getIcon?: (comment: T) => string
    statusBadge?: Snippet<[comment: T]>
    actions?: Snippet<[comment: T]>
    replyForm?: Snippet<[comment: T]>
  }

  let {
    comments = [],
    replyTo = null,
    getIcon = getCommentIcon,
    statusBadge,
    actions,
    replyForm
  }: Props = $props()

  function getCommentAuthor(comment: T): string {
    if (comment.is_anonymous || !comment.author_name) return 'Anonymous'
    return comment.author_name
  }

  function getCommentIcon(comment: T): string {
    if (comment.is_anonymous || !comment.author_name) return 'account_circle'
    if (comment.author_name.toLowerCase().includes('farhan'))
      return 'admin_panel_settings'
    return 'person'
  }

  function buildCommentTree(items: T[]): CommentTreeNode<T>[] {
    const map = new SvelteMap<string, CommentTreeNode<T>>()

    for (const item of items) {
      map.set(item.id, {comment: item, children: []})
    }

    const roots: CommentTreeNode<T>[] = []

    function getRootNode(item: T): CommentTreeNode<T> | null {
      let current: T = item
      const visited = new SvelteSet<string>([item.id])

      while (current.parent_id && map.has(current.parent_id)) {
        const parentNode = map.get(current.parent_id)!
        const parentId = parentNode.comment.id
        if (visited.has(parentId)) break

        visited.add(parentId)
        current = parentNode.comment
      }

      return map.get(current.id) ?? null
    }

    for (const item of items) {
      const node = map.get(item.id)!
      if (item.parent_id && map.has(item.parent_id)) {
        const directParent = map.get(item.parent_id)!
        node.reply_to_author = getCommentAuthor(directParent.comment)

        const rootNode = getRootNode(item)
        if (rootNode && rootNode.comment.id !== node.comment.id) {
          rootNode.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    }

    const sortFn = (a: CommentTreeNode<T>, b: CommentTreeNode<T>) =>
      new Date(a.comment.created_at).getTime()
      - new Date(b.comment.created_at).getTime()

    roots.sort(sortFn)
    for (const root of roots) {
      if (root.children.length > 0) {
        root.children.sort(sortFn)
      }
    }
    return roots
  }

  const commentTree = $derived(buildCommentTree(comments))
  const expandedReplies = new SvelteSet<string>()

  function toggleReplies(commentId: string) {
    if (expandedReplies.has(commentId)) {
      expandedReplies.delete(commentId)
      return
    }

    expandedReplies.add(commentId)
  }

  function getReplyToggleLabel(count: number, expanded: boolean): string {
    const replyLabel = count === 1 ? 'reply' : 'replies'
    if (expanded) return `Hide ${count} ${replyLabel}`
    return `View ${count} ${replyLabel}`
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
      class="z-10 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary select-none sm:h-8 sm:w-8"
      aria-hidden="true">
      <span
        class="material-symbols-rounded text-sm sm:text-base"
        style="font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;">
        {getIcon(comment)}
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <div
        class="inline-block max-w-full rounded-2xl border border-border-subtle bg-surface-card px-3 py-1.5 text-left sm:px-3.5 sm:py-2">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-[12px] font-semibold text-text-primary">
              {author}
            </span>
          </div>
          {#if statusBadge}
            {@render statusBadge(comment)}
          {/if}
        </div>

        <div
          class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] leading-relaxed text-text-primary/90">
          {#if node.reply_to_author}
            <span
              class=" inline-flex shrink-0 items-center font-mono text-copilot select-none">
              @{node.reply_to_author}
            </span>
          {/if}
          <span class="whitespace-pre-line">{comment.content}</span>
        </div>
      </div>

      <div
        class="mt-1 ml-1.5 flex flex-wrap items-center gap-2 text-[10px] text-text-muted select-none sm:ml-2">
        {#if actions}
          {@render actions(comment)}
        {:else}
          <time datetime={comment.created_at}
            >{formatBlogDate(comment.created_at)}</time>
        {/if}
        {#if showReplyToggle && hasChildren}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="text-[10px] font-semibold text-text-muted transition-colors hover:text-copilot hover:underline focus-visible:text-copilot focus-visible:underline"
            aria-expanded={isExpanded}
            aria-controls={replyContainerId}
            onclick={() => toggleReplies(comment.id)}>
            {getReplyToggleLabel(children.length, isExpanded)}
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

<div class="comment-thread-root flex flex-col gap-8">
  {#each commentTree as rootNode (rootNode.comment.id)}
    {@const rootReplyContainerId = `reply-container-${rootNode.comment.id}`}
    {@const rootExpanded = expandedReplies.has(rootNode.comment.id)}

    <div class="comment-thread-node flex min-w-0 flex-col">
      {@render renderNode(rootNode, true)}

      {#if rootNode.children.length > 0 && rootExpanded}
        <div
          id={rootReplyContainerId}
          class="mt-4 ml-5 flex flex-col gap-4 sm:ml-8">
          {#each rootNode.children as childNode (childNode.comment.id)}
            {@render renderNode(childNode)}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>
