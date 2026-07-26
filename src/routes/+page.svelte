<!-- @format -->
<script lang="ts">
  import LinkListSection from '$lib/LinkListSection.svelte'
  import ShinyText from '$lib/ShinyText.svelte'
  import {onMount} from 'svelte'
  import {isNameReserved} from '$lib/nameValidator'
  import {
    SkipLink,
    SpotlightSearch,
    FormField,
    Input,
    Textarea,
    Button,
    Dialog,
    EmptyState,
    FilterToolbar,
    FilterChipGroup,
    SortControl,
    FilterCheckboxGroup,
    SearchResultCount,
    FilterEmptyState,
    createFilterSortStore,
    FooterSection,
    ThemeSelect,
    formatBlogDate,
    formatReadTime,
    formatCommentCount,
    formatViewCount
  } from '$lib'
  import {supabase} from '$lib/supabase'
  import {SvelteSet} from 'svelte/reactivity'

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

  const name = 'Farhan Kurnia Pratama'
  const username = 'farhnkrnapratma'
  const desc =
    'Security-focused Software Engineer with expertise in Linux/Unix, AI, and Open-Source Software, dedicated to building reliable, maintainable, and privacy-centric systems.'
  const headline = 'Linux/Unix, AI, Open-Source Software, and Cybersecurity.'
  const siteUrl = 'https://fkp.my.id/'

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

  const contact: Contact[] = [
    {
      label: 'Email',
      value: 'contact@fkp.my.id',
      href: 'mailto:contact@fkp.my.id',
      icon: 'bi-envelope-at'
    },
    {
      label: 'GitHub',
      value: '@farhnkrnapratma',
      href: 'https://github.com/farhnkrnapratma',
      icon: 'bi-github'
    },
    {
      label: 'LinkedIn',
      value: '@farhnkrnapratma',
      href: 'https://linkedin.com/in/farhnkrnapratma',
      icon: 'bi-linkedin'
    },
    {
      label: 'X',
      value: '@farhnkrnapratma',
      href: 'https://x.com/farhnkrnapratma',
      icon: 'bi-twitter-x'
    },
    {
      label: 'Facebook',
      value: '@farhnkrnapratma',
      href: 'https://facebook.com/farhnkrnapratma',
      icon: 'bi-facebook'
    },
    {
      label: 'Instagram',
      value: '@farhnkrnapratma',
      href: 'https://instagram.com/farhnkrnapratma',
      icon: 'bi-instagram'
    },
    {
      label: 'Threads',
      value: '@farhnkrnapratma',
      href: 'https://threads.net/@farhnkrnapratma',
      icon: 'bi-threads'
    },
    {
      label: 'YouTube',
      value: '@farhnkrnapratma',
      href: 'https://youtube.com/@farhnkrnapratma',
      icon: 'bi-youtube'
    }
  ]

  const experiences: Experience[] = [
    {
      role: 'Software Engineer',
      company: 'PT Secure Modern Technology Indonesia',
      period: '2024 – Present',
      desc: 'Designed and developed highly secure, performant, and reliable software systems. Built secure APIs and backend services using Rust and Python. Automated system deployments and container orchestration, ensuring alignment with cybersecurity standards and robust access control guidelines.'
    }
  ]

  const education: Education[] = [
    {
      degree: "Bachelor's (S1)",
      major: 'Informatics Engineering',
      faculty: 'Faculty of Computer Science and Sciences',
      university: 'Indo Global Mandiri University, Palembang, Indonesia',
      url: 'https://www.uigm.ac.id/',
      period: '2024 – Present',
      gpa: '3.44/4.00'
    }
  ]

  interface SkillGroup {
    category: string
    items: string[]
  }

  const skills: SkillGroup[] = [
    {
      category: 'Linux',
      items: ['Debian', 'Ubuntu', 'Fedora', 'openSUSE', 'NixOS']
    },
    {category: 'Unix', items: ['FreeBSD', 'OmniOS', 'OpenBSD']},
    {category: 'Programming Languages', items: ['Rust', 'Python']},
    {
      category: 'DevOps & Tooling',
      items: ['Docker', 'Kubernetes', 'CI/CD', 'Nix']
    },
    {category: 'Shell Scripting', items: ['Bash', 'Nu']},
    {category: 'Database', items: ['PostgreSQL', 'SurrealDB']},
    {category: 'Version Control', items: ['Git', 'Jujutsu']},
    {
      category: 'Artificial Intelligence',
      items: ['Prompt Engineering', 'LLMs', 'RAG']
    },
    {category: 'Cybersecurity', items: ['GRC', 'IAM']}
  ]

  const snapshotSkillGroups = [
    'Linux',
    'Unix',
    'Programming Languages',
    'DevOps & Tooling',
    'Cybersecurity',
    'Artificial Intelligence'
  ]
  const skillsSnapshot = $derived(
    skills.filter(g => snapshotSkillGroups.includes(g.category))
  )

  interface FundingPlatform {
    label: string
    value: string
    shortValue?: string
    href: string
    icon: string
    color?: string
  }

  const fundingPlatforms: FundingPlatform[] = [
    {
      label: 'GitHub Sponsors',
      value: '@farhnkrnapratma',
      href: 'https://github.com/sponsors/farhnkrnapratma',
      icon: 'bi-heart-fill'
    },
    {
      label: 'Ko-fi',
      value: '@farhnkrnapratma',
      href: 'https://ko-fi.com/farhnkrnapratma',
      icon: 'bi-cup-hot-fill'
    },
    {
      label: 'Open Collective',
      value: '@farhnkrnapratma',
      href: 'https://opencollective.com/farhnkrnapratma',
      icon: 'bi-people-fill'
    }
  ]

  const langColors: Record<string, string> = {
    Nix: 'bg-blue-100 text-blue-700',
    Rust: 'bg-orange-100 text-orange-700',
    Svelte: 'bg-red-100 text-red-700',
    Go: 'bg-sky-100 text-sky-700',
    Python: 'bg-yellow-100 text-yellow-700',
    TypeScript: 'bg-indigo-100 text-indigo-700',
    Shell: 'bg-emerald-100 text-emerald-700',
    JavaScript: 'bg-amber-100 text-amber-700',
    CSS: 'bg-purple-100 text-purple-700',
    HTML: 'bg-pink-100 text-pink-700'
  }

  const projects = $derived(data.projects)

  type Theme = 'auto' | 'dark' | 'light'

  let activeSection = $state<Section>('home')
  let menuOpen = $state(false)
  let theme = $state<Theme>('auto')
  let themeDropdownOpen = $state(false)
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

  function applyTheme(newTheme: Theme) {
    theme = newTheme
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
      const isDark =
        newTheme === 'dark'
        || (newTheme === 'auto'
          && window.matchMedia('(prefers-color-scheme: dark)').matches)
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  function getThemeIcon(selectedTheme = theme) {
    if (selectedTheme === 'dark') return 'bi-moon-stars-fill'
    if (selectedTheme === 'light') return 'bi-sun-fill'
    return 'bi-circle-half'
  }

  function getThemeLabel(selectedTheme = theme) {
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

  onMount(() => {
    blogFilterStore.parseFromUrl(new URL(window.location.href))
    projectFilterStore.parseFromUrl(new URL(window.location.href))
    const saved = localStorage.getItem('theme') as Theme
    applyTheme(saved || 'auto')

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (theme === 'auto') {
        applyTheme('auto')
      }
    }
    media.addEventListener('change', listener)

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

    return () => {
      media.removeEventListener('change', listener)
      window.removeEventListener('hashchange', handleHashChange)
    }
  })
</script>

<svelte:head>
  <title>{name} — {headline}</title>
  <meta name="description" content={desc} />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href={siteUrl} />
  <meta property="og:title" content="{name} — {headline}" />
  <meta property="og:description" content={desc} />
  <meta property="og:type" content="profile" />
  <meta property="og:url" content={siteUrl} />
  <meta property="og:site_name" content={name} />
  <meta property="og:image" content="{siteUrl}hero.png" />
  <meta property="og:image:secure_url" content="{siteUrl}hero.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:alt" content="{name} — {desc}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="id_ID" />
  <meta property="profile:first_name" content="Farhan Kurnia" />
  <meta property="profile:last_name" content="Pratama" />
  <meta property="profile:username" content={username} />
  <meta property="profile:gender" content="male" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{name} — {headline}" />
  <meta name="twitter:description" content={desc} />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Farhan Kurnia Pratama",
      "url": "https://fkp.my.id",
      "sameAs": ["https://github.com/farhnkrnapratma"],
      "jobTitle": "Software Engineer",
      "description": "Linux/Unix, AI, Open-Source Software, and Cybersecurity."
    }
  </script>
</svelte:head>

{#if menuOpen}
  <button
    class="fixed inset-0 z-30 bg-transparent md:hidden"
    onclick={() => (menuOpen = false)}
    aria-label="Close menu"></button>
{/if}

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card px-3 font-sans shadow-xs backdrop-blur-lg transition-colors duration-300 sm:px-5 md:bg-surface-card/60"
  aria-label="Main navigation">
  <button
    onclick={() => navigate('home')}
    class="max-w-[calc(100vw-5rem)] min-w-0 cursor-pointer truncate text-left text-base font-bold tracking-tight text-text-primary transition-colors hover:text-copilot sm:max-w-none">
    {name}
  </button>

  <div class="flex items-center gap-2 sm:gap-3">
    <ul
      id="mobile-menu"
      class="fixed top-16 right-5 z-40 flex w-56 origin-top-right flex-col items-start gap-1 rounded-xl border border-border-subtle bg-surface-card p-2 shadow-lg transition-all duration-200 md:pointer-events-auto md:static md:h-auto md:w-auto md:translate-x-0 md:scale-100 md:flex-row md:items-center md:gap-0.5 md:rounded-lg md:border md:border-border-subtle md:bg-surface-switcher md:p-1 md:opacity-100 md:shadow-none"
      class:opacity-0={!menuOpen}
      class:scale-95={!menuOpen}
      class:pointer-events-none={!menuOpen}
      class:opacity-100={menuOpen}
      class:scale-100={menuOpen}>
      <li class="w-full md:hidden">
        <div class="relative w-full">
          <button
            onclick={() => (themeDropdownOpen = !themeDropdownOpen)}
            class="flex h-11 w-full cursor-pointer items-center justify-between rounded-lg px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            aria-label="Change theme"
            aria-haspopup="true"
            aria-expanded={themeDropdownOpen}>
            <span class="inline-flex items-center gap-3">
              <i class="bi {getThemeIcon()} text-sm" aria-hidden="true"></i>
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
              class="absolute top-12 right-0 left-0 z-50 flex w-full flex-col rounded-lg border border-border-subtle bg-surface-card p-1 shadow-lg">
              {#each ['auto', 'light', 'dark'] as themeOption (themeOption)}
                <button
                  onclick={() => {
                    applyTheme(themeOption as Theme)
                    themeDropdownOpen = false
                  }}
                  class="flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-xs font-bold transition-colors hover:bg-surface-hover {(
                    theme === themeOption
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
      </li>

      {#each navItems as item (item.id)}
        <li class="w-full md:w-auto">
          <button
            onclick={() => {
              navigate(item.id)
              menuOpen = false
            }}
            class="flex h-11 w-full cursor-pointer items-center justify-start rounded-lg border-0 px-4 text-sm leading-none font-medium whitespace-nowrap transition-all md:h-7.5 md:justify-center md:rounded-md md:px-3.5 {(
              activeSection === item.id
            ) ?
              'bg-copilot font-semibold text-white hover:bg-copilot/90 md:bg-surface-switcher-active md:text-copilot md:shadow-xs md:hover:bg-surface-switcher-active'
            : 'text-text-primary hover:bg-surface-hover md:text-text-muted md:hover:bg-surface-hover md:hover:text-text-primary'}">
            {item.label}
          </button>
        </li>
      {/each}
    </ul>

    <ThemeSelect
      {theme}
      onThemeChange={applyTheme}
      class="hidden md:inline-flex" />

    <SpotlightSearch projects={data.projects} />

    <button
      class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-xl transition-colors hover:bg-surface-hover md:hidden"
      onclick={() => (menuOpen = !menuOpen)}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
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
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  {#if activeSection === 'home'}
    <section
      class="relative z-10 mx-auto flex w-full flex-col gap-8 px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[50%]">
      <div
        class="pointer-events-none absolute top-12.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-copilot/10 blur-[80px]">
      </div>

      <div
        class="relative z-10 flex flex-col items-center justify-center text-center">
        <img
          src="/android-chrome-512x512.png"
          alt="Farhan Kurnia Pratama"
          loading="lazy"
          class="relative z-10 mb-6 h-28 w-28 rounded-full border-2 border-copilot object-cover object-top shadow-[0_0_20px_rgba(120,101,217,0.25)] transition-all duration-300 dark:shadow-[0_0_25px_rgba(120,101,217,0.35)]" />
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
          <a
            href="/cv.pdf"
            download="Farhan_Kurnia_Pratama_CV.pdf"
            class="hover:bg-copilot-hover inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-copilot py-2 text-xs font-semibold whitespace-nowrap text-white transition-colors sm:w-48 sm:text-sm">
            Download CV
          </a>
          <button
            onclick={() => navigate('projects')}
            class="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card py-2 text-xs font-semibold whitespace-nowrap text-text-primary transition-colors hover:bg-surface-hover sm:w-48 sm:text-sm">
            Browse projects
          </button>
          <button
            onclick={() => navigate('contact')}
            class="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card py-2 text-xs font-semibold whitespace-nowrap text-text-primary transition-colors hover:bg-surface-hover sm:mt-0 sm:w-48 sm:text-sm">
            Get in touch
          </button>
        </div>
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Top projects
        </h3>
        <div class="boxed-list text-left">
          <ul class="divide-y divide-border-subtle">
            {#each projects.slice(0, 3) as project (project.name)}
              <li
                class="group relative flex flex-col gap-3 p-5 text-left transition-all duration-200 hover:bg-surface-hover/40 active:scale-[0.995]">
                <article class="contents">
                  <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex flex-wrap items-center gap-0.5">
                      <h4
                        class="text-base leading-snug font-bold text-text-primary transition-colors group-hover:text-copilot">
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                          {project.name}
                        </a>
                      </h4>
                      {#if project.lang}
                        <span
                          class="inline-flex items-center gap-1 select-none">
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            style="background-color: {langColors[project.lang]
                              || 'var(--color-accent)'}"></span>
                          <span
                            class="rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-text-muted">
                            {project.lang}
                          </span>
                        </span>
                      {/if}
                    </div>

                    <div
                      class="no-scrollbar relative z-20 flex items-center gap-x-2 overflow-x-auto font-sans text-xs font-semibold whitespace-nowrap text-text-muted select-none sm:justify-end">
                      {#if project.licenseName}
                        <span class="inline-flex items-center gap-1">
                          <span
                            class="material-symbols-rounded text-xs leading-none"
                            style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                            aria-hidden="true">gavel</span>
                          {project.licenseName} License
                        </span>
                        <span aria-hidden="true">&middot;</span>
                      {/if}
                      <span class="inline-flex items-center gap-1">
                        <span
                          class="material-symbols-rounded text-xs leading-none"
                          style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                          aria-hidden="true">star_rate</span>
                        {project.stars} stars
                      </span>
                    </div>
                  </div>

                  <p
                    class="line-clamp-2 text-xs leading-normal text-text-muted dark:text-zinc-300">
                    {project.desc}
                  </p>

                  <div
                    class="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div
                      class="relative z-20 flex flex-wrap items-center gap-1.5">
                      {#each project.tags as tag (tag)}
                        <span
                          class="rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium text-text-muted transition-colors">
                          {tag}
                        </span>
                      {/each}
                    </div>

                    <div
                      class="flex items-center gap-1.5 text-xs font-bold text-copilot transition-colors">
                      <span>View repository</span>
                      <span
                        class="material-symbols-rounded text-xs leading-none transition-transform group-hover:translate-x-0.5"
                        style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                        aria-hidden="true">open_in_new</span>
                    </div>
                  </div>
                </article>
              </li>
            {/each}
          </ul>
        </div>
        {#if projects.length > 0}
          <div class="mt-4 flex justify-end">
            <button
              onclick={() => navigate('projects')}
              class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline">
              <span class="leading-none">View all projects</span>
              <span
                class="material-symbols-rounded leading-none transition-transform select-none group-hover:translate-x-0.5"
                style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        {/if}
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Recent posts
        </h3>
        <div class="boxed-list text-left">
          {#if posts.length === 0}
            <EmptyState
              icon="bi-journal-text"
              title="No posts yet"
              description="Check back soon for new articles." />
          {:else}
            <ul class="divide-y divide-border-subtle">
              {#each posts.slice(0, 2) as post (post.title)}
                <li
                  class="group relative flex w-full flex-col gap-5 p-5 text-left transition-all duration-200 hover:bg-surface-hover/40 active:scale-[0.995] sm:flex-row sm:items-start">
                  <div
                    class="relative aspect-video w-full shrink-0 animate-pulse overflow-hidden rounded-lg border border-border-subtle bg-surface-card/60 select-none sm:w-40 md:w-48">
                    {#if post.banner_path}
                      <img
                        src={getBannerUrl(post.banner_path)}
                        alt=""
                        loading="lazy"
                        onload={e =>
                          (
                            e.currentTarget.closest(
                              '.animate-pulse'
                            ) as HTMLElement | null
                          )?.classList.remove('animate-pulse')}
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103" />
                    {:else}
                      <div
                        class="to-palette-purple/15 flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 select-none">
                        <i class="bi bi-journal-text text-xl text-copilot/50"
                        ></i>
                      </div>
                    {/if}
                  </div>

                  <div class="flex flex-1 flex-col gap-2 font-sans">
                    <div
                      class="no-scrollbar flex w-full flex-wrap items-center gap-x-1.5 overflow-x-auto font-sans text-[11px] font-semibold whitespace-nowrap text-text-muted select-none">
                      <span>{formatBlogDate(post.created_at)}</span>
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
                      <h4
                        class="text-base leading-snug font-bold text-text-primary transition-colors group-hover:text-copilot">
                        <a
                          href="/blog/{post.slug}"
                          class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                          {post.title}
                        </a>
                      </h4>
                    </div>
                    {#if post.excerpt}
                      <p
                        class="line-clamp-2 text-xs leading-normal text-text-muted dark:text-zinc-300">
                        {post.excerpt}
                      </p>
                    {/if}
                    <div
                      class="mt-1 flex items-center gap-1.5 text-xs font-bold text-copilot">
                      <span class="leading-none">Read article</span>
                      <span
                        class="material-symbols-rounded leading-none transition-transform select-none group-hover:translate-x-0.5"
                        style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                        aria-hidden="true">arrow_forward</span>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        {#if posts.length > 0}
          <div class="mt-4 flex justify-end">
            <button
              onclick={() => navigate('blog')}
              class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline">
              <span class="leading-none">View all posts</span>
              <span
                class="material-symbols-rounded leading-none transition-transform select-none group-hover:translate-x-0.5"
                style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        {/if}
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Skills
        </h3>
        <div class="flex flex-wrap gap-2">
          {#each skillsSnapshot as group (group.category)}
            <span
              class="cursor-default rounded-full border border-border-subtle bg-surface-card/60 px-3.5 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover">
              {group.category}
              <span class="font-normal text-text-secondary opacity-80"
                >({group.items.join(', ')})</span>
            </span>
          {/each}
        </div>
      </div>

      <div>
        <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
          Experience
        </h3>
        <div class="boxed-list text-left">
          {#each experiences.slice(0, 1) as exp (exp.role)}
            <div
              class="flex flex-col gap-2 px-6 py-5 transition-all hover:bg-surface-hover/40">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h4 class="text-base font-bold text-text-primary">
                    {exp.role}
                  </h4>
                  <p class="text-sm font-medium text-text-secondary">
                    {exp.company}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full border border-border-subtle bg-border-subtle/30 px-2.5 py-0.5 text-xs font-semibold text-text-muted select-none">
                  {exp.period}
                </span>
              </div>
              <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {exp.desc}
              </p>
            </div>
          {/each}
        </div>
        <div class="mt-4 flex justify-end">
          <button
            onclick={() => navigate('cv')}
            class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copilot"
            aria-label="View full CV including education and experience">
            <span class="leading-none">View full CV</span>
            <span
              class="material-symbols-rounded leading-none transition-transform select-none group-hover:translate-x-0.5"
              style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
              aria-hidden="true">arrow_forward</span>
          </button>
        </div>
      </div>

      <div class="boxed-list border-copilot/30 bg-copilot/5 text-left">
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
            class="hover:bg-copilot-hover inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-copilot px-4 py-2 text-xs font-semibold text-white transition-colors">
            Become a sponsor
          </button>
        </div>
      </div>

      <form
        bind:this={contactFormElement}
        novalidate
        action="https://formsubmit.co/contact@fkp.my.id"
        method="POST"
        onsubmit={validateForm}
        class="flex w-full flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-card/60 p-6 text-left shadow-xs backdrop-blur-lg transition-colors duration-300"
        autocomplete="off">
        <input
          type="hidden"
          name="_subject"
          value="New message from portfolio website!" />
        <input type="hidden" name="_template" value="table" />
        <input type="hidden" name="_captcha" value="true" />
        <input type="hidden" name="_url" value="https://fkp.my.id/" />

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
            type="email"
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
          <Button type="submit" variant="primary" size="md">
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
      items={contact} />
  {/if}

  {#if activeSection === 'cv'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[50%]">
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
        <a
          href="/cv.pdf"
          download="Farhan_Kurnia_Pratama_CV.pdf"
          class="hover:bg-copilot-hover inline-flex items-center justify-center rounded-lg bg-copilot px-4 py-2.5 text-sm font-semibold text-white transition-colors">
          Download PDF
        </a>
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Experience
        </h2>
        <div class="boxed-list mt-4">
          {#each experiences as exp (exp.role)}
            <div
              class="flex flex-col gap-2 px-6 py-5 transition-all hover:bg-surface-hover/40">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-base font-bold text-text-primary">
                    {exp.role}
                  </h3>
                  <p class="text-sm font-medium text-text-secondary">
                    {exp.company}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full border border-border-subtle bg-border-subtle/30 px-2.5 py-0.5 text-xs font-semibold text-text-muted select-none">
                  {exp.period}
                </span>
              </div>
              <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {exp.desc}
              </p>
            </div>
          {/each}
        </div>
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Education
        </h2>
        <div class="boxed-list mt-4">
          {#each education as edu (`${edu.degree}-${edu.university}`)}
            <div
              class="flex flex-col gap-1.5 px-6 py-5 transition-all hover:bg-surface-hover/40">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-base font-bold text-text-primary">
                    {edu.degree} in {edu.major}
                  </h3>
                  <p class="text-sm text-text-secondary">{edu.faculty}</p>
                  <p class="mt-1 text-sm font-semibold text-text-primary">
                    {#if edu.url}
                      <a
                        href={edu.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="transition-colors hover:text-copilot hover:underline">
                        {edu.university}
                      </a>
                    {:else}
                      {edu.university}
                    {/if}
                  </p>
                  {#if edu.gpa}
                    <p class="mt-1.5 text-xs font-semibold text-text-secondary">
                      Current GPA: <span class="text-text-primary"
                        >{edu.gpa}</span>
                    </p>
                  {/if}
                </div>
                <span
                  class="shrink-0 rounded-full border border-border-subtle bg-border-subtle/30 px-2.5 py-0.5 text-xs font-semibold text-text-muted select-none">
                  {edu.period}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="mt-10">
        <h2
          class="text-sm font-bold tracking-wider text-text-secondary uppercase">
          Skills
        </h2>
        <div class="mt-4 flex flex-wrap gap-2">
          {#each skills as group (group.category)}
            <span
              class="cursor-default rounded-full bg-border-subtle/40 px-4 py-2 text-sm font-bold text-text-primary transition-colors hover:bg-border-subtle/60">
              {group.category}
              <span class="font-normal opacity-85"
                >({group.items.join(', ')})</span>
            </span>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#if activeSection === 'blog'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[50%]">
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
          class="mb-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-muted transition-colors select-none hover:bg-surface-hover hover:text-[#f26522]">
          <span
            class="material-symbols-rounded text-[11px] select-none"
            style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
            aria-hidden="true">rss_feed</span>
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
        <div class="boxed-list relative z-0 mt-2">
          <ul class="divide-y divide-border-subtle">
            {#each filteredBlogPosts as post (post.id)}
              <li
                class="group relative flex w-full flex-col gap-5 p-5 text-left transition-all duration-200 hover:bg-surface-hover/40 active:scale-[0.995] sm:flex-row sm:items-start">
                <div
                  class="relative aspect-video w-full shrink-0 animate-pulse overflow-hidden rounded-lg border border-border-subtle bg-surface-card/60 select-none sm:w-40 md:w-48">
                  {#if post.banner_path}
                    <img
                      src={getBannerUrl(post.banner_path)}
                      alt=""
                      loading="lazy"
                      onload={e =>
                        (
                          e.currentTarget.closest(
                            '.animate-pulse'
                          ) as HTMLElement | null
                        )?.classList.remove('animate-pulse')}
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103" />
                  {:else}
                    <div
                      class="to-palette-purple/15 flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 select-none">
                      <i
                        class="bi bi-journal-text text-xl text-copilot/50"
                        aria-hidden="true"></i>
                    </div>
                  {/if}
                </div>

                <div class="flex flex-1 flex-col gap-1 font-sans">
                  <div
                    class="no-scrollbar flex w-full flex-wrap items-center gap-x-1.5 overflow-x-auto font-sans text-[11px] font-semibold whitespace-nowrap text-text-muted select-none">
                    <span>{formatBlogDate(post.created_at)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatReadTime(post.read_time)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatCommentCount(post.comment_count)}</span>
                    {#if post.views_count !== undefined}
                      <span aria-hidden="true">&middot;</span>
                      <span>{formatViewCount(post.views_count)}</span>
                    {/if}
                  </div>
                  <div>
                    <h2
                      class="text-xl leading-snug font-bold text-text-primary transition-colors group-hover:text-text-primary hover:text-text-primary">
                      <a
                        href="/blog/{post.slug}"
                        class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                        {post.title}
                      </a>
                    </h2>
                  </div>
                  {#if post.excerpt}
                    <p
                      class="line-clamp-2 text-xs leading-normal text-text-muted dark:text-zinc-300">
                      {post.excerpt}
                    </p>
                  {/if}
                  <div
                    class="mt-1 flex items-center gap-1.5 text-xs font-bold text-copilot">
                    <span class="leading-none">Read article</span>
                    <span
                      class="material-symbols-rounded leading-none transition-transform select-none group-hover:translate-x-0.5"
                      style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                      aria-hidden="true">arrow_forward</span>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>
  {/if}

  {#if activeSection === 'projects'}
    <section
      class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[50%]">
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
        <div class="boxed-list relative z-0 mt-2">
          <ul class="divide-y divide-border-subtle">
            {#each filteredProjectList as project (project.name)}
              <li
                class="group relative flex flex-col gap-3 p-5 text-left transition-all duration-200 hover:bg-surface-hover/40 active:scale-[0.995]">
                <article class="contents">
                  <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex flex-wrap items-center gap-0.5">
                      <h3
                        class="text-base leading-snug font-bold text-text-primary transition-colors group-hover:text-copilot">
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                          {project.name}
                        </a>
                      </h3>
                      {#if project.lang}
                        <span
                          class="inline-flex items-center gap-1 select-none">
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            style="background-color: {langColors[project.lang]
                              || 'var(--color-accent)'}"></span>
                          <span
                            class="rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-text-muted">
                            {project.lang}
                          </span>
                        </span>
                      {/if}
                    </div>

                    <div
                      class="no-scrollbar relative z-20 flex items-center gap-x-2 overflow-x-auto font-sans text-xs font-semibold whitespace-nowrap text-text-muted select-none sm:justify-end">
                      {#if project.licenseName}
                        <span class="inline-flex items-center gap-1">
                          <span
                            class="material-symbols-rounded text-xs leading-none"
                            style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                            aria-hidden="true">gavel</span>
                          {project.licenseName} License
                        </span>
                        <span aria-hidden="true">&middot;</span>
                      {/if}
                      <span class="inline-flex items-center gap-1">
                        <span
                          class="material-symbols-rounded text-xs leading-none"
                          style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                          aria-hidden="true">star_rate</span>
                        {project.stars} stars
                      </span>
                    </div>
                  </div>

                  <p
                    class="dark:text-primary line-clamp-2 text-xs leading-normal text-text-secondary">
                    {project.desc}
                  </p>

                  <div
                    class="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div
                      class="relative z-20 flex flex-wrap items-center gap-1.5">
                      {#each project.tags as tag (tag)}
                        <button
                          type="button"
                          onclick={() =>
                            projectFilterStore.toggleMultiFilter('tag', tag)}
                          class="cursor-pointer rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium transition-colors hover:bg-surface-hover hover:text-copilot {(
                            projectFilterStore.filters['tag']?.includes(tag)
                          ) ?
                            'font-semibold text-copilot'
                          : 'text-text-muted'}">
                          {tag}
                        </button>
                      {/each}
                    </div>

                    <div
                      class="flex items-center gap-1.5 text-xs font-bold text-copilot transition-colors">
                      <span>View repository</span>
                      <span
                        class="material-symbols-rounded text-xs leading-none transition-transform group-hover:translate-x-0.5"
                        style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                        aria-hidden="true">open_in_new</span>
                    </div>
                  </div>
                </article>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>
  {/if}

  {#if activeSection === 'funding'}
    <LinkListSection
      title="Supporting & Funding"
      subtitle="Support open-source development and maintenance through these platforms."
      items={fundingPlatforms} />
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
    <Button variant="primary" size="md" onclick={executeSendMessage}
      >Send message</Button>
  {/snippet}
</Dialog>
