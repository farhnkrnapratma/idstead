<script
  lang="ts"
  module>
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

<script
  lang="ts"
  generics="T extends CommentItem">
  import type {Snippet} from 'svelte'
  import {SvelteMap, SvelteSet} from 'svelte/reactivity'
  import {ShieldCheck, User} from '@lucide/svelte'
  import RelativeTime from './RelativeTime.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    class?: string
    comments: T[]
    replyTo?: T | null
    statusBadge?: Snippet<[comment: T]>
    actions?: Snippet<[comment: T]>
    replyForm?: Snippet<[comment: T]>
  }

  let {
    class: className = '',
    comments = [],
    replyTo = null,
    statusBadge,
    actions,
    replyForm
  }: Props = $props()

  function getCommentAuthor(comment: T): string {
    if (comment.is_anonymous || !comment.author_name) return 'Anonymous'
    return comment.author_name
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
      {#if comment.author_name
        ?.toLowerCase()
        .includes('farhan') || comment.author_name === 'Admin'}
        <ShieldCheck class="size-4 text-copilot" />
      {:else}
        <User class="size-4" />
      {/if}
    </div>

    <div class="min-w-0 flex-1">
      <div
        class="inline-block max-w-full rounded-sm border border-border-subtle bg-surface-card px-3 py-1.5 text-left sm:px-3.5 sm:py-2">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-text-primary">
              {author}
            </span>
          </div>
          {#if statusBadge}
            {@render statusBadge(comment)}
          {/if}
        </div>

        <div
          class="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm leading-relaxed text-text-primary/90">
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
        class="mt-1 ml-1.5 flex flex-wrap items-center gap-2 text-2xs text-text-muted select-none sm:ml-2">
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
            class="text-2xs font-semibold text-text-muted transition-colors hover:text-copilot hover:underline focus-visible:text-copilot focus-visible:underline"
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

<div class={cn('comment-thread-root flex flex-col gap-8', className)}>
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
