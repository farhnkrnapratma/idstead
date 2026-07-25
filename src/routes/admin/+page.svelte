<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import {
    Dialog,
    Button,
    Badge,
    Textarea,
    FormField,
    Input,
    CommentThread,
    LoadingState,
    EmptyState,
    SkipLink,
    FilterToolbar,
    FilterSelect,
    SortControl,
    SearchResultCount,
    FilterChipGroup,
    FilterEmptyState,
    createFilterSortStore,
    ThemeSelect,
    formatBlogDate,
    formatViewCount,
  } from '$lib';

  interface AdminPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    storage_path: string;
    created_at: string;
    banner_path?: string | null;
    excerpt?: string | null;
  }

  function getBannerUrl(bannerPath: string | null | undefined): string | null {
    if (!bannerPath) return null;
    const { data: res } = supabase.storage.from('blog-posts').getPublicUrl(bannerPath);
    return res.publicUrl;
  }

  let isLoading = $state(true);
  let posts = $state<AdminPost[]>([]);
  let isLoggingOut = $state(false);

  const filterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc',
  });

  let showDeletePostDialog = $state(false);
  let postToDelete = $state<AdminPost | null>(null);
  let showDeleteCommentDialog = $state(false);
  let commentIdToDelete = $state<string | null>(null);

  interface AdminComment {
    id: string;
    post_id: string;
    parent_id: string | null;
    author_name: string;
    content: string;
    is_anonymous?: boolean;
    is_approved: boolean;
    created_at: string;
    posts?: { title: string };
  }

  let comments = $state<AdminComment[]>([]);
  let replyTo = $state<AdminComment | null>(null);
  let commentContent = $state('');
  let isSubmitting = $state(false);

  type Theme = 'auto' | 'dark' | 'light';
  let theme = $state<Theme>('auto');
  const expandedPostIds = new SvelteSet<string>();

  function toggleComments(postId: string) {
    if (expandedPostIds.has(postId)) {
      expandedPostIds.delete(postId);
    } else {
      expandedPostIds.add(postId);
    }
  }

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  async function handleAdminSubmit(e: SubmitEvent, parentId: string, postId: string) {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = commentContent.trim();
    if (!trimmed) return;

    isSubmitting = true;
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          parent_id: parentId,
          author_name: 'Admin',
          content: sanitizeInput(trimmed),
          is_anonymous: false,
          is_approved: true,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        const postObj = posts.find(p => p.id === postId);
        const newComment: AdminComment = {
          ...data,
          posts: { title: postObj?.title || '' },
        };
        comments = [...comments, newComment];
        replyTo = null;
        commentContent = '';
      }
    } catch (err) {
      console.error('Error saving admin reply:', err);
      alert('Failed to post reply. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function applyTheme(newTheme: Theme) {
    theme = newTheme;
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      const isDark =
        newTheme === 'dark' ||
        (newTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  let idleTimer: ReturnType<typeof setTimeout>;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = '/admin/login';
    }, IDLE_TIMEOUT_MS);
  }

  const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

  const statusFilter = $derived(filterStore.filters['status']?.[0] || 'all');

  const filteredPosts = $derived.by(() => {
    let list = posts;

    const q = filterStore.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p => p.title.toLowerCase().includes(q) || p.storage_path.toLowerCase().includes(q),
      );
    }

    if (statusFilter === 'published') {
      list = list.filter(p => p.published);
    } else if (statusFilter === 'draft') {
      list = list.filter(p => !p.published);
    }

    const sortField = filterStore.sort.field;
    const sortDir = filterStore.sort.direction === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title) * sortDir;
      } else if (sortField === 'status') {
        return (Number(a.published) - Number(b.published)) * sortDir;
      } else if (sortField === 'views') {
        const vA = postViewsMap.get(a.id) ?? 0;
        const vB = postViewsMap.get(b.id) ?? 0;
        return (vA - vB) * sortDir;
      } else if (sortField === 'comments') {
        const cA = getPostComments(a.id).length;
        const cB = getPostComments(b.id).length;
        return (cA - cB) * sortDir;
      } else if (sortField === 'readingTime') {
        const rA = (a.excerpt || '').length;
        const rB = (b.excerpt || '').length;
        return (rA - rB) * sortDir;
      } else {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sortDir;
      }
    });
  });

  onMount(() => {
    filterStore.parseFromUrl(new URL(window.location.href));
    const saved = localStorage.getItem('theme') as Theme;
    theme = saved || 'auto';

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/admin/login';
        return;
      }

      await Promise.all([fetchPosts(), fetchComments()]);
      isLoading = false;
    })();

    resetIdleTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  });

  const postViewsMap = new SvelteMap<string, number>();

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      posts = data;
      try {
        const { data: viewsData } = await supabase.from('post_views').select('post_id');
        if (viewsData) {
          postViewsMap.clear();
          for (const row of viewsData) {
            postViewsMap.set(row.post_id, (postViewsMap.get(row.post_id) ?? 0) + 1);
          }
        }
      } catch (err) {
        console.error('Error fetching view counts:', err);
      }
    }
  }

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*, posts(title)')
      .order('created_at', { ascending: true });

    if (!error && data) {
      comments = data;
    }
  }

  async function handleLogout() {
    isLoggingOut = true;
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  async function togglePublish(post: AdminPost) {
    const newStatus = !post.published;
    const { error } = await supabase
      .from('posts')
      .update({ published: newStatus })
      .eq('id', post.id);

    if (!error) {
      posts = posts.map(p => (p.id === post.id ? { ...p, published: newStatus } : p));
    } else {
      alert('Failed to update post status. Please try again.');
    }
  }

  function confirmDeletePost(post: AdminPost) {
    postToDelete = post;
    showDeletePostDialog = true;
  }

  async function executeDeletePost() {
    if (!postToDelete) return;
    const post = postToDelete;
    postToDelete = null;

    const { error: storageError } = await supabase.storage
      .from('blog-posts')
      .remove([post.storage_path]);

    if (storageError) {
      console.warn('Storage deletion warning:', storageError);
    }

    const { error: dbError } = await supabase.from('posts').delete().eq('id', post.id);

    if (!dbError) {
      posts = posts.filter(p => p.id !== post.id);
      comments = comments.filter(comment => comment.post_id !== post.id);
    } else {
      alert('Failed to delete post. Please try again.');
    }
  }

  function confirmDeleteComment(id: string) {
    commentIdToDelete = id;
    showDeleteCommentDialog = true;
  }

  async function executeDeleteComment() {
    if (!commentIdToDelete) return;
    const id = commentIdToDelete;
    commentIdToDelete = null;

    const { error } = await supabase.from('comments').delete().eq('id', id);

    if (!error) {
      const deletedIds = getDescendantCommentIds(id, comments);
      comments = comments.filter(c => !deletedIds.has(c.id));
    } else {
      alert('Failed to delete comment. Please try again.');
    }
  }

  function getPostComments(postId: string) {
    return comments.filter(comment => comment.post_id === postId);
  }

  function getDescendantCommentIds(commentId: string, items: AdminComment[]) {
    const deletedIds = new SvelteSet([commentId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const comment of items) {
        if (comment.parent_id && deletedIds.has(comment.parent_id) && !deletedIds.has(comment.id)) {
          deletedIds.add(comment.id);
          changed = true;
        }
      }
    }

    return deletedIds;
  }

  function getCommentAuthor(comment: AdminComment) {
    return comment.is_anonymous ? 'Anonymous' : comment.author_name;
  }

  function estimateReadTimeFromText(excerpt?: string | null): string {
    const text = excerpt || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 40));
    return `${minutes} min${minutes > 1 ? 's' : ''} read`;
  }

  function getCommentIcon(comment: AdminComment) {
    if (comment.author_name === 'Admin') return 'person_shield';
    return comment.is_anonymous ? 'domino_mask' : 'person';
  }
</script>

<svelte:head>
  <title>Console — Admin</title>
</svelte:head>

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card/60 px-5 font-sans shadow-xs backdrop-blur-lg transition-colors duration-300"
  aria-label="Admin navigation">
  <div class="flex items-center gap-4">
    <a
      href="/admin"
      class="flex items-center gap-2">
      <span
        class="material-symbols-rounded text-lg text-accent select-none"
        aria-hidden="true">code</span>
      <span class="text-sm font-bold text-text-primary select-none">Console</span>
    </a>
  </div>

  <div class="flex items-center gap-2">
    <ThemeSelect
      {theme}
      onThemeChange={applyTheme} />

    <Button
      variant="secondary"
      size="md"
      onclick={handleLogout}
      disabled={isLoggingOut}
      isLoading={isLoggingOut}>
      Sign out
    </Button>
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  <section
    class="mx-auto w-full flex-1 px-6 py-14 md:w-[80%] md:max-w-none lg:w-[50%]"
    aria-label="Blog posts">
    {#if isLoading}
      <LoadingState
        label="Loading dashboard data..."
        size="lg"
        class="py-20" />
    {:else}
      <div class="mb-6 flex items-center justify-between gap-4">
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Blog Posts</h1>
        <a href="/admin/new">
          <Button
            variant="primary"
            size="md"
            leadingIcon="bi-plus-lg">
            New post
          </Button>
        </a>
      </div>

      {#if posts.length > 0}
        <div class="mb-6">
          <FilterToolbar title="Admin posts filter">
            {#snippet searchSlot()}
              <div class="w-full sm:w-64">
                <Input
                  type="search"
                  placeholder="Search posts..."
                  value={filterStore.search}
                  oninput={e => filterStore.setSearch((e.target as HTMLInputElement).value)}
                  size="sm"
                  aria-label="Search posts" />
              </div>
            {/snippet}

            {#snippet filterControlsSlot()}
              <FilterSelect
                label="Status"
                value={statusFilter}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                ]}
                onChange={val => filterStore.setSingleFilter('status', val)} />
            {/snippet}

            {#snippet countSlot()}
              <SearchResultCount
                count={filteredPosts.length}
                total={posts.length}
                itemLabel="posts" />
            {/snippet}

            {#snippet sortSlot()}
              <SortControl
                fields={[
                  { value: 'date', label: 'Date' },
                  { value: 'views', label: 'Views' },
                  { value: 'comments', label: 'Comments' },
                  { value: 'readingTime', label: 'Reading time' },
                  { value: 'title', label: 'Title' },
                  { value: 'status', label: 'Status' },
                ]}
                currentField={filterStore.sort.field}
                currentDirection={filterStore.sort.direction}
                onFieldChange={field => filterStore.setSort(field)}
                onDirectionToggle={() => filterStore.toggleSortDirection()} />
            {/snippet}

            {#snippet chipsSlot()}
              <FilterChipGroup
                chips={filterStore.activeChips}
                onRemove={(type, val) => filterStore.removeFilter(type, val)}
                onClearAll={() => filterStore.clearAllFilters()} />
            {/snippet}
          </FilterToolbar>
        </div>
      {/if}

      {#if posts.length === 0}
        <EmptyState
          title="No posts yet"
          description="You haven't published any posts. Create your first article to get started."
          icon="bi-journal-plus">
          {#snippet actions()}
            <a href="/admin/new">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="bi-plus-lg">New post</Button>
            </a>
          {/snippet}
        </EmptyState>
      {:else if filteredPosts.length === 0}
        <FilterEmptyState
          title="No matching posts found"
          description="No posts match the current filter or search criteria."
          onClearFilters={() => filterStore.clearAllFilters()} />
      {:else}
        <div
          class="boxed-list relative z-0 overflow-visible! text-left"
          role="list"
          aria-label="Blog posts list">
          {#each filteredPosts as post (post.id)}
            {@const postComments = getPostComments(post.id)}
            {@const commentCount = postComments.length}
            {@const commentWord = commentCount > 1 ? 'comments' : 'comment'}
            <div
              class="action-row group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-5 text-left transition-all duration-200 hover:bg-surface-hover/40"
              role="listitem">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  class="relative aspect-video w-full shrink-0 animate-pulse overflow-hidden rounded-lg border border-border-subtle bg-surface-subtle/50 select-none sm:w-44 md:w-48">
                  {#if post.banner_path}
                    <img
                      src={getBannerUrl(post.banner_path)}
                      alt=""
                      loading="lazy"
                      onload={e =>
                        (
                          e.currentTarget.closest('.animate-pulse') as HTMLElement | null
                        )?.classList.remove('animate-pulse')}
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {:else}
                    <div
                      class="flex h-full w-full items-center justify-center bg-linear-to-br from-surface-subtle to-surface-card select-none">
                      <i
                        class="bi bi-file-earmark-text text-2xl text-text-muted/50"
                        aria-hidden="true"></i>
                    </div>
                  {/if}
                </div>

                <div class="flex min-w-0 flex-1 flex-col gap-2 font-sans">
                  <div
                    class="flex flex-wrap items-center gap-1.5 text-xs font-medium text-text-muted select-none">
                    <span>{formatBlogDate(post.created_at)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{estimateReadTimeFromText(post.excerpt)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatViewCount(postViewsMap.get(post.id) ?? 0)}</span>
                    <span aria-hidden="true">&middot;</span>
                    {#if post.published}
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary select-none">
                        <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
                        Published
                      </span>
                    {:else}
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted select-none">
                        <span class="h-1.5 w-1.5 rounded-full bg-warning"></span>
                        Draft
                      </span>
                    {/if}
                  </div>

                  <div class="mt-0.5">
                    <h2
                      class="text-base leading-snug font-bold text-text-primary transition-colors group-hover:text-accent sm:text-lg">
                      {post.title}
                    </h2>
                    {#if post.excerpt}
                      <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                        {post.excerpt}
                      </p>
                    {/if}
                  </div>
                </div>
              </div>

              <div
                class="no-scrollbar mt-1 flex w-full flex-wrap items-center justify-between gap-2 overflow-x-auto border-t border-border-subtle/40 pt-3.5 whitespace-nowrap">
                <div class="flex flex-wrap items-center gap-2">
                  <a
                    href="/blog/{post.slug}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="shrink-0"
                    aria-label="Read article: {post.title}">
                    <button
                      type="button"
                      class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent px-3.5 text-xs font-bold whitespace-nowrap text-text-on-accent shadow-xs transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                      Read article
                    </button>
                  </a>

                  <a
                    href="/admin/new?id={post.id}"
                    class="shrink-0"
                    aria-label="Edit post: {post.title}">
                    <button
                      type="button"
                      class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold whitespace-nowrap text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                      Edit
                    </button>
                  </a>

                  <button
                    type="button"
                    onclick={() => toggleComments(post.id)}
                    aria-expanded={expandedPostIds.has(post.id)}
                    aria-controls="comments-{post.id}"
                    class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold whitespace-nowrap text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                    {expandedPostIds.has(post.id) ? 'Hide' : 'Show'}
                    {commentWord} ({commentCount})
                  </button>

                  <button
                    type="button"
                    onclick={() => togglePublish(post)}
                    class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold whitespace-nowrap text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                    {post.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>

                <button
                  type="button"
                  onclick={() => confirmDeletePost(post)}
                  class="ml-auto inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#FE4C25]/40 bg-[#FE4C25]/10 px-3 text-xs font-semibold whitespace-nowrap text-[#FE4C25] transition-colors hover:bg-[#FE4C25] hover:text-white focus-visible:ring-2 focus-visible:ring-[#FE4C25] focus-visible:outline-none">
                  <span
                    class="material-symbols-rounded text-base leading-none select-none"
                    style="font-variation-settings: 'wght' 300, 'opsz' 20;"
                    aria-hidden="true">delete_forever</span>
                  <span>Delete</span>
                </button>
              </div>

              {#if expandedPostIds.has(post.id)}
                <div
                  id="comments-{post.id}"
                  class="mt-2 flex w-full flex-col gap-6 border-t border-border-subtle/50 pt-4">
                  {#if postComments.length > 0}
                    <CommentThread
                      comments={postComments}
                      {replyTo}
                      getIcon={getCommentIcon}>
                      {#snippet actions(comment)}
                        <time datetime={comment.created_at}
                          >{formatBlogDate(comment.created_at)}</time>
                        <span aria-hidden="true">&middot;</span>
                        {#if !comment.is_approved}
                          <Badge variant="warning">Hidden</Badge>
                          <span aria-hidden="true">&middot;</span>
                        {/if}
                        {#if comment.is_approved}
                          <button
                            type="button"
                            onclick={() => {
                              replyTo = comment;
                              commentContent = '';
                            }}
                            class="cursor-pointer font-bold text-text-muted transition-colors hover:text-accent focus-visible:outline-none">
                            Reply
                          </button>
                          <span aria-hidden="true">&middot;</span>
                        {/if}
                        <button
                          type="button"
                          onclick={() => confirmDeleteComment(comment.id)}
                          aria-label="Delete comment by {getCommentAuthor(comment)}"
                          class="cursor-pointer font-bold text-[#FE4C25] transition-colors hover:text-[#e03e19] hover:underline focus-visible:outline-none">
                          Delete
                        </button>
                      {/snippet}

                      {#snippet replyForm(comment)}
                        <form
                          onsubmit={e => handleAdminSubmit(e, comment.id, post.id)}
                          class="rounded-xl border border-border-subtle bg-surface-base p-4">
                          <div class="mb-3 flex items-center justify-between gap-3">
                            <p class="text-xs font-semibold text-text-secondary">
                              Replying as Admin to <span class="font-bold text-text-primary"
                                >{getCommentAuthor(comment)}</span>
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              showEscHint
                              onclick={() => {
                                replyTo = null;
                                commentContent = '';
                              }}>
                              Cancel
                            </Button>
                          </div>

                          <div class="flex flex-col gap-2.5">
                            <FormField
                              id="reply-msg-{comment.id}"
                              label="Message"
                              counter="{2000 - commentContent.length} characters left">
                              <Textarea
                                id="reply-msg-{comment.id}"
                                required
                                rows={3}
                                maxlength={2000}
                                placeholder="Write your reply…"
                                bind:value={commentContent} />
                            </FormField>
                            <div class="flex justify-end">
                              <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                isLoading={isSubmitting}>
                                {isSubmitting ? 'Posting…' : 'Post reply'}
                              </Button>
                            </div>
                          </div>
                        </form>
                      {/snippet}
                    </CommentThread>
                  {:else}
                    <p
                      class="py-3 text-center text-xs font-medium text-text-muted italic select-none">
                      No comments yet for this post.
                    </p>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </section>
</main>

<Dialog
  bind:isOpen={showDeletePostDialog}
  title="Delete post?"
  description={'Permanently delete "' + (postToDelete?.title || '') + '"? This cannot be undone.'}
  onClose={() => (showDeletePostDialog = false)}>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showDeletePostDialog = false)}>
      Cancel
    </Button>
    <Button
      variant="destructive"
      size="md"
      onclick={executeDeletePost}>
      Delete post
    </Button>
  {/snippet}
</Dialog>

<Dialog
  bind:isOpen={showDeleteCommentDialog}
  title="Delete comment?"
  description="Permanently delete this comment and all its replies? This cannot be undone."
  onClose={() => (showDeleteCommentDialog = false)}>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showDeleteCommentDialog = false)}>
      Cancel
    </Button>
    <Button
      variant="destructive"
      size="md"
      onclick={executeDeleteComment}>
      Delete comment
    </Button>
  {/snippet}
</Dialog>
