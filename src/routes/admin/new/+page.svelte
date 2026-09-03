<script lang="ts">
  import {supabase} from '$lib/supabase';
  import {onMount, tick} from 'svelte';
  import {
    X,
    Image as ImageIcon,
    AlertCircle,
    ArrowLeft,
    ImageUp
  } from '@lucide/svelte';
  import {renderMarkdown} from '$lib/markdown';
  import {
    enhanceCodeBlocks,
    splitHighlightedHtmlLines
  } from '$lib/utils/codeBlocks';
  import hljs from 'highlight.js';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {cn} from '$lib/utils/cn';
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
  import {compressImageToWebp} from '$lib/utils/imageCompressor';

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
  let originalSlug = '';

  let bannerFile = $state<File | null>(null);
  let bannerFileName = $state('');
  let bannerPreview = $state<string | null>(null);
  let bannerPath = $state<string | null>(null);
  let bannerError = $state<string | null>(null);
  let isCompressingBanner = $state(false);
  let isDraggingOverBanner = $state(false);
  let bannerFileInput = $state<HTMLInputElement | null>(null);

  const displayBannerName = $derived.by(() => {
    if (bannerFileName) return bannerFileName;
    if (bannerFile?.name) return bannerFile.name;
    if (bannerPath) {
      const parts = bannerPath.split('/');
      return parts[parts.length - 1];
    }
    return '';
  });

  let initialTitle = $state('');
  let initialExcerpt = $state('');
  let initialTags = $state<string[]>([]);
  let initialCollaborators = $state<string[]>([]);
  let initialMarkdownContent = $state('');

  const isDirty = $derived(
    title.trim() !== initialTitle.trim()
      || excerpt.trim() !== initialExcerpt.trim()
      || JSON.stringify(tags) !== JSON.stringify(initialTags)
      || JSON.stringify(collaborators) !== JSON.stringify(initialCollaborators)
      || markdownContent.trim() !== initialMarkdownContent.trim()
  );

  let titleError = $state('');
  let titleValid = $state(false);

  let excerptError = $state('');
  let excerptValid = $state(false);

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
      originalSlug = post.slug;
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
          collaborators,
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

  async function processBannerFile(file: File) {
    bannerError = null;
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/tiff',
      'image/tif'
    ];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff'];

    if (
      !allowedMimeTypes.includes(file.type.toLowerCase())
      && !allowedExts.includes(ext)
    ) {
      bannerError =
        'Supported image formats are JPEG, PNG, WebP, AVIF, and TIFF.';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      bannerError = 'Image size must be 25MB or less.';
      return;
    }

    isCompressingBanner = true;
    try {
      const compressedFile = await compressImageToWebp(file);
      bannerFile = compressedFile;
      bannerFileName = file.name;
      if (bannerPreview && bannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreview);
      }
      bannerPreview = URL.createObjectURL(compressedFile);
    } catch (err: unknown) {
      const error = err as Error;
      bannerError = error.message || 'Image compression failed.';
    } finally {
      isCompressingBanner = false;
      if (bannerFileInput) bannerFileInput.value = '';
    }
  }

  function handleBannerChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void processBannerFile(file);
    }
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
    if (isSubmitting) return;
    if (isDirty) {
      showCancelDialog = true;
    } else {
      window.location.href = '/admin';
    }
  }

  async function handleSaveClick(toBePublished: boolean) {
    if (isSubmitting) return;
    if (!validate()) return;
    if (!markdownContent.trim()) {
      errorMessage = 'Markdown content is required.';
      return;
    }

    await executeSave(toBePublished);
  }

  async function executeSave(toBePublished: boolean) {
    isSubmitting = true;
    submittingAction = toBePublished ? 'publish' : 'draft';
    errorMessage = null;
    let newPostId: string | null = null;

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
        const ext = bannerFile.type === 'image/webp' ? 'webp' : 'png';
        const bannerFileName = `banners/${slug}.${ext}`;
        const {error: bannerUploadError} = await supabase.storage
          .from('blog-posts')
          .upload(bannerFileName, bannerFile, {
            contentType: bannerFile.type || 'image/webp',
            cacheControl: '3600',
            upsert: true
          });

        if (bannerUploadError) {
          throw new Error(`Banner upload failed: ${bannerUploadError.message}`);
        }
        finalBannerPath = bannerFileName;
      }

      let aiSummary: string | null = null;
      let aiTldr: string[] | null = null;
      const missingTranslationLocales: string[] = [];
      const addMissingLocale = (locale: string) => {
        if (!missingTranslationLocales.includes(locale)) {
          missingTranslationLocales.push(locale);
        }
      };
      const needsExcerpt = excerpt.trim() === '';
      const shouldGenerateAiFields =
        toBePublished
        && (!isEditMode
          || markdownContent.trim() !== initialMarkdownContent.trim());

      const {data: sessionData} = await supabase.auth.getSession();
      const accessToken: string | undefined = sessionData.session?.access_token;

      if (accessToken) {
        const validateRes = await fetch('/api/internal/blog/validate-define', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({markdown: markdownContent})
        });
        if (!validateRes.ok) {
          const errBody = await validateRes.json().catch(() => null);
          throw new Error(
            errBody?.error?.message
              ?? errBody?.message
              ?? 'The :::define block contains errors.'
          );
        }
      }

      if (shouldGenerateAiFields) {
        try {
          if (accessToken) {
            const aiRes = await fetch('/api/internal/blog/generate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                markdown: markdownContent,
                needsExcerpt,
                title: title.trim(),
                excerpt: excerpt.trim() || null
              })
            });
            if (aiRes.ok) {
              const aiResult = await aiRes.json();
              if (needsExcerpt && aiResult.excerpt) {
                excerpt = aiResult.excerpt;
              }
              aiSummary = aiResult.summary ?? null;
              aiTldr = aiResult.tldr ?? null;
            }
          }
        } catch (err) {
          console.error('AI content generation failed:', err);
        }
      }

      const payload: Record<string, any> = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        tags:
          tags.length > 0 ?
            tags.map(t => decodeHtmlEntities(t.trim())).filter(Boolean)
          : null,
        collaborators:
          collaborators.length > 0 ?
            collaborators
              .map(c => decodeHtmlEntities(c.trim().replace(/^@/, '')))
              .filter(Boolean)
          : [],
        published: toBePublished,
        storage_path: storagePath,
        banner_path: finalBannerPath,
        ...(!isEditMode || aiSummary !== null ? {summary: aiSummary} : {}),
        ...(!isEditMode || aiTldr !== null ? {tldr: aiTldr} : {})
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
            .remove([
              `${originalSlug}.md`,
              `banners/${originalSlug}.png`,
              `banners/${originalSlug}.webp`
            ]);
        }
      } else {
        const {error: uploadError} = await supabase.storage
          .from('blog-posts')
          .upload(storagePath, mdFile, {cacheControl: '3600', upsert: true});

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const {data: insertedPost, error: dbError} = await supabase
          .from('db_posts')
          .insert(payload)
          .select('id')
          .single();

        if (dbError) {
          await supabase.storage.from('blog-posts').remove([storagePath]);
          throw dbError;
        }

        newPostId = insertedPost?.id ?? null;
      }

      const finalPostId = editId ?? newPostId;
      if (toBePublished && finalPostId && accessToken) {
        const targetLocales = ['id', 'ja', 'zh', 'ko'] as const;
        for (const locale of targetLocales) {
          try {
            const transRes = await fetch('/api/internal/blog/translate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                postId: finalPostId,
                slug: slug.trim(),
                locale,
                title: title.trim(),
                excerpt: excerpt.trim() || null,
                summary: aiSummary,
                tldr: aiTldr,
                markdown: markdownContent
              })
            });
            if (transRes.ok) {
              const transResult = await transRes.json();
              if (!transResult.stored && !transResult.skipped) {
                addMissingLocale(locale);
              }
            } else {
              addMissingLocale(locale);
            }
          } catch (err) {
            console.error(`Translation failed for locale ${locale}:`, err);
            addMissingLocale(locale);
          }
        }
      }

      const key = editId ? `autosave_edit_${editId}` : 'autosave_new';
      localStorage.removeItem(key);

      let successMessage =
        isEditMode ?
          toBePublished ? 'Post updated and published.'
          : 'Post updated and saved as draft.'
        : toBePublished ? 'Post published.'
        : 'Post saved as draft.';
      if (missingTranslationLocales.length > 0) {
        successMessage += ` Translations unavailable for: ${missingTranslationLocales.join(', ')}.`;
      }
      sessionStorage.setItem(
        'admin_toast',
        JSON.stringify({
          message: successMessage,
          type: missingTranslationLocales.length > 0 ? 'error' : 'success'
        })
      );
      window.location.href = '/admin';
    } catch (err) {
      const error = err as Error;
      console.error('Error saving post:', error);
      errorMessage = error.message || 'Failed to save blog post.';
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
    Back to Admin
  </Button>

  <div class="flex items-center gap-2">
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply} />
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col bg-surface-base pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
  {#if isCheckingAuth}
    <section class="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <LoadingState
        variant="post-editor"
        label="Loading post..." />
    </section>
  {:else}
    <section class="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
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
          class="rounded-sm border border-border-subtle bg-surface-card p-4 text-left sm:p-5">
          <h2 class="mb-3 text-base font-bold text-text-primary select-none">
            {isEditMode ? 'Edit post details' : 'Post details'}
          </h2>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
            <div class="flex flex-col gap-1.5 lg:col-span-4">
              <label
                for="post-banner"
                class="flex h-5 items-center gap-1.5 truncate font-sans-title text-xs font-bold text-text-secondary select-none">
                <span>Banner image</span>
                {#if displayBannerName}
                  <span class="truncate font-normal text-text-muted">
                    · {displayBannerName}
                  </span>
                {/if}
              </label>

              <div
                role="region"
                aria-label="Banner image upload dropzone"
                class={cn(
                  'group relative flex aspect-video w-full flex-1 items-center justify-center overflow-hidden rounded-sm border border-border-subtle/50 bg-surface-card/85 shadow-2xs backdrop-blur-xs transition-colors select-none dark:border-white/10 dark:bg-surface-card/70',
                  isDraggingOverBanner ?
                    'border-copilot! bg-copilot/10! ring-2 ring-copilot/30!'
                  : ''
                )}
                ondragover={e => {
                  e.preventDefault();
                  isDraggingOverBanner = true;
                }}
                ondragleave={() => {
                  isDraggingOverBanner = false;
                }}
                ondrop={e => {
                  e.preventDefault();
                  isDraggingOverBanner = false;
                  const file = e.dataTransfer?.files?.[0];
                  if (file) void processBannerFile(file);
                }}>
                {#if isCompressingBanner}
                  <div class="flex flex-col items-center gap-2">
                    <LoadingState
                      variant="spinner"
                      size="sm"
                      label="Compressing..." />
                  </div>
                {:else if bannerPreview}
                  <ImageWithSkeleton
                    src={bannerPreview}
                    alt="Banner preview"
                    class="h-full w-full bg-surface-base"
                    imgClass="object-contain" />
                  <button
                    type="button"
                    onclick={() => {
                      bannerFile = null;
                      bannerFileName = '';
                      if (bannerPreview && bannerPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(bannerPreview);
                      }
                      bannerPreview = null;
                      bannerPath = null;
                    }}
                    class="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/90"
                    aria-label="Remove banner">
                    <X class="size-4 leading-none" />
                  </button>
                {:else}
                  <div class="flex flex-col items-center gap-2">
                    <Button
                      type="ghost"
                      size="sm"
                      class="cursor-pointer gap-1.5 text-text-secondary hover:text-text-primary"
                      onclick={() => bannerFileInput?.click()}>
                      <ImageUp class="size-4 shrink-0" />
                      Choose File
                    </Button>
                  </div>
                {/if}
              </div>

              <input
                bind:this={bannerFileInput}
                type="file"
                id="post-banner"
                accept="image/png,image/webp,image/jpeg,image/jpg,image/avif,image/tiff,image/tif"
                onchange={handleBannerChange}
                class="hidden" />

              {#if bannerError}
                <div
                  id="post-banner-fb"
                  aria-live="polite"
                  class="text-xs font-medium">
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

            <div class="flex flex-col gap-1.5 lg:col-span-8">
              <div
                class="hidden h-5 lg:block"
                aria-hidden="true">
              </div>

              <div class="flex flex-1 flex-col justify-between gap-2.5">
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
                      validateTitleField();
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
                  hideFeedbackSlot
                  class="flex flex-1 flex-col">
                  <Textarea
                    id="post-excerpt"
                    rows={2}
                    maxlength={250}
                    bind:value={excerpt}
                    error={!!excerptError}
                    valid={excerptValid}
                    useAutoResize={false}
                    wrapperClass="flex flex-1 flex-col h-full"
                    class="h-full min-h-[68px] flex-1"
                    oninput={() => {
                      excerptError = '';
                      excerptValid = false;
                      validateExcerptField();
                    }} />
                </FormField>
              </div>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="post-tags"
              label="Tags"
              variant="floating"
              counter={`${tags.length}/5`}>
              <PillInput
                id="post-tags"
                bind:value={tags}
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
              counter={`${collaborators.length}/4`}>
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

        <MarkdownEditor
          bind:value={markdownContent}
          autosaveKey={editId ? `autosave_edit_${editId}` : 'autosave_new'}
          placeholder="Write your markdown content here..."
          minHeight="500px"
          stickyTopClass="top-12 sm:top-14"
          onImageUpload={handleImageUploadFile} />

        <div
          class="mt-4 mb-10 flex flex-col-reverse gap-2.5 select-none sm:flex-row sm:justify-end sm:gap-3">
          <Button
            type="ghost"
            size="md"
            class="w-full sm:w-auto"
            onclick={handleCancelClick}
            disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="secondary"
            size="md"
            class="w-full sm:w-auto"
            onclick={() => handleSaveClick(false)}
            disabled={isSubmitting}
            isLoading={submittingAction === 'draft'}>
            {submittingAction === 'draft' ? 'Saving draft…' : 'Save draft'}
          </Button>
          <Button
            type="primary"
            size="md"
            class="w-full sm:w-auto"
            onclick={() => handleSaveClick(true)}
            disabled={isSubmitting}
            isLoading={submittingAction === 'publish'}>
            {submittingAction === 'publish' ? 'Publishing…' : 'Publish post'}
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

<style>
  @reference "../../global.css";
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span) {
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
    --color-link-hover: var(--color-copilot-hover);
  }

  :global(:root.dark) .prose-custom {
    --color-heading: var(--color-gh-gray-1);
    --color-body: var(--color-gh-gray-3);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot-hover);
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

  .prose-custom :global(li > p) {
    @apply my-0!;
  }

  .prose-custom :global(blockquote:not(.markdown-alert)) {
    @apply my-6 rounded-sm border border-border-default/40 bg-surface-hover/30 p-4 text-sm leading-relaxed text-text-secondary;
  }

  .prose-custom :global(blockquote:not(.markdown-alert) p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-1.5! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pt-0! pr-0! pl-0!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-code-inline-bg px-0.5 py-px font-mono text-[0.925em] font-normal wrap-break-word [word-break:break-word] text-inherit;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-0! pl-0! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre!;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5! pl-2!;
  }

  .prose-custom :global(pre.code-wrap),
  .prose-custom :global(pre[data-wrap='true']) {
    @apply overflow-x-hidden! [overflow-wrap:anywhere]! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap code),
  .prose-custom :global(pre[data-wrap='true'] code) {
    @apply box-border! block! w-full! max-w-full! overflow-x-hidden! [overflow-wrap:anywhere]! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    @apply box-border! w-full! max-w-full! pl-[calc(0.5rem+4ch)]! -indent-[4ch] [overflow-wrap:anywhere]! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(a) {
    @apply text-security no-underline hover:underline;
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
    @apply inline-block! size-[0.85em]! align-middle! leading-none! text-inherit! no-underline!;
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
    @apply my-6 w-full max-w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold [overflow-wrap:break-word] [word-break:break-word] text-text-primary;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed [overflow-wrap:break-word] [word-break:break-word] text-text-secondary last:border-r-0;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    @apply [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal;
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
    @apply my-6 rounded-sm border p-4 text-xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 font-sans-title text-xs leading-none font-semibold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title svg) {
    @apply size-4 shrink-0 -translate-y-[6%];
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
    @apply border-security/40 bg-security-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-security;
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-success/40 bg-success-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-success;
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-copilot/40 bg-copilot-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-copilot;
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-warning/40 bg-warning-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-warning-strong;
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-danger/40 bg-danger-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-danger;
  }
  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
