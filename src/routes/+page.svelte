<script lang="ts">
  import {env as publicEnv} from '$env/dynamic/public';
  import {onMount, tick, untrack} from 'svelte';
  import type {Snippet} from 'svelte';
  import {
    Award,
    GitFork,
    Astroid,
    Clock,
    GitBranch,
    Activity,
    Code,
    Terminal,
    Copy,
    FolderArchive,
    Share2,
    Link2 as LinkIcon,
    Hash,
    Image as ImageIcon,
    ArrowRight,
    Heart,
    Rss,
    Menu,
    X,
    Download
  } from '@lucide/svelte';
  import {
    isNameReserved,
    extractAuthorNameTokens
  } from '$lib/utils/nameValidator';
  import {
    LinkListSection,
    ShinyText,
    SkipLink,
    ImageWithSkeleton,
    SpotlightSearch,
    FormField,
    Input,
    Textarea,
    Button,
    Badge,
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
    formatViewCount,
    formatAbsoluteDate,
    decodeHtmlEntities,
    Section,
    PageContainer,
    LogoLoop,
    ConsentNotice
  } from '$lib';
  import {supabase} from '$lib/supabase';
  import {SvelteSet} from 'svelte/reactivity';
  import {formatMonthAbbrev} from '$lib/author';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import AccessibilitySelect from '$lib/components/filter/AccessibilitySelect.svelte';
  import GradientWaves from '$lib/components/GradientWaves.svelte';
  import type {Theme, Project} from '$lib/types';
  import type {BlogPost} from './+page.server';

  let {data} = $props();

  type Section = 'home' | 'blog' | 'contact' | 'cv' | 'projects' | 'funding';

  interface NavItem {
    id: Section;
    label: string;
  }

  interface Contact {
    label: string;
    value: string;
    shortValue?: string;
    href: string;
    icon: string;
  }

  interface Experience {
    role: string;
    company: string;
    period: string;
    desc: string;
  }

  interface Education {
    degree: string;
    major: string;
    faculty: string;
    university: string;
    url?: string;
    period: string;
    gpa?: string;
  }

  let author = $derived(data.author);
  let authorTokens = $derived(extractAuthorNameTokens(author));
  let cvData = $derived(data.cv || {experience: [], education: []});
  let fundingData = $derived(data.funding || []);
  let contactData = $derived(data.contact || []);

  let name = $derived(author?.name || '');
  let username = $derived(author?.username || '');
  let desc = $derived(author?.bio || '');
  let headline = $derived(author?.headline || '');
  let jobTitle = $derived(author?.jobTitle || '');
  let siteUrl = $derived(author?.siteUrl || '');
  let avatar = $derived(author?.avatar || '');
  let skillBadges = $derived(
    (headline || '')
      .split(/[|,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
  );

  let isDarkTheme = $derived.by(() => {
    if (themeStore.current === 'dark') return true;
    if (themeStore.current === 'light') return false;
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const logoBaseUrl = (() => {
    const base = (publicEnv.PUBLIC_CDN_BASE_URL ?? '')
      .trim()
      .replace(/\/+$/, '');
    return base ? `${base}/logo/` : '/logo/';
  })();

  let logoCatalog = $derived(
    Array.isArray(data.logoCatalog) ? data.logoCatalog : []
  );

  let techLogos = $derived(
    logoCatalog.map(({name, extension, isThemeAware}) => {
      const filename =
        isThemeAware ?
          `${name}-${isDarkTheme ? 'dark' : 'light'}.${extension}`
        : `${name}.${extension}`;

      return {
        src: `${logoBaseUrl}${filename}`,
        alt: `${name} [icon] icon`,
        title: name
      };
    })
  );

  const navItems: NavItem[] = [
    {id: 'home', label: 'Home'},
    {id: 'projects', label: 'Projects'},
    {id: 'blog', label: 'Blog'},
    {id: 'cv', label: 'CV'},
    {id: 'funding', label: 'Funding'},
    {id: 'contact', label: 'Contact'}
  ];

  const posts = $derived(data.posts || []);

  function handleCvDownload(e: MouseEvent) {
    e.preventDefault();

    const pdfAnchor = document.createElement('a');
    pdfAnchor.href = '/api/v1/cv?download=1';
    pdfAnchor.download = '';
    document.body.appendChild(pdfAnchor);
    pdfAnchor.click();
    document.body.removeChild(pdfAnchor);

    setTimeout(() => {
      const checksumAnchor = document.createElement('a');
      checksumAnchor.href = '/api/v1/cv?checksum=1';
      checksumAnchor.download = '';
      document.body.appendChild(checksumAnchor);
      checksumAnchor.click();
      document.body.removeChild(checksumAnchor);
    }, 250);
  }

  function getBannerUrl(bannerPath: string | null | undefined): string | null {
    if (!bannerPath) return null;
    const {data: res} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(bannerPath);
    return res.publicUrl;
  }

  const failedBanners = new SvelteSet<string>();

  function markBannerFailed(postId: string) {
    failedBanners.add(postId);
  }

  let openCopyMenuId = $state<string | null>(null);
  function toggleCopyMenu(postId: string) {
    openCopyMenuId = openCopyMenuId === postId ? null : postId;
  }

  function isOutsideDropdown(
    target: EventTarget | null,
    attr: string,
    id: string
  ): boolean {
    const el = (target as HTMLElement | null)?.closest?.(`[${attr}]`);
    return el?.getAttribute(attr) !== id;
  }

  function handleDropdownOutsideClick(event: MouseEvent) {
    if (
      openCopyMenuId
      && isOutsideDropdown(event.target, 'data-copy-dropdown', openCopyMenuId)
    ) {
      openCopyMenuId = null;
    }
    if (
      openCodeMenuId
      && isOutsideDropdown(event.target, 'data-code-dropdown', openCodeMenuId)
    ) {
      openCodeMenuId = null;
    }
  }

  let shareDialogData = $state<{title: string; url: string} | null>(null);
  let showShareDialog = $state(false);

  function openShareDialog(data: {title: string; url: string}) {
    shareDialogData = data;
    showShareDialog = true;
  }

  function shareBlogPostDialog(post: {title: string; slug: string}) {
    if (typeof window === 'undefined') return;
    openShareDialog({
      title: post.title,
      url: `${window.location.origin}/blog/${post.slug}`
    });
  }

  function shareProjectDialog(project: {name: string; url: string}) {
    openShareDialog({title: project.name, url: project.url});
  }

  async function copyBlogId(post: {id: string}) {
    openCopyMenuId = null;
    try {
      await navigator.clipboard.writeText(post.id);
      toastStore.success('Copied!');
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  async function copyBlogMarkdown(post: {id: string; slug: string}) {
    openCopyMenuId = null;
    try {
      const res = await fetch(`/api/v1/blog/${post.slug}?format=md`);
      if (res.ok) {
        const mdText = await res.text();
        await navigator.clipboard.writeText(mdText);
        toastStore.success('Copied!');
      } else {
        toastStore.error('Failed to fetch Markdown');
      }
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  async function copyBlogUrl(post: {id: string; slug: string}) {
    openCopyMenuId = null;
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/blog/${post.slug}`
      );
      toastStore.success('Copied!');
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  type CodeTab = 'https' | 'ssh' | 'cli';

  let openCodeMenuId = $state<string | null>(null);
  let codeTabByProject = $state<Record<string, CodeTab>>({});

  function toggleCodeMenu(name: string) {
    openCodeMenuId = openCodeMenuId === name ? null : name;
  }

  function getCodeTab(name: string): CodeTab {
    return codeTabByProject[name] ?? 'https';
  }

  function setCodeTab(name: string, tab: CodeTab) {
    codeTabByProject = {...codeTabByProject, [name]: tab};
  }

  function codeCommand(
    project: {fullName: string; cloneUrl: string; sshUrl: string},
    tab: CodeTab
  ): string {
    if (tab === 'ssh') return `git clone ${project.sshUrl}`;
    if (tab === 'cli') return `gh repo clone ${project.fullName}`;
    return `git clone ${project.cloneUrl}`;
  }

  async function copyCodeCommand(
    project: {fullName: string; cloneUrl: string; sshUrl: string},
    tab: CodeTab
  ) {
    try {
      await navigator.clipboard.writeText(codeCommand(project, tab));
      toastStore.success('Copied!');
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  let experiences = $derived(cvData.experience || []);
  let education = $derived(cvData.education || []);
  let contact = $derived(contactData || []);

  interface SkillGroup {
    category: string;
    items: string[];
  }

  let rawSkills = $derived(data.skills || author?.skills || []);
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
  );

  const snapshotSkillGroups = [
    'Software Engineering',
    'Linux/Unix',
    'Linux',
    'Unix',
    'Programming Languages',
    'DevOps & Tooling',
    'Cybersecurity',
    'Artificial Intelligence'
  ];
  const skillsSnapshot = $derived(
    skills.filter(g => snapshotSkillGroups.includes(g.category)).length > 0 ?
      skills.filter(g => snapshotSkillGroups.includes(g.category))
    : skills.slice(0, 6)
  );

  function skillGroupBasis(skillCount: number): number {
    return 160 + skillCount * 24;
  }

  function pluralize(count: number, singular: string, plural: string): string {
    return count > 1 ? plural : singular;
  }

  function formatPeriod(
    startMonth?: string,
    startYear?: number | null,
    endMonth?: string | null,
    endYear?: number | null,
    currentlyIn?: boolean
  ): string {
    const sMonth = formatMonthAbbrev(startMonth);
    const eMonth = formatMonthAbbrev(endMonth);
    const start = [sMonth, startYear].filter(Boolean).join(' ');
    if (currentlyIn) return `${start} - Present`;
    const end = [eMonth, endYear].filter(Boolean).join(' ');
    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (end) return end;
    return '';
  }

  let contactItems = $derived(
    contactData.map(c => ({
      label: c.platform || c.displayValue,
      value: c.displayValue,
      href: c.href,
      icon: c.icon || ''
    }))
  );

  interface FundingPlatform {
    label: string;
    value: string;
    shortValue?: string;
    href: string;
    icon: string;
    color?: string;
  }

  let fundingPlatforms = $derived<FundingPlatform[]>(
    fundingData.map(f => ({
      label: f.platform,
      value: f.displayValue || f.platform,
      href: f.url,
      icon: f.icon || ''
    }))
  );

  const projects = $derived(data.projects || []);

  const recentProjects = $derived(
    [...projects]
      .sort(
        (a, b) =>
          new Date(b.pushedAt || 0).getTime()
          - new Date(a.pushedAt || 0).getTime()
      )
      .slice(0, 2)
  );

  const recentPosts = $derived(posts.slice(0, 2));

  let activeSection = $state<Section>('home');
  let menuOpen = $state(false);
  let mobileMenuRef = $state<HTMLElement | null>(null);
  let menuTriggerRef = $state<HTMLButtonElement | null>(null);
  let isDesktopViewport = $state(false);
  let menuHasBeenOpened = false;
  let formName = $state('');
  let formEmail = $state('');
  let formMessage = $state('');
  let formErrors = $state({name: '', email: '', message: ''});
  let formValid = $state({name: false, email: false, message: false});
  let showSendMessageDialog = $state(false);
  let contactFormElement = $state<HTMLFormElement | null>(null);

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateName = debounce(() => {
    if (formName.trim() === '') {
      formErrors.name = '';
      formValid.name = false;
    } else if (isNameReserved(formName, authorTokens)) {
      formErrors.name = 'This name cannot be used. Please use another name.';
      formValid.name = false;
    } else {
      formErrors.name = '';
      formValid.name = true;
    }
  }, 500);

  const validateEmail = debounce(() => {
    if (formEmail.trim() === '') {
      formErrors.email = '';
      formValid.email = false;
    } else if (!emailRegex.test(formEmail.trim())) {
      formErrors.email = 'Please enter a valid email address.';
      formValid.email = false;
    } else {
      formErrors.email = '';
      formValid.email = true;
    }
  }, 500);

  const validateMessage = debounce(() => {
    if (formMessage.trim() === '') {
      formErrors.message = '';
      formValid.message = false;
    } else {
      formErrors.message = '';
      formValid.message = true;
    }
  }, 500);

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function validateForm(e: Event) {
    const nameErr = formName.trim() === '' ? 'Name is required.' : '';
    const emailErr = formEmail.trim() === '' ? 'Email is required.' : '';
    const msgErr = formMessage.trim() === '' ? 'Message is required.' : '';
    const emailFormatErr =
      !emailErr && !emailRegex.test(formEmail.trim()) ?
        'Please enter a valid email address.'
      : '';
    const nameReservedErr =
      !nameErr && isNameReserved(formName, authorTokens) ?
        'This name cannot be used. Please use another name.'
      : '';

    formErrors = {
      name: nameErr || nameReservedErr,
      email: emailErr || emailFormatErr,
      message: msgErr
    };
    if (formErrors.name) formValid.name = false;
    if (formErrors.email) formValid.email = false;
    if (formErrors.message) formValid.message = false;

    e.preventDefault();

    if (!formErrors.name && !formErrors.email && !formErrors.message) {
      formName = sanitizeInput(formName.trim());
      formEmail = sanitizeInput(formEmail.trim());
      formMessage = sanitizeInput(formMessage.trim());
      showSendMessageDialog = true;
    }
  }

  function executeSendMessage() {
    if (contactFormElement) {
      contactFormElement.submit();
    }
  }

  function navigate(section: Section) {
    activeSection = section;
    menuOpen = false;
    if (typeof window !== 'undefined') {
      window.location.hash = section === 'home' ? '' : section;
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      menuOpen = false;
    }
  }

  $effect(() => {
    if (typeof document === 'undefined') return;

    if (menuOpen) {
      menuHasBeenOpened = true;
      tick().then(() => {
        const firstFocusable = mobileMenuRef?.querySelector<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
    } else if (menuHasBeenOpened) {
      menuTriggerRef?.focus();
    }
  });

  const blogFilterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  });

  const projectFilterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  });

  const allBlogTags = $derived.by(() => {
    const set = new SvelteSet<string>();
    for (const post of posts) {
      if (post.tags) {
        post.tags.forEach((t: string) => set.add(decodeHtmlEntities(t)));
      }
    }
    return Array.from(set);
  });

  const filteredBlogPosts = $derived.by(() => {
    let list = posts;

    const q = blogFilterStore.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(q)
          || (p.excerpt && p.excerpt.toLowerCase().includes(q))
      );
    }

    const selectedTags = blogFilterStore.filters['tag'] || [];
    if (selectedTags.length > 0) {
      list = list.filter(
        p => p.tags && p.tags.some((t: string) => selectedTags.includes(t))
      );
    }

    const sortField = blogFilterStore.sort.field;
    const sortDir = blogFilterStore.sort.direction === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title) * sortDir;
      } else if (sortField === 'readingTime') {
        const readingA = parseInt(a.read_time || '0', 10);
        const readingB = parseInt(b.read_time || '0', 10);
        return (readingA - readingB) * sortDir;
      } else if (sortField === 'views') {
        const viewsA = a.views_count ?? 0;
        const viewsB = b.views_count ?? 0;
        return (viewsA - viewsB) * sortDir;
      } else if (sortField === 'comments') {
        const commentsA = a.comment_count ?? 0;
        const commentsB = b.comment_count ?? 0;
        return (commentsA - commentsB) * sortDir;
      } else {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return (dateA - dateB) * sortDir;
      }
    });
  });

  const allProjectTags = $derived.by(() => {
    const set = new SvelteSet<string>();
    for (const p of projects) {
      if (p.tags) {
        p.tags.forEach(t => set.add(t));
      }
    }
    return Array.from(set);
  });

  const filteredProjectList = $derived.by(() => {
    let list = projects;

    const q = projectFilterStore.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q)
          || p.desc.toLowerCase().includes(q)
          || (p.lang && p.lang.toLowerCase().includes(q))
      );
    }

    const selectedTags = projectFilterStore.filters['tag'] || [];
    if (selectedTags.length > 0) {
      list = list.filter(
        p => p.tags && p.tags.some(t => selectedTags.includes(t))
      );
    }

    const sortField = projectFilterStore.sort.field;
    const sortDir = projectFilterStore.sort.direction === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name) * sortDir;
      } else if (sortField === 'stars') {
        return ((a.stars || 0) - (b.stars || 0)) * sortDir;
      } else if (sortField === 'license') {
        const lA = a.licenseName || '';
        const lB = b.licenseName || '';
        return lA.localeCompare(lB) * sortDir;
      } else {
        return a.name.localeCompare(b.name) * sortDir;
      }
    });
  });

  const PAGE_SIZE = 6;

  let blogPage = $state(1);
  let projectPage = $state(1);

  const blogTotalPages = $derived(
    Math.max(1, Math.ceil(filteredBlogPosts.length / PAGE_SIZE))
  );
  const blogPageClamped = $derived(Math.min(blogPage, blogTotalPages));
  const paginatedBlogPosts = $derived(
    filteredBlogPosts.slice(
      (blogPageClamped - 1) * PAGE_SIZE,
      blogPageClamped * PAGE_SIZE
    )
  );

  const projectTotalPages = $derived(
    Math.max(1, Math.ceil(filteredProjectList.length / PAGE_SIZE))
  );
  const projectPageClamped = $derived(Math.min(projectPage, projectTotalPages));
  const paginatedProjectList = $derived(
    filteredProjectList.slice(
      (projectPageClamped - 1) * PAGE_SIZE,
      projectPageClamped * PAGE_SIZE
    )
  );

  $effect(() => {
    void blogFilterStore.search;
    void blogFilterStore.filters;
    void blogFilterStore.sort;
    untrack(() => {
      blogPage = 1;
    });
  });

  $effect(() => {
    void projectFilterStore.search;
    void projectFilterStore.filters;
    void projectFilterStore.sort;
    untrack(() => {
      projectPage = 1;
    });
  });

  onMount(() => {
    blogFilterStore.parseFromUrl(new URL(window.location.href));
    projectFilterStore.parseFromUrl(new URL(window.location.href));

    const handleHashChange = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1) as Section;
        if (
          ['home', 'blog', 'contact', 'cv', 'projects', 'funding'].includes(
            hash
          )
        ) {
          activeSection = hash;
        }
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    const desktopQuery = window.matchMedia('(min-width: 768px)');
    isDesktopViewport = desktopQuery.matches;
    const handleViewportChange = (e: MediaQueryListEvent) => {
      isDesktopViewport = e.matches;
      if (e.matches) menuOpen = false;
    };
    desktopQuery.addEventListener('change', handleViewportChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      desktopQuery.removeEventListener('change', handleViewportChange);
    };
  });

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
  );
</script>

<svelte:head>
  <title>{name}{headline ? ` — ${headline}` : ''}</title>
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
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between glass-card border-b border-border-subtle/60 px-3 font-sans shadow-xs sm:px-5"
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
      class={[
        'fixed top-16 right-5 z-40 flex w-56 origin-top-right flex-col items-start gap-1 rounded-sm border border-border-subtle bg-surface-card p-2 shadow-lg transition-all duration-200 md:pointer-events-auto md:static md:h-auto md:w-auto md:translate-x-0 md:scale-100 md:flex-row md:items-center md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:opacity-100 md:shadow-none',
        !menuOpen && 'pointer-events-none scale-95 opacity-0',
        menuOpen && 'scale-100 opacity-100'
      ]}>
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
                  navigate(item.id);
                  menuOpen = false;
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

      <hr
        class="my-1 w-full border-border-subtle md:hidden"
        aria-hidden="true" />

      <div class="flex w-full items-center justify-between px-2 py-1 md:hidden">
        <ThemeSelect
          theme={themeStore.current}
          onThemeChange={themeStore.apply}
          dropdownDirection="up" />
        <AccessibilitySelect dropdownDirection="up" />
      </div>
    </div>

    <SpotlightSearch projects={data.projects} />

    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply}
      class="hidden md:inline-flex" />
    <AccessibilitySelect class="hidden md:inline-flex" />

    <button
      bind:this={menuTriggerRef}
      class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-xl transition-colors hover:bg-surface-hover md:hidden"
      onclick={() => (menuOpen = !menuOpen)}
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-menu">
      {#if menuOpen}
        <X class="size-5 text-text-primary" />
      {:else}
        <Menu class="size-5 text-text-primary" />
      {/if}
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
      {decodeHtmlEntities(tag)}
    </span>
  {/snippet}

  {#snippet filterableTag(tag: string)}
    {@const cleanTag = decodeHtmlEntities(tag)}
    <button
      type="button"
      onclick={() => projectFilterStore.toggleMultiFilter('tag', tag)}
      class="cursor-pointer rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium transition-colors hover:bg-surface-hover hover:text-copilot {(
        projectFilterStore.filters['tag']?.includes(tag)
      ) ?
        'font-semibold text-copilot'
      : 'text-text-muted'}">
      {cleanTag}
    </button>
  {/snippet}

  {#snippet blogFilterableTag(tag: string)}
    {@const cleanTag = decodeHtmlEntities(tag)}
    <button
      type="button"
      onclick={() => blogFilterStore.toggleMultiFilter('tag', tag)}
      class="cursor-pointer rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium transition-colors hover:bg-surface-hover hover:text-copilot {(
        blogFilterStore.filters['tag']?.includes(tag)
      ) ?
        'font-semibold text-copilot'
      : 'text-text-muted'}">
      {cleanTag}
    </button>
  {/snippet}

  {#snippet projectCard(
    project: Project,
    headingTag: 'h3' | 'h4',
    tagItem: Snippet<[string]>
  )}
    <div
      class="relative row-span-5 grid grid-rows-subgrid gap-3 rounded-sm glass-card p-5 text-left {(
        openCodeMenuId === project.name
      ) ?
        'z-30'
      : ''}">
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <svelte:element
            this={headingTag}
            class="line-clamp-1 text-xl leading-snug font-bold text-text-primary"
            title={project.name}>
            {project.name}
          </svelte:element>
        </div>

        <div
          class="relative z-20 grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs leading-5 font-medium text-text-muted select-none">
          {#if project.licenseName}
            <span class="inline-flex w-fit items-center gap-1">
              <Award class="size-3 leading-none" />
              {project.licenseName} License
            </span>
          {:else}
            <span aria-hidden="true"></span>
          {/if}
          <span class="inline-flex w-fit items-center gap-1">
            <GitFork class="size-3 leading-none" />
            {project.forks}
            {pluralize(project.forks, 'fork', 'forks')}
          </span>
          <span class="inline-flex w-fit items-center gap-1">
            <Astroid class="size-3 leading-none" />
            {project.stars}
            {pluralize(project.stars, 'star', 'stars')}
          </span>
          {#if project.pushedAt}
            <span class="inline-flex w-fit items-center gap-1">
              <Clock class="size-3 leading-none" />
              <RelativeTime
                date={project.pushedAt}
                titlePrefix="Last updated " />
            </span>
          {:else}
            <span aria-hidden="true"></span>
          {/if}
          <span class="inline-flex w-fit items-center gap-1">
            <GitBranch class="size-3 leading-none" />
            {project.branches}
            {pluralize(project.branches, 'branch', 'branches')}
          </span>
          <span class="inline-flex w-fit items-center gap-1">
            <Activity class="size-3 leading-none" />
            {project.commits}
            {pluralize(project.commits, 'commit', 'commits')}
          </span>
        </div>
      </div>

      <div
        class="relative z-20 flex min-h-[24px] flex-wrap content-start items-start gap-1.5">
        {#if project.tags.length > 0}
          {#each project.tags as tag (tag)}
            {@render tagItem(tag)}
          {/each}
        {:else}
          <div
            class="h-5 select-none"
            aria-hidden="true">
          </div>
        {/if}
      </div>

      <div
        class="flex flex-col justify-start border-y border-border-subtle py-3">
        <p
          class="text-[0.8125rem] leading-relaxed text-text-secondary"
          title={project.desc}>
          {project.desc}
        </p>
      </div>

      <div class="relative z-20 flex flex-col justify-start">
        {#if project.languages.length > 0}
          <div class="flex flex-col justify-start gap-2">
            <div
              class="flex h-1.5 w-full overflow-hidden rounded-full bg-border-subtle/30">
              {#each project.languages as language (language.name)}
                <div
                  class="w-(--lang-w) bg-(--lang-color)"
                  style="--lang-w: {language.percent}%; --lang-color: {language.color};">
                </div>
              {/each}
            </div>
            <div
              class="flex flex-wrap items-start gap-x-3 gap-y-1 text-xs text-text-muted">
              {#each project.languages as language (language.name)}
                <span
                  class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    class="h-2 w-2 shrink-0 rounded-full bg-(--lang-dot-color)"
                    style="--lang-dot-color: {language.color};"></span>
                  <span class="font-semibold text-text-primary"
                    >{language.name}</span>
                  {language.percent}%
                </span>
              {/each}
            </div>
          </div>
        {:else}
          <div
            class="flex flex-col justify-start gap-2 opacity-0 select-none"
            aria-hidden="true">
            <div class="h-1.5 w-full rounded-full bg-border-subtle/30"></div>
            <span class="text-xs">No language data</span>
          </div>
        {/if}
      </div>

      <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
        <hr class="mb-1 border-border-subtle" />

        <div class="grid grid-cols-2 gap-2">
          <Button
            type="secondary"
            size="md"
            class="w-full"
            onclick={() => shareProjectDialog(project)}>
            {#snippet leading()}
              <Share2 class="size-3.5" />
            {/snippet}
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
                <Code class="size-3.5" />
                Code
              </span>
            </DropdownTrigger>

            {#if openCodeMenuId === project.name}
              <div
                role="menu"
                class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-72 min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
                <div class="relative z-10 flex flex-col p-3">
                  <div
                    class="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                    <Terminal class="size-3.5" />
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
                      class="min-w-0 flex-1 scrollbar-none overflow-x-auto font-mono text-xxs whitespace-nowrap text-text-secondary select-all [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {codeCommand(project, getCodeTab(project.name))}
                    </span>
                    <button
                      type="button"
                      onclick={() =>
                        copyCodeCommand(project, getCodeTab(project.name))}
                      aria-label="Copy clone command"
                      class="shrink-0 cursor-pointer text-text-secondary transition-colors hover:text-copilot">
                      <Copy class="size-3.5" />
                    </button>
                  </div>

                  <hr class="my-2.5 border-border-subtle" />

                  <a
                    href={project.zipUrl}
                    class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                    <FolderArchive class="size-3.5" />
                    Download ZIP
                  </a>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none hover:bg-copilot-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-copilot-active sm:text-sm">
          View repo
        </a>
      </div>
    </div>
  {/snippet}

  {#snippet blogPostCard(post: BlogPost, tagItem: Snippet<[string]>)}
    <div
      class="relative flex h-full w-full flex-col gap-3 rounded-sm glass-card p-5 text-left {(
        openCopyMenuId === post.id
      ) ?
        'z-30'
      : ''}">
      {#if post.banner_path && !failedBanners.has(post.id)}
        <ImageWithSkeleton
          src={getBannerUrl(post.banner_path)}
          alt={post.title}
          aspectRatio="aspect-video"
          onerror={() => markBannerFailed(post.id)}
          class="w-full border border-border-subtle" />
      {:else}
        <div
          class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-linear-to-br from-accent/15 to-copilot/15 select-none">
          <ImageIcon class="size-8 text-copilot/50" />
        </div>
      {/if}

      <div class="flex flex-1 flex-col gap-1 font-sans">
        <div
          class="flex min-h-5 w-full scrollbar-none flex-wrap items-center gap-x-1.5 overflow-x-auto font-sans text-xxs font-medium whitespace-nowrap text-text-muted select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <RelativeTime date={post.created_at} />
          <span aria-hidden="true">&middot;</span>
          <span
            >Last updated {formatAbsoluteDate(
              post.updated_at || post.created_at
            )}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatReadTime(post.read_time)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatCommentCount(post.comment_count)}</span>
          {#if post.views_count !== undefined}
            <span aria-hidden="true">&middot;</span>
            <span>{formatViewCount(post.views_count)}</span>
          {/if}
        </div>
        <hr class="my-1.5 border-border-subtle" />
        <div class="mt-1">
          <h4 class="text-lg leading-snug font-bold text-text-primary">
            <a
              href="/blog/{post.slug}"
              class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
              {post.title}
            </a>
          </h4>
        </div>
        {#if post.tags && post.tags.length > 0}
          <div class="flex min-h-[24px] flex-wrap items-start gap-1.5">
            {#each post.tags as tag (tag)}
              {@render tagItem(tag)}
            {/each}
          </div>
        {/if}
        {#if post.excerpt}
          <p class="min-h-26 text-sm leading-normal text-text-secondary">
            {post.excerpt}
          </p>
        {/if}

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-2">
          <hr class="border-border-subtle" />

          <div class="grid grid-cols-2 gap-2">
            <Button
              type="secondary"
              size="md"
              class="w-full"
              onclick={() => shareBlogPostDialog(post)}>
              {#snippet leading()}
                <Share2 class="size-3.5" />
              {/snippet}
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
                  <Copy class="size-3.5" />
                  Copy
                </span>
              </DropdownTrigger>

              {#if openCopyMenuId === post.id}
                <div
                  role="menu"
                  class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-max min-w-40 -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
                  <div
                    class="relative z-10 flex flex-col overflow-hidden rounded-sm py-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onclick={() => copyBlogUrl(post)}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                      <LinkIcon class="size-3.5" />
                      <span>Copy URL</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onclick={() => copyBlogId(post)}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                      <Hash class="size-3.5" />
                      <span>Copy Blog ID</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onclick={() => copyBlogMarkdown(post)}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                      <svg
                        class="size-3.5 fill-current"
                        viewBox="0 0 24 24"
                        aria-hidden="true">
                        <path
                          d="M2.5 4A1.5 1.5 0 0 0 1 5.5v13A1.5 1.5 0 0 0 2.5 20h19a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 21.5 4h-19zm1 3h3l2 2.5 2-2.5h3v10h-2.5v-5.5L9.5 13.5 8 11.5v5.5H3.5V7zm13 0h4l-3 4.5h2V17h-2.5v-5.5h-2L16.5 7z" />
                      </svg>
                      <span>Copy as Markdown</span>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <a
            href="/blog/{post.slug}"
            class="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none hover:bg-copilot-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-copilot-active sm:text-sm">
            Read post
          </a>
        </div>
      </div>
    </div>
  {/snippet}

  {#if activeSection === 'home'}
    <div
      class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-85 select-none dark:opacity-75">
      <GradientWaves
        horizonColor="#5227FF"
        waveColor="#FF9FFC"
        crestColor="#FFFFFF"
        speed={0.45}
        amplitude={3.0}
        waveScale={0.65}
        waveRatio={0.9}
        swell={40}
        turbulence={22}
        tilt={1.11}
        zoom={1.0}
        height={5.5}
        fogDepth={15}
        detail="medium"
        brightness={1.35}
        opacity={1.0}
        grain={true}
        grainIntensity={0.04}
        reduceMotion={a11yStore.current.reduceMotion} />
    </div>

    <Section
      spacing="none"
      class="relative z-10 pt-10 pb-6 md:pt-14 md:pb-8">
      <PageContainer
        width="standard"
        class="flex flex-col gap-8">
        <div
          class="pointer-events-none absolute top-12.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-copilot/10 blur-[80px]">
        </div>

        <div class="relative z-10 mx-auto w-full">
          <div
            class="relative mt-12 flex flex-col items-center justify-center rounded-sm glass-card p-6 pt-0 text-center shadow-xl sm:p-8 sm:pt-0">
            {#if avatar}
              <ImageWithSkeleton
                src={avatar}
                alt={name || author?.name || ''}
                referrerpolicy="no-referrer"
                rounded="rounded-full"
                class="relative z-10 -mt-14 mb-2 h-28 w-28 border border-border-subtle/60 dark:border-white/10"
                imgClass="object-top" />
            {/if}

            <h1
              class="relative z-10 max-w-full px-2 {avatar ? 'mt-4' : (
                'pt-6'
              )} line-clamp-2 text-2xl font-extrabold tracking-tight text-balance wrap-break-word text-text-primary sm:text-3xl md:text-4xl lg:text-5xl">
              {name}
            </h1>

            {#if headline}
              <p
                class="relative z-10 mt-1.5 max-w-lg font-sans text-sm leading-relaxed text-text-secondary/85 sm:text-base">
                {headline}
              </p>
            {/if}

            {#if desc}
              <p
                class="text-md sm:text-md relative z-10 mt-3 max-w-lg font-sans leading-relaxed text-text-primary">
                {desc}
              </p>
            {/if}

            <div
              class="relative z-10 mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
              {#if data.cvExists}
                <Button
                  type="primary"
                  tone="neutral"
                  size="lg"
                  href="/api/v1/cv?download=1"
                  download
                  onclick={handleCvDownload}
                  class="w-full px-5 sm:w-auto sm:px-6">
                  {#snippet leading()}
                    <Download class="size-4" />
                  {/snippet}
                  Download CV
                </Button>
              {:else}
                <Button
                  type="primary"
                  tone="neutral"
                  size="lg"
                  disabled
                  title="No CV document is available yet."
                  class="w-full px-5 sm:w-auto sm:px-6">
                  {#snippet leading()}
                    <Download class="size-4" />
                  {/snippet}
                  Download CV
                </Button>
              {/if}

              <Button
                type="secondary"
                size="lg"
                onclick={() => navigate('projects')}
                class="w-full px-5 sm:w-auto sm:px-6">
                Browse projects
              </Button>

              <Button
                type="ghost"
                size="lg"
                onclick={() => navigate('contact')}
                class="w-full px-5 sm:w-auto sm:px-6">
                Get in touch
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
            Top projects
          </h3>
          {#if recentProjects.length === 0}
            <EmptyState
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
                <ArrowRight
                  class="size-4 transition-transform select-none group-hover:translate-x-0.5" />
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
              title="No posts yet"
              description="Check back soon for new articles." />
          {:else}
            <div
              class="relative z-0 mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each recentPosts as post (post.id)}
                {@render blogPostCard(post, staticTag)}
              {/each}
            </div>
          {/if}
          {#if posts.length > 0}
            <div class="mt-4 flex justify-end">
              <button
                onclick={() => navigate('blog')}
                class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-copilot hover:underline">
                <span class="leading-none">View all posts</span>
                <ArrowRight
                  class="size-4 transition-transform select-none group-hover:translate-x-0.5" />
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
              title="No skills listed yet"
              description="Check back soon for updated skills." />
          {:else}
            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {#each skillsSnapshot as group (group.category)}
                <div
                  class="sm:min-w-0 sm:shrink sm:grow sm:basis-(--sg-basis)"
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
              title="No experience listed yet"
              description="Check back soon for career history." />
          {:else}
            <div
              class="divide-y divide-border-subtle overflow-hidden rounded-md glass-card text-left">
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
              <ArrowRight
                class="size-4 transition-transform select-none group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <div
          class="divide-y divide-border-subtle overflow-hidden rounded-md glass-card border-copilot/30 bg-copilot/5 text-left shadow-xs">
          <div
            class="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <div class="flex items-start gap-4">
              <Heart class="mt-0.5 size-6 shrink-0 fill-current text-copilot" />
              <div>
                <h4 class="text-sm font-bold">
                  <ShinyText
                    text="Support Open Source Work"
                    color="var(--color-copilot)"
                    shineColor="#ffffff"
                    speed={3} />
                </h4>
                <p class="mt-0.5 text-xs leading-relaxed text-text-secondary">
                  Your support helps maintain and improve these open-source
                  projects
                </p>
              </div>
            </div>
            <button
              onclick={() => navigate('funding')}
              class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm bg-copilot px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-copilot-hover">
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
          class="flex w-full flex-col gap-3 rounded-sm glass-card p-6 text-left"
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
            value={siteUrl ? `${siteUrl}/` : '/'} />

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
                formErrors.name = '';
                formValid.name = false;
                validateName();
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
                formErrors.email = '';
                formValid.email = false;
                validateEmail();
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
                formErrors.message = '';
                formValid.message = false;
                validateMessage();
              }} />
          </FormField>

          <ConsentNotice action="sending this message" />

          <div class="mt-2 flex justify-end">
            <Button
              htmlType="submit"
              type="primary"
              size="md">
              Send message
            </Button>
          </div>
        </form>

        <hr class="mt-10 mb-8 border-border-subtle" />

        <div class="flex flex-col gap-7 select-none">
          <div class="text-center">
            <h3
              class="text-xs font-bold tracking-wider text-text-muted uppercase">
              Built With These Awesome Technologies & Tools
            </h3>
          </div>
          <LogoLoop
            logos={techLogos}
            speed={40}
            direction="left"
            logoHeight={75}
            gap={36}
            pauseOnHover={false}
            hoverSpeed={40}
            scaleOnHover={false}
            fadeOut={false}
            ariaLabel="Technologies and tools used to build this website"
            class="py-2" />
        </div>
      </PageContainer>
    </Section>
  {/if}

  {#if activeSection === 'contact'}
    <LinkListSection
      title="Contact"
      subtitle="Feel free to reach out via any of the channels below."
      items={contactItems}
      emptyTitle="No contact channels yet"
      emptyDescription="Check back soon for ways to get in touch." />
  {/if}

  {#if activeSection === 'cv'}
    <Section
      spacing="none"
      class="relative z-10 pt-10 pb-6 md:pt-14 md:pb-8">
      <PageContainer width="standard">
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
            <Button
              type="primary"
              tone="neutral"
              size="md"
              href="/api/v1/cv?download=1"
              download
              onclick={handleCvDownload}>
              {#snippet leading()}
                <Download class="size-4" />
              {/snippet}
              Download CV
            </Button>
          {:else}
            <Button
              type="primary"
              tone="neutral"
              size="md"
              disabled
              title="No CV document is available yet.">
              {#snippet leading()}
                <Download class="size-4" />
              {/snippet}
              Download CV
            </Button>
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
                title="No experience listed yet"
                description="Check back soon for career history." />
            </div>
          {:else}
            <div
              class="mt-4 divide-y divide-border-subtle overflow-hidden rounded-md glass-card">
              {#each experiences as exp (exp.company + exp.startYear)}
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
                title="No education listed yet"
                description="Check back soon for academic history." />
            </div>
          {:else}
            <div
              class="mt-4 divide-y divide-border-subtle overflow-hidden rounded-md glass-card">
              {#each education as edu (edu.institution + edu.startYear)}
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
                title="No skills listed yet"
                description="Check back soon for updated skills." />
            </div>
          {:else}
            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {#each skills as group (group.category)}
                <div
                  class="sm:min-w-0 sm:shrink sm:grow sm:basis-(--sg-basis)"
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
      </PageContainer>
    </Section>
  {/if}

  {#if activeSection === 'blog'}
    <Section
      spacing="none"
      class="relative z-10 pt-10 pb-6 md:pt-14 md:pb-8">
      <PageContainer width="standard">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-text-primary">
              Blog
            </h1>
            <p class="mt-2 text-sm text-text-secondary">
              Thoughts on Linux, security, and open source.
            </p>
          </div>
          <div class="group relative inline-flex">
            <a
              href="/atom.xml"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe via Atom/RSS feed"
              class="mb-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-muted transition-colors select-none hover:bg-surface-hover hover:text-brand-rss">
              <Rss class="size-3.5 select-none" />
              <span class="hidden items-center sm:inline">Feed</span>
            </a>

            <div
              role="tooltip"
              class="pointer-events-none absolute top-[calc(100%+6px)] right-0 z-70 rounded-sm glass-overlay px-2 py-1 text-3xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 sm:hidden">
              <span class="relative z-10">RSS Feed</span>
            </div>
          </div>
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
                    label="Tag"
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
              {@render blogPostCard(post, blogFilterableTag)}
            {/each}
          </div>
          <div class="mt-6">
            <Pagination
              page={blogPageClamped}
              totalPages={blogTotalPages}
              onPageChange={p => (blogPage = p)} />
          </div>
        {/if}
      </PageContainer>
    </Section>
  {/if}

  {#if activeSection === 'projects'}
    <Section
      spacing="none"
      class="relative z-10 pt-10 pb-6 md:pt-14 md:pb-8">
      <PageContainer width="standard">
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
      </PageContainer>
    </Section>
  {/if}

  {#if activeSection === 'funding'}
    <LinkListSection
      title="Supporting & Funding"
      subtitle="Support open-source development and maintenance through these platforms."
      items={fundingPlatforms}
      emptyTitle="No funding platforms yet"
      emptyDescription="Check back soon for ways to support this work." />
  {/if}

  <div
    class="mx-auto w-full max-w-full px-6 md:w-[80%] lg:w-[65%] xl:w-[55%] {(
      activeSection === 'home'
    ) ?
      'my-6'
    : 'mt-2 mb-6'}"
    aria-hidden="true">
    <div class="w-full border-t border-border-subtle/60"></div>
  </div>

  <FooterSection
    onNavClick={url => {
      if (url.startsWith('/#')) {
        const sectionId = url.replace('/#', '');
        navigate(sectionId as Section);
        window.scrollTo({top: 0, behavior: 'smooth'});
      } else if (url === '/') {
        navigate('home');
        window.scrollTo({top: 0, behavior: 'smooth'});
      } else {
        window.location.href = url;
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
      type="secondary"
      size="md"
      showEscHint
      onclick={() => (showSendMessageDialog = false)}>Cancel</Button>
    <Button
      type="primary"
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
