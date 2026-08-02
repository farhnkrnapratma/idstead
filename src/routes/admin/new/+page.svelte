<!-- @format -->
<script lang="ts">
  import {supabase} from '$lib/supabase'
  import {onMount, tick} from 'svelte'
  import {renderMarkdown} from '$lib/markdown'
  import hljs from 'highlight.js'
  import {
    SkipLink,
    LoadingState,
    StatusBanner,
    Button,
    IconButton,
    Card,
    FormField,
    Input,
    Textarea,
    ThemeSelect,
    Dialog
  } from '$lib'
  import {themeStore} from '$lib/stores/themeStore.svelte'

  let isCheckingAuth = $state(true)
  let title = $state('')
  let slug = $derived(generateSlug(title))
  let excerpt = $state('')
  let markdownContent = $state(
    '# New Post\n\nWrite your markdown content here...'
  )

  let isDark = $state(false)

  let isSubmitting = $state(false)
  let errorMessage = $state<string | null>(null)
  let activeTab = $state<'editor' | 'preview'>('editor')
  let previewHtml = $state('')

  let isEditMode = $state(false)
  let editId = $state<string | null>(null)
  let originalSlug = ''

  let bannerFile = $state<File | null>(null)
  let bannerPreview = $state<string | null>(null)
  let bannerPath = $state<string | null>(null)
  let bannerError = $state<string | null>(null)

  let initialTitle = $state('')
  let initialExcerpt = $state('')
  let initialMarkdownContent = $state('')

  const isDirty = $derived(
    title.trim() !== initialTitle.trim()
      || excerpt.trim() !== initialExcerpt.trim()
      || markdownContent.trim() !== initialMarkdownContent.trim()
  )

  let titleError = $state('')
  let titleValid = $state(false)

  let excerptError = $state('')
  let excerptValid = $state(false)

  let showCancelDialog = $state(false)
  let showPublishDialog = $state(false)
  let showSaveDraftDialog = $state(false)

  $effect(() => {
    if (typeof window !== 'undefined') {
      isDark = document.documentElement.classList.contains('dark')
      const observer = new MutationObserver(() => {
        isDark = document.documentElement.classList.contains('dark')
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      })
      return () => observer.disconnect()
    }
  })

  const IDLE_TIMEOUT_MS = 30 * 60 * 1000
  let idleTimer: ReturnType<typeof setTimeout>

  function resetIdleTimer() {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(async () => {
      await supabase.auth.signOut()
      window.location.href = '/admin/login'
    }, IDLE_TIMEOUT_MS)
  }

  const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart'
  ] as const

  onMount(() => {
    ;(async () => {
      const {data: sessionData} = await supabase.auth.getSession()
      if (!sessionData.session) {
        window.location.href = '/admin/login'
        return
      }
      isCheckingAuth = false

      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (id) {
        editId = id
        isEditMode = true
        await loadPostForEdit(id)
      } else {
        initialTitle = ''
        initialExcerpt = ''
        initialMarkdownContent =
          '# New Post\n\nWrite your markdown content here...'
      }

      const key = id ? `autosave_edit_${id}` : 'autosave_new'
      const savedDraft = localStorage.getItem(key)
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft)
          const defaultTemplate =
            '# New Post\n\nWrite your markdown content here...'
          if (!id) {
            title = parsed.title || title
            excerpt = parsed.excerpt || excerpt
            if (
              parsed.markdownContent
              && parsed.markdownContent !== defaultTemplate
            ) {
              markdownContent = parsed.markdownContent
            }
          } else {
            if (
              parsed.markdownContent
              && parsed.markdownContent !== defaultTemplate
              && parsed.markdownContent !== markdownContent
            ) {
              title = parsed.title || title
              excerpt = parsed.excerpt || excerpt
              markdownContent = parsed.markdownContent
            }
          }
        } catch (e) {
          console.error('Failed to parse autosave draft', e)
        }
      }
    })()

    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetIdleTimer, {passive: true})
    )

    return () => {
      clearTimeout(idleTimer)
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetIdleTimer)
      )
    }
  })

  async function loadPostForEdit(id: string) {
    try {
      const {data: post, error} = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !post) {
        throw error || new Error('Post not found')
      }

      title = post.title
      originalSlug = post.slug
      excerpt = post.excerpt || ''

      const {data: fileData, error: fileError} = await supabase.storage
        .from('blog-posts')
        .download(post.storage_path)

      if (fileError) {
        throw fileError
      }

      const fileText = await fileData.text()
      markdownContent = fileText

      bannerPath = post.banner_path || null
      if (post.banner_path) {
        const {data: publicUrl} = supabase.storage
          .from('blog-posts')
          .getPublicUrl(post.banner_path)
        bannerPreview = publicUrl.publicUrl
      } else {
        bannerPreview = null
      }

      initialTitle = title
      initialExcerpt = excerpt
      initialMarkdownContent = markdownContent
    } catch (err) {
      const error = err as Error
      console.error('Error loading post for edit:', error)
      errorMessage = 'Failed to load post data: ' + error.message
    }
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  $effect(() => {
    if (markdownContent) {
      renderMarkdown(markdownContent).then(html => {
        previewHtml = html
      })
    }
  })

  let showToast = $state(false)
  let toastMessage = $state('')

  function triggerToast(message: string) {
    toastMessage = message
    showToast = true
    setTimeout(() => {
      showToast = false
    }, 2000)
  }

  function getPrettyLanguage(className: string): string {
    if (!className) return 'Code'
    const match = className.match(/language-(\S+)/)
    if (!match) return 'Code'
    const lang = match[1].toLowerCase()
    const map: Record<string, string> = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      html: 'HTML',
      css: 'CSS',
      rust: 'Rust',
      rs: 'Rust',
      python: 'Python',
      py: 'Python',
      bash: 'Bash',
      sh: 'Shell',
      shell: 'Shell',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      md: 'Markdown',
      markdown: 'Markdown',
      go: 'Go',
      golang: 'Go',
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      cs: 'C#',
      sql: 'SQL',
      dockerfile: 'Docker',
      docker: 'Docker'
    }
    return map[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
  }

  function setupCodeHeaderBars() {
    const container = document.querySelector('.prose-custom')
    if (!container) return
    const preBlocks = container.querySelectorAll('pre')
    preBlocks.forEach(el => {
      const pre = el as HTMLElement
      if (pre.previousElementSibling?.classList.contains('code-header-bar'))
        return

      const codeElement = pre.querySelector('code')
      const langClass = codeElement?.className || ''
      const prettyLang = getPrettyLanguage(langClass)

      const headerBar = document.createElement('div')
      headerBar.className =
        'code-header-bar flex items-center justify-between bg-surface-canvas/95 border border-border-subtle rounded-t-lg px-4 py-1 text-xs text-text-muted font-semibold select-none mt-6'

      const leftSpan = document.createElement('span')
      leftSpan.className =
        'text-[12.5px] font-sans font-bold uppercase tracking-wider text-text-muted leading-none'
      leftSpan.innerText = prettyLang
      headerBar.appendChild(leftSpan)

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className =
        'flex h-5 w-5 items-center justify-center rounded-md border border-border-subtle/30 hover:bg-surface-hover/30 hover:text-text-primary transition-colors cursor-pointer text-text-muted leading-none'
      copyBtn.innerHTML =
        '<i class="bi bi-clipboard text-xs font-bold leading-none" aria-hidden="true"></i>'

      copyBtn.addEventListener('click', () => {
        if (!codeElement) return
        const codeText = codeElement.innerText || codeElement.textContent || ''
        navigator.clipboard
          .writeText(codeText)
          .then(() => {
            copyBtn.innerHTML =
              '<i class="bi bi-check-lg text-xs font-bold text-copilot leading-none" aria-hidden="true"></i>'
            triggerToast('Code copied to clipboard!')
            setTimeout(() => {
              copyBtn.innerHTML =
                '<i class="bi bi-clipboard text-xs font-bold leading-none" aria-hidden="true"></i>'
            }, 2000)
          })
          .catch(err => {
            console.error('Failed to copy code: ', err)
          })
      })

      headerBar.appendChild(copyBtn)

      pre.classList.add('mt-0!', 'rounded-t-none!', 'border-t-0!', 'pt-2.5!')

      pre.parentNode?.insertBefore(headerBar, pre)
    })
  }

  $effect(() => {
    if (activeTab === 'preview' && previewHtml) {
      tick().then(() => {
        const blocks = document.querySelectorAll('.prose-custom pre code')
        blocks.forEach(block => {
          hljs.highlightElement(block as HTMLElement)
        })
        setupCodeHeaderBars()
      })
    }
  })

  function splitHighlightedHtml(html: string): string[] {
    const lines = html.split('\n')
    const result: string[] = []
    let openTags: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const prefix = openTags.join('')
      const tagRegex = /<\/?([a-z0-9]+)[^>]*>/gi
      let match: RegExpExecArray | null
      const currentOpen = [...openTags]

      while ((match = tagRegex.exec(line)) !== null) {
        const fullTag = match[0]
        if (fullTag.startsWith('</')) {
          currentOpen.pop()
        } else if (!fullTag.endsWith('/>')) {
          currentOpen.push(fullTag)
        }
      }

      const suffix = currentOpen
        .slice()
        .reverse()
        .map(t => {
          const name = t.match(/<([a-z0-9]+)/i)?.[1]
          return name ? `</${name}>` : ''
        })
        .join('')

      result.push(prefix + line + suffix || '&nbsp;')
      openTags = currentOpen
    }

    return result
  }

  let lineHeights = $state<number[]>([])

  function updateLineHeights() {
    if (lineWrapMode !== 'soft') {
      lineHeights = []
      return
    }
    if (typeof document === 'undefined') return
    tick().then(() => {
      if (!preElement) return
      const lineEls =
        preElement.querySelectorAll<HTMLElement>('.editor-code-line')
      const heights: number[] = []
      lineEls.forEach(el => {
        heights.push(el.offsetHeight || 24)
      })
      lineHeights = heights
    })
  }

  $effect(() => {
    if (
      markdownContent !== undefined
      || lineWrapMode !== undefined
      || activeTab !== undefined
    ) {
      updateLineHeights()
    }
  })

  const highlightedMarkdown = $derived(
    hljs.highlight(markdownContent || '', {language: 'markdown'}).value
      + (markdownContent.endsWith('\n') ? '\n ' : '')
  )

  let excerptTextareaElement = $state<HTMLTextAreaElement | null>(null)

  $effect(() => {
    if (excerpt !== undefined && excerptTextareaElement) {
      excerptTextareaElement.style.height = 'auto'
      excerptTextareaElement.style.height = `${excerptTextareaElement.scrollHeight}px`
    }
  })

  let markdownTextareaElement = $state<HTMLTextAreaElement | null>(null)

  $effect(() => {
    if (markdownContent !== undefined && markdownTextareaElement) {
      markdownTextareaElement.style.height = 'auto'
      markdownTextareaElement.style.height = `${markdownTextareaElement.scrollHeight}px`
    }
  })

  $effect(() => {
    if (markdownTextareaElement) {
      textareaElement = markdownTextareaElement
    }
  })

  let preElement = $state<HTMLElement | null>(null)
  let textareaElement = $state<HTMLTextAreaElement | null>(null)

  let indentMode = $state<'spaces' | 'tabs'>('spaces')
  let indentSize = $state(4)
  let lineWrapMode = $state<'soft' | 'none'>('soft')

  let indentModeDropdownOpen = $state(false)
  let indentSizeDropdownOpen = $state(false)
  let wrapModeDropdownOpen = $state(false)

  let currentLine = $state(1)
  let currentColumn = $state(1)

  let imageFileInput = $state<HTMLInputElement | null>(null)

  let lineCount = $derived(markdownContent.split('\n').length)

  let lineEnding = $derived(markdownContent.includes('\r\n') ? 'CRLF' : 'LF')

  function updateCursorPosition() {
    if (!textareaElement) return
    const textBeforeCursor = markdownContent.substring(
      0,
      textareaElement.selectionStart
    )
    const lines = textBeforeCursor.split('\n')
    currentLine = lines.length
    currentColumn = lines[lines.length - 1].length + 1
  }

  function handleTextareaKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const indentStr = indentMode === 'spaces' ? ' '.repeat(indentSize) : '\t'
      markdownContent =
        markdownContent.substring(0, start)
        + indentStr
        + markdownContent.substring(end)
      tick().then(() => {
        target.selectionStart = target.selectionEnd = start + indentStr.length
        syncScroll()
        updateCursorPosition()
      })
    }
  }

  function insertMarkdown(prefix: string, suffix: string = '') {
    if (!textareaElement) return
    const start = textareaElement.selectionStart
    const end = textareaElement.selectionEnd
    const selectedText = markdownContent.substring(start, end)
    const replacement = prefix + selectedText + suffix
    markdownContent =
      markdownContent.substring(0, start)
      + replacement
      + markdownContent.substring(end)
    tick().then(() => {
      textareaElement!.focus()
      textareaElement!.selectionStart = start + prefix.length
      textareaElement!.selectionEnd =
        start + prefix.length + selectedText.length
      syncScroll()
      updateCursorPosition()
    })
  }

  async function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const allowedTypes = ['image/png', 'image/webp', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      errorMessage = 'Supported image formats are PNG, WebP, JPEG, JPG.'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      errorMessage = 'Image size must be 5MB or less.'
      return
    }
    isSubmitting = true
    errorMessage = null
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `images/${slug || 'post'}-${Date.now()}.${ext}`
      const {error: uploadError} = await supabase.storage
        .from('blog-posts')
        .upload(path, file, {cacheControl: '3600', upsert: true})
      if (uploadError) throw uploadError
      const {data: urlData} = supabase.storage
        .from('blog-posts')
        .getPublicUrl(path)
      insertMarkdown(
        `![${file.name.replace(/\.[^/.]+$/, '')}](${urlData.publicUrl})`
      )
    } catch (err) {
      const error = err as Error
      errorMessage = error.message || 'Failed to upload image.'
    } finally {
      isSubmitting = false
      target.value = ''
    }
  }

  function syncScroll() {
    if (textareaElement && preElement) {
      preElement.scrollTop = textareaElement.scrollTop
      preElement.scrollLeft = textareaElement.scrollLeft
    }
  }

  let autoSaveStatus = $state<'saving' | 'saved' | 'idle'>('idle')
  let autoSaveTimer: ReturnType<typeof setTimeout>

  $effect(() => {
    if (markdownContent && !isCheckingAuth) {
      autoSaveStatus = 'saving'
      clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(() => {
        const key = editId ? `autosave_edit_${editId}` : 'autosave_new'
        const data = {title, excerpt, markdownContent, timestamp: Date.now()}
        localStorage.setItem(key, JSON.stringify(data))
        autoSaveStatus = 'saved'
        setTimeout(() => {
          if (autoSaveStatus === 'saved') autoSaveStatus = 'idle'
        }, 1500)
      }, 500)
    }
  })

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const validateTitleField = debounce(() => {
    if (title.trim() === '') {
      titleError = ''
      titleValid = false
    } else if (title.trim().length > 60) {
      titleError = 'Title must be 60 characters or less.'
      titleValid = false
    } else {
      titleError = ''
      titleValid = true
    }
  }, 500)

  const validateExcerptField = debounce(() => {
    const val = excerpt.trim()
    if (val === '') {
      excerptError = ''
      excerptValid = false
    } else if (val.length > 250) {
      excerptError = 'Excerpt must be 250 characters or less.'
      excerptValid = false
    } else {
      excerptError = ''
      excerptValid = true
    }
  }, 500)

  function validateImageDimensions(file: File): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const ratio = img.width / img.height
        const valid =
          (img.width === 1280 && img.height === 640)
          || Math.abs(ratio - 2.0) < 0.05
        resolve(valid)
      }
      img.onerror = () => {
        resolve(false)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleBannerChange(e: Event) {
    bannerError = null
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      bannerError = 'Banner must be a PNG, JPG, or WebP image.'
      input.value = ''
      return
    }

    const isValidDimensions = await validateImageDimensions(file)
    if (!isValidDimensions) {
      bannerError =
        'Banner dimensions must have a 2:1 ratio (e.g. 1280x640 pixels).'
      input.value = ''
      return
    }

    bannerFile = file
    bannerPreview = URL.createObjectURL(file)
  }

  function validate() {
    const titleVal = title.trim()
    if (titleVal === '') {
      titleError = 'Title is required.'
      titleValid = false
      return false
    }
    if (titleVal.length > 60) {
      titleError = 'Title must be 60 characters or less.'
      titleValid = false
      return false
    }

    const excerptVal = excerpt.trim()
    if (excerptVal === '') {
      errorMessage = 'Excerpt is required.'
      return false
    }
    if (excerptVal.length > 250) {
      errorMessage = 'Excerpt must be 250 characters or less.'
      return false
    }

    titleError = ''
    titleValid = true
    return true
  }

  function handleCancelClick() {
    if (isDirty) {
      showCancelDialog = true
    } else {
      window.location.href = '/admin'
    }
  }

  function handleSaveClick(toBePublished: boolean) {
    if (!validate()) return
    if (!markdownContent.trim()) {
      errorMessage = 'Markdown content is required.'
      return
    }

    if (toBePublished) {
      showPublishDialog = true
    } else {
      showSaveDraftDialog = true
    }
  }

  async function executeSave(toBePublished: boolean) {
    showPublishDialog = false
    showSaveDraftDialog = false
    isSubmitting = true
    errorMessage = null

    try {
      // Ensure Supabase auth session is valid before storage or database operations
      const {data: userData, error: userError} = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        const {data: refreshData, error: refreshError} =
          await supabase.auth.refreshSession()
        if (refreshError || !refreshData?.session) {
          throw new Error('Your session has expired. Please log in again.')
        }
      }

      const activeUser = (await supabase.auth.getUser()).data?.user

      if (title.trim().length > 60) {
        throw new Error(
          'Title exceeds backend maximum length of 60 characters.'
        )
      }
      if (!/^[a-z-]*$/.test(slug)) {
        throw new Error(
          'Slug contains invalid characters. Only a-z and - are allowed.'
        )
      }

      const fileName = `${slug}.md`
      const storagePath = `${fileName}`

      const mdBlob = new Blob([markdownContent], {type: 'text/markdown'})
      const mdFile = new File([mdBlob], fileName, {type: 'text/markdown'})

      let finalBannerPath = bannerPath

      if (bannerFile) {
        if (bannerFile.type !== 'image/png') {
          throw new Error('Backend Validation: Banner must be a PNG image.')
        }
        const bannerFileName = `banners/${slug}.png`
        const {error: bannerUploadError} = await supabase.storage
          .from('blog-posts')
          .upload(bannerFileName, bannerFile, {
            cacheControl: '3600',
            upsert: true
          })

        if (bannerUploadError) {
          throw new Error(`Banner upload failed: ${bannerUploadError.message}`)
        }
        finalBannerPath = bannerFileName
      }

      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        published: toBePublished,
        storage_path: storagePath,
        banner_path: finalBannerPath
      }

      if (isEditMode && editId) {
        const {error: uploadError} = await supabase.storage
          .from('blog-posts')
          .upload(storagePath, mdFile, {cacheControl: '3600', upsert: true})

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        const updatePayload: Record<string, any> = {
          ...payload,
          updated_at: new Date().toISOString()
        }

        let {error: dbError} = await supabase
          .from('posts')
          .update(updatePayload)
          .eq('id', editId)

        if (
          dbError
          && (dbError.message.includes('updated_at')
            || dbError.code === '42703')
        ) {
          const {error: dbError2} = await supabase
            .from('posts')
            .update(payload)
            .eq('id', editId)
          dbError = dbError2
        }

        if (dbError) {
          throw dbError
        }

        if (originalSlug && originalSlug !== slug) {
          await supabase.storage
            .from('blog-posts')
            .remove([`${originalSlug}.md`, `banners/${originalSlug}.png`])
        }
      } else {
        const {error: uploadError} = await supabase.storage
          .from('blog-posts')
          .upload(storagePath, mdFile, {cacheControl: '3600', upsert: true})

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        const {error: dbError} = await supabase.from('posts').insert(payload)

        if (dbError) {
          await supabase.storage.from('blog-posts').remove([storagePath])
          throw dbError
        }
      }

      const key = editId ? `autosave_edit_${editId}` : 'autosave_new'
      localStorage.removeItem(key)
      window.location.href = '/admin'
    } catch (err) {
      const error = err as Error
      console.error('Error saving post:', error)
      errorMessage = error.message || 'Failed to save blog post.'
    } finally {
      isSubmitting = false
    }
  }
</script>

<svelte:head>
  <title>{isEditMode ? 'Edit post' : 'New post'} — Console</title>
  {#if isDark}
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
  {:else}
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
  {/if}
</svelte:head>

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card/60 px-5 font-sans shadow-xs backdrop-blur-lg transition-colors duration-300"
  aria-label="Editor navigation">
  <button
    type="button"
    onclick={handleCancelClick}
    class="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
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
      label="Verifying credentials…"
      size="lg"
      class="flex-1 py-20" />
  {:else}
    <section class="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      {#if errorMessage}
        <StatusBanner
          type="error"
          message={errorMessage}
          class="mb-6" />
      {/if}

      <form
        onsubmit={e => e.preventDefault()}
        class="flex flex-col gap-4">
        <div
          class="rounded-2xl border border-border-subtle bg-surface-card/45 p-6 text-left shadow-xs backdrop-blur-lg transition-colors duration-300">
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
                class="group relative flex aspect-2/1 w-full items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-base select-none">
                {#if bannerPreview}
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    loading="lazy"
                    class="h-full w-full bg-surface-base object-contain" />
                  <button
                    type="button"
                    onclick={() => {
                      bannerFile = null
                      bannerPreview = null
                      bannerPath = null
                    }}
                    class="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/90"
                    aria-label="Remove banner">
                    <span
                      class="material-symbols-rounded text-base leading-none"
                      >close</span>
                  </button>
                {:else}
                  <div
                    class="flex flex-col items-center gap-2 text-text-muted/65">
                    <i class="bi bi-image text-3xl"></i>
                    <span class="text-[10px]">No banner uploaded</span>
                  </div>
                {/if}
              </div>

              <input
                type="file"
                id="post-banner"
                accept="image/png,image/jpeg,image/webp"
                onchange={handleBannerChange}
                class="mt-2 block w-full text-xs text-text-secondary file:mr-4 file:cursor-pointer file:rounded-lg file:border file:border-border-subtle file:bg-surface-card file:px-4 file:py-2 file:text-xs file:font-semibold file:text-text-primary hover:file:bg-surface-hover focus:outline-2 focus:outline-copilot" />

              {#if bannerError}
                <div
                  id="post-banner-fb"
                  aria-live="polite"
                  class="mt-1 text-xs font-medium">
                  <span
                    role="alert"
                    class="flex items-start gap-1.5 text-danger">
                    <i
                      class="bi bi-exclamation-circle-fill mt-[1px] shrink-0 self-start text-xs leading-none"
                      aria-hidden="true"></i>
                    <span class="min-w-0 flex-1 break-words"
                      >{bannerError}</span>
                  </span>
                </div>
              {/if}
            </div>

            <div class="flex flex-col gap-2.5 lg:col-span-7">
              <FormField
                id="post-title"
                label="Title*"
                required
                error={titleError}
                valid={titleValid}
                counter="{60 - title.length} left">
                <Input
                  type="text"
                  id="post-title"
                  maxlength={60}
                  required
                  placeholder="Getting Started with Rust"
                  bind:value={title}
                  error={!!titleError}
                  valid={titleValid}
                  oninput={() => {
                    titleError = ''
                    titleValid = false
                    validateTitleField()
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
                  required
                  placeholder="Brief summary of the post (max 250 characters)…"
                  bind:value={excerpt}
                  error={!!excerptError}
                  valid={excerptValid}
                  oninput={() => {
                    excerptError = ''
                    excerptValid = false
                    validateExcerptField()
                  }} />
              </FormField>
            </div>
          </div>
        </div>

        <div class="boxed-list flex flex-col overflow-hidden text-left">
          <div
            class="flex items-center border-b border-border-subtle bg-surface-card/10 px-4 py-2.5 select-none">
            <div
              class="inline-flex gap-0.5 rounded-lg border border-border-subtle bg-surface-switcher p-1">
              <button
                type="button"
                onclick={() => (activeTab = 'editor')}
                aria-pressed={activeTab === 'editor'}
                class="cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all {(
                  activeTab === 'editor'
                ) ?
                  'border border-border-subtle/10 bg-surface-switcher-active text-text-primary shadow-xs'
                : 'text-text-secondary hover:bg-surface-hover/30 hover:text-text-primary'}">
                Edit
              </button>
              <button
                type="button"
                onclick={() => (activeTab = 'preview')}
                aria-pressed={activeTab === 'preview'}
                class="cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all {(
                  activeTab === 'preview'
                ) ?
                  'border border-border-subtle/10 bg-surface-switcher-active text-text-primary shadow-xs'
                : 'text-text-secondary hover:bg-surface-hover/30 hover:text-text-primary'}">
                Preview
              </button>
            </div>

            <div class="ml-auto flex items-center gap-2 select-none">
              <div
                role="status"
                aria-live="polite"
                class="flex items-center pr-1.5 text-xs font-medium text-text-muted">
                {#if autoSaveStatus === 'saving'}
                  <span class="inline-flex items-center gap-1.5">
                    <svg
                      class="h-3.5 w-3.5 animate-spin text-text-muted"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true">
                      <circle
                        class="stroke-copilot stroke-3 opacity-25"
                        cx="12"
                        cy="12"
                        r="10"></circle>
                      <path
                        class="fill-copilot opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving…
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1.5">
                    <span
                      class="material-symbols-rounded text-[13px] text-text-muted"
                      aria-hidden="true">cloud_done</span>
                    Saved
                  </span>
                {/if}
              </div>

              <div class="relative">
                <button
                  type="button"
                  onclick={() => {
                    indentModeDropdownOpen = !indentModeDropdownOpen
                    indentSizeDropdownOpen = false
                    wrapModeDropdownOpen = false
                  }}
                  class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
                  aria-haspopup="true"
                  aria-expanded={indentModeDropdownOpen}>
                  {indentMode === 'spaces' ? 'Spaces' : 'Tabs'}
                  <span
                    class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                      indentModeDropdownOpen
                    ) ?
                      'rotate-180'
                    : ''}">
                    <i class="bi bi-chevron-down text-[9px] leading-none"></i>
                  </span>
                </button>
                {#if indentModeDropdownOpen}
                  <button
                    class="fixed inset-0 z-40 cursor-default"
                    onclick={() => (indentModeDropdownOpen = false)}
                    aria-label="Close menu"></button>
                  <div
                    role="menu"
                    class="absolute top-8.5 right-0 z-50 flex min-w-30 flex-col rounded-lg border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
                    {#each ['spaces', 'tabs'] as const as mode (mode)}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={() => {
                          indentMode = mode
                          indentModeDropdownOpen = false
                        }}
                        class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                        <span>{mode === 'spaces' ? 'Spaces' : 'Tabs'}</span>
                        {#if indentMode === mode}
                          <i class="bi bi-check text-copilot"></i>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="relative">
                <button
                  type="button"
                  onclick={() => {
                    indentSizeDropdownOpen = !indentSizeDropdownOpen
                    indentModeDropdownOpen = false
                    wrapModeDropdownOpen = false
                  }}
                  class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
                  aria-haspopup="true"
                  aria-expanded={indentSizeDropdownOpen}>
                  {indentSize}
                  <span
                    class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                      indentSizeDropdownOpen
                    ) ?
                      'rotate-180'
                    : ''}">
                    <i class="bi bi-chevron-down text-[9px] leading-none"></i>
                  </span>
                </button>
                {#if indentSizeDropdownOpen}
                  <button
                    class="fixed inset-0 z-40 cursor-default"
                    onclick={() => (indentSizeDropdownOpen = false)}
                    aria-label="Close menu"></button>
                  <div
                    role="menu"
                    class="absolute top-8.5 right-0 z-50 flex min-w-20 flex-col rounded-lg border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
                    {#each [2, 4, 8] as size (size)}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={() => {
                          indentSize = size
                          indentSizeDropdownOpen = false
                        }}
                        class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                        <span>{size}</span>
                        {#if indentSize === size}
                          <i class="bi bi-check text-copilot"></i>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="relative">
                <button
                  type="button"
                  onclick={() => {
                    wrapModeDropdownOpen = !wrapModeDropdownOpen
                    indentModeDropdownOpen = false
                    indentSizeDropdownOpen = false
                  }}
                  class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
                  aria-haspopup="true"
                  aria-expanded={wrapModeDropdownOpen}>
                  {lineWrapMode === 'soft' ? 'Soft wrap' : 'No wrap'}
                  <span
                    class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                      wrapModeDropdownOpen
                    ) ?
                      'rotate-180'
                    : ''}">
                    <i class="bi bi-chevron-down text-[9px] leading-none"></i>
                  </span>
                </button>
                {#if wrapModeDropdownOpen}
                  <button
                    class="fixed inset-0 z-40 cursor-default"
                    onclick={() => (wrapModeDropdownOpen = false)}
                    aria-label="Close menu"></button>
                  <div
                    role="menu"
                    class="absolute top-8.5 right-0 z-50 flex min-w-30 flex-col rounded-lg border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
                    {#each ['soft', 'none'] as const as mode (mode)}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={() => {
                          lineWrapMode = mode
                          wrapModeDropdownOpen = false
                        }}
                        class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                        <span>{mode === 'soft' ? 'Soft wrap' : 'No wrap'}</span>
                        {#if lineWrapMode === mode}
                          <i class="bi bi-check text-copilot"></i>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="bg-surface-base">
            {#if activeTab === 'editor'}
              <div class="flex w-full flex-row items-stretch overflow-hidden">
                <div
                  class="editor-line-numbers border-r border-border-subtle/20 bg-surface-card/10 pt-5 pb-5 select-none">
                  {#each Array.from({length: lineCount}).keys() as i (i)}
                    <div
                      class="line-num-item pr-3.5 pl-4 text-right transition-colors {(
                        currentLine === i + 1
                      ) ?
                        '-mr-px border-r-2 border-copilot bg-copilot/10 font-bold text-copilot'
                      : 'text-text-muted/40'}"
                      style={lineWrapMode === 'soft' && lineHeights[i] ?
                        `height: ${lineHeights[i]}px !important;`
                      : ''}>
                      {i + 1}
                    </div>
                  {/each}
                </div>

                <div class="relative flex-1 overflow-hidden">
                  <pre
                    bind:this={preElement}
                    class="editor-pre no-scrollbar pointer-events-none absolute inset-0 m-0! box-border! w-full! overflow-y-hidden! border-0! bg-transparent pt-5! pr-5! pb-5! pl-4! text-text-primary select-none {(
                      lineWrapMode === 'soft'
                    ) ?
                      'overflow-x-hidden! break-normal! wrap-break-word! whitespace-pre-wrap!'
                    : 'overflow-x-auto! break-normal! whitespace-pre!'}"><code
                      class="whitespace-inherit! break-inherit! overflow-wrap-inherit! language-markdown m-0! block! bg-transparent! p-0!"
                      >{#each splitHighlightedHtml(highlightedMarkdown) as lineHtml, i (i)}<div
                          class="editor-code-line whitespace-inherit! break-inherit! overflow-wrap-inherit! m-0! p-0!">{@html lineHtml}</div>{/each}</code></pre>

                  <textarea
                    bind:this={markdownTextareaElement}
                    required
                    aria-label="Markdown content"
                    bind:value={markdownContent}
                    onscroll={syncScroll}
                    oninput={() => {
                      syncScroll()
                      updateCursorPosition()
                    }}
                    onclick={updateCursorPosition}
                    onkeyup={updateCursorPosition}
                    onfocus={updateCursorPosition}
                    onkeydown={handleTextareaKeyDown}
                    class="editor-textarea relative m-0! box-border! w-full! resize-none! overflow-y-hidden! border-0! bg-transparent pt-5! pr-5! pb-5! pl-4! text-transparent caret-text-primary focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none {(
                      lineWrapMode === 'soft'
                    ) ?
                      'overflow-x-hidden! break-normal! wrap-break-word! whitespace-pre-wrap!'
                    : 'overflow-x-auto! break-normal! whitespace-pre!'}"
                  ></textarea>
                </div>
              </div>
            {:else}
              <div class="prose-custom w-full bg-surface-base p-6">
                {#if previewHtml}
                  {@html previewHtml}
                {:else}
                  <p class="text-text-muted italic">Nothing to preview yet…</p>
                {/if}
              </div>
            {/if}
          </div>

          {#if activeTab === 'editor'}
            <div
              class="flex flex-wrap items-center justify-between border-t border-border-subtle bg-surface-card/10 px-3 py-1.5 text-xs text-text-secondary select-none">
              <div
                class="flex items-center gap-1"
                role="toolbar"
                aria-label="Formatting tools">
                {#each [{action: () => insertMarkdown('# '), icon: 'format_h1', label: 'H1 heading'}, {action: () => insertMarkdown('## '), icon: 'format_h2', label: 'H2 heading'}, {action: () => insertMarkdown('### '), icon: 'format_h3', label: 'H3 heading'}] as const as item (item.icon)}
                  <button
                    type="button"
                    onclick={item.action}
                    aria-label={item.label}
                    class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                    <span
                      class="material-symbols-rounded text-base"
                      aria-hidden="true">{item.icon}</span>
                  </button>
                {/each}
                <div
                  class="mx-1 h-4 w-px bg-border-subtle"
                  aria-hidden="true">
                </div>
                {#each [{action: () => insertMarkdown('**', '**'), icon: 'format_bold', label: 'Bold'}, {action: () => insertMarkdown('*', '*'), icon: 'format_italic', label: 'Italic'}, {action: () => insertMarkdown('<u>', '</u>'), icon: 'format_underlined', label: 'Underline'}, {action: () => insertMarkdown('~~', '~~'), icon: 'format_strikethrough', label: 'Strikethrough'}] as const as item (item.icon)}
                  <button
                    type="button"
                    onclick={item.action}
                    aria-label={item.label}
                    class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                    <span
                      class="material-symbols-rounded text-base"
                      aria-hidden="true">{item.icon}</span>
                  </button>
                {/each}
                <div
                  class="mx-1 h-4 w-px bg-border-subtle"
                  aria-hidden="true">
                </div>
                <button
                  type="button"
                  onclick={() => imageFileInput?.click()}
                  aria-label="Insert image"
                  class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                  <span
                    class="material-symbols-rounded text-base"
                    aria-hidden="true">add_photo_alternate</span>
                </button>
                <input
                  type="file"
                  bind:this={imageFileInput}
                  accept="image/png, image/webp, image/jpeg, image/jpg"
                  onchange={handleImageUpload}
                  class="hidden"
                  aria-label="Upload image file" />
                {#each [{action: () => insertMarkdown('[', '](url)'), icon: 'link', label: 'Insert link'}, {action: () => insertMarkdown('1. '), icon: 'format_list_numbered', label: 'Numbered list'}, {action: () => insertMarkdown('- '), icon: 'format_list_bulleted', label: 'Bulleted list'}, {action: () => insertMarkdown('```\n', '\n```'), icon: 'code_blocks', label: 'Code block'}] as const as item (item.icon)}
                  <button
                    type="button"
                    onclick={item.action}
                    aria-label={item.label}
                    class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                    <span
                      class="material-symbols-rounded text-base"
                      aria-hidden="true">{item.icon}</span>
                  </button>
                {/each}
              </div>

              <div
                class="flex items-center gap-4 font-mono text-[11px] select-none">
                <span class="text-[12.5px] font-semibold tracking-wide"
                  >{currentLine}:{currentColumn}</span>
                <span
                  class="flex items-center gap-1 text-[12.5px] font-semibold tracking-wide">
                  <span
                    class="material-symbols-rounded text-[14px]"
                    aria-hidden="true">space_bar</span>
                  {indentSize}
                </span>
                <span class="text-[12.5px] font-semibold tracking-wide"
                  >UTF-8</span>
                <span class="text-[12.5px] font-semibold tracking-wide"
                  >{lineEnding}</span>
                <span class="group relative flex cursor-help items-center">
                  <span
                    class="material-symbols-rounded text-[16px]"
                    aria-label="Markdown formatting supported">markdown</span>
                  <span
                    class="absolute right-0 bottom-full mb-1.5 hidden rounded-md border border-border-subtle bg-surface-elevated px-2 py-1 font-sans text-[10px] whitespace-nowrap text-text-primary shadow-md group-hover:block">
                    Markdown formatting is supported
                  </span>
                </span>
              </div>
            </div>
          {/if}
        </div>

        <div class="mt-4 mb-10 flex flex-wrap justify-end gap-3 select-none">
          <Button
            variant="ghost"
            size="md"
            onclick={handleCancelClick}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="md"
            onclick={() => handleSaveClick(false)}
            disabled={isSubmitting}>
            Save draft
          </Button>
          <Button
            variant="primary"
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
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showCancelDialog = false)}>Keep editing</Button>
    <Button
      variant="destructive"
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
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showPublishDialog = false)}>Cancel</Button>
    <Button
      variant="primary"
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
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showSaveDraftDialog = false)}>Cancel</Button>
    <Button
      variant="primary"
      size="md"
      onclick={() => executeSave(false)}>Save draft</Button>
  {/snippet}
</Dialog>

{#if showToast}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-subtle bg-surface-card/90 px-4 py-2 text-xs font-semibold text-text-primary shadow-lg backdrop-blur-md transition-all duration-300">
    <i
      class="bi bi-check-circle-fill text-sm text-copilot"
      aria-hidden="true"></i>
    {toastMessage}
  </div>
{/if}

<style>
  @reference "../../layout.css";
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span),
  .line-num-item {
    @apply font-mono text-[14.5px]! leading-[24px]! tracking-normal! normal-case!;
    font-feature-settings: var(--font-feature-settings-mono) !important;
  }

  .editor-textarea,
  .editor-pre {
    @apply break-words!;
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
    @apply block! min-h-[24px]! leading-[24px]!;
  }

  .line-num-item {
    @apply box-border! flex! h-[24px] items-start! justify-end!;
  }

  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
