<script lang="ts">
  import {env as publicEnv} from '$env/dynamic/public';
  import {onMount, tick, untrack} from 'svelte';
  import type {Snippet} from 'svelte';
  import {
    Code,
    Terminal,
    Copy,
    CopyCheck,
    FolderArchive,
    Share2,
    Link2 as LinkIcon,
    Paperclip,
    Hash,
    QrCode,
    FileBracesCorner,
    SquareText,
    Dot,
    Eye,
    Save,
    ChevronRight,
    EllipsisVertical,
    Image as ImageIcon,
    ArrowRight,
    HandHeart,
    Rss,
    Download,
    Star,
    GitBranch,
    GitFork,
    RotateCcwClock,
    Scale,
    GitCommitHorizontal,
    SquareArrowOutUpRight,
    Link,
    ScanText,
    TextAlignStart,
    FileText
  } from '@lucide/svelte';
  import {cn} from '$lib/utils/cn';
  import {
    isNameReserved,
    extractAuthorNameTokens
  } from '$lib/utils/nameValidator';
  import {
    LinkListSection,
    LinkGridSection,
    ShinyText,
    SkipLink,
    ImageWithSkeleton,
    SpotlightSearch,
    BottomNav,
    BrandIcon,
    FormField,
    Input,
    Textarea,
    Button,
    Badge,
    Dialog,
    EmptyState,
    Tooltip,
    CvEntryCard,
    ShareDialog,
    QrCodeDialog,
    ProjectCodeDialog,
    BlogActionsDialog,
    FilterToolbar,
    FilterChipGroup,
    SortControl,
    FilterCheckboxGroup,
    SearchResultCount,
    FilterEmptyState,
    Pagination,
    RelativeTime,
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
    ConsentNotice,
    ArticleMeta,
    staggerChildren,
    withViewTransition
  } from '$lib';
  import {supabase} from '$lib/supabase';
  import {SvelteSet} from 'svelte/reactivity';
  import {formatMonthAbbrev} from '$lib/author';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import AccessibilitySelect from '$lib/components/filter/AccessibilitySelect.svelte';
  import {
    turnstileWidget,
    executeTurnstile,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';
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
    description?: string;
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
  let socials = $derived(author?.socialLinks || []);
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

  let shareDialogData = $state<{title: string; url: string} | null>(null);
  let showShareDialog = $state(false);

  let selectedCodeProject = $state<Project | null>(null);
  let showProjectCodeDialog = $state(false);

  function openProjectCodeDialog(project: Project) {
    selectedCodeProject = project;
    showProjectCodeDialog = true;
  }

  let selectedBlogActionPost = $state<BlogPost | null>(null);
  let showBlogActionsDialog = $state(false);
  let activeProjectShareId = $state<string | null>(null);
  let activeProjectCodeId = $state<string | null>(null);
  let projectCodeTab = $state<'https' | 'ssh' | 'cli'>('https');
  let activeBlogShareId = $state<string | null>(null);
  let activeBlogQuickActionsId = $state<string | null>(null);
  let copiedProjectShareUrlId = $state<string | null>(null);
  let copiedProjectCloneId = $state<string | null>(null);
  let copiedBlogShareUrlId = $state<string | null>(null);

  function closeAllCardPopovers() {
    activeProjectShareId = null;
    activeProjectCodeId = null;
    activeBlogShareId = null;
    activeBlogQuickActionsId = null;
    copiedProjectShareUrlId = null;
    copiedProjectCloneId = null;
    copiedBlogShareUrlId = null;
  }

  function openBlogActionsDialog(post: BlogPost) {
    selectedBlogActionPost = post;
    showBlogActionsDialog = true;
  }

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

  let qrCodeDialogData = $state<{
    title: string;
    url: string;
    slug: string;
  } | null>(null);
  let showQrCodeDialog = $state(false);

  function openBlogQrDialog(post: {title: string; slug: string}) {
    if (typeof window === 'undefined') return;
    qrCodeDialogData = {
      title: post.title,
      url: `${window.location.origin}/blog/${post.slug}`,
      slug: post.slug
    };
    showQrCodeDialog = true;
  }

  function openProjectQrDialog(project: {name: string; url: string}) {
    if (typeof window === 'undefined') return;
    qrCodeDialogData = {
      title: project.name,
      url: project.url,
      slug: project.name
    };
    showQrCodeDialog = true;
  }

  async function copyBlogId(post: {id: string}) {
    try {
      await navigator.clipboard.writeText(post.id);
      toastStore.success('Copied!');
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  async function copyBlogMarkdown(post: {id: string; slug: string}) {
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

  async function copyBlogText(post: {title: string; slug: string}) {
    try {
      const res = await fetch(`/api/v1/blog/${post.slug}?format=text`);
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        toastStore.success('Copied!');
      } else {
        toastStore.error('Failed to fetch Text');
      }
    } catch {
      toastStore.error('Failed to copy');
    }
  }

  async function copyBlogUrl(post: {id: string; slug: string}) {
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

  function downloadFile(filename: string, content: string, mimeType: string) {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadBlogMarkdown(post: {title: string; slug: string}) {
    try {
      const res = await fetch(`/api/v1/blog/${post.slug}?format=md`);
      if (res.ok) {
        const mdText = await res.text();
        downloadFile(`${post.slug}.md`, mdText, 'text/markdown;charset=utf-8');
        toastStore.success('Markdown file downloaded');
      } else {
        toastStore.error('Failed to download Markdown');
      }
    } catch {
      toastStore.error('Failed to download');
    }
  }

  async function downloadBlogText(post: {title: string; slug: string}) {
    try {
      const res = await fetch(`/api/v1/blog/${post.slug}?format=text`);
      if (res.ok) {
        const text = await res.text();
        downloadFile(`${post.slug}.txt`, text, 'text/plain;charset=utf-8');
        toastStore.success('Text file downloaded');
      } else {
        toastStore.error('Failed to download Text');
      }
    } catch {
      toastStore.error('Failed to download');
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
    return count === 1 ? singular : plural;
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
      icon: c.icon || '',
      description: c.description || ''
    }))
  );

  interface FundingPlatform {
    label: string;
    value: string;
    shortValue?: string;
    href: string;
    icon: string;
    color?: string;
    description?: string;
  }

  let fundingPlatforms = $derived<FundingPlatform[]>(
    fundingData.map(f => ({
      label: f.platform,
      value: f.displayValue || f.platform,
      href: f.url,
      icon: f.icon || '',
      description: f.description || ''
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
  let formName = $state('');
  let formEmail = $state('');
  let formMessage = $state('');
  let formErrors = $state({name: '', email: '', message: ''});
  let formValid = $state({name: false, email: false, message: false});
  let showSendMessageDialog = $state(false);
  let contactFormElement = $state<HTMLFormElement | null>(null);
  let turnstileContactEl = $state<HTMLDivElement | null>(null);

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

  async function validateForm(e: SubmitEvent) {
    const nameErr = formName.trim() === '' ? 'Name is required.' : '';
    const nameReservedErr =
      !nameErr && isNameReserved(formName, authorTokens) ?
        'This name is reserved.'
      : '';
    const emailErr = formEmail.trim() === '' ? 'Email is required.' : '';
    const emailFormatErr =
      !emailErr && !emailRegex.test(formEmail.trim()) ?
        'Please enter a valid email address.'
      : '';
    const msgErr = formMessage.trim() === '' ? 'Message is required.' : '';

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
      if (turnstileSiteKey) {
        const token = await executeTurnstile(turnstileContactEl);
        if (!token) {
          toastStore.error('Please complete the security verification.');
          return;
        }
      }
      formName = sanitizeInput(formName.trim());
      formEmail = sanitizeInput(formEmail.trim());
      formMessage = sanitizeInput(formMessage.trim());
      showSendMessageDialog = true;
    }
  }

  function executeSendMessage() {
    if (contactFormElement) {
      contactFormElement.submit();
      resetTurnstile(turnstileContactEl);
    }
  }

  function navigate(section: Section) {
    withViewTransition(() => {
      activeSection = section;
      if (typeof window !== 'undefined') {
        window.location.hash = section === 'home' ? '' : section;
      }
    }, 'context');
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeAllCardPopovers();
    }
  }

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

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
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
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    async
    defer></script>
</svelte:head>

<svelte:window
  onclick={closeAllCardPopovers}
  onkeydown={handleWindowKeydown} />

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-12 w-full items-center justify-between glass-card border-b border-border-subtle/30 px-3 font-sans shadow-2xs sm:h-14 sm:px-5"
  aria-label="Main navigation">
  <div class="flex shrink-0 items-center lg:w-1/4 lg:flex-none">
    <SpotlightSearch
      projects={data.projects}
      variant="responsive" />
  </div>

  <nav
    class="hidden md:flex md:flex-1 md:items-center md:justify-center"
    aria-label="Section navigation">
    <ul class="flex items-center gap-1">
      {#each navItems as item (item.id)}
        <li>
          <button
            onclick={() => navigate(item.id)}
            class="flex h-9 cursor-pointer items-center justify-center rounded-sm border-0 px-3 text-sm leading-none font-medium whitespace-nowrap transition-all {(
              activeSection === item.id
            ) ?
              'bg-copilot-contrast-bg font-semibold text-white shadow-xs hover:bg-copilot-contrast-bg/90'
            : 'text-text-secondary hover:bg-surface-hover hover:text-copilot'}">
            {item.label}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div
    class="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:w-1/4 lg:flex-none">
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply} />
    <AccessibilitySelect />
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col pt-12 pb-16 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14 md:pb-0">
  {#snippet staticTag(tag: string)}
    <span
      class="inline-flex items-center rounded-full bg-copilot-subtle px-2 py-0.5 font-mono text-[12px] font-medium text-copilot transition-colors">
      {decodeHtmlEntities(tag)}
    </span>
  {/snippet}

  {#snippet filterableTag(tag: string)}
    {@const cleanTag = decodeHtmlEntities(tag)}
    <button
      type="button"
      onclick={() => projectFilterStore.toggleMultiFilter('tag', tag)}
      class="inline-flex cursor-pointer items-center rounded-full px-2 py-0.5 font-mono text-[12px] font-medium transition-colors {(
        projectFilterStore.filters['tag']?.includes(tag)
      ) ?
        'bg-copilot text-text-on-accent'
      : 'bg-copilot-subtle text-copilot hover:bg-copilot/15'}">
      {cleanTag}
    </button>
  {/snippet}

  {#snippet blogFilterableTag(tag: string)}
    {@const cleanTag = decodeHtmlEntities(tag)}
    <button
      type="button"
      onclick={() => blogFilterStore.toggleMultiFilter('tag', tag)}
      class="inline-flex cursor-pointer items-center rounded-full px-2 py-0.5 font-mono text-[12px] font-medium transition-colors {(
        blogFilterStore.filters['tag']?.includes(tag)
      ) ?
        'bg-copilot text-text-on-accent'
      : 'bg-copilot-subtle text-copilot hover:bg-copilot/15'}">
      {cleanTag}
    </button>
  {/snippet}

  {#snippet projectCard(
    project: Project,
    headingTag: 'h3' | 'h4',
    tagItem: Snippet<[string]>
  )}
    <div
      class="relative flex flex-col gap-2.5 rounded-sm glass-card p-4 text-left {(
        activeProjectShareId === project.name
        || activeProjectCodeId === project.name
      ) ?
        'z-40'
      : ''}">
      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <svelte:element
          this={headingTag}
          class="font-sans-title text-lg leading-none font-bold text-text-primary"
          title={project.name}>
          {project.name}
        </svelte:element>

        {#if project.lang}
          <span
            class="inline-flex items-center py-0.5 font-mono text-xxs leading-none font-medium text-text-secondary select-none">
            <Dot
              strokeWidth={10}
              class="size-3.5 shrink-0"
              color={project.langColor ?? '#909692'} />
            <span class="leading-none">{project.lang}</span>
          </span>
        {/if}

        {#if project.latestCommitSha || project.pushedAt}
          <span
            class="inline-flex items-center gap-1.5 font-sans-title text-xs leading-none font-medium whitespace-nowrap text-text-muted">
            <GitCommitHorizontal class="size-3.5 shrink-0 text-text-muted" />
            {#if project.latestCommitSha}
              <a
                href="https://github.com/{project.fullName}/commit/{project.latestCommitSha}"
                target="_blank"
                rel="noopener noreferrer"
                class="leading-none text-text-muted transition-colors hover:text-copilot hover:underline">
                {project.latestCommitSha}
              </a>
            {/if}
            {#if project.latestCommitSha && project.pushedAt}
              <span
                class="inline-flex items-center leading-none text-text-muted/40 select-none"
                aria-hidden="true">·</span>
            {/if}
            {#if project.pushedAt}
              <RelativeTime
                class="leading-none"
                date={project.pushedAt} />
            {/if}
          </span>
        {/if}
      </div>

      <div
        class="relative z-20 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-sans-title text-xs">
        <span
          class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
          <Star
            class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span
            >{project.stars} {pluralize(project.stars, 'star', 'stars')}</span>
        </span>
        <span
          class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
          <GitFork
            class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span
            >{project.forks} {pluralize(project.forks, 'fork', 'forks')}</span>
        </span>
        <span
          class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
          <RotateCcwClock
            class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span
            >{project.commits}
            {pluralize(project.commits, 'commit', 'commits')}</span>
        </span>
        <span
          class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
          <GitBranch
            class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span
            >{project.branches}
            {pluralize(project.branches, 'branch', 'branches')}</span>
        </span>
        {#if project.licenseName}
          <span
            class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
            <Scale
              class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
              strokeWidth={1.75}
              absoluteStrokeWidth={true} />
            {#if project.licenseUrl}
              <a
                href={project.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-text-secondary transition-colors hover:text-copilot hover:underline">
                {project.licenseName} License
              </a>
            {:else}
              <span>{project.licenseName} License</span>
            {/if}
          </span>
        {/if}
      </div>

      {#if project.desc}
        <p
          class="line-clamp-2 text-xs leading-relaxed text-text-secondary"
          title={project.desc}>
          {project.desc}
        </p>
      {/if}

      {#if project.tags && project.tags.length > 0}
        <div class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
          {#each project.tags as tag (tag)}
            {@render tagItem(tag)}
          {/each}
        </div>
      {/if}

      <div
        class="relative mt-auto flex flex-col gap-2 pt-1 {(
          activeProjectShareId === project.name
          || activeProjectCodeId === project.name
        ) ?
          'z-50'
        : 'z-10'}">
        <hr class="border-border-subtle/25" />

        <div class="relative flex items-center gap-2">
          <div class="shrink-0">
            <Button
              type="ghost"
              size="xs"
              aria-label="Share project"
              aria-expanded={activeProjectShareId === project.name}
              aria-haspopup="dialog"
              class={cn(
                'size-6.5! px-0! text-text-muted hover:text-copilot',
                activeProjectShareId === project.name
                  && 'border-copilot text-copilot'
              )}
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                activeProjectCodeId = null;
                activeProjectShareId =
                  activeProjectShareId === project.name ? null : project.name;
              }}>
              <Share2 class="size-3.5" />
            </Button>
          </div>

          <div class="shrink-0">
            <Button
              type="ghost"
              size="xs"
              aria-label="Code options"
              aria-expanded={activeProjectCodeId === project.name}
              aria-haspopup="dialog"
              class={cn(
                'size-6.5! px-0! text-text-muted hover:text-copilot',
                activeProjectCodeId === project.name
                  && 'border-copilot text-copilot'
              )}
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                activeProjectShareId = null;
                activeProjectCodeId =
                  activeProjectCodeId === project.name ? null : project.name;
              }}>
              <Code class="size-3.5" />
            </Button>
          </div>

          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-copilot px-3 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none hover:bg-copilot-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-copilot-active">
            <span>View repo</span>
            <SquareArrowOutUpRight class="size-3.5 text-text-on-accent" />
          </a>

          {#if activeProjectShareId === project.name}
            {@const projectUrl = project.url}
            {@const encodedUrl = encodeURIComponent(projectUrl)}
            {@const encodedTitle = encodeURIComponent(project.name)}
            <div
              role="dialog"
              tabindex="-1"
              aria-label="Share project"
              class="absolute right-0 bottom-full left-0 z-50 mb-2 flex flex-col gap-3 popover-surface p-3 sm:right-auto sm:w-80"
              onclick={(e: MouseEvent) => e.stopPropagation()}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Escape') activeProjectShareId = null;
              }}>
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                  >Direct link</span>
                <div
                  class="flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-base/80 p-1 pr-1.5 pl-2.5 shadow-2xs">
                  <span
                    class="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary select-all"
                    >{projectUrl}</span>
                  <Button
                    type={copiedProjectShareUrlId === project.name ?
                      'tertiary'
                    : 'secondary'}
                    size="xs"
                    class="size-6.5! shrink-0 px-0!"
                    aria-label={copiedProjectShareUrlId === project.name ?
                      'Copied project URL'
                    : 'Copy project URL'}
                    onclick={async () => {
                      try {
                        await navigator.clipboard.writeText(projectUrl);
                        toastStore.success('Project URL copied');
                        copiedProjectShareUrlId = project.name;
                        setTimeout(() => {
                          if (copiedProjectShareUrlId === project.name) {
                            copiedProjectShareUrlId = null;
                          }
                        }, 2000);
                      } catch {
                        toastStore.error('Failed to copy');
                      }
                    }}>
                    {#snippet leading()}
                      {#if copiedProjectShareUrlId === project.name}
                        <CopyCheck class="size-3.5 text-copilot" />
                      {:else}
                        <Copy class="size-3.5" />
                      {/if}
                    {/snippet}
                  </Button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <span
                  class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                  >Share to platform</span>
                <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-3">
                  <Button
                    href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
                    target="_blank"
                    rel="noopener noreferrer"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share on X"
                    aria-label="Share on X">
                    {#snippet leading()}
                      <i
                        class="bi bi-twitter-x inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">X</span>
                  </Button>
                  <Button
                    href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share on LinkedIn"
                    aria-label="Share on LinkedIn">
                    {#snippet leading()}
                      <i
                        class="bi bi-linkedin inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">LinkedIn</span>
                  </Button>
                  <Button
                    href="https://api.whatsapp.com/send?text={encodedTitle}%20{encodedUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share on WhatsApp"
                    aria-label="Share on WhatsApp">
                    {#snippet leading()}
                      <i
                        class="bi bi-whatsapp inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">WhatsApp</span>
                  </Button>
                  <Button
                    href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share on Facebook"
                    aria-label="Share on Facebook">
                    {#snippet leading()}
                      <i
                        class="bi bi-facebook inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">Facebook</span>
                  </Button>
                  <Button
                    href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
                    target="_blank"
                    rel="noopener noreferrer"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share on Reddit"
                    aria-label="Share on Reddit">
                    {#snippet leading()}
                      <i
                        class="bi bi-reddit inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">Reddit</span>
                  </Button>
                  <Button
                    href="mailto:?subject={encodedTitle}&body={encodedUrl}"
                    type="secondary"
                    size="xs"
                    class="w-full justify-center px-1.5 sm:px-2"
                    title="Share via Email"
                    aria-label="Share via Email">
                    {#snippet leading()}
                      <i
                        class="bi bi-envelope-fill inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span class="hidden truncate sm:inline">Email</span>
                  </Button>
                </div>
              </div>

              <div class="border-t border-border-subtle/60 pt-1.5">
                <Button
                  type="ghost"
                  size="xs"
                  class="w-full justify-center text-text-secondary hover:text-text-primary"
                  onclick={() => {
                    activeProjectShareId = null;
                    openProjectQrDialog(project);
                  }}>
                  {#snippet leading()}
                    <QrCode class="size-3.5" />
                  {/snippet}
                  <span>View QR Code</span>
                </Button>
              </div>
            </div>
          {/if}

          {#if activeProjectCodeId === project.name}
            {@const cloneCmd =
              projectCodeTab === 'https' ? `git clone ${project.cloneUrl}`
              : projectCodeTab === 'ssh' ? `git clone ${project.sshUrl}`
              : `gh repo clone ${project.fullName}`}
            <div
              role="dialog"
              tabindex="-1"
              aria-label="Clone repository"
              class="absolute right-0 bottom-full left-0 z-50 mb-2 flex flex-col gap-3 popover-surface p-3 sm:right-auto sm:w-80"
              onclick={(e: MouseEvent) => e.stopPropagation()}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Escape') activeProjectCodeId = null;
              }}>
              <div>
                <span
                  class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                  Clone repository
                </span>
              </div>

              <div
                class="flex rounded-sm border border-border-subtle bg-surface-base/50 p-0.5 text-xs font-semibold">
                {#each [['https', 'HTTPS'], ['ssh', 'SSH'], ['cli', 'GitHub CLI']] as const as [key, label] (key)}
                  <button
                    type="button"
                    onclick={() => (projectCodeTab = key)}
                    class="rounded-2xs flex-1 cursor-pointer py-1 transition-colors {(
                      projectCodeTab === key
                    ) ?
                      'bg-copilot text-white shadow-2xs'
                    : 'text-text-secondary hover:text-text-primary'}">
                    {label}
                  </button>
                {/each}
              </div>

              <div
                class="flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-base/80 p-1.5 pl-2.5 font-mono text-xs text-text-secondary shadow-2xs">
                <span class="min-w-0 flex-1 truncate select-all"
                  >{cloneCmd}</span>
                <Button
                  type={copiedProjectCloneId === project.name ?
                    'tertiary'
                  : 'secondary'}
                  size="xs"
                  class="size-6.5! shrink-0 px-0!"
                  aria-label={copiedProjectCloneId === project.name ?
                    'Copied clone command'
                  : 'Copy clone command'}
                  onclick={async () => {
                    try {
                      await navigator.clipboard.writeText(cloneCmd);
                      toastStore.success('Clone command copied');
                      copiedProjectCloneId = project.name;
                      setTimeout(() => {
                        if (copiedProjectCloneId === project.name) {
                          copiedProjectCloneId = null;
                        }
                      }, 2000);
                    } catch {
                      toastStore.error('Failed to copy');
                    }
                  }}>
                  {#snippet leading()}
                    {#if copiedProjectCloneId === project.name}
                      <CopyCheck class="size-3.5 text-copilot" />
                    {:else}
                      <Copy class="size-3.5" />
                    {/if}
                  {/snippet}
                </Button>
              </div>

              <div class="border-t border-border-subtle/60 pt-1.5">
                <Button
                  href={project.zipUrl}
                  download
                  type="ghost"
                  size="xs"
                  class="w-full justify-center text-text-secondary hover:text-text-primary">
                  {#snippet leading()}
                    <Download class="size-3.5" />
                  {/snippet}
                  <span>Download ZIP</span>
                </Button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet blogPostCard(post: BlogPost, tagItem: Snippet<[string]>)}
    <div
      class="relative flex flex-col rounded-sm glass-card text-left {(
        activeBlogShareId === post.id || activeBlogQuickActionsId === post.id
      ) ?
        'z-40'
      : ''}">
      <div class="aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-sm">
        {#if post.banner_path && !failedBanners.has(post.id)}
          <ImageWithSkeleton
            src={getBannerUrl(post.banner_path)}
            alt={post.title}
            rounded=""
            onerror={() => markBannerFailed(post.id)}
            class="h-full w-full object-cover" />
        {:else}
          <div
            class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-copilot/15 select-none">
            <ImageIcon class="size-10 text-copilot/50" />
          </div>
        {/if}
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col justify-between gap-2.5 p-4 font-sans">
        <div class="flex flex-col gap-2">
          <div class="relative flex items-start justify-between gap-2">
            <h4
              style="view-transition-name: post-title-{post.slug}"
              class="line-clamp-2 min-w-0 flex-1 font-sans-title text-lg leading-snug font-bold text-text-primary">
              <a
                href="/blog/{post.slug}"
                class="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                {post.title}
              </a>
            </h4>

            <div class="relative z-20 flex shrink-0 items-center gap-1">
              <div class="relative shrink-0">
                <Button
                  type="ghost"
                  size="xs"
                  aria-label="Share post"
                  aria-expanded={activeBlogShareId === post.id}
                  aria-haspopup="dialog"
                  class={cn(
                    'size-6.5! px-0! text-text-muted hover:text-copilot',
                    activeBlogShareId === post.id
                      && 'border-copilot text-copilot'
                  )}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    activeBlogQuickActionsId = null;
                    activeBlogShareId =
                      activeBlogShareId === post.id ? null : post.id;
                  }}>
                  <Share2 class="size-3.5" />
                </Button>
              </div>

              <div class="relative shrink-0">
                <Button
                  type="ghost"
                  size="xs"
                  aria-label="Blog quick actions"
                  aria-expanded={activeBlogQuickActionsId === post.id}
                  aria-haspopup="menu"
                  class={cn(
                    'size-6.5! px-0! text-text-muted hover:text-copilot',
                    activeBlogQuickActionsId === post.id
                      && 'border-copilot text-copilot'
                  )}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    activeBlogShareId = null;
                    activeBlogQuickActionsId =
                      activeBlogQuickActionsId === post.id ? null : post.id;
                  }}>
                  <EllipsisVertical class="size-3.5" />
                </Button>
              </div>
            </div>

            {#if activeBlogShareId === post.id}
              {@const postUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/blog/${post.slug}`}
              {@const encodedUrl = encodeURIComponent(postUrl)}
              {@const encodedTitle = encodeURIComponent(post.title)}
              <div
                role="dialog"
                tabindex="-1"
                aria-label="Share post"
                class="absolute top-full right-0 z-50 mt-1.5 flex flex-col gap-3 popover-surface p-3 sm:w-80"
                onclick={(e: MouseEvent) => e.stopPropagation()}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Escape') activeBlogShareId = null;
                }}>
                <div class="flex flex-col gap-1.5">
                  <span
                    class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Direct link</span>
                  <div
                    class="flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-base/80 p-1 pr-1.5 pl-2.5 shadow-2xs">
                    <span
                      class="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary select-all"
                      >{postUrl}</span>
                    <Button
                      type={copiedBlogShareUrlId === post.id ?
                        'tertiary'
                      : 'secondary'}
                      size="xs"
                      class="size-6.5! shrink-0 px-0!"
                      aria-label={copiedBlogShareUrlId === post.id ?
                        'Copied post link'
                      : 'Copy post URL'}
                      onclick={async () => {
                        try {
                          await navigator.clipboard.writeText(postUrl);
                          toastStore.success('Post link copied');
                          copiedBlogShareUrlId = post.id;
                          setTimeout(() => {
                            if (copiedBlogShareUrlId === post.id) {
                              copiedBlogShareUrlId = null;
                            }
                          }, 2000);
                        } catch {
                          toastStore.error('Failed to copy');
                        }
                      }}>
                      {#snippet leading()}
                        {#if copiedBlogShareUrlId === post.id}
                          <CopyCheck class="size-3.5 text-copilot" />
                        {:else}
                          <Copy class="size-3.5" />
                        {/if}
                      {/snippet}
                    </Button>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span
                    class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Share to platform</span>
                  <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-3">
                    <Button
                      href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
                      target="_blank"
                      rel="noopener noreferrer"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share on X"
                      aria-label="Share on X">
                      {#snippet leading()}
                        <i
                          class="bi bi-twitter-x inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">X</span>
                    </Button>
                    <Button
                      href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share on LinkedIn"
                      aria-label="Share on LinkedIn">
                      {#snippet leading()}
                        <i
                          class="bi bi-linkedin inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">LinkedIn</span>
                    </Button>
                    <Button
                      href="https://api.whatsapp.com/send?text={encodedTitle}%20{encodedUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share on WhatsApp"
                      aria-label="Share on WhatsApp">
                      {#snippet leading()}
                        <i
                          class="bi bi-whatsapp inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">WhatsApp</span>
                    </Button>
                    <Button
                      href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share on Facebook"
                      aria-label="Share on Facebook">
                      {#snippet leading()}
                        <i
                          class="bi bi-facebook inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">Facebook</span>
                    </Button>
                    <Button
                      href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
                      target="_blank"
                      rel="noopener noreferrer"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share on Reddit"
                      aria-label="Share on Reddit">
                      {#snippet leading()}
                        <i
                          class="bi bi-reddit inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">Reddit</span>
                    </Button>
                    <Button
                      href="mailto:?subject={encodedTitle}&body={encodedUrl}"
                      type="secondary"
                      size="xs"
                      class="w-full justify-center px-1.5 sm:px-2"
                      title="Share via Email"
                      aria-label="Share via Email">
                      {#snippet leading()}
                        <i
                          class="bi bi-envelope-fill inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                      <span class="hidden truncate sm:inline">Email</span>
                    </Button>
                  </div>
                </div>

                <div class="border-t border-border-subtle/60 pt-1.5">
                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-center text-text-secondary hover:text-text-primary"
                    onclick={() => {
                      activeBlogShareId = null;
                      openBlogQrDialog(post);
                    }}>
                    {#snippet leading()}
                      <QrCode class="size-3.5" />
                    {/snippet}
                    <span>View QR Code</span>
                  </Button>
                </div>
              </div>
            {/if}

            {#if activeBlogQuickActionsId === post.id}
              <div
                role="menu"
                tabindex="-1"
                aria-label="Blog quick actions"
                class="absolute right-0 bottom-full z-50 mb-2 flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-sm border border-border-subtle bg-surface-elevated/95 p-2.5 shadow-xl backdrop-blur-md sm:flex-row sm:gap-0 sm:divide-x sm:divide-border-subtle/60"
                onclick={(e: MouseEvent) => e.stopPropagation()}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Escape') activeBlogQuickActionsId = null;
                }}>
                <div class="flex flex-col gap-1 sm:pr-3">
                  <span
                    class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Copy</span>
                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogMarkdown(post);
                    }}>
                    {#snippet leading()}
                      <Copy class="size-3.5" />
                    {/snippet}
                    <span>Copy as Markdown</span>
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogText(post);
                    }}>
                    {#snippet leading()}
                      <ScanText class="size-3.5" />
                    {/snippet}
                    <span>Copy as Text</span>
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogUrl(post);
                    }}>
                    {#snippet leading()}
                      <Link class="size-3.5" />
                    {/snippet}
                    <span>Copy URL</span>
                  </Button>

                  {#if post.id}
                    <Button
                      type="ghost"
                      size="xs"
                      class="w-full justify-start px-1.5 whitespace-nowrap"
                      onclick={() => {
                        activeBlogQuickActionsId = null;
                        copyBlogId(post);
                      }}>
                      {#snippet leading()}
                        <Hash class="size-3.5" />
                      {/snippet}
                      <span>Copy Post ID</span>
                    </Button>
                  {/if}
                </div>

                <div
                  class="flex flex-col gap-1 border-t border-border-subtle/60 pt-2 sm:border-t-0 sm:px-3 sm:pt-0">
                  <span
                    class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >View</span>
                  <Button
                    type="ghost"
                    size="xs"
                    href="/api/v1/blog/{post.slug}?format=md"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => (activeBlogQuickActionsId = null)}>
                    {#snippet leading()}
                      <i
                        class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span>View as Markdown</span>
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    href="/api/v1/blog/{post.slug}?format=text"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => (activeBlogQuickActionsId = null)}>
                    {#snippet leading()}
                      <TextAlignStart class="size-3.5" />
                    {/snippet}
                    <span>View as Text</span>
                  </Button>
                </div>

                <div
                  class="flex flex-col gap-1 border-t border-border-subtle/60 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
                  <span
                    class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Save</span>
                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      downloadBlogMarkdown(post);
                    }}>
                    {#snippet leading()}
                      <i
                        class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    {/snippet}
                    <span>Save as Markdown</span>
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    class="w-full justify-start px-1.5 whitespace-nowrap"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      downloadBlogText(post);
                    }}>
                    {#snippet leading()}
                      <FileText class="size-3.5" />
                    {/snippet}
                    <span>Save as Text</span>
                  </Button>
                </div>
              </div>
            {/if}
          </div>

          <ArticleMeta
            size="xs"
            layout="single"
            class="min-h-4.5"
            date={post.created_at}
            updatedAt={post.updated_at}
            readingTime={formatReadTime(post.read_time)}
            commentsCount={post.comment_count}
            views={post.views_count} />

          {#if post.excerpt}
            <p class="line-clamp-2 text-xs leading-relaxed text-text-secondary">
              {post.excerpt}
            </p>
          {/if}

          {#if post.tags && post.tags.length > 0}
            <div
              class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
              {#each post.tags as tag (tag)}
                {@render tagItem(tag)}
              {/each}
            </div>
          {/if}
        </div>

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
          <hr class="border-border-subtle/25" />
          <a
            href="/blog/{post.slug}"
            class="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-sm bg-copilot px-3 text-xs font-semibold text-text-on-accent shadow-xs transition-all select-none hover:bg-copilot-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-copilot-active">
            Read post
          </a>
        </div>
      </div>
    </div>
  {/snippet}

  {#if activeSection === 'home'}
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
            use:staggerChildren
            class="stagger-children relative mt-10 flex flex-col items-center justify-center rounded-sm glass-card px-3.5 pt-0 pb-6 text-center sm:mt-12 sm:px-8 sm:pt-0 sm:pb-8">
            {#if avatar}
              <ImageWithSkeleton
                src={avatar}
                alt={name || author?.name || ''}
                referrerpolicy="no-referrer"
                variant="avatar"
                rounded="rounded-full"
                class="relative z-10 -mt-10 mb-1 h-20 w-20 border border-border-subtle/30 shadow-sm sm:-mt-14 sm:mb-2 sm:h-28 sm:w-28 dark:border-white/8"
                imgClass="object-top" />
            {/if}

            <h1
              class="relative z-10 max-w-full px-2 font-sans-title {avatar ?
                'mt-2 sm:mt-4'
              : 'pt-6'} line-clamp-2 text-[1.75rem] leading-[1.05] font-extrabold tracking-tight text-balance wrap-break-word text-text-primary sm:text-3xl sm:leading-[1.15] md:text-4xl lg:text-5xl">
              {name}
            </h1>

            {#if headline}
              <p
                class="relative z-10 mt-1 max-w-lg font-sans-title text-xs leading-relaxed text-text-muted/90 sm:mt-1.5 sm:text-sm">
                {headline}
              </p>
            {/if}

            {#if desc}
              <p
                class="relative z-10 mt-2.5 max-w-lg font-sans text-[13px] leading-relaxed text-text-primary/85 sm:mt-3 sm:text-sm">
                {desc}
              </p>
            {/if}

            {#if socials.length > 0}
              <div
                class="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-1 select-none sm:mt-5 sm:gap-1.5">
                {#each socials as item (item.url + item.platform)}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.platform}
                    title={item.platform}
                    class="flex size-7.5 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none sm:size-8">
                    <BrandIcon
                      icon={item.icon}
                      class="text-sm leading-none sm:text-base" />
                  </a>
                {/each}
              </div>
            {/if}

            <div
              class="relative z-10 mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
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
            <div class="mt-2 grid grid-cols-1 gap-4">
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
            <div class="mt-2 grid grid-cols-1 gap-4">
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
              class="divide-y divide-border-subtle/40 overflow-hidden rounded-sm glass-card text-left">
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
          class="divide-y divide-border-subtle/40 overflow-hidden rounded-sm glass-card bg-copilot/5 text-left">
          <div
            class="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <div
              class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
              <div class="flex items-center gap-3 sm:block">
                <HandHeart
                  class="size-5 shrink-0 text-copilot sm:mt-0.5 sm:size-6" />
                <h4 class="font-sans-title text-sm font-bold sm:hidden">
                  <ShinyText
                    text="Support Open Source Work"
                    color="var(--color-copilot)"
                    shineColor="#ffffff"
                    speed={3} />
                </h4>
              </div>
              <div>
                <h4 class="hidden font-sans-title text-sm font-bold sm:block">
                  <ShinyText
                    text="Support Open Source Work"
                    color="var(--color-copilot)"
                    shineColor="#ffffff"
                    speed={3} />
                </h4>
                <p
                  class="text-xs leading-relaxed text-text-secondary sm:mt-0.5">
                  Your support helps maintain and improve these open-source
                  projects
                </p>
              </div>
            </div>
            <Button
              type="primary"
              size="sm"
              onclick={() => navigate('funding')}>
              Become a sponsor
            </Button>
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
            <h2 class="font-sans-title text-sm font-bold text-text-primary">
              Send a Message
            </h2>
            <p class="mt-0.5 text-xs text-text-muted">
              Feel free to drop me a line. I'll get back to you as soon as
              possible.
            </p>
          </div>

          <FormField
            id="form-name"
            label="Name"
            variant="floating"
            required
            hideAsterisk
            maxlength={50}
            currentLength={formName.length}
            error={formErrors.name}
            valid={formValid.name}>
            <Input
              type="text"
              id="form-name"
              name="name"
              autocomplete="name"
              maxlength={50}
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
            variant="floating"
            required
            hideAsterisk
            maxlength={100}
            currentLength={formEmail.length}
            error={formErrors.email}
            valid={formValid.email}>
            <Input
              type="text"
              id="form-email"
              name="email"
              autocomplete="email"
              maxlength={100}
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
            variant="floating"
            required
            hideAsterisk
            maxlength={2000}
            currentLength={formMessage.length}
            counter={`${formMessage.length}/2000`}
            error={formErrors.message}
            valid={formValid.message}>
            <Textarea
              id="form-message"
              name="message"
              rows={4}
              maxlength={2000}
              bind:value={formMessage}
              error={!!formErrors.message}
              valid={formValid.message}
              oninput={() => {
                formErrors.message = '';
                formValid.message = false;
                validateMessage();
              }} />
          </FormField>

          <div
            bind:this={turnstileContactEl}
            class="cf-turnstile select-none"
            data-sitekey={turnstileSiteKey}
            data-action="contact-message"
            data-size="flexible"
            data-theme="auto"
            data-appearance="interaction-only"
            data-execution="execute"
            use:turnstileWidget={{
              sitekey: turnstileSiteKey,
              size: 'flexible',
              action: 'contact-message',
              theme: 'auto',
              appearance: 'interaction-only',
              execution: 'execute'
            }}>
          </div>

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
              class="font-sans-title text-xs font-bold tracking-wider text-text-muted uppercase">
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
    <LinkGridSection
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
          <div class="flex flex-col gap-1">
            <h2
              class="font-sans-title text-base font-bold text-text-primary sm:text-lg">
              Curriculum Vitae
            </h2>
            <p class="text-xs text-text-secondary">
              View or download my updated resume.
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
              class="mt-4 divide-y divide-border-subtle/40 overflow-hidden rounded-sm glass-card">
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
              class="mt-4 divide-y divide-border-subtle/40 overflow-hidden rounded-sm glass-card">
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
          <Tooltip
            content="RSS Feed"
            placement="bottom"
            align="right"
            class="sm:hidden">
            <a
              href="/atom.xml"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe via Atom/RSS feed"
              class="mb-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-muted transition-colors select-none hover:bg-surface-hover hover:text-brand-rss">
              <Rss class="size-3.5 select-none" />
              <span class="hidden items-center sm:inline">Feed</span>
            </a>
          </Tooltip>
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
                    aria-label="Search articles" />
                </div>
              {/snippet}

              {#snippet filterControlsSlot()}
                {#if allBlogTags.length > 0}
                  <FilterCheckboxGroup
                    label="Tags"
                    options={allBlogTags.map(t => ({
                      value: t,
                      label: decodeHtmlEntities(t)
                    }))}
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
          <div
            use:staggerChildren
            class="stagger-children relative mt-2 grid grid-cols-1 gap-4 {(
              activeBlogShareId || activeBlogQuickActionsId
            ) ?
              'z-40'
            : 'z-0'}">
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
            use:staggerChildren
            class="stagger-children relative mt-2 grid grid-cols-1 gap-4 {(
              activeProjectShareId || activeProjectCodeId
            ) ?
              'z-40'
            : 'z-0'}">
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
    <LinkGridSection
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
  onOpenQr={() => {
    if (shareDialogData) {
      qrCodeDialogData = {
        title: shareDialogData.title,
        url: shareDialogData.url,
        slug: 'share'
      };
      showQrCodeDialog = true;
    }
  }}
  onClose={() => (showShareDialog = false)} />

<QrCodeDialog
  bind:isOpen={showQrCodeDialog}
  title={qrCodeDialogData?.title ?? ''}
  url={qrCodeDialogData?.url ?? ''}
  slug={qrCodeDialogData?.slug ?? ''}
  avatarUrl={author?.avatar ?? ''}
  onClose={() => (showQrCodeDialog = false)} />

<ProjectCodeDialog
  bind:isOpen={showProjectCodeDialog}
  project={selectedCodeProject}
  onClose={() => (showProjectCodeDialog = false)} />

<BlogActionsDialog
  bind:isOpen={showBlogActionsDialog}
  post={selectedBlogActionPost}
  onClose={() => (showBlogActionsDialog = false)}
  onCopyMarkdown={() => {
    if (selectedBlogActionPost) {
      copyBlogMarkdown(selectedBlogActionPost);
    }
  }}
  onCopyText={() => {
    if (selectedBlogActionPost) {
      copyBlogText(selectedBlogActionPost);
    }
  }}
  onSaveMarkdown={() => {
    if (selectedBlogActionPost) {
      downloadBlogMarkdown(selectedBlogActionPost);
    }
  }}
  onSaveText={() => {
    if (selectedBlogActionPost) {
      downloadBlogText(selectedBlogActionPost);
    }
  }} />

<BottomNav
  {activeSection}
  onNavigate={navigate} />
