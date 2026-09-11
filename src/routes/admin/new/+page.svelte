<script lang="ts">
  import {FieldValidation, requiredText} from '$lib/fieldValidation';
  import {supabase} from '$lib/supabase';
  import {onDestroy, onMount, tick} from 'svelte';
  import {ArrowLeft} from '@lucide/svelte';
  import {TRANSLATION_LOCALES} from '$lib/translationLocales';
  import {
    SkipLink,
    LoadingState,
    StatusBanner,
    Button,
    FormField,
    FieldMessage,
    Input,
    Textarea,
    MarkdownEditor,
    ThemeSelect,
    Dialog,
    toastStore,
    PillInput,
    decodeHtmlEntities,
    sanitizeInput
  } from '$lib';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import PageContainer from '$lib/layout/PageContainer.svelte';
  import BannerImageUpload from '$lib/components/BannerImageUpload.svelte';
  import {bannerUrl, type BannerChange} from '$lib/blogBanner';
  import {
    submitPost,
    rememberPostSave,
    recallPostSave,
    PostSaveError
  } from '$lib/postSaveClient';

  let isCheckingAuth = $state(true);
  let title = $state('');
  let slug = $derived(generateSlug(title));
  let excerpt = $state('');
  let tags = $state<string[]>([]);
  let collaborators = $state<string[]>([]);
  let markdownContent = $state(
    '# New Post\n\nWrite your markdown content here...'
  );

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  let isEditMode = $state(false);
  let editId = $state<string | null>(null);
  let postRevision = $state<number | null>(null);
  let savedBannerUrl = $state<string | null>(null);
  let bannerChange = $state.raw<BannerChange>({operation: 'keep'});
  let bannerBlocked = $state(false);
  let pendingSave = $state.raw<FormData | null>(null);
  let operationKey = '';
  let loadFailed = $state(false);

  let initialTitle = $state('');
  let initialExcerpt = $state('');
  let initialTags = $state<string[]>([]);
  let initialCollaborators = $state<string[]>([]);
  let initialMarkdownContent = $state('');

  const isDirty = $derived(
    bannerChange.operation !== 'keep'
      || bannerBlocked
      || !!pendingSave
      || title.trim() !== initialTitle.trim()
      || excerpt.trim() !== initialExcerpt.trim()
      || JSON.stringify(tags) !== JSON.stringify(initialTags)
      || JSON.stringify(collaborators) !== JSON.stringify(initialCollaborators)
      || markdownContent.trim() !== initialMarkdownContent.trim()
  );

  let titleError = $state('');
  let titleValid = $state(false);

  let excerptError = $state('');
  let excerptValid = $state(false);

  let contentError = $state('');
  let tagsError = $state('');
  let tagsValid = $state(false);

  let showCancelDialog = $state(false);
  let submittingAction = $state<'publish' | 'draft' | null>(null);

  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  let idleTimer: ReturnType<typeof setTimeout>;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = '/admin/login';
    }, IDLE_TIMEOUT_MS);
  }

  const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart'
  ] as const;

  onMount(() => {
    (async () => {
      try {
        const {data: sessionData} = await supabase.auth.getSession();
        if (!sessionData.session) {
          const target = window.location.pathname + window.location.search;
          window.location.href = `/admin/login?redirectTo=${encodeURIComponent(target)}`;
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
          editId = id;
          isEditMode = true;
          await loadPostForEdit(id);
        } else {
          initialTitle = '';
          initialExcerpt = '';
          initialTags = [];
          initialMarkdownContent =
            '# New Post\n\nWrite your markdown content here...';
        }

        operationKey = `post-save:${id || 'new'}`;
        pendingSave = await recallPostSave(operationKey);
        if (pendingSave)
          errorMessage =
            'A previous Save needs reconciliation. Use Retry Save to confirm it.';

        const key = id ? `autosave_edit_${id}` : 'autosave_new';
        const savedDraft = localStorage.getItem(key);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            const defaultTemplate =
              '# New Post\n\nWrite your markdown content here...';
            if (!id) {
              title = parsed.title || title;
              excerpt = parsed.excerpt || excerpt;
              tags =
                Array.isArray(parsed.tags) ?
                  parsed.tags.map((t: any) => decodeHtmlEntities(String(t)))
                : tags;
              collaborators =
                Array.isArray(parsed.collaborators) ?
                  parsed.collaborators.map((c: any) =>
                    decodeHtmlEntities(String(c))
                  )
                : collaborators;
              if (
                parsed.markdownContent
                && parsed.markdownContent !== defaultTemplate
              ) {
                markdownContent = parsed.markdownContent;
              }
            } else {
              if (
                parsed.markdownContent
                && parsed.markdownContent !== defaultTemplate
                && parsed.markdownContent !== markdownContent
              ) {
                title = parsed.title || title;
                excerpt = parsed.excerpt || excerpt;
                tags =
                  Array.isArray(parsed.tags) ?
                    parsed.tags.map((t: any) => decodeHtmlEntities(String(t)))
                  : tags;
                collaborators =
                  Array.isArray(parsed.collaborators) ?
                    parsed.collaborators.map((c: any) =>
                      decodeHtmlEntities(String(c))
                    )
                  : collaborators;
                markdownContent = parsed.markdownContent;
              }
            }
          } catch (e) {
            console.error('Failed to parse autosave draft', e);
          }
        }
      } catch (err: any) {
        console.error('Failed initializing edit page:', err);
        errorMessage = err?.message || 'Failed loading post data.';
      } finally {
        isCheckingAuth = false;
      }
    })();

    resetIdleTimer();
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetIdleTimer, {passive: true})
    );

    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetIdleTimer)
      );
    };
  });

  async function loadPostForEdit(id: string) {
    try {
      const {data: post, error} = await supabase
        .from('db_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !post) {
        throw error || new Error('Post not found');
      }

      title = post.title;
      postRevision = post.post_revision;
      savedBannerUrl = bannerUrl(post);
      excerpt = post.excerpt || '';
      tags =
        Array.isArray(post.tags) ?
          post.tags.map((t: string) => decodeHtmlEntities(t))
        : [];
      collaborators =
        Array.isArray(post.collaborators) ?
          post.collaborators
            .map((c: string) => decodeHtmlEntities(c.trim().replace(/^@/, '')))
            .filter(Boolean)
        : [];

      let fileText = '';
      if (post.storage_path) {
        try {
          const {data: fileData, error: fileError} = await supabase.storage
            .from('blog-posts')
            .download(post.storage_path);

          if (!fileError && fileData) {
            fileText = await fileData.text();
          } else {
            const {data: publicUrlData} = supabase.storage
              .from('blog-posts')
              .getPublicUrl(post.storage_path);
            const fileRes = await fetch(publicUrlData.publicUrl);
            if (fileRes.ok) {
              fileText = await fileRes.text();
            }
          }
        } catch (storageErr) {
          console.error('Failed downloading post markdown file:', storageErr);
        }
      }

      markdownContent = fileText;
      initialTitle = title;
      initialExcerpt = excerpt;
      initialTags = [...tags];
      initialCollaborators = [...collaborators];
      initialMarkdownContent = markdownContent;
    } catch (err: any) {
      loadFailed = true;
      console.error('Failed in loadPostForEdit:', err);
      errorMessage = err?.message || 'Failed to load post for editing';
    }
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function handleImageUploadFile(file: File): Promise<string | null> {
    const allowedTypes = ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      errorMessage = 'Supported image formats are PNG, WebP, JPEG, JPG.';
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorMessage = 'Image size must be 5MB or less.';
      return null;
    }
    isSubmitting = true;
    errorMessage = null;
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `images/${slug || 'post'}-${Date.now()}.${ext}`;
      const {error: uploadError} = await supabase.storage
        .from('blog-posts')
        .upload(path, file, {cacheControl: '3600', upsert: true});
      if (uploadError) throw uploadError;
      const {data: urlData} = supabase.storage
        .from('blog-posts')
        .getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      const error = err as Error;
      errorMessage = error.message || 'Failed to upload image.';
      return null;
    } finally {
      isSubmitting = false;
    }
  }

  $effect(() => {
    if (markdownContent && !isCheckingAuth) {
      const timer = setTimeout(() => {
        const key = editId ? `autosave_edit_${editId}` : 'autosave_new';
        const data = {
          title,
          excerpt,
          tags,
          collaborators,
          markdownContent,
          timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
      }, 500);
      return () => clearTimeout(timer);
    }
  });

  const validation = new FieldValidation();
  onDestroy(() => validation.destroy());
  validation.register('content', {
    value: () => markdownContent,
    baseline: () => (isEditMode ? initialMarkdownContent : undefined),
    validate: requiredText('Markdown content'),
    report: result => {
      contentError = result.error;
    }
  });
  validation.register('title', {
    value: () => title,
    baseline: () => (isEditMode ? initialTitle : undefined),
    validate: requiredText('Title', 60),
    report: result => {
      titleError = result.error;
      titleValid = result.valid;
    }
  });
  validation.register('excerpt', {
    value: () => excerpt,
    baseline: () => (isEditMode ? initialExcerpt : undefined),
    validate: value =>
      value.trim().length > 250 ?
        'Excerpt must be 250 characters or less.'
      : '',
    report: result => {
      excerptError = result.error;
      excerptValid = result.valid;
    }
  });
  validation.register('tags', {
    value: () => tags,
    baseline: () => (isEditMode ? initialTags : undefined),
    validate: value =>
      !value.length ? 'At least 1 tag is required.'
      : value.length > 5 ? 'Maximum 5 tags allowed.'
      : '',
    report: result => {
      tagsError = result.error;
      tagsValid = result.valid;
    }
  });
  function validate() {
    return validation.submit(undefined, !isEditMode);
  }

  function handleCancelClick() {
    if (isSubmitting) return;
    if (isDirty) {
      showCancelDialog = true;
    } else {
      window.location.href = '/admin';
    }
  }

  async function handleSaveClick(toBePublished: boolean) {
    if (isSubmitting || bannerBlocked || loadFailed) return;
    if (!pendingSave && !(await validate())) return;

    await executeSave(toBePublished);
  }

  async function executeSave(toBePublished: boolean) {
    if (isSubmitting || bannerBlocked || loadFailed) return;
    isSubmitting = true;
    submittingAction = toBePublished ? 'publish' : 'draft';
    errorMessage = null;
    try {
      const {data: sessionData} = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken)
        throw new Error('Your session has expired. Please log in again.');
      if (!pendingSave) {
        let aiSummary: string | null = null;
        let aiTldr: string[] | null = null;
        const shouldGenerate =
          toBePublished
          && (!isEditMode
            || markdownContent.trim() !== initialMarkdownContent.trim());
        if (shouldGenerate) {
          try {
            const response = await fetch('/api/internal/blog/generate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                markdown: markdownContent,
                needsExcerpt: excerpt.trim() === '',
                title: title.trim(),
                excerpt: excerpt.trim() || null
              })
            });
            if (response.ok) {
              const generated = await response.json();
              if (!excerpt.trim() && generated.excerpt)
                excerpt = generated.excerpt;
              aiSummary = generated.summary ?? null;
              aiTldr = generated.tldr ?? null;
            }
          } catch (error) {
            console.error('AI content generation failed:', error);
          }
        }
        const metadata = {
          operationId: crypto.randomUUID(),
          id: editId || crypto.randomUUID(),
          revision: postRevision,
          kind: 'save',
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || null,
          tags: tags.map(t => decodeHtmlEntities(t.trim())).filter(Boolean),
          collaborators: collaborators
            .map(c => decodeHtmlEntities(c.trim().replace(/^@/, '')))
            .filter(Boolean),
          published: toBePublished,
          bannerOperation: bannerChange.operation,
          ...(!isEditMode || aiSummary !== null ? {summary: aiSummary} : {}),
          ...(!isEditMode || aiTldr !== null ? {tldr: aiTldr} : {})
        };
        const form = new FormData();
        form.set('post', JSON.stringify(metadata));
        form.set('markdown', markdownContent);
        if (bannerChange.operation === 'replace')
          form.set('banner', bannerChange.file, 'banner.webp');
        await rememberPostSave(operationKey, form);
        pendingSave = form;
      }
      const form = pendingSave;
      const submitted = JSON.parse(String(form.get('post')));
      submittingAction = submitted.published ? 'publish' : 'draft';
      const result = await submitPost(form, accessToken);
      editId = result.post.id;
      postRevision = result.post.post_revision;
      savedBannerUrl = bannerUrl(result.post);
      bannerChange = {operation: 'keep'};
      title = submitted.title;
      excerpt = submitted.excerpt || '';
      tags = submitted.tags;
      collaborators = submitted.collaborators;
      markdownContent = String(form.get('markdown'));
      const missing: string[] = [];
      if (submitted.published) {
        await Promise.all(
          TRANSLATION_LOCALES.map(async locale => {
            try {
              const response = await fetch('/api/internal/blog/translate', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  postId: editId,
                  slug: submitted.slug,
                  locale,
                  title: submitted.title,
                  excerpt: submitted.excerpt,
                  summary: submitted.summary ?? null,
                  tldr: submitted.tldr ?? null,
                  markdown: markdownContent
                })
              });
              const translation = await response.json();
              if (
                !response.ok
                || (!translation.stored && !translation.skipped)
                || (translation.stored && !translation.bodyTranslated)
              )
                missing.push(locale);
            } catch {
              missing.push(locale);
            }
          })
        );
      }
      await rememberPostSave(operationKey, null);
      pendingSave = null;
      localStorage.removeItem(
        isEditMode ? `autosave_edit_${editId}` : 'autosave_new'
      );
      isEditMode = true;
      operationKey = `post-save:${editId}`;
      window.history.replaceState(
        window.history.state,
        '',
        `/admin/new?id=${editId}`
      );
      initialTitle = title;
      initialExcerpt = excerpt;
      initialTags = [...tags];
      initialCollaborators = [...collaborators];
      initialMarkdownContent = markdownContent;
      toastStore.success(
        submitted.published ? 'Post published.' : 'Post saved as draft.'
      );
      if (missing.length)
        toastStore.error(
          `Post saved. Translations incomplete for: ${missing.join(', ')}.`
        );
    } catch (error) {
      if (error instanceof PostSaveError && error.definitive) {
        await rememberPostSave(operationKey, null);
        pendingSave = null;
      }
      errorMessage =
        error instanceof Error ? error.message : 'Post could not be saved.';
      toastStore.error(errorMessage);
    } finally {
      isSubmitting = false;
      submittingAction = null;
    }
  }
</script>

<svelte:head>
  <title>{isEditMode ? 'Edit post' : 'New post'} — Console</title>
</svelte:head>

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-12 w-full items-center justify-between border-b border-border-subtle bg-surface-card px-3 font-sans shadow-xs sm:h-14 sm:px-5"
  aria-label="Editor navigation">
  <Button
    type="outline"
    size="sm"
    onclick={handleCancelClick}>
    <ArrowLeft class="size-3.5 shrink-0" />
    Admin
  </Button>

  <div class="flex items-center gap-2">
    <ThemeSelect
      variant="ghost"
      theme={themeStore.current}
      onThemeChange={themeStore.apply} />
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col bg-surface-base pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
  {#if isCheckingAuth}
    <PageContainer
      as="section"
      width="editor"
      class="flex-1 px-4 py-10">
      <LoadingState
        variant="post-editor"
        label="Loading post..." />
    </PageContainer>
  {:else}
    <PageContainer
      as="section"
      width="editor"
      class="flex-1 px-4 py-10">
      {#if errorMessage}
        <StatusBanner
          variant="error"
          message={errorMessage}
          class="mb-6" />
      {/if}

      <form
        onsubmit={e => e.preventDefault()}
        novalidate
        class="flex flex-col gap-4">
        <fieldset
          disabled={isSubmitting || !!pendingSave || loadFailed}
          class="contents">
          <div
            class="rounded-md border border-border-subtle bg-surface-card p-4 text-left sm:p-5">
            <h2 class="mb-3 text-base font-bold text-text-primary select-none">
              {isEditMode ? 'Edit post details' : 'Post details'}
            </h2>

            <div class="flex flex-col gap-4">
              <BannerImageUpload
                savedUrl={savedBannerUrl}
                savedRevision={postRevision ?? 0}
                disabled={isSubmitting || !!pendingSave}
                onprepared={change => {
                  bannerChange = change;
                }}
                onblocked={blocked => {
                  bannerBlocked = blocked;
                }} />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="post-title"
                  label="Title"
                  variant="floating"
                  required
                  hideAsterisk
                  maxlength={60}
                  currentLength={title.length}
                  error={titleError}
                  valid={titleValid}
                  counter={`${title.length}/60`}
                  hideFeedbackSlot
                  class="shrink-0">
                  <Input
                    type="text"
                    id="post-title"
                    maxlength={60}
                    bind:value={title}
                    error={!!titleError}
                    valid={titleValid}
                    oninput={() => {
                      titleError = '';
                      titleValid = false;
                      queueMicrotask(() => validation.input('title'));
                    }}
                    onblur={() => {
                      void validation.check('title');
                    }} />
                </FormField>

                <FormField
                  id="post-excerpt"
                  label="Excerpt"
                  variant="floating"
                  maxlength={250}
                  currentLength={excerpt.length}
                  error={excerptError}
                  valid={excerptValid}
                  counter={`${excerpt.length}/250`}
                  hideFeedbackSlot>
                  <Textarea
                    id="post-excerpt"
                    rows={2}
                    maxlength={250}
                    bind:value={excerpt}
                    error={!!excerptError}
                    valid={excerptValid}
                    oninput={() => {
                      excerptError = '';
                      excerptValid = false;
                      queueMicrotask(() => validation.input('excerpt'));
                    }}
                    onblur={() => {
                      void validation.check('excerpt');
                    }} />
                </FormField>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="post-tags"
                  label="Tags"
                  variant="floating"
                  counter={`${tags.length}/5`}
                  error={tagsError}
                  valid={tagsValid}>
                  <PillInput
                    id="post-tags"
                    bind:value={
                      () => tags,
                      value => {
                        tags = value;
                        validation.input('tags');
                      }
                    }
                    onblur={() => {
                      void validation.check('tags');
                    }}
                    itemLabel="Tag"
                    placeholderEmpty="Type tag and press comma..."
                    placeholderFilled="Add tag..."
                    maxItems={5}
                    maxItemLength={30} />
                </FormField>

                <FormField
                  id="post-collaborators"
                  label="Collaborators"
                  variant="floating"
                  counter={`${collaborators.length}/4`}
                  hideFeedbackSlot>
                  <PillInput
                    id="post-collaborators"
                    bind:value={collaborators}
                    itemLabel="Collaborator"
                    placeholderEmpty="Type GitHub username and press comma..."
                    placeholderFilled="Add collaborator..."
                    maxItems={4}
                    maxItemLength={39}
                    transformItem={item => item.replace(/^@+/, '')} />
                </FormField>
              </div>
            </div>
          </div>

          {#if contentError}<FieldMessage message={contentError} />{/if}
          <MarkdownEditor
            bind:value={
              () => markdownContent,
              value => {
                markdownContent = value;
                validation.input('content');
              }
            }
            onblur={() => {
              void validation.check('content');
            }}
            autosaveKey={editId ? `autosave_edit_${editId}` : 'autosave_new'}
            placeholder="Write your markdown content here..."
            minHeight="500px"
            stickyTopClass="top-12 sm:top-14"
            onImageUpload={handleImageUploadFile} />
        </fieldset>
        <div
          class="mt-4 mb-10 flex flex-col gap-2.5 select-none sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Button
            type="danger"
            size="md"
            class="order-2 w-full sm:order-1 sm:w-auto"
            onclick={handleCancelClick}
            disabled={isSubmitting}>
            {isEditMode ? 'Discard changes' : 'Discard draft'}
          </Button>

          <div
            class="order-1 grid grid-cols-2 gap-2.5 sm:order-2 sm:flex sm:items-center sm:gap-3">
            <Button
              type="secondary"
              size="md"
              class="w-full sm:w-auto"
              onclick={() => handleSaveClick(false)}
              disabled={isSubmitting || bannerBlocked || loadFailed}
              isLoading={submittingAction === 'draft'}>
              {submittingAction === 'draft' ? 'Saving draft…'
              : pendingSave ? 'Retry Save'
              : 'Save draft'}
            </Button>
            <Button
              type="primary"
              size="md"
              class="w-full sm:w-auto"
              onclick={() => handleSaveClick(true)}
              disabled={isSubmitting || bannerBlocked || loadFailed}
              isLoading={submittingAction === 'publish'}>
              {submittingAction === 'publish' ? 'Publishing…'
              : pendingSave ? 'Retry Save'
              : 'Publish post'}
            </Button>
          </div>
        </div>
      </form>
    </PageContainer>
  {/if}
</main>

<Dialog
  bind:isOpen={showCancelDialog}
  title={isEditMode ? 'Discard unsaved changes?' : 'Discard draft?'}
  description={isEditMode ?
    'You have unsaved edits. All changes will be lost.'
  : 'You have an unsaved draft. All changes will be lost.'}
  onClose={() => (showCancelDialog = false)}>
  {#snippet footer()}
    <Button
      type="secondary"
      size="md"
      onclick={() => (showCancelDialog = false)}>Keep editing</Button>
    <Button
      type="danger"
      tone="critical"
      size="md"
      onclick={() => (window.location.href = '/admin')}
      >{isEditMode ? 'Discard changes' : 'Discard draft'}</Button>
  {/snippet}
</Dialog>
