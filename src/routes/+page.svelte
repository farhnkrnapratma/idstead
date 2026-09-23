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
    FileText,
    Pin,
    Sparkles
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
    ConsentNotice,
    ArticleMeta,
    staggerChildren,
    popoverPosition,
    withViewTransition
  } from '$lib';
  import {supabase} from '$lib/supabase';
  import {SvelteSet} from 'svelte/reactivity';
  import {formatMonthAbbrev} from '$lib/author';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {
    applyCodeThemeVariables,
    createCodeActionControls,
    ensureHljsThemeStylesheet,
    resolveHljsTheme
  } from '$lib/utils/codeBlocks';
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

  const expandedExcerptIds = new SvelteSet<string>();
  const overflowingExcerptIds = new SvelteSet<string>();

  function observeExcerptOverflow(postId: string) {
    return (element: HTMLElement) => {
      const updateOverflow = () => {
        if (element.scrollHeight > element.clientHeight + 1) {
          overflowingExcerptIds.add(postId);
        } else {
          overflowingExcerptIds.delete(postId);
        }
      };

      const resizeObserver = new ResizeObserver(updateOverflow);
      resizeObserver.observe(element);

      return () => resizeObserver.disconnect();
    };
  }

  function toggleExcerpt(postId: string) {
    if (expandedExcerptIds.has(postId)) {
      expandedExcerptIds.delete(postId);
    } else {
      expandedExcerptIds.add(postId);
    }
  }

  const failedRepoBanners = new SvelteSet<string>();

  function markRepoBannerFailed(projectName: string) {
    failedRepoBanners.add(projectName);
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
  let activeProjectCodeMenuId = $state<string | null>(null);
  const projectCodeTabs = [
    ['https', 'HTTPS'],
    ['ssh', 'SSH'],
    ['cli', 'GitHub CLI']
  ] as const;
  type ProjectCodeTab = (typeof projectCodeTabs)[number][0];
  let projectCodeTab = $state<ProjectCodeTab>('https');
  let projectCodeTheme = $derived(
    resolveHljsTheme(themeStore.isDark, codeBlockPrefsStore.current.colorScheme)
  );
  let activeBlogShareId = $state<string | null>(null);
  let activeBlogQuickActionsId = $state<string | null>(null);
  let copiedProjectShareUrlId = $state<string | null>(null);
  let copiedProjectCloneId = $state<string | null>(null);
  let copiedBlogShareUrlId = $state<string | null>(null);

  function closeAllCardPopovers() {
    activeProjectShareId = null;
    activeProjectCodeId = null;
    activeProjectCodeMenuId = null;
    activeBlogShareId = null;
    activeBlogQuickActionsId = null;
    copiedProjectShareUrlId = null;
    copiedProjectCloneId = null;
    copiedBlogShareUrlId = null;
  }

  function handleProjectCodeTabKeydown(event: KeyboardEvent, index: number) {
    let targetIndex: number;

    if (event.key === 'ArrowRight') {
      targetIndex = (index + 1) % projectCodeTabs.length;
    } else if (event.key === 'ArrowLeft') {
      targetIndex =
        (index - 1 + projectCodeTabs.length) % projectCodeTabs.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = projectCodeTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    projectCodeTab = projectCodeTabs[targetIndex][0];
    const currentButton = event.currentTarget as HTMLButtonElement;
    currentButton.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [targetIndex]?.focus();
  }

  function syncProjectCodeTheme(node: HTMLElement) {
    const theme = projectCodeTheme;
    const header =
      node.querySelector<HTMLElement>('.markdown-tabs-header')
      || node.querySelector<HTMLElement>('.code-header-bar');
    const body = node.querySelector<HTMLElement>('.code-body');
    if (!header || !body) return;

    node.dataset.codeTheme = theme;
    header.dataset.codeTheme = theme;
    body.dataset.codeTheme = theme;
    applyCodeThemeVariables(node, body);
    void ensureHljsThemeStylesheet(theme).then(() => {
      if (theme === projectCodeTheme && node.isConnected) {
        applyCodeThemeVariables(node, body);
      }
    });
  }

  let activeProjectCodeControls: ReturnType<
    typeof createCodeActionControls
  > | null = null;

  function mountProjectCodeControls(node: HTMLElement, project: Project) {
    const controls = createCodeActionControls({
      getCodeText: () => {
        return (
          projectCodeTab === 'https' ? `git clone ${project.cloneUrl}`
          : projectCodeTab === 'ssh' ? `git clone ${project.sshUrl}`
          : `gh repo clone ${project.fullName}`
        );
      },
      getDownloadFilename: () => `clone-${project.name}.sh`,
      downloadLabel: 'Download ZIP',
      onDownload: () => {
        if (project.zipUrl) {
          const a = document.createElement('a');
          a.href = project.zipUrl;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      },
      shouldHideLineNumbers: () => true,
      triggerToast: toastStore.success
    });
    node.appendChild(controls.controls);
    controls.syncKebabTheme(projectCodeTheme);
    activeProjectCodeControls = controls;

    return {
      update() {
        controls.syncKebabTheme(projectCodeTheme);
        controls.applyPrefs();
      },
      destroy() {
        if (activeProjectCodeControls === controls) {
          activeProjectCodeControls = null;
        }
        controls.controls.remove();
      }
    };
  }

  $effect(() => {
    void codeBlockPrefsStore.current;
    activeProjectCodeControls?.applyPrefs();
  });

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
    avatarUrl?: string;
  } | null>(null);
  let showQrCodeDialog = $state(false);

  function openBlogQrDialog(post: {title: string; slug: string}) {
    if (typeof window === 'undefined') return;
    qrCodeDialogData = {
      title: post.title,
      url: `${window.location.origin}/blog/${post.slug}`,
      slug: post.slug,
      avatarUrl: author?.avatar || ''
    };
    showQrCodeDialog = true;
  }

  function openProjectQrDialog(project: {name: string; url: string}) {
    if (typeof window === 'undefined') return;
    qrCodeDialogData = {
      title: project.name,
      url: project.url,
      slug: project.name,
      avatarUrl: author?.avatar || ''
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

  interface SkillGroupData {
    category: string;
    items: string[];
  }

  let rawSkills = $derived(data.skills || author?.skills || []);
  let skills = $derived<SkillGroupData[]>(
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
  const pinnedRepoNames = $derived(
    (data.pinnedRepoNames || []).map((n: string) => n.toLowerCase())
  );
  const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

  function isRepoPinned(project: Project) {
    return pinnedRepoNames.includes(project.name.toLowerCase());
  }

  function isRepoNew(project: Project) {
    if (!project.createdAt) return false;
    return (
      Date.now() - new Date(project.createdAt).getTime() < NEW_ITEM_WINDOW_MS
    );
  }

  function isPostNew(post: BlogPost) {
    if (!post.created_at) return false;
    return (
      Date.now() - new Date(post.created_at).getTime() < NEW_ITEM_WINDOW_MS
    );
  }

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
  let isSubmittingMessage = $state(false);
  let contactFormElement = $state<HTMLFormElement | null>(null);
  let turnstileContactEl = $state<HTMLDivElement | null>(null);

  const canClearContactForm = $derived(
    Boolean(formName.trim() || formEmail.trim() || formMessage.trim())
  );

  function clearContactForm() {
    formName = '';
    formEmail = '';
    formMessage = '';
    formErrors = {name: '', email: '', message: ''};
    formValid = {name: false, email: false, message: false};
  }

  let contactEmail = $derived.by(() => {
    const emailItem = contactData.find(
      c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
    );
    if (emailItem) {
      return (
        emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')
      ).trim();
    }
    return author?.email?.trim() || '';
  });

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
    e.preventDefault();

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

    if (formErrors.name || formErrors.email || formErrors.message) {
      return;
    }

    if (!contactEmail) {
      toastStore.error('Message submission is currently unavailable.');
      return;
    }

    isSubmittingMessage = true;

    try {
      if (turnstileSiteKey) {
        const token = await executeTurnstile(turnstileContactEl);
        if (!token) {
          toastStore.error('Please complete the security verification.');
          return;
        }
      }

      const sanitizedName = sanitizeInput(formName.trim());
      const sanitizedEmail = sanitizeInput(formEmail.trim());
      const sanitizedMessage = sanitizeInput(formMessage.trim());

      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          referrerPolicy: 'no-referrer-when-downgrade',
          body: JSON.stringify({
            name: sanitizedName,
            email: sanitizedEmail,
            message: sanitizedMessage,
            _subject: 'New message from portfolio website!',
            _captcha: 'false'
          })
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === 'false' || data?.success === false) {
        throw new Error(
          typeof data?.message === 'string' ?
            data.message
          : 'Failed to send message.'
        );
      }

      toastStore.success('Message sent successfully. Thank you!');
      formName = '';
      formEmail = '';
      formMessage = '';
      formErrors = {name: '', email: '', message: ''};
      formValid = {name: false, email: false, message: false};
    } catch (err) {
      const msg =
        err instanceof Error && err.message ?
          err.message
        : 'Failed to send message. Please try again later.';
      toastStore.error(msg);
    } finally {
      isSubmittingMessage = false;
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
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

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
      if (isRepoPinned(a) !== isRepoPinned(b)) {
        return isRepoPinned(a) ? -1 : 1;
      }

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
  onscroll={closeAllCardPopovers}
  onkeydown={handleWindowKeydown} />

<nav
  class="fixed top-0 z-40 flex h-12 w-full items-center justify-between glass-card border-b border-border-subtle/30 px-3 font-sans shadow-2xs sm:h-14 sm:px-5"
  aria-label="Main navigation">
  <div class="flex shrink-0 items-center lg:w-1/4 lg:flex-none">
    <div class="relative inline-flex">
      <SkipLink variant="search-overlay" />
      <SpotlightSearch
        projects={data.projects}
        variant="responsive" />
    </div>
  </div>

  <nav
    class="hidden md:flex md:flex-1 md:items-center md:justify-center"
    aria-label="Section navigation">
    <ul class="flex items-center gap-1">
      {#each navItems as item (item.id)}
        <li>
          <button
            onclick={() => navigate(item.id)}
            class="flex h-9 cursor-pointer items-center justify-center rounded-md border-0 px-3 text-sm leading-none font-medium whitespace-nowrap transition-all {(
              activeSection === item.id
            ) ?
              'bg-accent-contrast-bg font-semibold text-white shadow-xs hover:bg-accent-contrast-bg/90'
            : 'text-text-secondary hover:bg-surface-hover hover:text-accent'}">
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
      class="inline-flex items-center rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-[12px] font-medium text-accent transition-colors">
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
        'bg-accent text-text-on-accent'
      : 'bg-accent-subtle text-accent hover:bg-accent/15'}">
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
        'bg-accent text-text-on-accent'
      : 'bg-accent-subtle text-accent hover:bg-accent/15'}">
      {cleanTag}
    </button>
  {/snippet}

  {#snippet projectCard(
    project: Project,
    headingTag: 'h3' | 'h4',
    tagItem: Snippet<[string]>
  )}
    {@const repoBannerUrl =
      project.openGraphImageUrl
      || `https://opengraph.githubassets.com/1/${project.fullName}`}
    <div
      class="relative flex flex-col rounded-md glass-card border-0! text-left dark:border-0! {(
        activeProjectShareId === project.name
        || activeProjectCodeId === project.name
      ) ?
        'z-40'
      : ''}">
      <div
        class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
        {#if !failedRepoBanners.has(project.name)}
          <ImageWithSkeleton
            src={repoBannerUrl}
            alt={project.name}
            rounded=""
            onerror={() => markRepoBannerFailed(project.name)}
            class="h-full w-full object-cover" />
        {:else}
          <div
            class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
            <FolderArchive class="size-10 text-accent/50" />
          </div>
        {/if}
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
        <div class="flex flex-col gap-1.5 sm:gap-2">
          <div class="relative flex items-start justify-between gap-2">
            <svelte:element
              this={headingTag}
              class="line-clamp-2 min-w-0 flex-1 font-sans-title text-lg leading-snug font-bold text-text-primary">
              {project.name}
              {#if isRepoPinned(project) || isRepoNew(project)}
                <span
                  class="ml-1.5 inline-flex items-center gap-1 align-middle select-none">
                  {#if isRepoPinned(project)}
                    <span
                      class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
                      title="Pinned repository"
                      aria-label="Pinned repository">
                      <Pin class="size-3 shrink-0" />
                    </span>
                  {/if}
                  {#if isRepoNew(project)}
                    <span
                      class="inline-flex size-4.5 items-center justify-center rounded-full bg-security-subtle text-security"
                      title="New repository"
                      aria-label="New repository">
                      <Sparkles class="size-3 shrink-0" />
                    </span>
                  {/if}
                </span>
              {/if}
            </svelte:element>

            <div class="relative z-20 flex shrink-0 items-center gap-1">
              <div class="relative shrink-0">
                <Button
                  type="ghost"
                  size="xs"
                  aria-label="Share project"
                  aria-expanded={activeProjectShareId === project.name}
                  aria-haspopup="dialog"
                  class={cn(
                    'size-6.5! px-0! text-text-muted hover:text-accent',
                    activeProjectShareId === project.name
                      && 'border-accent text-accent'
                  )}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    activeProjectCodeId = null;
                    activeProjectShareId =
                      activeProjectShareId === project.name ?
                        null
                      : project.name;
                  }}>
                  <Share2 class="size-3.5" />
                </Button>
              </div>

              <div class="relative shrink-0">
                <Button
                  type="ghost"
                  size="xs"
                  aria-label="Clone options"
                  aria-expanded={activeProjectCodeId === project.name}
                  aria-haspopup="dialog"
                  class={cn(
                    'size-6.5! px-0! text-text-muted hover:text-accent',
                    activeProjectCodeId === project.name
                      && 'border-accent text-accent'
                  )}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    activeProjectShareId = null;
                    activeProjectCodeMenuId = null;
                    projectCodeTab = 'https';
                    activeProjectCodeId =
                      activeProjectCodeId === project.name ?
                        null
                      : project.name;
                  }}>
                  <Code class="size-3.5" />
                </Button>
              </div>
            </div>

            {#if activeProjectShareId === project.name}
              {@const projectUrl = project.url}
              {@const encodedUrl = encodeURIComponent(projectUrl)}
              {@const encodedTitle = encodeURIComponent(project.name)}
              <div
                role="dialog"
                tabindex="-1"
                aria-label="Share project"
                use:popoverPosition={{
                  placement: 'bottom-end',
                  offset: 6,
                  padding: 8
                }}
                class="absolute z-50 flex flex-col gap-3 popover-surface p-3 sm:w-80"
                onclick={(e: MouseEvent) => e.stopPropagation()}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Escape') activeProjectShareId = null;
                }}>
                <div class="flex flex-col gap-1.5">
                  <span
                    class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Direct link</span>
                  <div
                    class="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-base/80 p-1 pr-1.5 pl-2.5 shadow-2xs">
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
                          <CopyCheck class="size-3.5 text-accent" />
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
                use:popoverPosition={{
                  placement: 'bottom-end',
                  offset: 6,
                  padding: 8
                }}
                class="absolute z-50 flex w-84 flex-col gap-3 popover-surface p-3 sm:w-96"
                onclick={(e: MouseEvent) => e.stopPropagation()}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Escape') {
                    activeProjectCodeId = null;
                    activeProjectCodeMenuId = null;
                  }
                }}>
                <div class="flex items-center justify-between">
                  <span
                    class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                    Clone repository
                  </span>
                </div>

                <div
                  {@attach syncProjectCodeTheme}
                  data-code-theme={projectCodeTheme}
                  class="markdown-tabs-container group/codemin relative m-0 flex flex-col overflow-visible rounded-md border border-border-subtle shadow-2xs">
                  <div
                    data-code-theme={projectCodeTheme}
                    class="markdown-tabs-header hljs relative flex min-h-8 items-end justify-between rounded-t-md border-b border-border-subtle px-3 pt-0 pb-0 select-none"
                    role="tablist">
                    <div
                      aria-label="Clone method"
                      class="markdown-tabs-nav m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none]">
                      {#each projectCodeTabs as [key, label], index (key)}
                        <button
                          id="project-clone-tab-{key}"
                          type="button"
                          role="tab"
                          aria-selected={projectCodeTab === key}
                          aria-controls="project-clone-panel"
                          tabindex={projectCodeTab === key ? 0 : -1}
                          onclick={() => (projectCodeTab = key)}
                          onkeydown={event =>
                            handleProjectCodeTabKeydown(event, index)}
                          class={[
                            'markdown-tab-button relative -mb-px inline-flex shrink-0 cursor-pointer items-center justify-center border-b-[2.5px] px-3 py-1.5 font-sans-title text-xs font-medium whitespace-nowrap transition-all select-none',
                            projectCodeTab === key ?
                              'active-tab border-b-accent font-bold text-accent'
                            : 'border-b-transparent text-text-muted hover:text-text-primary'
                          ]}>
                          {label}
                        </button>
                      {/each}
                    </div>

                    <div
                      use:mountProjectCodeControls={project}
                      class="markdown-tabs-actions ml-2 flex shrink-0 items-center gap-1 self-center pb-0.5">
                    </div>
                  </div>

                  <div
                    id="project-clone-panel"
                    role="tabpanel"
                    aria-labelledby="project-clone-tab-{projectCodeTab}"
                    data-code-theme={projectCodeTheme}
                    class="code-body hljs relative flex min-w-0 items-center overflow-hidden rounded-b-md font-mono text-xs">
                    <span
                      class="pointer-events-none absolute top-1/2 right-3.5 z-10 -translate-y-1/2 font-mono text-[11px] text-text-muted/70 lowercase select-none">
                      bash
                    </span>
                    <span
                      class="shrink-0 py-2.5 pr-1 pl-3 font-normal text-accent select-none">
                      $
                    </span>
                    <span
                      class={[
                        'min-w-0 flex-1 scrollbar-none py-2.5 pr-14 pl-1 select-all [-ms-overflow-style:none]',
                        codeBlockPrefsStore.current.wrap ?
                          'break-all whitespace-pre-wrap'
                        : 'overflow-x-auto whitespace-pre'
                      ]}>{cloneCmd}</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div
            class="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-sans-title text-xs">
            {#if project.lang}
              <span
                class="inline-flex items-center gap-1 py-0.5 font-mono text-xxs leading-none font-medium text-text-secondary select-none">
                <Dot
                  strokeWidth={10}
                  class="size-3.5 shrink-0"
                  color={project.langColor ?? '#909692'} />
                <span class="leading-none">{project.lang}</span>
              </span>
            {/if}
            <span
              class="inline-flex items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary">
              <Star
                class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
              <span
                >{project.stars}
                {pluralize(project.stars, 'star', 'stars')}</span>
            </span>
            <span
              class="hidden items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary sm:inline-flex">
              <GitFork
                class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
              <span
                >{project.forks}
                {pluralize(project.forks, 'fork', 'forks')}</span>
            </span>
            <span
              class="hidden items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary sm:inline-flex">
              <RotateCcwClock
                class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
              <span
                >{project.commits}
                {pluralize(project.commits, 'commit', 'commits')}</span>
            </span>
            {#if project.licenseName}
              <span
                class="hidden items-center gap-1.5 font-normal whitespace-nowrap text-text-secondary sm:inline-flex">
                <Scale
                  class="size-3.5 shrink-0 -translate-y-[0.5px] text-text-muted/70 transition-colors"
                  strokeWidth={1.75}
                  absoluteStrokeWidth={true} />
                {#if project.licenseUrl}
                  <a
                    href={project.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-text-secondary transition-colors hover:text-accent hover:underline">
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
            <div
              class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
              {#each project.tags as tag (tag)}
                {@render tagItem(tag)}
              {/each}
            </div>
          {/if}
        </div>

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
          <hr class="border-border-subtle/25" />
          <Button
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            type="primary"
            size="sm"
            fullWidth>
            View repo
            {#snippet trailing()}
              <SquareArrowOutUpRight class="size-3.5" />
            {/snippet}
          </Button>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet blogPostCard(post: BlogPost, tagItem: Snippet<[string]>)}
    <div
      class="relative flex flex-col rounded-md glass-card border-0! text-left dark:border-0! {(
        activeBlogShareId === post.id || activeBlogQuickActionsId === post.id
      ) ?
        'z-40'
      : ''}">
      <div
        class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
        {#if post.banner_path && !failedBanners.has(post.id)}
          <ImageWithSkeleton
            src={getBannerUrl(post.banner_path)}
            alt={post.title}
            rounded=""
            onerror={() => markBannerFailed(post.id)}
            class="h-full w-full object-cover" />
        {:else}
          <div
            class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
            <ImageIcon class="size-10 text-text-muted" />
          </div>
        {/if}
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
        <div class="flex flex-col gap-1.5 sm:gap-2">
          <div class="relative flex items-start justify-between gap-2">
            <h4
              style="view-transition-name: post-title-{post.slug}"
              class="line-clamp-2 min-w-0 flex-1 font-sans-title text-lg leading-snug font-bold text-text-primary">
              {post.title}
              {#if post.pinned || isPostNew(post)}
                <span
                  class="ml-1.5 inline-flex items-center gap-1 align-middle select-none">
                  {#if post.pinned}
                    <span
                      class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
                      title="Pinned post"
                      aria-label="Pinned post">
                      <Pin class="size-3 shrink-0" />
                    </span>
                  {/if}
                  {#if isPostNew(post)}
                    <span
                      class="inline-flex size-4.5 items-center justify-center rounded-full bg-security-subtle text-security"
                      title="New post"
                      aria-label="New post">
                      <Sparkles class="size-3 shrink-0" />
                    </span>
                  {/if}
                </span>
              {/if}
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
                    'size-6.5! px-0! text-text-muted hover:text-accent',
                    activeBlogShareId === post.id && 'border-accent text-accent'
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
                    'size-6.5! px-0! text-text-muted hover:text-accent',
                    activeBlogQuickActionsId === post.id
                      && 'border-accent text-accent'
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
                use:popoverPosition={{
                  placement: 'bottom-end',
                  offset: 6,
                  padding: 8
                }}
                class="absolute z-50 flex flex-col gap-3 popover-surface p-3 sm:w-80"
                onclick={(e: MouseEvent) => e.stopPropagation()}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Escape') activeBlogShareId = null;
                }}>
                <div class="flex flex-col gap-1.5">
                  <span
                    class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Direct link</span>
                  <div
                    class="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-base/80 p-1 pr-1.5 pl-2.5 shadow-2xs">
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
                          <CopyCheck class="size-3.5 text-accent" />
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
                use:popoverPosition={{
                  placement: 'top-end',
                  offset: 6,
                  padding: 8
                }}
                class="absolute z-50 flex max-h-[85vh] max-w-[calc(100vw-2rem)] flex-row divide-x divide-border-subtle/60 overflow-y-auto rounded-md border border-border-subtle bg-surface-elevated/95 p-2.5 shadow-xl backdrop-blur-md">
                <div class="flex flex-col gap-1 pr-3">
                  <span
                    class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Copy</span>
                  <Button
                    type="ghost"
                    size="xs"
                    label="Copy as MD"
                    truncateMiddle
                    class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogMarkdown(post);
                    }}>
                    {#snippet leading()}
                      <Copy class="size-3.5" />
                    {/snippet}
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    label="Copy as TXT"
                    truncateMiddle
                    class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogText(post);
                    }}>
                    {#snippet leading()}
                      <ScanText class="size-3.5" />
                    {/snippet}
                  </Button>

                  <Button
                    type="ghost"
                    size="xs"
                    label="Post URL"
                    truncateMiddle
                    class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                      activeBlogQuickActionsId = null;
                      copyBlogUrl(post);
                    }}>
                    {#snippet leading()}
                      <Link class="size-3.5" />
                    {/snippet}
                  </Button>

                  {#if post.id}
                    <Button
                      type="ghost"
                      size="xs"
                      label="Post ID"
                      truncateMiddle
                      class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                      onclick={() => {
                        activeBlogQuickActionsId = null;
                        copyBlogId(post);
                      }}>
                      {#snippet leading()}
                        <Hash class="size-3.5" />
                      {/snippet}
                    </Button>
                  {/if}
                </div>

                <div class="flex flex-col gap-2 pl-3 sm:contents">
                  <div class="flex flex-col gap-1 sm:px-3">
                    <span
                      class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                      >View</span>
                    <Button
                      type="ghost"
                      size="xs"
                      href="/api/v1/blog/{post.slug}?format=md"
                      label="View as MD"
                      truncateMiddle
                      class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                      onclick={() => (activeBlogQuickActionsId = null)}>
                      {#snippet leading()}
                        <i
                          class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                    </Button>

                    <Button
                      type="ghost"
                      size="xs"
                      href="/api/v1/blog/{post.slug}?format=text"
                      label="View as TXT"
                      truncateMiddle
                      class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                      onclick={() => (activeBlogQuickActionsId = null)}>
                      {#snippet leading()}
                        <TextAlignStart class="size-3.5" />
                      {/snippet}
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
                      label="Save as MD"
                      truncateMiddle
                      class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                      onclick={() => {
                        activeBlogQuickActionsId = null;
                        downloadBlogMarkdown(post);
                      }}>
                      {#snippet leading()}
                        <i
                          class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                          aria-hidden="true"></i>
                      {/snippet}
                    </Button>

                    <Button
                      type="ghost"
                      size="xs"
                      label="Save as TXT"
                      truncateMiddle
                      class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                      onclick={() => {
                        activeBlogQuickActionsId = null;
                        downloadBlogText(post);
                      }}>
                      {#snippet leading()}
                        <FileText class="size-3.5" />
                      {/snippet}
                    </Button>
                  </div>
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
            {@const isExpanded = expandedExcerptIds.has(post.id)}
            {@const isOverflowing = overflowingExcerptIds.has(post.id)}
            <div class="flex flex-col items-start gap-1">
              <p
                {@attach !isExpanded && observeExcerptOverflow(post.id)}
                class="text-xs leading-relaxed text-text-secondary {isExpanded ?
                  ''
                : 'line-clamp-2'}">
                {post.excerpt}
                {#if isOverflowing && isExpanded}
                  <button
                    type="button"
                    onclick={() => toggleExcerpt(post.id)}
                    class="ml-1 inline cursor-pointer text-xs font-normal whitespace-nowrap text-security underline hover:opacity-80 focus:outline-none">
                    Show less
                  </button>
                {/if}
              </p>
              {#if isOverflowing && !isExpanded}
                <button
                  type="button"
                  onclick={() => toggleExcerpt(post.id)}
                  class="inline-flex cursor-pointer text-xs font-normal whitespace-nowrap text-security underline hover:opacity-80 focus:outline-none">
                  Show more
                </button>
              {/if}
            </div>
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
          <Button
            href="/blog/{post.slug}"
            type="primary"
            size="sm"
            fullWidth>
            Read post
          </Button>
        </div>
      </div>
    </div>
  {/snippet}

  {#if activeSection === 'home'}
    <Section
      spacing="none"
      class="relative z-10 pt-4 pb-6 sm:pt-5 md:pt-6 md:pb-8">
      <PageContainer
        width="standard"
        class="flex flex-col gap-4 sm:gap-5">
        <div
          class="pointer-events-none absolute top-7.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-accent/10 blur-[80px] sm:top-9 md:top-10">
        </div>

        <div class="relative z-10 mx-auto w-full">
          <div
            use:staggerChildren
            class="stagger-children relative mt-8 flex w-full flex-col items-center justify-center rounded-md glass-card px-3 pt-0 pb-4 text-center sm:mt-10 sm:px-8 sm:pt-0 sm:pb-6">
            {#if avatar}
              <ImageWithSkeleton
                src={avatar}
                alt={name || author?.name || ''}
                referrerpolicy="no-referrer"
                variant="avatar"
                rounded="rounded-full"
                class="relative z-10 -mt-8 mb-1 h-20 w-20 border border-border-subtle/30 shadow-sm sm:-mt-12 sm:mb-2 sm:h-28 sm:w-28 dark:border-white/8"
                imgClass="object-top" />
            {/if}

            <h1
              class="relative z-10 max-w-full px-0 font-sans-title sm:px-2 {(
                avatar
              ) ?
                'mt-1.5 sm:mt-4'
              : 'pt-5'} text-xl font-extrabold tracking-tight text-text-primary sm:text-2xl md:text-3xl">
              {name}
            </h1>

            {#if headline}
              <p
                class="relative z-10 mt-1 max-w-lg font-sans-title text-xs leading-relaxed text-text-muted sm:mt-1.5 sm:text-sm">
                {headline}
              </p>
            {/if}

            {#if desc}
              <p
                class="relative z-10 mt-2 max-w-lg font-sans text-xs leading-relaxed text-text-secondary sm:mt-3 sm:text-sm">
                {desc}
              </p>
            {/if}

            {#if socials.length > 0}
              <div
                class="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-1 select-none sm:mt-5 sm:gap-1.5">
                {#each socials as item (item.url + item.platform)}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.platform}
                    title={item.platform}
                    class="flex size-7.5 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:size-8">
                    <BrandIcon
                      icon={item.icon}
                      class="text-sm leading-none sm:text-base" />
                  </a>
                {/each}
              </div>
            {/if}

            <div
              class="relative z-10 mt-3.5 flex w-full flex-col items-center gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:justify-center">
              <div
                class="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
                {#if data.cvExists}
                  <Button
                    type="primary"
                    tone="neutral"
                    size="xs"
                    href="/api/v1/cv?download=1"
                    download
                    onclick={handleCvDownload}
                    class="w-full sm:h-9 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm">
                    Download CV
                  </Button>
                {:else}
                  <Button
                    type="primary"
                    tone="neutral"
                    size="xs"
                    disabled
                    title="No CV document is available yet."
                    class="w-full sm:h-9 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm">
                    Download CV
                  </Button>
                {/if}

                <Button
                  type="secondary"
                  size="xs"
                  onclick={() => navigate('projects')}
                  class="w-full sm:h-9 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm">
                  Browse projects
                </Button>
              </div>

              <Button
                type="ghost"
                size="xs"
                onclick={() => navigate('contact')}
                class="w-auto sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
                Get in touch
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3
            class="mb-3 text-lg font-bold tracking-tight text-text-primary sm:mb-4">
            Top projects
          </h3>
          {#if recentProjects.length === 0}
            <EmptyState
              title="No projects yet"
              description="Check back soon for featured repositories." />
          {:else}
            <div class="mt-2 grid grid-cols-1 gap-3 sm:gap-4">
              {#each recentProjects as project (project.name)}
                {@render projectCard(project, 'h4', staticTag)}
              {/each}
            </div>
          {/if}
          {#if projects.length > 0}
            <div class="mt-3 flex justify-end sm:mt-4">
              <button
                onclick={() => navigate('projects')}
                class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-accent hover:underline">
                <span class="leading-none">View all projects</span>
                <ArrowRight
                  class="size-4 transition-transform select-none group-hover:translate-x-0.5" />
              </button>
            </div>
          {/if}
        </div>

        <div>
          <h3
            class="mb-3 text-lg font-bold tracking-tight text-text-primary sm:mb-4">
            Recent posts
          </h3>
          {#if posts.length === 0}
            <EmptyState
              title="No posts yet"
              description="Check back soon for new articles." />
          {:else}
            <div class="mt-2 grid grid-cols-1 gap-3 sm:gap-4">
              {#each recentPosts as post (post.id)}
                {@render blogPostCard(post, staticTag)}
              {/each}
            </div>
          {/if}
          {#if posts.length > 0}
            <div class="mt-4 flex justify-end">
              <button
                onclick={() => navigate('blog')}
                class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-accent hover:underline">
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
              class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card text-left">
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
              class="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              aria-label="View full CV including education and experience">
              <span class="leading-none">View full CV</span>
              <ArrowRight
                class="size-4 transition-transform select-none group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <div
          class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card bg-accent/5 text-left">
          <div
            class="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4">
            <div
              class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
              <div class="flex items-center gap-3 sm:block">
                <HandHeart
                  class="size-5 shrink-0 text-accent sm:mt-0.5 sm:size-6" />
                <h4 class="font-sans-title text-sm font-bold sm:hidden">
                  <ShinyText
                    text="Support Open Source Work"
                    color="var(--color-accent)"
                    shineColor="#ffffff"
                    speed={3} />
                </h4>
              </div>
              <div>
                <h4 class="hidden font-sans-title text-sm font-bold sm:block">
                  <ShinyText
                    text="Support Open Source Work"
                    color="var(--color-accent)"
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
          action={contactEmail ? `https://formsubmit.co/${contactEmail}` : '#'}
          method="POST"
          onsubmit={validateForm}
          class="flex w-full flex-col gap-2.5 rounded-md glass-card p-4 text-left sm:gap-3 sm:p-6"
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

          <div class="mt-2 flex items-center justify-between gap-2 select-none">
            <Button
              htmlType="button"
              type="outline"
              tone="critical"
              size="md"
              class="flex-1 sm:flex-initial"
              disabled={!canClearContactForm || isSubmittingMessage}
              onclick={clearContactForm}>
              <span
                >Clear<span class="hidden sm:inline">&nbsp;message</span></span>
            </Button>
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              class="flex-1 sm:flex-initial"
              disabled={isSubmittingMessage}
              isLoading={isSubmittingMessage}>
              {isSubmittingMessage ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        </form>
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
      class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
      <PageContainer width="standard">
        <div
          class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-text-primary">
              Curriculum Vitae
            </h1>
            <p class="mt-2 text-sm text-text-secondary">
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
              Download CV
            </Button>
          {:else}
            <Button
              type="primary"
              tone="neutral"
              size="md"
              disabled
              title="No CV document is available yet.">
              Download CV
            </Button>
          {/if}
        </div>

        <div class="mt-8">
          <h2 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
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
              class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card">
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

        <div class="mt-8">
          <h2 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
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
              class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card">
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

        <div class="mt-8">
          <h2 class="mb-4 text-lg font-bold tracking-tight text-text-primary">
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
      class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
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
              class="mb-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-muted transition-colors select-none hover:bg-surface-hover hover:text-brand-rss">
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
      class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
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
    class="mx-auto w-full max-w-full px-3 sm:px-6 md:w-[80%] lg:w-[50%] {(
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
        slug: 'share',
        avatarUrl: author?.avatar || ''
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
  avatarUrl={qrCodeDialogData?.avatarUrl || author?.avatar || ''}
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
