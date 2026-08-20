<script lang="ts">
  import {supabase} from '$lib/supabase';
  import {onMount, tick} from 'svelte';
  import {X, Image as ImageIcon, AlertCircle} from '@lucide/svelte';
  import {renderMarkdown} from '$lib/markdown';
  import {
    enhanceCodeBlocks,
    splitHighlightedHtmlLines
  } from '$lib/utils/codeBlocks';
  import hljs from 'highlight.js';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {resolveHljsTheme} from '$lib/utils/hljsTheme';
  import {
    SkipLink,
    LoadingState,
    StatusBanner,
    Button,
    IconButton,
    Card,
    ImageWithSkeleton,
    FormField,
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

  let isCheckingAuth = $state(true);
  let title = $state('');
  let slug = $derived(generateSlug(title));
  let excerpt = $state('');
  let tags = $state<string[]>([]);
  let markdownContent = $state(
    '# New Post\n\nWrite your markdown content here...'
  );

  let isDark = $state(false);

  const hljsTheme = $derived(
    resolveHljsTheme(
      a11yStore.current.highContrast,
      isDark,
      codeBlockPrefsStore.current.colorScheme
    )
  );

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  let isEditMode = $state(false);
  let editId = $state<string | null>(null);
  let originalSlug = '';

  let bannerFile = $state<File | null>(null);
  let bannerPreview = $state<string | null>(null);
  let bannerPath = $state<string | null>(null);
  let bannerError = $state<string | null>(null);

  let initialTitle = $state('');
  let initialExcerpt = $state('');
  let initialTags = $state<string[]>([]);
  let initialMarkdownContent = $state('');

  const isDirty = $derived(
    title.trim() !== initialTitle.trim()
      || excerpt.trim() !== initialExcerpt.trim()
      || JSON.stringify(tags) !== JSON.stringify(initialTags)
      || markdownContent.trim() !== initialMarkdownContent.trim()
  );

  let titleError = $state('');
  let titleValid = $state(false);

  let excerptError = $state('');
  let excerptValid = $state(false);

  let tagsError = $state('');
  let tagsValid = $state(false);

  let showCancelDialog = $state(false);
  let showPublishDialog = $state(false);
  let showSaveDraftDialog = $state(false);

  $effect(() => {
    isDark = document.documentElement.classList.contains('dark');
    const observer = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  });

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
          window.location.href = '/admin/login';
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
      originalSlug = post.slug;
      excerpt = post.excerpt || '';
      tags =
        Array.isArray(post.tags) ?
          post.tags.map((t: string) => decodeHtmlEntities(t))
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
      initialMarkdownContent = markdownContent;

      bannerPath = post.banner_path || null;
      if (post.banner_path) {
        const {data: publicUrl} = supabase.storage
          .from('blog-posts')
          .getPublicUrl(post.banner_path);
        bannerPreview = publicUrl.publicUrl;
      } else {
        bannerPreview = null;
      }
    } catch (err: any) {
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
          markdownContent,
          timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
      }, 500);
      return () => clearTimeout(timer);
    }
  });

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const validateTitleField = debounce(() => {
    if (title.trim() === '') {
      titleError = '';
      titleValid = false;
    } else if (title.trim().length > 60) {
      titleError = 'Title must be 60 characters or less.';
      titleValid = false;
    } else {
      titleError = '';
      titleValid = true;
    }
  }, 500);

  const validateExcerptField = debounce(() => {
    const val = excerpt.trim();
    if (val === '') {
      excerptError = '';
      excerptValid = false;
    } else if (val.length > 250) {
      excerptError = 'Excerpt must be 250 characters or less.';
      excerptValid = false;
    } else {
      excerptError = '';
      excerptValid = true;
    }
  }, 500);

  const validateTagsField = debounce(() => {
    if (tags.length === 0) {
      tagsError = 'At least 1 tag is required.';
      tagsValid = false;
    } else if (tags.length > 5) {
      tagsError = 'Maximum 5 tags allowed.';
      tagsValid = false;
    } else {
      tagsError = '';
      tagsValid = true;
    }
  }, 300);

  function validateImageDimensions(file: File): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        const valid =
          (img.width === 1280 && img.height === 640)
          || Math.abs(ratio - 2.0) < 0.05;
        resolve(valid);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleBannerChange(e: Event) {
    bannerError = null;
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      bannerError = 'Banner must be a PNG, JPG, or WebP image.';
      input.value = '';
      return;
    }

    const isValidDimensions = await validateImageDimensions(file);
    if (!isValidDimensions) {
      bannerError =
        'Banner dimensions must have a 2:1 ratio (e.g. 1280x640 pixels).';
      input.value = '';
      return;
    }

    bannerFile = file;
    bannerPreview = URL.createObjectURL(file);
  }

  function validate() {
    const titleVal = title.trim();
    if (titleVal === '') {
      titleError = 'Title is required.';
      titleValid = false;
      return false;
    }
    if (titleVal.length > 60) {
      titleError = 'Title must be 60 characters or less.';
      titleValid = false;
      return false;
    }

    const excerptVal = excerpt.trim();
    if (excerptVal === '') {
      errorMessage = 'Excerpt is required.';
      return false;
    }
    if (excerptVal.length > 250) {
      errorMessage = 'Excerpt must be 250 characters or less.';
      return false;
    }

    if (tags.length === 0) {
      tagsError = 'At least 1 tag is required.';
      tagsValid = false;
      errorMessage = 'At least 1 tag is required.';
      return false;
    }
    if (tags.length > 5) {
      tagsError = 'Maximum 5 tags allowed.';
      tagsValid = false;
      errorMessage = 'Maximum 5 tags allowed.';
      return false;
    }

    titleError = '';
    titleValid = true;
    tagsError = '';
    tagsValid = true;
    return true;
  }

  function handleCancelClick() {
    if (isDirty) {
      showCancelDialog = true;
    } else {
      window.location.href = '/admin';
    }
  }

  function handleSaveClick(toBePublished: boolean) {
    if (!validate()) return;
    if (!markdownContent.trim()) {
      errorMessage = 'Markdown content is required.';
      return;
    }

    if (toBePublished) {
      showPublishDialog = true;
    } else {
      showSaveDraftDialog = true;
    }
  }

  async function executeSave(toBePublished: boolean) {
    showPublishDialog = false;
    showSaveDraftDialog = false;
    isSubmitting = true;
    errorMessage = null;

    try {
      const {data: userData, error: userError} = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        const {data: refreshData, error: refreshError} =
          await supabase.auth.refreshSession();
        if (refreshError || !refreshData?.session) {
          throw new Error('Your session has expired. Please log in again.');
        }
      }

      const activeUser = (await supabase.auth.getUser()).data?.user;

      if (title.trim().length > 60) {
        throw new Error(
          'Title exceeds backend maximum length of 60 characters.'
        );
      }
      if (!/^[a-z-]*$/.test(slug)) {
        throw new Error(
          'Slug contains invalid characters. Only a-z and - are allowed.'
        );
      }

      const fileName = `${slug}.md`;
      const storagePath = `${fileName}`;

      const mdBlob = new Blob([markdownContent], {type: 'text/markdown'});
      const mdFile = new File([mdBlob], fileName, {type: 'text/markdown'});

      let finalBannerPath = bannerPath;

      if (bannerFile) {
        if (bannerFile.type !== 'image/png') {
          throw new Error('Backend Validation: Banner must be a PNG image.');
        }
        const bannerFileName = `banners/${slug}.png`;
        const {error: bannerUploadError} = await supabase.storage
          .from('blog-posts')
          .upload(bannerFileName, bannerFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (bannerUploadError) {
          throw new Error(`Banner upload failed: ${bannerUploadError.message}`);
        }
        finalBannerPath = bannerFileName;
      }

      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        tags:
          tags.length > 0 ?
            tags.map(t => decodeHtmlEntities(t.trim())).filter(Boolean)
          : null,
        published: toBePublished,
        storage_path: storagePath,
        banner_path: finalBannerPath
      };

      if (isEditMode && editId) {
        const {error: uploadError} = await supabase.storage
          .from('blog-posts')
          .upload(storagePath, mdFile, {cacheControl: '3600', upsert: true});

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const updatePayload: Record<string, any> = {
          ...payload,
          updated_at: new Date().toISOString()
        };

        let {error: dbError} = await supabase
          .from('db_posts')
          .update(updatePayload)
          .eq('id', editId);

        if (
          dbError
          && (dbError.message.includes('updated_at')
            || dbError.code === '42703')
        ) {
          const {error: dbError2} = await supabase
            .from('db_posts')
            .update(payload)
            .eq('id', editId);
          dbError = dbError2;
        }

        if (dbError) {
          throw dbError;
        }

        if (originalSlug && originalSlug !== slug) {
          await supabase.storage
            .from('blog-posts')
            .remove([`${originalSlug}.md`, `banners/${originalSlug}.png`]);
        }
      } else {
        const {error: uploadError} = await supabase.storage
          .from('blog-posts')
          .upload(storagePath, mdFile, {cacheControl: '3600', upsert: true});

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const {error: dbError} = await supabase
          .from('db_posts')
          .insert(payload);

        if (dbError) {
          await supabase.storage.from('blog-posts').remove([storagePath]);
          throw dbError;
        }
      }

      const key = editId ? `autosave_edit_${editId}` : 'autosave_new';
      localStorage.removeItem(key);

      const successMessage =
        isEditMode ?
          toBePublished ? 'Post updated and published.'
          : 'Post updated and saved as draft.'
        : toBePublished ? 'Post published.'
        : 'Post saved as draft.';
      sessionStorage.setItem(
        'admin_toast',
        JSON.stringify({message: successMessage, type: 'success'})
      );
      window.location.href = '/admin';
    } catch (err) {
      const error = err as Error;
      console.error('Error saving post:', error);
      errorMessage = error.message || 'Failed to save blog post.';
      toastStore.error(errorMessage);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>{isEditMode ? 'Edit post' : 'New post'} — Console</title>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{hljsTheme}.min.css" />
</svelte:head>

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card px-5 font-sans shadow-xs"
  aria-label="Editor navigation">
  <button
    type="button"
    onclick={handleCancelClick}
    class="inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
    Back to Admin
  </button>

  <div class="flex items-center gap-2">
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply}
      class="hidden md:inline-flex" />
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  {#if isCheckingAuth}
    <LoadingState
      label="Loading post..."
      size="lg"
      class="flex-1 py-20" />
  {:else}
    <section class="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
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
        <div
          class="rounded-sm border border-border-subtle bg-surface-card p-6 text-left">
          <h2 class="mb-4 text-base font-bold text-text-primary select-none">
            {isEditMode ? 'Edit post details' : 'Post details'}
          </h2>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div class="flex flex-col gap-2 lg:col-span-5">
              <label
                for="post-banner"
                class="text-xs font-bold text-text-secondary select-none">
                Banner image
              </label>

              <div
                class="group relative flex aspect-2/1 w-full items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface-base select-none">
                {#if bannerPreview}
                  <ImageWithSkeleton
                    src={bannerPreview}
                    alt="Banner preview"
                    class="h-full w-full bg-surface-base"
                    imgClass="object-contain" />
                  <button
                    type="button"
                    onclick={() => {
                      bannerFile = null;
                      bannerPreview = null;
                      bannerPath = null;
                    }}
                    class="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/90"
                    aria-label="Remove banner">
                    <X class="size-4 leading-none" />
                  </button>
                {:else}
                  <div
                    class="flex flex-col items-center gap-2 text-text-muted/65">
                    <ImageIcon class="size-8" />
                    <span class="text-2xs">No banner uploaded</span>
                  </div>
                {/if}
              </div>

              <input
                type="file"
                id="post-banner"
                accept="image/png,image/jpeg,image/webp"
                onchange={handleBannerChange}
                class="mt-2 block w-full text-xs text-text-secondary file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-border-subtle file:bg-surface-card file:px-4 file:py-2 file:text-xs file:font-semibold file:text-text-primary hover:file:bg-surface-hover focus:outline-2 focus:outline-copilot" />

              {#if bannerError}
                <div
                  id="post-banner-fb"
                  aria-live="polite"
                  class="mt-1 text-xs font-medium">
                  <span
                    role="alert"
                    class="flex items-start gap-1.5 text-danger">
                    <AlertCircle
                      class="mt-px size-3.5 shrink-0 self-start leading-none" />
                    <span class="min-w-0 flex-1 wrap-break-word"
                      >{bannerError}</span>
                  </span>
                </div>
              {/if}
            </div>

            <div class="flex flex-col gap-2.5 lg:col-span-7">
              <FormField
                id="post-title"
                label="Title"
                required
                error={titleError}
                valid={titleValid}
                counter="{60 - title.length} left">
                <Input
                  type="text"
                  id="post-title"
                  maxlength={60}
                  placeholder="Getting Started with Rust"
                  bind:value={title}
                  error={!!titleError}
                  valid={titleValid}
                  oninput={() => {
                    titleError = '';
                    titleValid = false;
                    validateTitleField();
                  }} />
              </FormField>

              <FormField
                id="post-excerpt"
                label="Excerpt"
                required
                error={excerptError}
                valid={excerptValid}
                counter="{250 - excerpt.length} left">
                <Textarea
                  id="post-excerpt"
                  rows={3}
                  maxlength={250}
                  placeholder="Brief summary of the post (max 250 characters)…"
                  bind:value={excerpt}
                  error={!!excerptError}
                  valid={excerptValid}
                  oninput={() => {
                    excerptError = '';
                    excerptValid = false;
                    validateExcerptField();
                  }} />
              </FormField>

              <FormField
                id="post-tags"
                label="Tags"
                counter={`${tags.length}/5`}>
                {#snippet hintSnippet()}
                  Up to 5 tags, 30 characters each. Separate multiple tags with
                  commas. To include a comma within a tag name, use a backslash
                  (e.g., UI\,UX Design).
                {/snippet}
                <PillInput
                  id="post-tags"
                  bind:value={tags}
                  itemLabel="Tag"
                  placeholderEmpty="Type tag and press comma..."
                  placeholderFilled="Add tag..."
                  maxItems={5}
                  maxItemLength={30} />
              </FormField>
            </div>
          </div>
        </div>

        <MarkdownEditor
          bind:value={markdownContent}
          autosaveKey={editId ? `autosave_edit_${editId}` : 'autosave_new'}
          placeholder="Write your markdown content here..."
          minHeight="500px"
          stickyTopClass="top-15"
          onImageUpload={handleImageUploadFile} />

        <div class="mt-4 mb-10 flex flex-wrap justify-end gap-3 select-none">
          <Button
            type="ghost"
            size="md"
            onclick={handleCancelClick}>
            Cancel
          </Button>
          <Button
            type="secondary"
            size="md"
            onclick={() => handleSaveClick(false)}
            disabled={isSubmitting}>
            Save draft
          </Button>
          <Button
            type="primary"
            size="md"
            onclick={() => handleSaveClick(true)}
            disabled={isSubmitting}
            isLoading={isSubmitting}>
            {isSubmitting ? 'Publishing…' : 'Publish post'}
          </Button>
        </div>
      </form>
    </section>
  {/if}
</main>

<Dialog
  bind:isOpen={showCancelDialog}
  title="Discard unsaved changes?"
  description="You have unsaved edits. All changes will be lost."
  onClose={() => (showCancelDialog = false)}>
  {#snippet footer()}
    <Button
      type="secondary"
      size="md"
      showEscHint
      onclick={() => (showCancelDialog = false)}>Keep editing</Button>
    <Button
      type="danger"
      tone="critical"
      size="md"
      onclick={() => (window.location.href = '/admin')}>Discard changes</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:isOpen={showPublishDialog}
  title="Publish post?"
  description="This will make the post immediately visible to all readers."
  onClose={() => (showPublishDialog = false)}>
  {#snippet footer()}
    <Button
      type="secondary"
      size="md"
      showEscHint
      onclick={() => (showPublishDialog = false)}>Cancel</Button>
    <Button
      type="primary"
      size="md"
      onclick={() => executeSave(true)}>Publish post</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:isOpen={showSaveDraftDialog}
  title="Save as draft?"
  description="The post will be saved privately and won't be visible to readers."
  onClose={() => (showSaveDraftDialog = false)}>
  {#snippet footer()}
    <Button
      type="secondary"
      size="md"
      showEscHint
      onclick={() => (showSaveDraftDialog = false)}>Cancel</Button>
    <Button
      type="primary"
      size="md"
      onclick={() => executeSave(false)}>Save draft</Button>
  {/snippet}
</Dialog>

<style>
  @reference "../../global.css";
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span),
  .line-num-item {
    @apply font-mono text-[14.5px]! leading-6! tracking-normal! normal-case!;
    font-feature-settings: var(--font-feature-settings-mono) !important;
  }

  .editor-textarea,
  .editor-pre {
    @apply wrap-break-word!;
    word-break: normal !important;
  }

  .editor-textarea {
    @apply m-0! box-border! border-0! outline-hidden!;
  }

  .editor-textarea:focus,
  .editor-textarea:focus-visible {
    @apply border-transparent! shadow-none! outline-hidden!;
    --tw-ring-shadow: none !important;
  }

  .editor-code-line {
    @apply block! min-h-6! leading-6!;
  }

  .line-num-item {
    @apply box-border! flex! h-6 items-start! justify-end!;
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3) {
    @apply font-sans;
  }

  .prose-custom {
    @apply font-sans text-[0.9rem] leading-[1.7] text-(--color-body);
    --color-heading: var(--color-gh-gray-6);
    --color-body: var(--color-gh-gray-5);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot);
  }

  :global(:root.dark) .prose-custom {
    --color-heading: var(--color-gh-gray-1);
    --color-body: var(--color-gh-gray-3);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot);
  }

  .prose-custom :global(p) {
    @apply mt-5 mb-5 text-(--color-body);
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3),
  .prose-custom :global(h4),
  .prose-custom :global(h5),
  .prose-custom :global(h6) {
    @apply font-sans text-(--color-heading);
  }

  .prose-custom :global(h1) {
    @apply mt-8 mb-4 text-3xl font-extrabold;
  }

  .prose-custom :global(h2) {
    @apply mt-7 mb-3 text-2xl font-bold;
  }

  .prose-custom :global(h3) {
    @apply mt-6 mb-2 text-xl font-semibold;
  }

  .prose-custom :global(ul) {
    @apply mt-4 mb-4 list-disc pl-6;
  }

  .prose-custom :global(ol) {
    @apply mt-4 mb-4 list-decimal pl-6;
  }

  .prose-custom :global(li) {
    @apply mt-1 mb-1;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-2! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pr-3.5! pl-2!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-surface-hover px-1 py-px font-mono text-xs font-normal text-inherit;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-3.5! pl-0! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! text-inherit;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    padding-left: 4ch;
    text-indent: -4ch;
  }

  .prose-custom :global(a) {
    @apply text-(--color-link) underline;
  }

  .prose-custom :global(a):hover {
    @apply text-(--color-link-hover);
  }

  .prose-custom :global(.heading-text) {
    @apply inline! transition-none!;
  }

  .prose-custom :global(a.anchor-link) {
    @apply ml-[0.35rem]! inline-flex! items-center! justify-center! align-middle! leading-none! whitespace-nowrap! text-text-primary! no-underline! transition-none!;
  }

  :global(:root.dark) .prose-custom :global(a.anchor-link) {
    @apply text-gh-gray-4!;
  }

  .prose-custom :global(a.anchor-link svg) {
    @apply inline-block! align-middle! text-[0.85em]! leading-none! text-inherit! no-underline!;
  }

  .prose-custom :global(h1:hover .heading-text),
  .prose-custom :global(h2:hover .heading-text),
  .prose-custom :global(h3:hover .heading-text),
  .prose-custom :global(h4:hover .heading-text),
  .prose-custom :global(h5:hover .heading-text),
  .prose-custom :global(h6:hover .heading-text),
  .prose-custom :global(.heading-text):hover,
  :global(:root.dark) .prose-custom :global(h1:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h2:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h3:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h4:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h5:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h6:hover .heading-text),
  :global(:root.dark) .prose-custom :global(.heading-text):hover {
    @apply text-copilot underline underline-offset-4;
  }

  .prose-custom :global(h1:hover a.anchor-link),
  .prose-custom :global(h2:hover a.anchor-link),
  .prose-custom :global(h3:hover a.anchor-link),
  .prose-custom :global(h4:hover a.anchor-link),
  .prose-custom :global(h5:hover a.anchor-link),
  .prose-custom :global(h6:hover a.anchor-link),
  .prose-custom :global(a.anchor-link):hover,
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover,
  .prose-custom :global(h1:hover a.anchor-link svg),
  .prose-custom :global(h2:hover a.anchor-link svg),
  .prose-custom :global(h3:hover a.anchor-link svg),
  .prose-custom :global(h4:hover a.anchor-link svg),
  .prose-custom :global(h5:hover a.anchor-link svg),
  .prose-custom :global(h6:hover a.anchor-link svg),
  .prose-custom :global(a.anchor-link):hover :global(svg),
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover :global(svg) {
    @apply text-copilot! no-underline! opacity-100;
  }

  .prose-custom :global(table) {
    @apply my-6 w-full max-w-full overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold text-text-primary;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed text-text-secondary last:border-r-0;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-default;
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-r-xl border-l-4 p-4 text-xs shadow-2xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 text-xs font-bold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-content) {
    @apply leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > *:first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-alert-content > *:last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-alert-note) {
    @apply border-(--color-security) bg-security-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-(--color-security);
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-(--color-success) bg-(--color-success-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-(--color-success);
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-(--color-copilot) bg-copilot-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-(--color-copilot);
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-(--color-warning) bg-warning-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-(--color-warning-strong);
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-(--color-danger) bg-danger-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-(--color-danger);
  }
  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
