<!-- @format -->
<script lang="ts">
  import {onMount, tick} from 'svelte'
  import type {Snippet} from 'svelte'
  import {isNameReserved} from '$lib/utils/nameValidator'
  import {
    LinkListSection,
    ShinyText,
    SkipLink,
    SpotlightSearch,
    FormField,
    Input,
    Textarea,
    Button,
    Dialog,
    EmptyState,
    CvEntryCard,
    ShareDialog,
    FilterToolbar,
    FilterChipGroup,
    SortControl,
    FilterCheckboxGroup,
    SearchResultCount,
    FilterEmptyState,
    Pagination,
    RelativeTime,
    DropdownTrigger,
    toastStore,
    createFilterSortStore,
    FooterSection,
    ThemeSelect,
    SkillGroup,
    formatReadTime,
    formatCommentCount,
    formatViewCount
  } from '$lib'
  import {supabase} from '$lib/supabase'
  import {SvelteSet} from 'svelte/reactivity'
  import {formatMonthAbbrev, decodeHtmlEntities} from '$lib/author'
  import {themeStore} from '$lib/stores/themeStore.svelte'
  import type {Theme, Project} from '$lib/types'
  import type {BlogPost} from './+page.server'

  let {data} = $props()

  type Section = 'home' | 'blog' | 'contact' | 'cv' | 'projects' | 'funding'

  interface NavItem {
    id: Section
    label: string
  }

  interface Contact {
    label: string
    value: string
    shortValue?: string
    href: string
    icon: string
  }

  interface Experience {
    role: string
    company: string
    period: string
    desc: string
  }

  interface Education {
    degree: string
    major: string
    faculty: string
    university: string
    url?: string
    period: string
    gpa?: string
  }

  let author = $derived(data.author)
  let cvData = $derived(data.cv || {experience: [], education: []})
  let fundingData = $derived(data.funding || [])
  let contactData = $derived(data.contact || [])

  let name = $derived(author?.name || '')
  let username = $derived(author?.username || '')
  let desc = $derived(author?.bio || '')
  let headline = $derived(author?.headline || '')
  let jobTitle = $derived(author?.jobTitle || '')
  let siteUrl = $derived(author?.siteUrl || '')
  let avatar = $derived(author?.avatar || '')

  const navItems: NavItem[] = [
    {id: 'home', label: 'Home'},
    {id: 'projects', label: 'Projects'},
    {id: 'blog', label: 'Blog'},
    {id: 'cv', label: 'CV'},
    {id: 'funding', label: 'Funding'},
    {id: 'contact', label: 'Contact'}
  ]

  const posts = $derived(data.posts || [])

  function getBannerUrl(bannerPath: string | null | undefined): string | null {
    if (!bannerPath) return null
    const {data: res} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(bannerPath)
    return res.publicUrl
  }

  const failedBanners = new SvelteSet<string>()

  function markBannerFailed(postId: string) {
    failedBanners.add(postId)
  }

  let openCopyMenuId = $state<string | null>(null)
  function toggleCopyMenu(postId: string) {
    openCopyMenuId = openCopyMenuId === postId ? null : postId
  }

  function isOutsideDropdown(
    target: EventTarget | null,
    attr: string,
    id: string
  ): boolean {
    const el = (target as HTMLElement | null)?.closest?.(`[${attr}]`)
    return el?.getAttribute(attr) !== id
  }

  function handleDropdownOutsideClick(event: MouseEvent) {
    if (
      openCopyMenuId
      && isOutsideDropdown(event.target, 'data-copy-dropdown', openCopyMenuId)
    ) {
      openCopyMenuId = null
    }
    if (
      openCodeMenuId
      && isOutsideDropdown(event.target, 'data-code-dropdown', openCodeMenuId)
    ) {
      openCodeMenuId = null
    }
  }

  let shareDialogData = $state<{title: string; url: string} | null>(null)
  let showShareDialog = $state(false)

  function openShareDialog(data: {title: string; url: string}) {
    shareDialogData = data
    showShareDialog = true
  }

  function shareBlogPostDialog(post: {title: string; slug: string}) {
    if (typeof window === 'undefined') return
    openShareDialog({
      title: post.title,
      url: `${window.location.origin}/blog/${post.slug}`
    })
  }

  function shareProjectDialog(project: {name: string; url: string}) {
    openShareDialog({title: project.name, url: project.url})
  }

  async function copyBlogId(post: {id: string}) {
    openCopyMenuId = null
    try {
      await navigator.clipboard.writeText(post.id)
      toastStore.success('Copied!')
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  async function copyBlogMarkdown(post: {id: string; slug: string}) {
    openCopyMenuId = null
    try {
      const res = await fetch(`/api/v1/blog/${post.slug}?format=md`)
      if (res.ok) {
        const mdText = await res.text()
        await navigator.clipboard.writeText(mdText)
        toastStore.success('Copied!')
      } else {
        toastStore.error('Failed to fetch Markdown')
      }
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  async function copyBlogUrl(post: {id: string; slug: string}) {
    openCopyMenuId = null
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/blog/${post.slug}`
      )
      toastStore.success('Copied!')
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  type CodeTab = 'https' | 'ssh' | 'cli'

  let openCodeMenuId = $state<string | null>(null)
  let codeTabByProject = $state<Record<string, CodeTab>>({})

  function toggleCodeMenu(name: string) {
    openCodeMenuId = openCodeMenuId === name ? null : name
  }

  function getCodeTab(name: string): CodeTab {
    return codeTabByProject[name] ?? 'https'
  }

  function setCodeTab(name: string, tab: CodeTab) {
    codeTabByProject = {...codeTabByProject, [name]: tab}
  }

  function codeCommand(
    project: {fullName: string; cloneUrl: string; sshUrl: string},
    tab: CodeTab
  ): string {
    if (tab === 'ssh') return `git clone ${project.sshUrl}`
    if (tab === 'cli') return `gh repo clone ${project.fullName}`
    return `git clone ${project.cloneUrl}`
  }

  async function copyCodeCommand(
    project: {fullName: string; cloneUrl: string; sshUrl: string},
    tab: CodeTab
  ) {
    try {
      await navigator.clipboard.writeText(codeCommand(project, tab))
      toastStore.success('Copied!')
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  let experiences = $derived(cvData.experience || [])
  let education = $derived(cvData.education || [])
  let contact = $derived(contactData || [])

  interface SkillGroup {
    category: string
    items: string[]
  }

  let rawSkills = $derived(data.skills || author?.skills || [])
  let skills = $derived<SkillGroup[]>(
    (Array.isArray(rawSkills) ?
      rawSkills.map((s: any) =>
        typeof s === 'string' ?
          {category: 'Skills', items: [s]}
        : {
            category: decodeHtmlEntities(s.category || 'General'),
            items: (s.items || []).map((i: string) => decodeHtmlEntities(i))
          }
      )
    : []
    ).sort((a, b) => a.items.length - b.items.length)
  )

  const snapshotSkillGroups = [
    'Software Engineering',
    'Linux/Unix',
    'Linux',
    'Unix',
    'Programming Languages',
    'DevOps & Tooling',
    'Cybersecurity',
    'Artificial Intelligence'
  ]
  const skillsSnapshot = $derived(
    skills.filter(g => snapshotSkillGroups.includes(g.category)).length > 0 ?
      skills.filter(g => snapshotSkillGroups.includes(g.category))
    : skills.slice(0, 6)
  )

  function skillGroupBasis(skillCount: number): number {
    return 160 + skillCount * 24
  }

  function formatPeriod(
    startMonth?: string,
    startYear?: number,
    endMonth?: string | null,
    endYear?: number | null,
    currentlyIn?: boolean
  ): string {
    const sMonth = formatMonthAbbrev(startMonth)
    const eMonth = formatMonthAbbrev(endMonth)
    const start = [sMonth, startYear].filter(Boolean).join(' ')
    if (currentlyIn) return `${start} - Present`
    const end = [eMonth, endYear].filter(Boolean).join(' ')
    if (start && end) return `${start} - ${end}`
    if (start) return start
    if (end) return end
    return ''
  }

  let contactItems = $derived(
    contactData.map(c => ({
      label: c.platform || c.displayValue,
      value: c.displayValue,
      href: c.href,
      icon: c.icon || 'bi-person'
    }))
  )

  interface FundingPlatform {
    label: string
    value: string
    shortValue?: string
    href: string
    icon: string
    color?: string
  }

  let fundingPlatforms = $derived<FundingPlatform[]>(
    fundingData.map(f => ({
      label: f.platform,
      value: f.displayValue || f.platform,
      href: f.url,
      icon: f.icon || 'bi-heart-fill'
    }))
  )

  const projects = $derived(data.projects || [])

  const recentProjects = $derived(
    [...projects]
      .sort(
        (a, b) =>
          new Date(b.pushedAt || 0).getTime()
          - new Date(a.pushedAt || 0).getTime()
      )
      .slice(0, 2)
  )

  const recentPosts = $derived(posts.slice(0, 2))

  let activeSection = $state<Section>('home')
  let menuOpen = $state(false)
  let themeDropdownOpen = $state(false)
  let mobileMenuRef = $state<HTMLElement | null>(null)
  let menuTriggerRef = $state<HTMLButtonElement | null>(null)
  let isDesktopViewport = $state(false)
  let menuHasBeenOpened = false
  let formName = $state('')
  let formEmail = $state('')
  let formMessage = $state('')
  let formErrors = $state({name: '', email: '', message: ''})
  let formValid = $state({name: false, email: false, message: false})
  let showSendMessageDialog = $state(false)
  let contactFormElement = $state<HTMLFormElement | null>(null)

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const validateName = debounce(() => {
    if (formName.trim() === '') {
      formErrors.name = ''
      formValid.name = false
    } else if (isNameReserved(formName)) {
      formErrors.name = 'This name cannot be used. Please use another name.'
      formValid.name = false
    } else {
      formErrors.name = ''
      formValid.name = true
    }
  }, 500)

  const validateEmail = debounce(() => {
    if (formEmail.trim() === '') {
      formErrors.email = ''
      formValid.email = false
    } else if (!emailRegex.test(formEmail.trim())) {
      formErrors.email = 'Please enter a valid email address.'
      formValid.email = false
    } else {
      formErrors.email = ''
      formValid.email = true
    }
  }, 500)

  const validateMessage = debounce(() => {
    if (formMessage.trim() === '') {
      formErrors.message = ''
      formValid.message = false
    } else {
      formErrors.message = ''
      formValid.message = true
    }
  }, 500)

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  function validateForm(e: Event) {
    const nameErr = formName.trim() === '' ? 'Name is required.' : ''
    const emailErr = formEmail.trim() === '' ? 'Email is required.' : ''
    const msgErr = formMessage.trim() === '' ? 'Message is required.' : ''
    const emailFormatErr =
      !emailErr && !emailRegex.test(formEmail.trim()) ?
        'Please enter a valid email address.'
      : ''
    const nameReservedErr =
      !nameErr && isNameReserved(formName) ?
        'This name cannot be used. Please use another name.'
      : ''

    formErrors = {
      name: nameErr || nameReservedErr,
      email: emailErr || emailFormatErr,
      message: msgErr
    }
    if (formErrors.name) formValid.name = false
    if (formErrors.email) formValid.email = false
    if (formErrors.message) formValid.message = false

    e.preventDefault()

    if (!formErrors.name && !formErrors.email && !formErrors.message) {
      formName = sanitizeInput(formName.trim())
      formEmail = sanitizeInput(formEmail.trim())
      formMessage = sanitizeInput(formMessage.trim())
      showSendMessageDialog = true
    }
  }

  function executeSendMessage() {
    if (contactFormElement) {
      contactFormElement.submit()
    }
  }

  function navigate(section: Section) {
    activeSection = section
    menuOpen = false
    if (typeof window !== 'undefined') {
      window.location.hash = section === 'home' ? '' : section
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault()
      menuOpen = false
    }
  }

  $effect(() => {
    if (typeof document === 'undefined') return

    if (menuOpen) {
      menuHasBeenOpened = true
      tick().then(() => {
        const firstFocusable = mobileMenuRef?.querySelector<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      })
    } else if (menuHasBeenOpened) {
      menuTriggerRef?.focus()
    }
  })

  function getThemeIcon(selectedTheme = themeStore.current) {
    if (selectedTheme === 'dark') return 'bi-moon-stars-fill'
    if (selectedTheme === 'light') return 'bi-sun-fill'
    return 'bi-circle-half'
  }

  function getThemeLabel(selectedTheme = themeStore.current) {
    return selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)
  }

  const blogFilterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  })

  const projectFilterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  })

  const allBlogTags = $derived.by(() => {
    const set = new SvelteSet<string>()
    for (const post of posts) {
      if (post.tags) {
        post.tags.forEach((t: string) => set.add(t))
      }
    }
    return Array.from(set)
  })

  const filteredBlogPosts = $derived.by(() => {
    let list = posts

    const q = blogFilterStore.search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(q)
          || (p.excerpt && p.excerpt.toLowerCase().includes(q))
      )
    }

    const selectedTags = blogFilterStore.filters['tag'] || []
    if (selectedTags.length > 0) {
      list = list.filter(
        p => p.tags && p.tags.some((t: string) => selectedTags.includes(t))
      )
    }

    const sortField = blogFilterStore.sort.field
    const sortDir = blogFilterStore.sort.direction === 'asc' ? 1 : -1

    return [...list].sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title) * sortDir
      } else if (sortField === 'readingTime') {
        const readingA = parseInt(a.read_time || '0', 10)
        const readingB = parseInt(b.read_time || '0', 10)
        return (readingA - readingB) * sortDir
      } else if (sortField === 'views') {
        const viewsA = a.views_count ?? 0
        const viewsB = b.views_count ?? 0
        return (viewsA - viewsB) * sortDir
      } else if (sortField === 'comments') {
        const commentsA = a.comment_count ?? 0
        const commentsB = b.comment_count ?? 0
        return (commentsA - commentsB) * sortDir
      } else {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return (dateA - dateB) * sortDir
      }
    })
  })

  const allProjectTags = $derived.by(() => {
    const set = new SvelteSet<string>()
    for (const p of projects) {
      if (p.tags) {
        p.tags.forEach(t => set.add(t))
      }
    }
    return Array.from(set)
  })

  const filteredProjectList = $derived.by(() => {
    let list = projects

    const q = projectFilterStore.search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q)
          || p.desc.toLowerCase().includes(q)
          || (p.lang && p.lang.toLowerCase().includes(q))
      )
    }

    const selectedTags = projectFilterStore.filters['tag'] || []
    if (selectedTags.length > 0) {
      list = list.filter(
        p => p.tags && p.tags.some(t => selectedTags.includes(t))
      )
    }

    const sortField = projectFilterStore.sort.field
    const sortDir = projectFilterStore.sort.direction === 'asc' ? 1 : -1

    return [...list].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name) * sortDir
      } else if (sortField === 'stars') {
        return ((a.stars || 0) - (b.stars || 0)) * sortDir
      } else if (sortField === 'license') {
        const lA = a.licenseName || ''
        const lB = b.licenseName || ''
        return lA.localeCompare(lB) * sortDir
      } else {
        return a.name.localeCompare(b.name) * sortDir
      }
    })
  })

  const PAGE_SIZE = 6

  let blogPage = $state(1)
  let projectPage = $state(1)

  const blogTotalPages = $derived(
    Math.max(1, Math.ceil(filteredBlogPosts.length / PAGE_SIZE))
  )
  const blogPageClamped = $derived(Math.min(blogPage, blogTotalPages))
  const paginatedBlogPosts = $derived(
    filteredBlogPosts.slice(
      (blogPageClamped - 1) * PAGE_SIZE,
      blogPageClamped * PAGE_SIZE
    )
  )

  const projectTotalPages = $derived(
    Math.max(1, Math.ceil(filteredProjectList.length / PAGE_SIZE))
  )
  const projectPageClamped = $derived(Math.min(projectPage, projectTotalPages))
  const paginatedProjectList = $derived(
    filteredProjectList.slice(
      (projectPageClamped - 1) * PAGE_SIZE,
      projectPageClamped * PAGE_SIZE
    )
  )

  $effect(() => {
    void blogFilterStore.search
    void blogFilterStore.filters
    void blogFilterStore.sort
    blogPage = 1
  })

  $effect(() => {
    void projectFilterStore.search
    void projectFilterStore.filters
    void projectFilterStore.sort
    projectPage = 1
  })

  onMount(() => {
    blogFilterStore.parseFromUrl(new URL(window.location.href))
    projectFilterStore.parseFromUrl(new URL(window.location.href))

    const handleHashChange = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1) as Section
        if (
          ['home', 'blog', 'contact', 'cv', 'projects', 'funding'].includes(
            hash
          )
        ) {
          activeSection = hash
        }
      }
    }
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)

    const desktopQuery = window.matchMedia('(min-width: 768px)')
    isDesktopViewport = desktopQuery.matches
    const handleViewportChange = (e: MediaQueryListEvent) => {
      isDesktopViewport = e.matches
      if (e.matches) menuOpen = false
    }
    desktopQuery.addEventListener('change', handleViewportChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      desktopQuery.removeEventListener('change', handleViewportChange)
    }
  })

  let jsonLdScript = $derived(
    '<script type="application/ld+json">'
      + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: name,
        url: siteUrl,
        sameAs: Object.values(author?.socials || {}).filter(Boolean),
        jobTitle: jobTitle,
        description: desc
      }).replace(/</g, '\\u003c')
      + '</'
      + 'script>'
  )
</script>

<svelte:head>
  <title>{name} — {jobTitle}</title>
  <meta
    name="description"
    content={desc} />
  <meta
    name="robots"
    content="index, follow" />
  <link
    rel="canonical"
    href={siteUrl} />
  <meta
    property="og:title"
    content="{name} — {headline}" />
  <meta
    property="og:description"
    content={desc} />
  <meta
    property="og:type"
    content="profile" />
  <meta
    property="og:url"
    content={siteUrl} />
  <meta
    property="og:site_name"
    content={name} />
  <meta
    property="og:image"
    content="{siteUrl}/hero.png" />
  <meta
    property="og:image:secure_url"
    content="{siteUrl}/hero.png" />
  <meta
    property="og:image:type"
    content="image/png" />
  <meta
    property="og:image:width"
    content="1280" />
  <meta
    property="og:image:height"
    content="640" />
  <meta
    property="og:image:alt"
    content="{name} — {desc}" />
  <meta
    property="og:locale"
    content="en_US" />
  <meta
    property="og:locale:alternate"
    content="id_ID" />
  <meta
    property="profile:username"
    content={username} />
  <meta
    property="profile:gender"
    content="male" />
  <meta
    name="twitter:card"
    content="summary_large_image" />
  <meta
    name="twitter:title"
    content="{name} — {headline}" />
  <meta
    name="twitter:description"
    content={desc} />
  {@html jsonLdScript}
</svelte:head>

<svelte:window
  onclick={handleDropdownOutsideClick}
  onkeydown={handleMenuKeydown} />

{#if menuOpen}
  <button
    class="fixed inset-0 z-30 bg-overlay-backdrop backdrop-blur-md md:hidden"
    onclick={() => (menuOpen = false)}
    aria-label="Close menu"></button>
{/if}

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card/45 px-3 font-sans shadow-xs backdrop-blur-xl transition-colors duration-300 sm:px-5"
  aria-label="Main navigation">
  <button
    onclick={() => navigate('home')}
    class="max-w-[calc(100vw-5rem)] min-w-0 cursor-pointer truncate text-left text-base font-bold tracking-tight text-text-primary transition-colors hover:text-copilot sm:max-w-none">
    {name}
  </button>

  <div class="flex items-center gap-2 sm:gap-3">
    <div
      id="mobile-menu"
      bind:this={mobileMenuRef}
      inert={!isDesktopViewport && !menuOpen}
      class="fixed top-16 right-5 z-40 flex w-56 origin-top-right flex-col items-start gap-1 rounded-sm border border-border-subtle bg-surface-card p-2 shadow-lg transition-all duration-200 md:pointer-events-auto md:static md:h-auto md:w-auto md:translate-x-0 md:scale-100 md:flex-row md:items-center md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:opacity-100 md:shadow-none"
      class:opacity-0={!menuOpen}
      class:scale-95={!menuOpen}
      class:pointer-events-none={!menuOpen}
      class:opacity-100={menuOpen}
      class:scale-100={menuOpen}>
      <div
        class="w-full md:hidden"
        role="group"
        aria-label="Appearance">
        <p
          class="px-4 pt-1 pb-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
          aria-hidden="true">
          Appearance
        </p>
        <div class="relative w-full">
          <button
            onclick={() => (themeDropdownOpen = !themeDropdownOpen)}
            class="flex h-11 w-full cursor-pointer items-center justify-between rounded-md px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot"
            aria-label="Change theme"
            aria-haspopup="listbox"
            aria-expanded={themeDropdownOpen}>
            <span class="inline-flex items-center gap-3">
              <i
                class="bi {getThemeIcon()} text-sm"
                aria-hidden="true"></i>
              {getThemeLabel()}
            </span>
            <span
              class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                themeDropdownOpen
              ) ?
                'rotate-180'
              : ''}">
              <i
                class="bi bi-chevron-down text-xs leading-none"
                aria-hidden="true"></i>
            </span>
          </button>

          {#if themeDropdownOpen}
            <div
              class="absolute top-12 right-0 left-0 z-50 flex w-full flex-col rounded-sm border border-border-subtle bg-surface-card p-1 shadow-lg"
              role="listbox"
              aria-label="Theme">
              {#each ['auto', 'light', 'dark'] as themeOption (themeOption)}
                <button
                  role="option"
                  aria-selected={themeStore.current === themeOption}
                  onclick={() => {
                    themeStore.apply(themeOption as Theme)
                    themeDropdownOpen = false
                  }}
                  class="flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-xs font-bold transition-colors hover:bg-surface-hover hover:text-copilot {(
                    themeStore.current === themeOption
                  ) ?
                    'text-copilot'
                  : 'text-text-primary'}">
                  <i
                    class="bi {getThemeIcon(themeOption as Theme)} text-sm"
                    aria-hidden="true"></i>
                  {getThemeLabel(themeOption as Theme)}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <hr
        class="my-1 w-full border-border-subtle md:hidden"
        aria-hidden="true" />

      <nav
        class="w-full md:contents"
        aria-label="Section navigation">
        <p
          class="px-4 pt-1 pb-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase md:hidden"
          aria-hidden="true">
          Menu
        </p>
        <ul
          class="flex w-full flex-col items-start gap-1 md:w-auto md:flex-row md:items-center md:gap-1">
          {#each navItems as item (item.id)}
            <li class="w-full md:w-auto">
              <button
                onclick={() => {
                  navigate(item.id)
                  menuOpen = false
                }}
                class="text-md flex h-11 w-full cursor-pointer items-center justify-start rounded-sm border-0 px-4 leading-none font-medium whitespace-nowrap transition-all md:h-9 md:justify-center md:rounded-sm md:px-3 md:text-sm {(
                  activeSection === item.id
                ) ?
                  'bg-copilot-contrast-bg font-semibold text-white hover:bg-copilot-contrast-bg/90 md:bg-copilot-contrast-bg md:text-white md:shadow-xs md:hover:bg-copilot-contrast-bg/90'
                : 'text-text-primary hover:bg-surface-hover hover:text-copilot md:text-text-secondary md:hover:bg-surface-hover md:hover:text-copilot'}">
                {item.label}
              </button>
            </li>
          {/each}
        </ul>
      </nav>
    </div>

    <SpotlightSearch projects={data.projects} />

    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply}
      class="hidden md:inline-flex" />

    <button
      bind:this={menuTriggerRef}
      class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-xl transition-colors hover:bg-surface-hover md:hidden"
      onclick={() => (menuOpen = !menuOpen)}
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-menu">
      <i
        class="bi {menuOpen ? 'bi-x-lg' : 'bi-list'} text-text-primary"
        aria-hidden="true"></i>
    </button>
  </div>
</nav>

<main
  id="main-content"
  inert={menuOpen}
  aria-hidden={menuOpen ? 'true' : undefined}
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  {#snippet staticTag(tag: string)}
    <span
      class="rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium text-text-muted transition-colors">
      {tag}
    </span>
  {/snippet}

  {#snippet filterableTag(tag: string)}
    <button
      type="button"
      onclick={() => projectFilterStore.toggleMultiFilter('tag', tag)}
      class="cursor-pointer rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium transition-colors hover:bg-surface-hover hover:text-copilot {(
        projectFilterStore.filters['tag']?.includes(tag)
      ) ?
        'font-semibold text-copilot'
      : 'text-text-muted'}">
      {tag}
    </button>
  {/snippet}

  {#snippet projectCard(
    project: Project,
    headingTag: 'h3' | 'h4',
    tagItem: Snippet<[string]>
  )}
    <div
      class="relative flex h-full flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-5 text-left shadow-xs {(
        openCodeMenuId === project.name
      ) ?
        'z-30'
      : ''}">
      <article class="contents">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-1">
            <svelte:element
              this={headingTag}
              class="text-xl leading-snug font-bold text-text-primary">
              {project.name}
            </svelte:element>
            {#if project.lang}
              <span class="inline-flex items-center gap-1 select-none">
                <span
                  class="rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-text-muted">
                  {project.lang}
                </span>
              </span>
            {/if}
          </div>

          <div
            class="relative z-20 grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs leading-5 font-medium text-text-muted select-none">
            {#if project.licenseName}
              <span class="inline-flex w-fit items-center gap-1">
                <i
                  class="bi bi-award text-xs leading-none"
                  aria-hidden="true"></i>
                {project.licenseName} License
              </span>
            {:else}
              <span aria-hidden="true"></span>
            {/if}
            <span class="inline-flex w-fit items-center gap-1">
              <i
                class="bi bi-diagram-2 text-xs leading-none"
                aria-hidden="true"></i>
              {project.forks} forks
            </span>
            <span class="inline-flex w-fit items-center gap-1">
              <i
                class="bi bi-star-fill text-xs leading-none"
                aria-hidden="true"></i>
              {project.stars} stars
            </span>
            {#if project.pushedAt}
              <span class="inline-flex w-fit items-center gap-1">
                <i
                  class="bi bi-clock-history text-xs leading-none"
                  aria-hidden="true"></i>
                <RelativeTime
                  date={project.pushedAt}
                  titlePrefix="Updated " />
              </span>
            {:else}
              <span aria-hidden="true"></span>
            {/if}
            <span class="inline-flex w-fit items-center gap-1">
              <i
                class="bi bi-git text-xs leading-none"
                aria-hidden="true"></i>
              {project.branches} branches
            </span>
            <span class="inline-flex w-fit items-center gap-1">
              <i
                class="bi bi-activity text-xs leading-none"
                aria-hidden="true"></i>
              {project.commits} commits
            </span>
          </div>

          {#if project.tags.length > 0}
            <div class="relative z-20 flex flex-wrap items-center gap-1.5">
              {#each project.tags as tag (tag)}
                {@render tagItem(tag)}
              {/each}
            </div>
          {/if}
        </div>

        <p class="min-h-[4rem] text-sm leading-normal text-text-secondary">
          {project.desc}
        </p>

        {#if project.languages.length > 0}
          <div class="relative z-20 flex flex-col gap-2">
            <span
              class="text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              Languages
            </span>
            <div
              class="flex h-1.5 w-full overflow-hidden rounded-full bg-border-subtle/30">
              {#each project.languages as language (language.name)}
                <div
                  class="w-[var(--lang-w)] bg-[var(--lang-color)]"
                  style="--lang-w: {language.percent}%; --lang-color: {language.color};">
                </div>
              {/each}
            </div>
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              {#each project.languages as language (language.name)}
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="h-2 w-2 shrink-0 rounded-full bg-[var(--lang-dot-color)]"
                    style="--lang-dot-color: {language.color};"></span>
                  <span class="font-semibold text-text-primary"
                    >{language.name}</span>
                  {language.percent}%
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-2">
          <hr class="border-border-subtle" />

          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="md"
              leadingIcon="bi-share-fill"
              class="w-full"
              onclick={() => shareProjectDialog(project)}>
              Share
            </Button>

            <div
              class="relative w-full"
              data-code-dropdown={project.name}>
              <DropdownTrigger
                ariaLabel="Code options"
                fullWidth
                isOpen={openCodeMenuId === project.name}
                onclick={() => toggleCodeMenu(project.name)}>
                <span class="inline-flex items-center gap-1.5">
                  <i
                    class="bi bi-code text-xs"
                    aria-hidden="true"></i>
                  Code
                </span>
              </DropdownTrigger>

              {#if openCodeMenuId === project.name}
                <div
                  role="menu"
                  class="absolute left-0 z-50 mt-1.5 w-72 overflow-hidden rounded-sm border border-border-subtle bg-surface-elevated/70 p-3 shadow-xl backdrop-blur-lg">
                  <div
                    class="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                    <i
                      class="bi bi-terminal text-xs"
                      aria-hidden="true"></i>
                    Clone
                  </div>

                  <div
                    class="mt-2.5 flex rounded-sm border border-border-subtle p-0.5 text-xs font-semibold">
                    {#each [['https', 'HTTPS'], ['ssh', 'SSH'], ['cli', 'GitHub CLI']] as const as [key, label] (key)}
                      <button
                        type="button"
                        onclick={() => setCodeTab(project.name, key)}
                        class="flex-1 cursor-pointer rounded-xs py-1 transition-colors {(
                          getCodeTab(project.name) === key
                        ) ?
                          'bg-copilot text-white'
                        : 'text-text-secondary hover:text-text-primary'}">
                        {label}
                      </button>
                    {/each}
                  </div>

                  <div
                    class="mt-2.5 flex items-center gap-2 rounded-sm border border-border-subtle bg-surface-base/60 px-2.5 py-2">
                    <span
                      class="min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto font-mono text-[11px] whitespace-nowrap text-text-secondary select-all [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {codeCommand(project, getCodeTab(project.name))}
                    </span>
                    <button
                      type="button"
                      onclick={() =>
                        copyCodeCommand(project, getCodeTab(project.name))}
                      aria-label="Copy clone command"
                      class="shrink-0 cursor-pointer text-text-secondary transition-colors hover:text-copilot">
                      <i
                        class="bi bi-copy text-xs"
                        aria-hidden="true"></i>
                    </button>
                  </div>

                  <hr class="my-2.5 border-border-subtle" />

                  <a
                    href={project.zipUrl}
                    class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                    <i
                      class="bi bi-file-earmark-zip text-xs"
                      aria-hidden="true"></i>
                    Download ZIP
                  </a>
                </div>
              {/if}
            </div>
          </div>

          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            class="hover:bg-copilot-hover active:bg-copilot-active inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:text-sm">
            View repo
          </a>
        </div>
      </article>
    </div>
  {/snippet}

  {#snippet blogPostCard(post: BlogPost)}
    <div
      class="relative flex h-full w-full flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-5 text-left shadow-xs {(
        openCopyMenuId === post.id
      ) ?
        'z-30'
      : ''}">
      <div
        class="relative aspect-video w-full overflow-hidden rounded-sm border border-border-subtle select-none">
        {#if post.banner_path && !failedBanners.has(post.id)}
          <img
            src={getBannerUrl(post.banner_path)}
            alt={post.title}
            loading="lazy"
            onload={e =>
              (
                e.currentTarget.closest('.animate-pulse') as HTMLElement | null
              )?.classList.remove('animate-pulse')}
            onerror={() => markBannerFailed(post.id)}
            class="block h-full w-full object-cover" />
        {:else}
          <div
            class="to-palette-purple/15 flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 select-none">
            <i
              class="bi bi-journal-text text-2xl text-copilot/50"
              aria-hidden="true"></i>
          </div>
        {/if}
      </div>

      <div class="flex flex-1 flex-col gap-1 font-sans">
        <div
          class="flex min-h-[1.25rem] w-full [scrollbar-width:none] flex-wrap items-center gap-x-1.5 overflow-x-auto font-sans text-[11px] font-medium whitespace-nowrap text-text-muted select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <RelativeTime date={post.created_at} />
          <span aria-hidden="true">&middot;</span>
          <span>{formatReadTime(post.read_time)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatCommentCount(post.comment_count)}</span>
          {#if post.views_count !== undefined}
            <span aria-hidden="true">&middot;</span>
            <span>{formatViewCount(post.views_count)}</span>
          {/if}
        </div>
        <div class="mt-1">
          <h4 class="text-lg leading-snug font-bold text-text-primary">
            <a
              href="/blog/{post.slug}"
              class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
              {post.title}
            </a>
          </h4>
        </div>
        {#if post.excerpt}
          <p class="min-h-[6.5rem] text-sm leading-normal text-text-secondary">
            {post.excerpt}
          </p>
        {/if}

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-2">
          <hr class="border-border-subtle" />

          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="md"
              leadingIcon="bi-share-fill"
              class="w-full"
              onclick={() => shareBlogPostDialog(post)}>
              Share
            </Button>

            <div
              class="relative w-full"
              data-copy-dropdown={post.id}>
              <DropdownTrigger
                ariaLabel="Copy options menu"
                fullWidth
                isOpen={openCopyMenuId === post.id}
                onclick={() => toggleCopyMenu(post.id)}>
                <span class="inline-flex items-center gap-1.5">
                  <i
                    class="bi bi-copy text-xs"
                    aria-hidden="true"></i>
                  Copy
                </span>
              </DropdownTrigger>

              {#if openCopyMenuId === post.id}
                <div
                  role="menu"
                  class="absolute left-0 z-50 mt-1.5 min-w-40 overflow-hidden rounded-sm border border-border-subtle bg-surface-elevated/70 py-1 shadow-xl backdrop-blur-lg">
                  <button
                    type="button"
                    role="menuitem"
                    onclick={() => copyBlogUrl(post)}
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                    <i
                      class="bi bi-link text-xs"
                      aria-hidden="true"></i>
                    <span>Copy Blog URL</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onclick={() => copyBlogId(post)}
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                    <i
                      class="bi bi-hash text-xs"
                      aria-hidden="true"></i>
                    <span>Copy Blog ID</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onclick={() => copyBlogMarkdown(post)}
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                    <i
                      class="bi bi-markdown-fill text-xs"
                      aria-hidden="true"></i>
                    <span>Copy as Markdown</span>
                  </button>
                </div>
              {/if}
            </div>
          </div>

          <a
            href="/blog/{post.slug}"
            class="hover:bg-copilot-hover active:bg-copilot-active inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:text-sm">
            Read post
          </a>
        </div>
      </div>
    </div>
  {/snippet}

  {#if activeSection === 'home'}
    <section
      class="relative z-10 mx-auto flex w-full flex-col gap-8 px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[60%] xl:w-[50%]">
      <div
        class="pointer-events-none absolute top-12.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-copilot/10 blur-[80px]">
      </div>

      <div
        class="relative z-10 flex flex-col items-center justify-center text-center">
        <img
          src={avatar}
          alt={name || author?.name || ''}
          loading="lazy"
          referrerpolicy="no-referrer"
          class="relative z-10 mb-6 h-28 w-28 rounded-full border-2 border-copilot object-cover object-top shadow-[0_0_20px_color-mix(in_srgb,var(--color-copilot)_25%,transparent)] transition-all duration-300 dark:shadow-[0_0_25px_color-mix(in_srgb,var(--color-copilot)_35%,transparent)]" />
        <h1
          class="relative z-10 px-2 text-2xl font-bold tracking-tight whitespace-nowrap text-text-primary sm:text-3xl md:text-4xl lg:text-5xl">
          {name}
        </h1>
        <p
          class="relative z-10 mt-3 mb-2 font-mono text-lg font-medium text-text-secondary">
          {headline}
        </p>
        <p
          class="relative z-10 mt-4 max-w-xl text-base leading-relaxed text-text-secondary/90">
          {desc}
        </p>

        <div
          class="relative z-10 mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {#if data.cvExists}
            <a
              href="/api/v1/cv"
              download="Farhan_Kurnia_Pratama_CV.pdf"
              class="hover:bg-copilot-hover active:bg-copilot-active inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-sm bg-copilot px-5 text-sm font-semibold whitespace-nowrap text-text-on-accent transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:w-48">
              Download CV
            </a>
          {:else}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="No CV document is available yet."
              class="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-sm bg-copilot/40 px-5 text-sm font-semibold whitespace-nowrap text-text-on-accent/70 select-none sm:w-48">
              Download CV
            </button>
          {/if}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onclick={() => navigate('projects')}
            class="sm:w-48">
            Browse projects
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onclick={() => navigate('contact')}
            class="sm:w-48">
            Get in touch
          </Button>
        </div>
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Top projects
        </h3>
        {#if recentProjects.length === 0}
          <EmptyState
            icon="bi-folder2-open"
            title="No projects yet"
            description="Check back soon for featured repositories." />
        {:else}
          <div
            class="relative {openCodeMenuId ? 'z-40' : (
              'z-0'
            )} mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {#each recentProjects as project (project.name)}
              {@render projectCard(project, 'h4', staticTag)}
            {/each}
          </div>
        {/if}
        {#if projects.length > 0}
          <div class="mt-4 flex justify-end">
            <button
              onclick={() => navigate('projects')}
              class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline">
              <span class="leading-none">View all projects</span>
              <i
                class="bi bi-arrow-right text-base leading-none transition-transform select-none group-hover:translate-x-0.5"
                aria-hidden="true"></i>
            </button>
          </div>
        {/if}
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Recent posts
        </h3>
        {#if posts.length === 0}
          <EmptyState
            icon="bi-journal-text"
            title="No posts yet"
            description="Check back soon for new articles." />
        {:else}
          <div class="relative z-0 mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {#each recentPosts as post (post.id)}
              {@render blogPostCard(post)}
            {/each}
          </div>
        {/if}
        {#if posts.length > 0}
          <div class="mt-4 flex justify-end">
            <button
              onclick={() => navigate('blog')}
              class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline">
              <span class="leading-none">View all posts</span>
              <i
                class="bi bi-arrow-right text-base leading-none transition-transform select-none group-hover:translate-x-0.5"
                aria-hidden="true"></i>
            </button>
          </div>
        {/if}
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Skills
        </h3>
        {#if skillsSnapshot.length === 0}
          <EmptyState
            icon="bi-stack"
            title="No skills listed yet"
            description="Check back soon for updated skills." />
        {:else}
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {#each skillsSnapshot as group (group.category)}
              <div
                class="sm:min-w-0 sm:shrink sm:grow sm:[flex-basis:var(--sg-basis)]"
                style="--sg-basis: {skillGroupBasis(group.items.length)}px">
                <SkillGroup
                  category={group.category}
                  skills={group.items}
                  class="h-full" />
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Experience
        </h3>
        {#if experiences.length === 0}
          <EmptyState
            icon="bi-briefcase-fill"
            title="No experience listed yet"
            description="Check back soon for career history." />
        {:else}
          <div
            class="divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface-card/45 text-left shadow-xs backdrop-blur-lg transition-colors duration-300">
            {#each experiences.slice(0, 2) as exp (exp.title || exp.company)}
              <CvEntryCard
                role={exp.title}
                organization={exp.company}
                period={formatPeriod(
                  exp.startMonth,
                  exp.startYear,
                  exp.endMonth,
                  exp.endYear,
                  exp.currentlyIn
                )}
                description={exp.description} />
            {/each}
          </div>
        {/if}
        <div class="mt-4 flex justify-end">
          <button
            onclick={() => navigate('cv')}
            class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copilot"
            aria-label="View full CV including education and experience">
            <span class="leading-none">View full CV</span>
            <i
              class="bi bi-arrow-right text-base leading-none transition-transform select-none group-hover:translate-x-0.5"
              aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div
        class="divide-y divide-adwaita-border overflow-hidden rounded-md border border-copilot/30! bg-copilot/5! text-left shadow-xs backdrop-blur-lg transition-colors duration-300">
        <div
          class="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
          <div class="flex items-start gap-4">
            <i
              class="bi bi-heart-fill mt-0.5 shrink-0 text-2xl text-copilot"
              aria-hidden="true"></i>
            <div>
              <h4 class="text-sm font-bold">
                <ShinyText
                  text="Support Open Source Work"
                  color="var(--color-copilot)"
                  shineColor="var(--color-surface-card)"
                  speed={1.5} />
              </h4>
              <p class="mt-0.5 text-xs leading-relaxed text-text-secondary">
                Your support helps maintain and improve these open-source
                projects
              </p>
            </div>
          </div>
          <button
            onclick={() => navigate('funding')}
            class="hover:bg-copilot-hover inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 py-2 text-xs font-semibold text-white transition-colors">
            Become a sponsor
          </button>
        </div>
      </div>

      <form
        bind:this={contactFormElement}
        novalidate
        action="https://buttondown.email/api/v1/subscribers"
        method="POST"
        onsubmit={validateForm}
        class="flex w-full flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card/45 p-6 text-left shadow-xs backdrop-blur-xl transition-colors duration-300"
        autocomplete="off">
        <input
          type="hidden"
          name="_subject"
          value="New message from portfolio website!" />
        <input
          type="hidden"
          name="_template"
          value="table" />
        <input
          type="hidden"
          name="_captcha"
          value="true" />
        <input
          type="hidden"
          name="_url"
          value="https://fkp.my.id/" />

        <div class="mb-2 select-none">
          <h2 class="text-sm font-bold text-text-primary">Send a Message</h2>
          <p class="mt-0.5 text-xs text-text-muted">
            Feel free to drop me a line. I'll get back to you as soon as
            possible.
          </p>
        </div>

        <FormField
          id="form-name"
          label="Name"
          required
          error={formErrors.name}
          valid={formValid.name}>
          <Input
            type="text"
            id="form-name"
            name="name"
            aria-required="true"
            autocomplete="name"
            placeholder="Enter your name"
            bind:value={formName}
            error={!!formErrors.name}
            valid={formValid.name}
            oninput={() => {
              formErrors.name = ''
              formValid.name = false
              validateName()
            }} />
        </FormField>

        <FormField
          id="form-email"
          label="Email"
          required
          error={formErrors.email}
          valid={formValid.email}>
          <Input
            type="text"
            id="form-email"
            name="email"
            aria-required="true"
            autocomplete="email"
            placeholder="Enter your email"
            bind:value={formEmail}
            error={!!formErrors.email}
            valid={formValid.email}
            oninput={() => {
              formErrors.email = ''
              formValid.email = false
              validateEmail()
            }} />
        </FormField>

        <FormField
          id="form-message"
          label="Message"
          required
          error={formErrors.message}
          valid={formValid.message}
          counter="{2000 - formMessage.length} left">
          <Textarea
            id="form-message"
            name="message"
            rows={4}
            maxlength={2000}
            placeholder="Write your message…"
            bind:value={formMessage}
            error={!!formErrors.message}
            valid={formValid.message}
            oninput={() => {
              formErrors.message = ''
              formValid.message = false
              validateMessage()
            }} />
        </FormField>

        <div class="mt-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md">
            Send message
          </Button>
        </div>
      </form>
    </section>
  {/if}

  {#if activeSection === 'contact'}
    <LinkListSection
      title="Contact"
      subtitle="Feel free to reach out via any of the channels below."
      items={contactItems}
      emptyIcon="bi-envelope-at-fill"
      emptyTitle="No contact channels yet"
      emptyDescription="Check back soon for ways to get in touch." />
  {/if}

  {#if activeSection === 'cv'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[60%] xl:w-[50%]">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary">
            Curriculum Vitae
          </h1>
          <p class="mt-2 text-sm text-text-secondary">
            Security-focused Software Engineer.
          </p>
        </div>
        {#if data.cvExists}
          <a
            href="/api/v1/cv"
            download="Farhan_Kurnia_Pratama_CV.pdf"
            class="hover:bg-copilot-hover inline-flex items-center justify-center rounded-sm bg-copilot px-4 py-2.5 text-sm font-semibold text-white transition-colors">
            Download PDF
          </a>
        {:else}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="No CV document is available yet."
            class="inline-flex cursor-not-allowed items-center justify-center rounded-sm bg-copilot/40 px-4 py-2.5 text-sm font-semibold text-white/70">
            Download PDF
          </button>
        {/if}
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Experience
        </h2>
        {#if experiences.length === 0}
          <div class="mt-4">
            <EmptyState
              icon="bi-briefcase-fill"
              title="No experience listed yet"
              description="Check back soon for career history." />
          </div>
        {:else}
          <div
            class="mt-4 divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface-card/45 shadow-xs backdrop-blur-lg transition-colors duration-300">
            {#each experiences as exp, idx (idx)}
              <CvEntryCard
                role={exp.title}
                organization={exp.company}
                period={formatPeriod(
                  exp.startMonth,
                  exp.startYear,
                  exp.endMonth,
                  exp.endYear,
                  exp.currentlyIn
                )}
                description={exp.description} />
            {/each}
          </div>
        {/if}
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Education
        </h2>
        {#if education.length === 0}
          <div class="mt-4">
            <EmptyState
              icon="bi-mortarboard-fill"
              title="No education listed yet"
              description="Check back soon for academic history." />
          </div>
        {:else}
          <div
            class="mt-4 divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface-card/45 shadow-xs backdrop-blur-lg transition-colors duration-300">
            {#each education as edu, idx (idx)}
              <CvEntryCard
                role={edu.degree}
                organization={edu.institution}
                period={formatPeriod(
                  edu.startMonth,
                  edu.startYear,
                  edu.endMonth,
                  edu.endYear,
                  edu.currentlyIn
                )}
                description={edu.description} />
            {/each}
          </div>
        {/if}
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Skills
        </h2>
        {#if skills.length === 0}
          <div class="mt-4">
            <EmptyState
              icon="bi-stack"
              title="No skills listed yet"
              description="Check back soon for updated skills." />
          </div>
        {:else}
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {#each skills as group (group.category)}
              <div
                class="sm:min-w-0 sm:shrink sm:grow sm:[flex-basis:var(--sg-basis)]"
                style="--sg-basis: {skillGroupBasis(group.items.length)}px">
                <SkillGroup
                  category={group.category}
                  skills={group.items}
                  class="h-full" />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  {#if activeSection === 'blog'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[60%] xl:w-[50%]">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary">
            Blog
          </h1>
          <p class="mt-2 text-sm text-text-secondary">
            Thoughts on Linux, security, and open source.
          </p>
        </div>
        <a
          href="/atom.xml"
          target="_blank"
          rel="noopener noreferrer"
          title="Subscribe via Atom/RSS feed"
          aria-label="Subscribe via Atom/RSS feed"
          class="mb-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-muted transition-colors select-none hover:bg-surface-hover hover:text-(--color-brand-rss)">
          <i
            class="bi bi-rss-fill text-xs select-none"
            aria-hidden="true"></i>
          <span class="hidden items-center sm:inline">Feed</span>
        </a>
      </div>

      {#if posts.length > 0}
        <div class="mb-6">
          <FilterToolbar title="Blog posts filter">
            {#snippet searchSlot()}
              <div class="w-full sm:w-60">
                <Input
                  type="search"
                  placeholder="Search articles..."
                  value={blogFilterStore.search}
                  oninput={e =>
                    blogFilterStore.setSearch(
                      (e.target as HTMLInputElement).value
                    )}
                  size="sm"
                  aria-label="Search blog articles" />
              </div>
            {/snippet}

            {#snippet filterControlsSlot()}
              {#if allBlogTags.length > 0}
                <FilterCheckboxGroup
                  label="Category/Tag"
                  options={allBlogTags.map(t => ({value: t, label: t}))}
                  selectedValues={blogFilterStore.filters['tag'] || []}
                  onChange={val =>
                    blogFilterStore.toggleMultiFilter('tag', val)} />
              {/if}
            {/snippet}

            {#snippet countSlot()}
              <SearchResultCount
                count={filteredBlogPosts.length}
                total={posts.length}
                itemLabel="articles" />
            {/snippet}

            {#snippet sortSlot()}
              <SortControl
                fields={[
                  {value: 'date', label: 'Date'},
                  {value: 'views', label: 'Views'},
                  {value: 'comments', label: 'Comments'},
                  {value: 'readingTime', label: 'Reading time'},
                  {value: 'title', label: 'Title'}
                ]}
                currentField={blogFilterStore.sort.field}
                currentDirection={blogFilterStore.sort.direction}
                onFieldChange={field => blogFilterStore.setSort(field)}
                onDirectionToggle={() =>
                  blogFilterStore.toggleSortDirection()} />
            {/snippet}

            {#snippet chipsSlot()}
              <FilterChipGroup
                chips={blogFilterStore.activeChips}
                onRemove={(type, val) =>
                  blogFilterStore.removeFilter(type, val)}
                onClearAll={() => blogFilterStore.clearAllFilters()} />
            {/snippet}
          </FilterToolbar>
        </div>
      {/if}

      {#if posts.length === 0}
        <EmptyState
          icon="bi-journal-x"
          title="No posts yet"
          description="Articles will appear here once published." />
      {:else if filteredBlogPosts.length === 0}
        <FilterEmptyState
          title="No articles match these filters"
          description="Try adjusting your tag filters or search keyword."
          onClearFilters={() => blogFilterStore.clearAllFilters()} />
      {:else}
        <div class="relative z-0 mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {#each paginatedBlogPosts as post (post.id)}
            {@render blogPostCard(post)}
          {/each}
        </div>
        <div class="mt-6">
          <Pagination
            page={blogPageClamped}
            totalPages={blogTotalPages}
            onPageChange={p => (blogPage = p)} />
        </div>
      {/if}
    </section>
  {/if}

  {#if activeSection === 'projects'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[60%] xl:w-[50%]">
      <div class="mb-6">
        <h1 class="text-3xl font-bold tracking-tight text-text-primary">
          Projects
        </h1>
        <p class="mt-2 text-sm text-text-secondary">
          Open source work on GitHub.
        </p>
      </div>

      {#if projects.length > 0}
        <div class="mb-6">
          <FilterToolbar title="Projects filter">
            {#snippet searchSlot()}
              <div class="w-full sm:w-60">
                <Input
                  type="search"
                  placeholder="Search projects..."
                  value={projectFilterStore.search}
                  oninput={e =>
                    projectFilterStore.setSearch(
                      (e.target as HTMLInputElement).value
                    )}
                  size="sm"
                  aria-label="Search projects" />
              </div>
            {/snippet}

            {#snippet filterControlsSlot()}
              {#if allProjectTags.length > 0}
                <FilterCheckboxGroup
                  label="Topics"
                  options={allProjectTags.map(t => ({value: t, label: t}))}
                  selectedValues={projectFilterStore.filters['tag'] || []}
                  onChange={val =>
                    projectFilterStore.toggleMultiFilter('tag', val)} />
              {/if}
            {/snippet}

            {#snippet countSlot()}
              <SearchResultCount
                count={filteredProjectList.length}
                total={projects.length}
                itemLabel="projects" />
            {/snippet}

            {#snippet sortSlot()}
              <SortControl
                fields={[
                  {value: 'name', label: 'Name'},
                  {value: 'stars', label: 'Stars'},
                  {value: 'license', label: 'License'}
                ]}
                currentField={projectFilterStore.sort.field}
                currentDirection={projectFilterStore.sort.direction}
                onFieldChange={field => projectFilterStore.setSort(field)}
                onDirectionToggle={() =>
                  projectFilterStore.toggleSortDirection()} />
            {/snippet}

            {#snippet chipsSlot()}
              <FilterChipGroup
                chips={projectFilterStore.activeChips}
                onRemove={(type, val) =>
                  projectFilterStore.removeFilter(type, val)}
                onClearAll={() => projectFilterStore.clearAllFilters()} />
            {/snippet}
          </FilterToolbar>
        </div>
      {/if}

      {#if projects.length === 0}
        <EmptyState
          icon="bi-box-seam"
          title="No projects yet"
          description="Projects will appear here." />
      {:else if filteredProjectList.length === 0}
        <FilterEmptyState
          title="No projects match these filters"
          description="Try adjusting your tech stack filters or search keyword."
          onClearFilters={() => projectFilterStore.clearAllFilters()} />
      {:else}
        <div
          class="relative {openCodeMenuId ? 'z-40' : (
            'z-0'
          )} mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {#each paginatedProjectList as project (project.name)}
            {@render projectCard(project, 'h3', filterableTag)}
          {/each}
        </div>
        <div class="mt-6">
          <Pagination
            page={projectPageClamped}
            totalPages={projectTotalPages}
            onPageChange={p => (projectPage = p)} />
        </div>
      {/if}
    </section>
  {/if}

  {#if activeSection === 'funding'}
    <LinkListSection
      title="Supporting & Funding"
      subtitle="Support open-source development and maintenance through these platforms."
      items={fundingPlatforms}
      emptyIcon="bi-heart-fill"
      emptyTitle="No funding platforms yet"
      emptyDescription="Check back soon for ways to support this work." />
  {/if}

  <FooterSection
    onNavClick={url => {
      if (url.startsWith('/#')) {
        const sectionId = url.replace('/#', '')
        navigate(sectionId as Section)
        window.scrollTo({top: 0, behavior: 'smooth'})
      } else if (url === '/') {
        navigate('home')
        window.scrollTo({top: 0, behavior: 'smooth'})
      } else {
        window.location.href = url
      }
    }} />
</main>

<Dialog
  bind:isOpen={showSendMessageDialog}
  title="Send message?"
  description="Are you sure you want to send this message?"
  onClose={() => (showSendMessageDialog = false)}>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showSendMessageDialog = false)}>Cancel</Button>
    <Button
      variant="primary"
      size="md"
      onclick={executeSendMessage}>Send message</Button>
  {/snippet}
</Dialog>

<ShareDialog
  bind:isOpen={showShareDialog}
  title="Share this?"
  url={shareDialogData?.url ?? ''}
  articleTitle={shareDialogData?.title ?? ''}
  showEmail
  onClose={() => (showShareDialog = false)} />
