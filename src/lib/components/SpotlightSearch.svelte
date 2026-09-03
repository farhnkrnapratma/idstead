<script lang="ts">
  import {tick} from 'svelte';
  import {goto} from '$app/navigation';
  import {page} from '$app/state';
  import {
    Search,
    ArrowDownUp,
    CornerDownLeft,
    Command,
    FileText,
    RotateCw,
    SunMoon,
    Download,
    Copy,
    Link,
    FileCode,
    SquareText,
    ShieldCheck,
    Scale,
    FileLock,
    MessageSquare,
    FolderGit2,
    Compass,
    Sparkles,
    HeartHandshake,
    House,
    FolderOpen,
    Newspaper,
    FileUser,
    Send,
    X,
    Accessibility,
    Type,
    Languages,
    Rss,
    Code,
    RotateCcwClock,
    Trash,
    CaseSensitive,
    WholeWord,
    Regex
  } from '@lucide/svelte';
  import type {Project} from '$lib/types';
  import {portal} from '../utils/actions';
  import {cn} from '../utils/cn';
  import {decodeHtmlEntities} from '../utils/formatters';
  import {lockScroll} from '../utils/scroll';
  import Tooltip from './Tooltip.svelte';
  import ShareDialog from './ShareDialog.svelte';
  import Button from '../components/Button.svelte';
  import QrCodeDialog from './QrCodeDialog.svelte';
  import {themeStore} from '../stores/themeStore.svelte';
  import {toastStore} from '../stores/toastStore.svelte';
  import {a11yStore, type FontScale} from '../stores/a11yStore.svelte';
  import {
    contentFontStore,
    type ContentFont
  } from '../stores/contentFontStore.svelte';
  import {
    searchHistoryStore,
    type SearchHistoryEntry
  } from '../stores/searchHistoryStore.svelte';
  import {sanitizeInput} from '../utils/sanitizeInput';

  export type ItemCategory =
    'pages' | 'posts' | 'projects' | 'actions' | 'commands' | 'skills';

  export interface SpotlightItem {
    id: string;
    category: ItemCategory;
    title: string;
    subtitle?: string;
    url?: string;
    action?: () => void;
    tags?: string[];
    icon?: any;
    badge?: string;
    requiresArgs?: boolean;
    autocompleteQuery?: string;
  }

  interface LanguageSwitcher {
    slug: string;
    currentLanguage: string;
    availableLocales: string[];
  }

  const LANGUAGE_LABELS: Record<string, string> = {
    en: 'English',
    id: 'Bahasa Indonesia',
    ja: '日本語',
    zh: '简体中文',
    ko: '한국어'
  };

  interface Props {
    projects?: Project[];
    languageSwitcher?: LanguageSwitcher;
    class?: string;
    wrapperClass?: string;
    variant?: 'default' | 'expanded' | 'responsive';
  }

  let {
    projects = [],
    languageSwitcher,
    class: className = '',
    wrapperClass = '',
    variant = 'default'
  }: Props = $props();

  let isOpen = $state(false);
  let rawQuery = $state('');
  let isCaseSensitive = $state(false);
  let isWholeWord = $state(false);
  let isRegex = $state(false);
  let results = $state<SpotlightItem[]>([]);
  let activeIndex = $state(-1);
  let isLoading = $state(false);
  let showHelp = $state(false);
  let isShareOpen = $state(false);
  let isQrOpen = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLElement | null>(null);
  let helpDialogEl = $state<HTMLDivElement | null>(null);

  const SECTION_LABELS: Record<string, string> = {
    home: 'Home',
    blog: 'Blog',
    projects: 'Projects',
    contact: 'Contact',
    cv: 'CV',
    funding: 'Funding'
  };

  const CATEGORY_ICONS: Record<ItemCategory, typeof Search> = {
    commands: Command,
    posts: FileText,
    projects: FolderGit2,
    pages: Compass,
    actions: Sparkles,
    skills: Code
  };

  const ALL_ICON_COMPONENTS: Record<string, typeof Search> = {
    Search,
    ArrowDownUp,
    CornerDownLeft,
    Command,
    FileText,
    RotateCw,
    SunMoon,
    Download,
    Copy,
    Link,
    FileCode,
    SquareText,
    ShieldCheck,
    Scale,
    FileLock,
    MessageSquare,
    FolderGit2,
    Compass,
    Sparkles,
    HeartHandshake,
    House,
    FolderOpen,
    Newspaper,
    FileUser,
    Send,
    X,
    Accessibility,
    Type,
    Languages,
    Rss,
    Code,
    RotateCcwClock,
    Trash
  };

  const ICON_NAME_BY_COMPONENT = new Map<unknown, string>(
    Object.entries(ALL_ICON_COMPONENTS).map(([name, comp]) => [comp, name])
  );

  const activePageContext = $derived.by(() => {
    if (!isQrOpen && !isShareOpen) {
      return {
        title: '',
        url: '',
        slug: 'page',
        avatarUrl: '',
        isBlogPost: false
      };
    }

    const post = (page.data as any)?.post;
    const author = (page.data as any)?.author;
    const authorAvatar = (author?.avatar as string | undefined) ?? '';
    const authorName = (author?.name as string | undefined) ?? '';
    const currentUrl =
      typeof window !== 'undefined' ? window.location.href : page.url.href;

    if (post?.title) {
      return {
        title: post.title as string,
        url: currentUrl,
        slug: (post.slug as string) || 'blog-post',
        avatarUrl: authorAvatar,
        isBlogPost: true
      };
    }

    const hash = (
      typeof window !== 'undefined' ?
        window.location.hash.replace(/^#/, '')
      : (page.url.hash || '').replace(/^#/, '')).toLowerCase();

    if (hash && SECTION_LABELS[hash]) {
      const sectionLabel = SECTION_LABELS[hash];
      return {
        title: authorName ? `${sectionLabel} — ${authorName}` : sectionLabel,
        url: currentUrl,
        slug: hash,
        avatarUrl: authorAvatar,
        isBlogPost: false
      };
    }

    const docTitle =
      typeof document !== 'undefined' && document.title ? document.title
      : authorName ? `Portfolio — ${authorName}`
      : 'Portfolio';

    return {
      title: docTitle,
      url: currentUrl,
      slug: 'page',
      avatarUrl: authorAvatar,
      isBlogPost: false
    };
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  let searchAbortController: AbortController | null = null;

  interface HelpCommandSpec {
    command: string;
    argHint: string;
    description: string;
    validArgs: string[];
    actionQuery?: string;
  }

  const helpCommands: HelpCommandSpec[] = [
    {
      command: '/open',
      argHint: '[target]',
      description: 'Navigate to routes or search blog posts.',
      validArgs: [
        'home',
        'blog',
        'projects',
        'cv',
        'funding',
        'contact',
        'terms',
        'privacy',
        'security',
        'feedback',
        'feed',
        'api',
        'blog [slug]'
      ],
      actionQuery: '/open '
    },
    {
      command: '/theme',
      argHint: '[mode]',
      description: 'Switch color mode.',
      validArgs: ['dark', 'light', 'auto'],
      actionQuery: '/theme '
    },
    {
      command: '/font',
      argHint: '[style]',
      description: 'Change article reading typeface.',
      validArgs: ['sans', 'serif', 'mono'],
      actionQuery: '/font '
    },
    {
      command: '/copy',
      argHint: '[target]',
      description: 'Copy page URL, post ID, or markdown text.',
      validArgs: ['url', 'link', 'pid', 'md', 'txt'],
      actionQuery: '/copy '
    },
    {
      command: '/save',
      argHint: '[target]',
      description: 'Download CV PDF or export article file.',
      validArgs: ['cv', 'md', 'txt'],
      actionQuery: '/save '
    },
    {
      command: '/a11y',
      argHint: '[feature]',
      description: 'Configure contrast, motion, text scaling, or reset.',
      validArgs: [
        'high-contrast',
        'reduce-motion',
        'solid-surface',
        'focus-ring',
        'dyslexic-text',
        'text-size [scale]',
        'reset'
      ],
      actionQuery: '/a11y '
    },
    {
      command: '/translate',
      argHint: '[lang]',
      description:
        'Switch this blog post to another language (post pages only).',
      validArgs: ['en', 'id', 'ja', 'zh', 'ko'],
      actionQuery: '/translate '
    },
    {
      command: '/share',
      argHint: '',
      description: 'Share the current page.',
      validArgs: [],
      actionQuery: '/share'
    },
    {
      command: '/qr',
      argHint: '',
      description: 'Show a QR code for the current page.',
      validArgs: [],
      actionQuery: '/qr'
    },
    {
      command: '/refresh',
      argHint: '',
      description: 'Reload page.',
      validArgs: [],
      actionQuery: '/refresh'
    },
    {
      command: '/help',
      argHint: '',
      description: 'Show reference.',
      validArgs: [],
      actionQuery: '/help'
    }
  ];

  const defaultCommands: SpotlightItem[] = [
    {
      id: 'cmd-home',
      category: 'pages',
      title: '/home',
      subtitle: 'Navigate to Home page',
      url: '/',
      icon: Command,
      badge: 'Page'
    },
    {
      id: 'cmd-projects',
      category: 'pages',
      title: '/projects',
      subtitle: 'Browse showcase projects',
      url: '/#projects',
      icon: Command,
      badge: 'Section'
    },
    {
      id: 'cmd-blog',
      category: 'pages',
      title: '/blog',
      subtitle: 'Browse articles & write-ups',
      url: '/#blog',
      icon: Command,
      badge: 'Section'
    },
    {
      id: 'cmd-cv',
      category: 'pages',
      title: '/cv',
      subtitle: 'View Curriculum Vitae',
      url: '/#cv',
      icon: Command,
      badge: 'Section'
    },
    {
      id: 'cmd-funding',
      category: 'pages',
      title: '/funding',
      subtitle: 'Support open-source development',
      url: '/#funding',
      icon: Command,
      badge: 'Section'
    },
    {
      id: 'cmd-contact',
      category: 'pages',
      title: '/contact',
      subtitle: 'Send a message or get in touch',
      url: '/#contact',
      icon: Command,
      badge: 'Section'
    },
    {
      id: 'cmd-privacy',
      category: 'pages',
      title: '/privacy',
      subtitle: 'Privacy Policy & data practices',
      url: '/privacy',
      icon: Command,
      badge: 'Legal'
    },
    {
      id: 'cmd-terms',
      category: 'pages',
      title: '/terms',
      subtitle: 'Terms of Service',
      url: '/terms',
      icon: Command,
      badge: 'Legal'
    },
    {
      id: 'cmd-security',
      category: 'pages',
      title: '/security',
      subtitle: 'Security Policy & disclosures',
      url: '/security',
      icon: Command,
      badge: 'Security'
    },
    {
      id: 'cmd-feedback',
      category: 'pages',
      title: '/feedback',
      subtitle: 'Report an issue or suggestion',
      url: '/feedback',
      icon: Command,
      badge: 'Help'
    },
    {
      id: 'cmd-open',
      category: 'actions',
      title: '/open',
      subtitle: 'Navigate to pages or blog articles',
      requiresArgs: true,
      autocompleteQuery: '/open ',
      icon: Command,
      badge: 'Navigate'
    },
    {
      id: 'cmd-refresh',
      category: 'actions',
      title: '/refresh',
      subtitle: 'Reload the current page',
      action: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },
      icon: Command,
      badge: 'System'
    },
    {
      id: 'cmd-theme',
      category: 'actions',
      title: '/theme',
      subtitle: 'Switch appearance theme',
      requiresArgs: true,
      autocompleteQuery: '/theme ',
      icon: Command,
      badge: 'Theme'
    },
    {
      id: 'cmd-font',
      category: 'actions',
      title: '/font',
      subtitle: 'Switch reading content font',
      requiresArgs: true,
      autocompleteQuery: '/font ',
      icon: Command,
      badge: 'Appearance'
    },
    {
      id: 'cmd-a11y',
      category: 'actions',
      title: '/a11y',
      subtitle: 'Configure accessibility preferences',
      requiresArgs: true,
      autocompleteQuery: '/a11y ',
      icon: Command,
      badge: 'Accessibility'
    },
    {
      id: 'cmd-copy',
      category: 'actions',
      title: '/copy',
      subtitle: 'Copy page content or link to clipboard',
      requiresArgs: true,
      autocompleteQuery: '/copy ',
      icon: Command,
      badge: 'Action'
    },
    {
      id: 'cmd-save',
      category: 'actions',
      title: '/save',
      subtitle: 'Download files or export content',
      requiresArgs: true,
      autocompleteQuery: '/save ',
      icon: Command,
      badge: 'File'
    },
    {
      id: 'cmd-share',
      category: 'actions',
      title: '/share',
      subtitle: 'Share the current page',
      action: () => {
        isShareOpen = true;
      },
      icon: Command,
      badge: 'Share'
    },
    {
      id: 'cmd-qr',
      category: 'actions',
      title: '/qr',
      subtitle: 'Show a QR code for the current page',
      action: () => {
        isQrOpen = true;
      },
      icon: Command,
      badge: 'Share'
    },
    {
      id: 'cmd-help',
      category: 'actions',
      title: '/help',
      subtitle: 'Show slash commands & search guide',
      action: () => {
        showHelp = true;
      },
      icon: Command,
      badge: 'Help'
    }
  ];

  function fuzzyMatch(
    target: string,
    queryText: string
  ): {matched: boolean; score: number} {
    if (!target || !queryText) return {matched: false, score: 0};

    if (isRegex) {
      const re = compileRegexQuery(queryText);
      if (re && re.test(target)) {
        return {matched: true, score: 80};
      }
      return {matched: false, score: 0};
    }

    if (isWholeWord) {
      const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = isCaseSensitive ? '' : 'i';
      try {
        const re = new RegExp(`\\b${escaped}\\b`, flags);
        if (re.test(target)) {
          return {matched: true, score: 90};
        }
      } catch {}
      return {matched: false, score: 0};
    }

    const t = isCaseSensitive ? target : target.toLowerCase();
    const q = isCaseSensitive ? queryText : queryText.toLowerCase();

    if (t === q) return {matched: true, score: 100};
    if (t.startsWith(q)) return {matched: true, score: 80};
    if (t.includes(q)) return {matched: true, score: 60};

    let tIdx = 0;
    let qIdx = 0;
    let score = 0;
    let consecutive = 0;

    while (tIdx < t.length && qIdx < q.length) {
      if (t[tIdx] === q[qIdx]) {
        score += 10 + consecutive * 5;
        consecutive++;
        qIdx++;
      } else {
        consecutive = 0;
      }
      tIdx++;
    }

    if (qIdx === q.length) {
      return {matched: true, score};
    }

    return {matched: false, score: 0};
  }

  function compileRegexQuery(regexStr: string): RegExp | null {
    try {
      let pattern = regexStr;
      let flags = isCaseSensitive ? '' : 'i';
      if (regexStr.startsWith('/') && regexStr.lastIndexOf('/') > 0) {
        const lastSlash = regexStr.lastIndexOf('/');
        pattern = regexStr.substring(1, lastSlash);
        const customFlags = regexStr.substring(lastSlash + 1);
        if (customFlags) {
          flags = customFlags;
        }
      }
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }

  function getDynamicCommandItems(query: string): SpotlightItem[] {
    const q = query.trim().toLowerCase();
    if (!q.startsWith('/')) return [];

    const items: SpotlightItem[] = [];
    const root = q.split(/\s+/)[0];

    if (
      q.startsWith('/theme')
      || (root.length > 2 && '/theme'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const arg = parts[1] || '';
      if (
        !arg
        || arg === 'auto'
        || 'auto'.startsWith(arg)
        || arg === 'system'
      ) {
        items.push({
          id: 'dyn-theme-auto',
          category: 'actions',
          title: '/theme auto',
          subtitle: 'Switch appearance to System match',
          action: () => {
            themeStore.apply('auto');
            toastStore.show('Switched to system theme', 'success');
          },
          icon: SunMoon,
          badge: 'Theme'
        });
      }
      if (!arg || arg === 'dark' || 'dark'.startsWith(arg)) {
        items.push({
          id: 'dyn-theme-dark',
          category: 'actions',
          title: '/theme dark',
          subtitle: 'Switch appearance to Dark mode',
          action: () => {
            themeStore.apply('dark');
            toastStore.show('Switched to dark theme', 'success');
          },
          icon: SunMoon,
          badge: 'Theme'
        });
      }
      if (!arg || arg === 'light' || 'light'.startsWith(arg)) {
        items.push({
          id: 'dyn-theme-light',
          category: 'actions',
          title: '/theme light',
          subtitle: 'Switch appearance to Light mode',
          action: () => {
            themeStore.apply('light');
            toastStore.show('Switched to light theme', 'success');
          },
          icon: SunMoon,
          badge: 'Theme'
        });
      }
    }

    if (
      q.startsWith('/font')
      || (root.length > 2 && '/font'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const arg = parts[1] || '';
      if (!arg || arg === 'sans' || 'sans'.startsWith(arg)) {
        items.push({
          id: 'dyn-font-sans',
          category: 'actions',
          title: '/font sans',
          subtitle: 'Set reading font to Sans-serif (Google Sans)',
          action: () => {
            contentFontStore.setFont('sans');
            toastStore.show('Content font set to Sans-serif', 'success');
          },
          icon: Type,
          badge: 'Font'
        });
      }
      if (!arg || arg === 'serif' || 'serif'.startsWith(arg)) {
        items.push({
          id: 'dyn-font-serif',
          category: 'actions',
          title: '/font serif',
          subtitle: 'Set reading font to Serif (Source Serif 4)',
          action: () => {
            contentFontStore.setFont('serif');
            toastStore.show('Content font set to Serif', 'success');
          },
          icon: Type,
          badge: 'Font'
        });
      }
      if (!arg || arg === 'mono' || 'mono'.startsWith(arg)) {
        items.push({
          id: 'dyn-font-mono',
          category: 'actions',
          title: '/font mono',
          subtitle: 'Set reading font to Monospace (Google Sans Code)',
          action: () => {
            contentFontStore.setFont('mono');
            toastStore.show('Content font set to Monospace', 'success');
          },
          icon: Type,
          badge: 'Font'
        });
      }
    }

    if (
      q.startsWith('/a11y')
      || (root.length > 2 && '/a11y'.startsWith(root))
    ) {
      const a11yFeatures = [
        {
          key: 'reduce-motion',
          name: 'Reduce motion animations',
          toggle: () => a11yStore.toggleReduceMotion(),
          state: () => a11yStore.current.reduceMotion
        },
        {
          key: 'solid-surface',
          name: 'Solid card surfaces',
          toggle: () => a11yStore.toggleSolidSurfaces(),
          state: () => a11yStore.current.solidSurfaces
        },
        {
          key: 'high-contrast',
          name: 'High contrast mode',
          toggle: () => a11yStore.toggleHighContrast(),
          state: () => a11yStore.current.highContrast
        },
        {
          key: 'focus-ring',
          name: 'Enhanced focus indicator',
          toggle: () => a11yStore.toggleFocusHighlight(),
          state: () => a11yStore.current.focusHighlight
        },
        {
          key: 'dyslexic-text',
          name: 'OpenDyslexic reading typeface',
          toggle: () => a11yStore.toggleDyslexicFont(),
          state: () => a11yStore.current.dyslexicFont
        }
      ] as const;

      const parts = q.split(/\s+/);
      const subCmd = parts[1] || '';
      const val = parts[2] || '';

      for (const feat of a11yFeatures) {
        if (
          !subCmd
          || feat.key.includes(subCmd)
          || feat.name.toLowerCase().includes(subCmd)
        ) {
          const isCurrentlyOn = feat.state();
          let targetAction = feat.toggle;
          let actionLabel = `Toggle ${feat.name} (currently ${isCurrentlyOn ? 'ON' : 'OFF'})`;

          if (val === 'on') {
            targetAction = () => {
              if (!feat.state()) feat.toggle();
              toastStore.show(`${feat.name}: ON`, 'success');
            };
            actionLabel = `Turn ON ${feat.name}`;
          } else if (val === 'off') {
            targetAction = () => {
              if (feat.state()) feat.toggle();
              toastStore.show(`${feat.name}: OFF`, 'success');
            };
            actionLabel = `Turn OFF ${feat.name}`;
          }

          items.push({
            id: `dyn-a11y-${feat.key}`,
            category: 'actions',
            title: `/a11y ${feat.key}${val ? ` ${val}` : ''}`,
            subtitle: actionLabel,
            action: () => {
              targetAction();
              if (!val) {
                toastStore.show(
                  `${feat.name}: ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
                  'success'
                );
              }
            },
            icon: Accessibility,
            badge: 'Accessibility'
          });
        }
      }

      if (
        !subCmd
        || 'text-size'.includes(subCmd)
        || 'font-scale'.includes(subCmd)
        || 'size'.includes(subCmd)
      ) {
        const scales: FontScale[] = [100, 110, 120, 130, 140, 150];
        const parsedScale = parseInt(val.replace('%', ''), 10);

        if (scales.includes(parsedScale as FontScale)) {
          items.push({
            id: `dyn-a11y-scale-${parsedScale}`,
            category: 'actions',
            title: `/a11y text-size ${parsedScale}%`,
            subtitle: `Set text sizing scale to ${parsedScale}%`,
            action: () => {
              a11yStore.setFontScale(parsedScale as FontScale);
              toastStore.show(`Text scale set to ${parsedScale}%`, 'success');
            },
            icon: Accessibility,
            badge: 'Accessibility'
          });
        } else {
          for (const s of [100, 110, 120, 130, 140, 150] as FontScale[]) {
            if (!val || String(s).includes(val.replace('%', ''))) {
              items.push({
                id: `dyn-a11y-scale-${s}`,
                category: 'actions',
                title: `/a11y text-size ${s}%`,
                subtitle: `Set text scale to ${s}% (current: ${a11yStore.current.fontScale}%)`,
                action: () => {
                  a11yStore.setFontScale(s);
                  toastStore.show(`Text scale set to ${s}%`, 'success');
                },
                icon: Accessibility,
                badge: 'Accessibility'
              });
            }
          }
        }
      }

      if (!subCmd || 'reset'.includes(subCmd)) {
        items.push({
          id: 'dyn-a11y-reset',
          category: 'actions',
          title: '/a11y reset',
          subtitle: 'Reset all accessibility settings to defaults',
          action: () => {
            a11yStore.reset();
            toastStore.show(
              'Accessibility settings reset to default',
              'success'
            );
          },
          icon: Accessibility,
          badge: 'Accessibility'
        });
      }
    }

    if (
      q.startsWith('/open')
      || (root.length > 2 && '/open'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const sub = parts[1] || '';

      const openTargets = [
        {
          name: 'home',
          title: '/open home',
          subtitle: 'Navigate to Home page',
          url: '/',
          icon: House,
          badge: 'Page'
        },
        {
          name: 'blog',
          title: '/open blog',
          subtitle: 'Browse articles & write-ups section',
          url: '/#blog',
          icon: Newspaper,
          badge: 'Section'
        },
        {
          name: 'projects',
          title: '/open projects',
          subtitle: 'Navigate to Projects showcase',
          url: '/#projects',
          icon: FolderOpen,
          badge: 'Section'
        },
        {
          name: 'cv',
          title: '/open cv',
          subtitle: 'View Curriculum Vitae and experience',
          url: '/#cv',
          icon: FileUser,
          badge: 'Section'
        },
        {
          name: 'funding',
          title: '/open funding',
          subtitle: 'Support open-source development',
          url: '/#funding',
          icon: HeartHandshake,
          badge: 'Section'
        },
        {
          name: 'contact',
          title: '/open contact',
          subtitle: 'Send a message or get in touch',
          url: '/#contact',
          icon: Send,
          badge: 'Section'
        },
        {
          name: 'terms',
          title: '/open terms',
          subtitle: 'Terms of Service',
          url: '/terms',
          icon: Scale,
          badge: 'Legal'
        },
        {
          name: 'privacy',
          title: '/open privacy',
          subtitle: 'Privacy Policy and data practices',
          url: '/privacy',
          icon: FileLock,
          badge: 'Legal'
        },
        {
          name: 'security',
          title: '/open security',
          subtitle: 'Security Policy and vulnerability reporting',
          url: '/security',
          icon: ShieldCheck,
          badge: 'Security'
        },
        {
          name: 'feedback',
          title: '/open feedback',
          subtitle: 'Report an issue or suggest an improvement',
          url: '/feedback',
          icon: MessageSquare,
          badge: 'Help'
        },
        {
          name: 'feed',
          title: '/open feed',
          subtitle: 'Subscribe via RSS/Atom feed',
          url: '/atom.xml',
          icon: Rss,
          badge: 'Feed'
        },
        {
          name: 'api',
          title: '/open api',
          subtitle: 'Browse the public REST API docs',
          url: '/api/v1',
          icon: Code,
          badge: 'Developer'
        }
      ];

      for (const target of openTargets) {
        if (!sub || target.name.startsWith(sub) || target.name.includes(sub)) {
          items.push({
            id: `dyn-open-${target.name}`,
            category: 'actions',
            title: target.title,
            subtitle: target.subtitle,
            url: target.url,
            icon: target.icon,
            badge: target.badge
          });
        }
      }
    }

    if (
      q.startsWith('/copy')
      || (root.length > 2 && '/copy'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const arg = parts[1] || '';
      const pathname = page?.url?.pathname || '';
      const isBlogPage = pathname.startsWith('/blog/') && pathname.length > 6;
      const isLegalPage = ['/terms', '/privacy', '/security'].includes(
        pathname
      );
      const currentSlug =
        isBlogPage ?
          pathname.replace('/blog/', '').split('/')[0]
        : pathname.replace('/', '');

      if (!arg || 'url'.startsWith(arg) || 'link'.startsWith(arg)) {
        items.push({
          id: 'dyn-copy-url',
          category: 'actions',
          title: '/copy url',
          subtitle: 'Copy current page URL to clipboard',
          action: async () => {
            if (typeof window !== 'undefined') {
              await navigator.clipboard.writeText(window.location.href);
              toastStore.show('Page URL copied to clipboard', 'success');
            }
          },
          icon: Link,
          badge: 'Copy'
        });
      }

      if (
        isBlogPage
        && (!arg
          || 'pid'.startsWith(arg)
          || 'page-id'.startsWith(arg)
          || 'id'.startsWith(arg))
      ) {
        items.push({
          id: 'dyn-copy-pid',
          category: 'actions',
          title: '/copy pid',
          subtitle: `Copy blog post slug / ID ("${currentSlug}") to clipboard`,
          action: async () => {
            if (typeof window !== 'undefined') {
              await navigator.clipboard.writeText(currentSlug);
              toastStore.show(`Post ID copied: ${currentSlug}`, 'success');
            }
          },
          icon: FileText,
          badge: 'Copy'
        });
      }

      if (
        (isBlogPage || isLegalPage)
        && (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg))
      ) {
        items.push({
          id: 'dyn-copy-md',
          category: 'actions',
          title: '/copy md',
          subtitle: `Copy ${isBlogPage ? 'article' : 'page'} Markdown source to clipboard`,
          action: async () => {
            try {
              const type = isBlogPage ? 'blog' : 'legal';
              const res = await fetch(
                `/api/internal/raw?type=${type}&slug=${currentSlug}&format=md`
              );
              if (!res.ok) throw new Error();
              const text = await res.text();
              await navigator.clipboard.writeText(text);
              toastStore.show('Markdown copied to clipboard', 'success');
            } catch {
              toastStore.show('Failed to copy markdown', 'error');
            }
          },
          icon: FileCode,
          badge: 'Copy'
        });
      }

      if (
        (isBlogPage || isLegalPage)
        && (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg))
      ) {
        items.push({
          id: 'dyn-copy-txt',
          category: 'actions',
          title: '/copy txt',
          subtitle: `Copy ${isBlogPage ? 'article' : 'page'} Plaintext content to clipboard`,
          action: async () => {
            try {
              const type = isBlogPage ? 'blog' : 'legal';
              const res = await fetch(
                `/api/internal/raw?type=${type}&slug=${currentSlug}&format=text`
              );
              if (!res.ok) throw new Error();
              const text = await res.text();
              await navigator.clipboard.writeText(text);
              toastStore.show('Plaintext copied to clipboard', 'success');
            } catch {
              toastStore.show('Failed to copy plaintext', 'error');
            }
          },
          icon: SquareText,
          badge: 'Copy'
        });
      }
    }

    if (
      q.startsWith('/save')
      || (root.length > 2 && '/save'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const arg = parts[1] || '';
      const pathname = page?.url?.pathname || '';
      const isBlogPage = pathname.startsWith('/blog/') && pathname.length > 6;
      const currentSlug =
        isBlogPage ? pathname.replace('/blog/', '').split('/')[0] : '';

      if (!arg || 'cv'.startsWith(arg) || 'curriculum-vitae'.startsWith(arg)) {
        items.push({
          id: 'dyn-save-cv',
          category: 'actions',
          title: '/save cv',
          subtitle: 'Download official Curriculum Vitae (PDF)',
          url: '/api/v1/cv',
          icon: Download,
          badge: 'File'
        });
      }

      if (
        isBlogPage
        && (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg))
      ) {
        items.push({
          id: 'dyn-save-md',
          category: 'actions',
          title: '/save md',
          subtitle: 'Download article as Markdown (.md) file',
          action: async () => {
            try {
              const res = await fetch(
                `/api/internal/raw?type=blog&slug=${currentSlug}&format=md`
              );
              if (!res.ok) throw new Error();
              const text = await res.text();
              const blob = new Blob([text], {
                type: 'text/markdown;charset=utf-8'
              });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${currentSlug}.md`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
              toastStore.show(`Downloaded ${currentSlug}.md`, 'success');
            } catch {
              toastStore.show('Failed to download markdown', 'error');
            }
          },
          icon: Download,
          badge: 'File'
        });
      }

      if (
        isBlogPage
        && (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg))
      ) {
        items.push({
          id: 'dyn-save-txt',
          category: 'actions',
          title: '/save txt',
          subtitle: 'Download article as Plaintext (.txt) file',
          action: async () => {
            try {
              const res = await fetch(
                `/api/internal/raw?type=blog&slug=${currentSlug}&format=text`
              );
              if (!res.ok) throw new Error();
              const text = await res.text();
              const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${currentSlug}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
              toastStore.show(`Downloaded ${currentSlug}.txt`, 'success');
            } catch {
              toastStore.show('Failed to download plaintext', 'error');
            }
          },
          icon: Download,
          badge: 'File'
        });
      }
    }

    if (
      q.startsWith('/translate')
      || (root.length > 2 && '/translate'.startsWith(root))
    ) {
      const pathname = page?.url?.pathname || '';
      const isBlogPage = pathname.startsWith('/blog/') && pathname.length > 6;

      if (isBlogPage && languageSwitcher) {
        const parts = q.split(/\s+/);
        const arg = parts[1] || '';
        const options = ['en', ...languageSwitcher.availableLocales];

        for (const lang of options) {
          if (!arg || lang.startsWith(arg)) {
            items.push({
              id: `dyn-translate-${lang}`,
              category: 'actions',
              title: `/translate ${lang}`,
              subtitle: `Switch this post to ${LANGUAGE_LABELS[lang] ?? lang}`,
              url:
                lang === 'en' ?
                  `/blog/${languageSwitcher.slug}`
                : `/blog/${languageSwitcher.slug}?lang=${lang}`,
              icon: Languages,
              badge: 'Language'
            });
          }
        }
      }
    }

    return items;
  }

  function searchLocalItems(q: string): SpotlightItem[] {
    const cleanQ = q.trim();
    if (!cleanQ) return [];

    const isCommandQuery = cleanQ.startsWith('/');
    const isRegexQuery = isRegex;
    const compiledRegex = isRegexQuery ? compileRegexQuery(cleanQ) : null;

    const matchedItems: {item: SpotlightItem; score: number}[] = [];

    if (isCommandQuery) {
      const dynamicCmds = getDynamicCommandItems(cleanQ);
      for (const dyn of dynamicCmds) {
        if (
          !isRegexQuery
          || (compiledRegex
            && (compiledRegex.test(dyn.title)
              || (dyn.subtitle && compiledRegex.test(dyn.subtitle))))
        ) {
          matchedItems.push({item: dyn, score: 95});
        }
      }
    }

    for (const cmd of defaultCommands) {
      if (isCommandQuery) {
        const cmdName = cmd.title.toLowerCase();
        const queryLower = cleanQ.toLowerCase();
        if (cmdName.startsWith(queryLower) || cmdName.includes(queryLower)) {
          matchedItems.push({item: cmd, score: 90});
          continue;
        }
      }

      const matchTitle = fuzzyMatch(cmd.title, cleanQ);
      const matchSub =
        cmd.subtitle ?
          fuzzyMatch(cmd.subtitle, cleanQ)
        : {matched: false, score: 0};

      if (isRegexQuery) {
        if (
          compiledRegex
          && (compiledRegex.test(cmd.title)
            || (cmd.subtitle && compiledRegex.test(cmd.subtitle)))
        ) {
          matchedItems.push({item: cmd, score: 75});
          continue;
        }
      }

      if (matchTitle.matched || matchSub.matched) {
        const titleScore = matchTitle.matched ? matchTitle.score : 0;
        const subScore = matchSub.matched ? matchSub.score * 0.5 : 0;
        matchedItems.push({item: cmd, score: Math.max(titleScore, subScore)});
      }
    }

    for (const p of projects) {
      const matchName = fuzzyMatch(p.name, cleanQ);
      const matchDesc = fuzzyMatch(p.desc, cleanQ);
      const tagMatch = p.tags.some(t => fuzzyMatch(t, cleanQ).matched);

      let isMatch = matchName.matched || matchDesc.matched || tagMatch;
      let score = Math.max(
        matchName.matched ? matchName.score : 0,
        matchDesc.matched ? matchDesc.score * 0.5 : 0
      );

      if (isRegexQuery) {
        if (
          compiledRegex
          && (compiledRegex.test(p.name)
            || compiledRegex.test(p.desc)
            || p.tags.some(t => compiledRegex.test(t)))
        ) {
          isMatch = true;
          score = 70;
        }
      }

      if (isMatch) {
        matchedItems.push({
          item: {
            id: `proj-${p.name}`,
            category: 'projects',
            title: p.name,
            subtitle: p.desc,
            url: p.url,
            tags: p.tags.slice(0, 3),
            icon: FolderGit2,
            badge: 'Project'
          },
          score
        });
      }
    }

    return matchedItems
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const lenDiff = a.item.title.length - b.item.title.length;
        if (lenDiff !== 0) return lenDiff;
        return a.item.title.localeCompare(b.item.title);
      })
      .map(m => m.item);
  }

  async function runSearch(inputString: string) {
    const trimmed = inputString.trim();
    if (trimmed.length < 1) {
      searchAbortController?.abort();
      results = [];
      isLoading = false;
      activeIndex = -1;
      return;
    }

    searchAbortController?.abort();
    const controller = new AbortController();
    searchAbortController = controller;

    isLoading = true;

    const localMatches = searchLocalItems(trimmed);

    if (trimmed.length >= 2 && !trimmed.startsWith('/')) {
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}`,
          {signal: controller.signal}
        );
        const data = await res.json();
        if (controller.signal.aborted) return;
        const postResults: SpotlightItem[] = (data.data ?? []).map(
          (post: any) => ({
            id: `post-${post.url}`,
            category: 'posts' as const,
            title: post.title,
            subtitle: post.subtitle ?? 'Blog post',
            url: post.url,
            icon: FileText,
            badge: 'Post'
          })
        );

        const existingUrls = new Set(
          localMatches.map(m => m.url).filter(Boolean)
        );
        const uniquePostResults = postResults.filter(
          p => !existingUrls.has(p.url)
        );
        results = [...localMatches, ...uniquePostResults];
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        results = localMatches;
      }
    } else if (trimmed.startsWith('/open blog')) {
      const blogSubQuery = trimmed.replace('/open blog', '').trim();
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(blogSubQuery || 'a')}`,
          {signal: controller.signal}
        );
        const data = await res.json();
        if (controller.signal.aborted) return;
        const postResults: SpotlightItem[] = (data.data ?? []).map(
          (post: any) => ({
            id: `open-post-${post.url}`,
            category: 'posts' as const,
            title: `/open blog ${post.url.replace('/blog/', '')}`,
            subtitle: post.title,
            url: post.url,
            icon: FileText,
            badge: 'Post'
          })
        );
        results = [...localMatches, ...postResults];
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        results = localMatches;
      }
    } else {
      results = localMatches;
    }

    if (controller.signal.aborted) return;
    activeIndex = results.length > 0 ? 0 : -1;
    isLoading = false;
  }

  function handleInput() {
    if (showHelp) showHelp = false;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runSearch(rawQuery);
    }, 150);
  }

  function getHighlightChunks(
    text: string,
    query: string
  ): {text: string; match: boolean}[] {
    if (!text) return [];
    const trimmed = query.trim();
    if (!trimmed) return [{text, match: false}];

    if (isRegex) {
      try {
        let pattern = trimmed;
        let flags = isCaseSensitive ? 'g' : 'gi';
        if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
          const lastSlash = trimmed.lastIndexOf('/');
          pattern = trimmed.substring(1, lastSlash);
          const customFlags = trimmed.substring(lastSlash + 1);
          flags = customFlags.includes('g') ? customFlags : customFlags + 'g';
        }
        const regex = new RegExp(`(${pattern})`, flags);
        const parts = text.split(regex);
        return parts
          .filter(part => part.length > 0)
          .map(part => {
            const isMatch = new RegExp(
              `^(${pattern})$`,
              isCaseSensitive ? '' : 'i'
            ).test(part);
            return {text: part, match: isMatch};
          });
      } catch {
        return [{text, match: false}];
      }
    }

    const rawTokens = trimmed
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    if (rawTokens.length === 0) return [{text, match: false}];

    const searchTerms: string[] = [];
    for (const t of rawTokens) {
      const term = isCaseSensitive ? t : t.toLowerCase();
      if (!searchTerms.includes(term)) searchTerms.push(term);
      if (term.startsWith('/') && term.length > 1) {
        const stripped = term.slice(1);
        if (!searchTerms.includes(stripped)) searchTerms.push(stripped);
      }
    }

    const escapedTerms = searchTerms
      .filter(t => t.length > 0)
      .sort((a, b) => b.length - a.length)
      .map(t => {
        const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return isWholeWord ? `\\b${esc}\\b` : esc;
      });

    if (escapedTerms.length === 0) return [{text, match: false}];

    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`(${escapedTerms.join('|')})`, flags);
      const parts = text.split(regex);
      return parts
        .filter(part => part.length > 0)
        .map(part => {
          const comp = isCaseSensitive ? part : part.toLowerCase();
          const isMatch =
            isWholeWord ?
              escapedTerms.some(et =>
                new RegExp(`^${et}$`, isCaseSensitive ? '' : 'i').test(part)
              )
            : searchTerms.includes(comp);
          return {text: part, match: isMatch};
        });
    } catch {
      return [{text, match: false}];
    }
  }

  let previouslyFocusedElement = $state<HTMLElement | null>(null);

  function open(initialQuery = '') {
    if (typeof document !== 'undefined') {
      previouslyFocusedElement = document.activeElement as HTMLElement;
    }
    isOpen = true;
    showHelp = false;
    rawQuery = initialQuery;
    if (initialQuery) {
      runSearch(initialQuery);
    } else {
      results = [];
      activeIndex = -1;
    }
    tick().then(() => inputEl?.focus());
  }

  function close() {
    isOpen = false;
    showHelp = false;
    rawQuery = '';
    results = [];
    activeIndex = -1;
    if (previouslyFocusedElement) {
      tick().then(() => {
        previouslyFocusedElement?.focus();
        previouslyFocusedElement = null;
      });
    }
  }

  function select(item: SpotlightItem) {
    if (
      item.requiresArgs
      || (item.autocompleteQuery && !rawQuery.trim().endsWith(item.title))
    ) {
      rawQuery = item.autocompleteQuery || `${item.title} `;
      runSearch(rawQuery);
      activeIndex = 0;
      inputEl?.focus();
      return;
    }

    if (item.id === 'cmd-help' || item.title === '/help') {
      searchHistoryStore.record({
        id: item.id,
        category: item.category,
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        iconName: item.icon ? ICON_NAME_BY_COMPONENT.get(item.icon) : undefined
      });
      showHelp = true;
      rawQuery = '';
      results = [];
      activeIndex = -1;
      return;
    }

    searchHistoryStore.record({
      id: item.id,
      category: item.category,
      title: item.title,
      subtitle: item.subtitle,
      badge: item.badge,
      iconName: item.icon ? ICON_NAME_BY_COMPONENT.get(item.icon) : undefined
    });
    close();
    if (item.action) {
      item.action();
    } else if (item.url) {
      if (item.url.startsWith('http')) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      } else {
        goto(item.url);
      }
    }
  }

  function selectHistoryEntry(entry: SearchHistoryEntry) {
    rawQuery = entry.title;
    runSearch(rawQuery);
    activeIndex = 0;
    inputEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (showHelp) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        showHelp = false;
        tick().then(() => inputEl?.focus());
        return;
      }
      return;
    }

    const inHistoryMode =
      rawQuery.length === 0 && searchHistoryStore.current.length > 0;
    const navLength =
      inHistoryMode ? searchHistoryStore.current.length : flatItems.length;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        if (navLength > 0) {
          activeIndex = activeIndex < navLength - 1 ? activeIndex + 1 : 0;
          scrollActiveIntoView();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        if (navLength > 0) {
          activeIndex = activeIndex > 0 ? activeIndex - 1 : navLength - 1;
          scrollActiveIntoView();
        }
        break;
      }
      case 'Tab': {
        if (inHistoryMode) break;
        e.preventDefault();
        e.stopPropagation();
        const activeItem =
          activeIndex >= 0 ? flatItems[activeIndex] : flatItems[0];
        if (activeItem) {
          if (activeItem.requiresArgs) {
            rawQuery = activeItem.autocompleteQuery || `${activeItem.title} `;
            runSearch(rawQuery);
            activeIndex = 0;
          } else if (activeItem.title.startsWith('/')) {
            rawQuery = activeItem.title;
            runSearch(rawQuery);
            activeIndex = 0;
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        e.stopPropagation();
        if (inHistoryMode) {
          const entry =
            searchHistoryStore.current[activeIndex >= 0 ? activeIndex : 0];
          if (entry) selectHistoryEntry(entry);
        } else if (activeIndex >= 0 && flatItems[activeIndex]) {
          select(flatItems[activeIndex]);
        } else if (flatItems.length > 0) {
          select(flatItems[0]);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        e.stopPropagation();
        if (showHelp) {
          showHelp = false;
          inputEl?.focus();
        } else {
          close();
        }
        break;
      }
    }
  }

  function handleResultKeydown(e: KeyboardEvent, item: SpotlightItem) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(item);
    }
  }

  function handleHistoryKeydown(e: KeyboardEvent, entry: SearchHistoryEntry) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectHistoryEntry(entry);
    }
  }

  function scrollActiveIntoView() {
    if (!listEl || activeIndex < 0) return;
    const items = listEl.querySelectorAll('[data-result-item]');
    items[activeIndex]?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (showHelp && e.key === 'Escape') {
      e.preventDefault();
      showHelp = false;
      tick().then(() => inputEl?.focus());
      return;
    }
    if (isOpen && e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    const target = e.target as HTMLElement | null;
    const inInput =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')
      || Boolean(target?.isContentEditable);
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
      return;
    }
    if (!inInput && e.key === '/') {
      e.preventDefault();
      if (isOpen) {
        close();
      } else {
        open('/');
      }
    }
  }

  $effect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      return () => {
        unlock();
      };
    }
  });

  $effect(() => {
    if (showHelp) {
      tick().then(() => helpDialogEl?.focus());
    }
  });

  function escapeHtml(unsafe: string) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlight(text: string, q: string): string {
    const safeText = escapeHtml(text || '');
    const cleanQ = q.trim().replace(/^[/]+/, '');
    if (!cleanQ || cleanQ.length < 1) return safeText;
    const safeQ = escapeHtml(cleanQ);
    const escaped = safeQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safeText.replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<mark class="bg-copilot/20 text-copilot rounded-[2px] px-[1px] not-italic font-semibold">$1</mark>'
    );
  }

  let categorizedResults = $derived.by(() => {
    const groups: {
      category: ItemCategory;
      label: string;
      items: SpotlightItem[];
    }[] = [];
    const catMap: Record<
      ItemCategory,
      {label: string; items: SpotlightItem[]}
    > = {
      actions: {label: 'System Actions', items: []},
      pages: {label: 'Pages & Sections', items: []},
      posts: {label: 'Blog Posts', items: []},
      projects: {label: 'GitHub Projects', items: []},
      commands: {label: 'Commands', items: []},
      skills: {label: 'Skills & Tools', items: []}
    };

    for (const item of results) {
      catMap[item.category]?.items.push(item);
    }

    for (const [key, val] of Object.entries(catMap)) {
      if (val.items.length > 0) {
        groups.push({
          category: key as ItemCategory,
          label: val.label,
          items: val.items
        });
      }
    }

    return groups;
  });

  let flatItems = $derived.by(() => {
    return categorizedResults.flatMap(group => group.items);
  });

  let indexById = $derived.by(() => {
    return new Map(flatItems.map((item, i) => [item.id, i]));
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div
  class={cn(
    'group relative',
    variant === 'expanded' ? 'flex w-full' : 'inline-flex',
    wrapperClass
  )}>
  {#snippet triggerButton()}
    <button
      type="button"
      onclick={() => open()}
      class={cn(
        variant === 'expanded' ?
          'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm glass-button px-2.5 text-xs font-medium text-text-secondary hover:border-copilot/50 hover:text-copilot sm:h-9 sm:px-3'
        : 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-border-subtle bg-surface p-0 text-xs font-semibold text-text-secondary backdrop-blur-none transition-colors hover:border-copilot hover:bg-surface-hover hover:text-copilot sm:h-9 sm:w-9 lg:h-9 lg:w-auto lg:justify-between lg:gap-2 lg:px-3',
        className
      )}
      aria-label="Open spotlight search (Ctrl+K or /)">
      {#if variant === 'expanded'}
        <div class="flex min-w-0 items-center gap-2">
          <Search class="size-4 shrink-0" />
          <span class="truncate font-sans text-xs text-text-muted"
            >Search...</span>
        </div>
        <kbd
          class="inline-flex h-5 items-center justify-center rounded-sm border border-border-subtle/50 bg-surface-base/80 px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-text-secondary shadow-2xs">
          /
        </kbd>
      {:else}
        <div class="flex min-w-0 items-center gap-2">
          <Search class="size-4 shrink-0" />
          <span
            class="hidden truncate font-sans text-xs text-text-muted lg:inline"
            >Search...</span>
        </div>
        <div class="ml-1.5 hidden items-center gap-1 lg:flex">
          <kbd
            class="inline-flex h-5 items-center justify-center rounded-sm border border-border-subtle/50 bg-surface-base/80 px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-text-secondary shadow-2xs">
            Ctrl+K
          </kbd>
          <span class="text-xxs text-text-muted">or</span>
          <kbd
            class="inline-flex h-5 items-center justify-center rounded-sm border border-border-subtle/50 bg-surface-base/80 px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-text-secondary shadow-2xs">
            /
          </kbd>
        </div>
      {/if}
    </button>
  {/snippet}

  {#if variant === 'expanded'}
    {@render triggerButton()}
  {:else}
    <Tooltip
      content="Search (Ctrl+K or /)"
      placement="bottom"
      align="center"
      class="lg:hidden">
      {@render triggerButton()}
    </Tooltip>
  {/if}
</div>

{#if isOpen}
  <div
    use:portal
    class="fixed inset-0 z-99999 flex items-center justify-center overscroll-contain p-4">
    <button
      type="button"
      class="fixed inset-0 cursor-default touch-none bg-overlay/80 backdrop-blur-xs transition-opacity duration-200"
      aria-label="Close search"
      onwheel={e => e.preventDefault()}
      ontouchmove={e => e.preventDefault()}
      onclick={close}></button>

    <div
      class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-sm border-0 bg-surface-card text-text-primary shadow-xl backdrop-blur-md outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-white/8"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Command Palette & Search">
      <div
        class="flex items-center justify-between border-b border-border-subtle/40 px-4 py-2">
        <input
          bind:this={inputEl}
          bind:value={rawQuery}
          oninput={handleInput}
          onkeydown={handleKeydown}
          type="search"
          id="spotlight-search-input"
          name="q"
          spellcheck="false"
          autocomplete="off"
          placeholder="Search or type / for commands..."
          class="search-input min-w-0 flex-1 border-none! border-transparent! bg-transparent py-0! pt-0! pb-0! font-sans-title text-sm font-medium text-text-primary shadow-none! ring-0! ring-transparent! ring-offset-0! outline-none! [-webkit-box-shadow:none]! [-webkit-tap-highlight-color:transparent] placeholder:font-sans-title placeholder:font-normal placeholder:text-text-muted focus:border-none! focus:border-transparent! focus:shadow-none! focus:ring-0! focus:ring-transparent! focus:outline-none! focus-visible:border-none! focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:ring-transparent! focus-visible:outline-none! active:border-none! active:border-transparent! active:shadow-none! active:ring-0! active:ring-transparent! active:outline-none!"
          aria-label="Search query"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={activeIndex >= 0 ?
            `result-${activeIndex}`
          : undefined} />

        <div class="flex shrink-0 items-center gap-1 pl-2 select-none">
          <Button
            type="ghost"
            size="xs"
            class="flex size-6 cursor-pointer items-center justify-center rounded-sm p-0 transition-colors hover:bg-surface-hover"
            title="Match Case ({isCaseSensitive ? 'ON' : 'OFF'})"
            aria-label="Toggle Case Sensitivity"
            aria-pressed={isCaseSensitive}
            onclick={() => {
              isCaseSensitive = !isCaseSensitive;
              runSearch(rawQuery);
            }}>
            <CaseSensitive
              class={cn(
                'size-3.5 transition-colors',
                isCaseSensitive ? 'text-copilot' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>

          <Button
            type="ghost"
            size="xs"
            class="flex size-6 cursor-pointer items-center justify-center rounded-sm p-0 transition-colors hover:bg-surface-hover"
            title="Match Whole Word ({isWholeWord ? 'ON' : 'OFF'})"
            aria-label="Toggle Whole Word Search"
            aria-pressed={isWholeWord}
            onclick={() => {
              isWholeWord = !isWholeWord;
              runSearch(rawQuery);
            }}>
            <WholeWord
              class={cn(
                'size-3.5 transition-colors',
                isWholeWord ? 'text-copilot' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>

          <Button
            type="ghost"
            size="xs"
            class="flex size-6 cursor-pointer items-center justify-center rounded-sm p-0 transition-colors hover:bg-surface-hover"
            title="Use Regular Expression ({isRegex ? 'ON' : 'OFF'})"
            aria-label="Toggle Regular Expression Search"
            aria-pressed={isRegex}
            onclick={() => {
              isRegex = !isRegex;
              runSearch(rawQuery);
            }}>
            <Regex
              class={cn(
                'size-3.5 transition-colors',
                isRegex ? 'text-copilot' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>
        </div>
      </div>

      <div
        bind:this={listEl}
        class="min-h-0 flex-1 snap-y snap-mandatory scroll-py-1 overflow-y-auto overscroll-contain">
        {#if rawQuery.length === 0}
          {#if searchHistoryStore.current.length > 0}
            <div class="flex flex-col gap-0.5 px-3 pt-1.5 pb-2.5">
              <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
                <div
                  class="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase select-none">
                  <RotateCcwClock class="size-3.5 -translate-y-[1px]" />
                  <span>Recently used</span>
                </div>
                <Button
                  type="ghost"
                  size="xs"
                  aria-label="Clear recently used"
                  class="flex size-6 cursor-pointer items-center justify-center rounded-sm p-0 text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
                  onclick={() => searchHistoryStore.clear()}>
                  <X class="size-3.5" />
                </Button>
              </div>
              {#each searchHistoryStore.current as entry, idx (entry.id)}
                {@const isSlashCmd =
                  entry.title.startsWith('/')
                  || entry.category === 'commands'
                  || entry.category === 'actions'}
                <div
                  role="option"
                  tabindex="-1"
                  aria-selected={activeIndex === idx}
                  data-result-item
                  onclick={() => selectHistoryEntry(entry)}
                  onkeydown={e => handleHistoryKeydown(e, entry)}
                  onmouseenter={() => {
                    activeIndex = idx;
                  }}
                  class={cn(
                    'group flex w-full cursor-pointer snap-start items-center justify-between gap-3 rounded-sm px-1 py-1 transition-colors',
                    activeIndex === idx ?
                      'bg-copilot/10 dark:bg-copilot/20'
                    : 'hover:bg-surface-hover'
                  )}>
                  <div class="min-w-0 flex-1">
                    {#if entry.title.startsWith('/')}
                      <div class="truncate font-mono text-xs font-medium">
                        <span class="font-normal text-text-muted/60">/</span
                        ><span class="text-text-primary"
                          >{entry.title.slice(1)}</span>
                      </div>
                    {:else}
                      <div
                        class="truncate font-sans-title text-xs font-medium text-text-primary">
                        {entry.title}
                      </div>
                    {/if}
                    {#if entry.subtitle}
                      <div
                        class="mt-0.5 line-clamp-1 font-sans text-2xs leading-snug wrap-break-word text-text-secondary">
                        {entry.subtitle}
                      </div>
                    {/if}
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    {#if isSlashCmd}
                      <span
                        class={cn(
                          'inline-flex h-[18px] shrink-0 items-center justify-center rounded-sm border px-1 font-mono text-3xs font-medium select-none',
                          activeIndex === idx ?
                            'border-copilot/30 bg-copilot/25 text-copilot'
                          : 'border-border-subtle/60 bg-surface-elevated text-text-secondary'
                        )}>
                        <Command class="size-2.5" />
                      </span>
                    {/if}
                    {#if entry.badge}
                      <span
                        class={cn(
                          'inline-flex h-[18px] shrink-0 items-center rounded-sm border px-1.5 font-mono text-3xs font-medium select-none',
                          activeIndex === idx ?
                            'border-copilot/30 bg-copilot/25 text-copilot'
                          : 'border-border-subtle/60 bg-surface-elevated text-text-secondary'
                        )}>
                        {entry.badge}
                      </span>
                    {/if}
                    <Button
                      type="ghost"
                      size="xs"
                      aria-label="Remove {entry.title} from recently used"
                      class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm p-0 transition-colors hover:bg-[#FE4C25]/15"
                      onclick={e => {
                        e.stopPropagation();
                        searchHistoryStore.remove(entry.id);
                      }}>
                      <Trash class="size-3.5 text-[#FE4C25]" />
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="flex h-full flex-col items-center justify-center gap-1 px-4 text-center select-none">
              <p class="font-sans-title text-xs font-medium text-text-muted">
                Search or run any commands
              </p>
              <p class="font-sans-title text-2xs text-text-muted">
                Type <span class="font-mono text-copilot">/</span> for commands,
                or
                <span class="font-mono text-copilot">/help</span> for the guide
              </p>
            </div>
          {/if}
        {:else if isLoading && results.length === 0}
          <div class="space-y-2 p-3">
            {#each [1, 2, 3] as placeholderId (placeholderId)}
              <div
                class="flex animate-pulse items-center gap-3 rounded-sm border border-border-subtle bg-surface-hover p-2.5 select-none">
                <div class="size-4 shrink-0 rounded-sm bg-border-default"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 w-2/5 rounded bg-border-default"></div>
                  <div class="h-2.5 w-3/5 rounded bg-border-subtle"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else if results.length === 0}
          <div
            class="flex h-full flex-col items-center justify-center px-4 text-center select-none">
            <p class="font-sans-title text-xs font-medium text-text-muted">
              No results found
            </p>
          </div>
        {:else}
          <ul
            id="search-results"
            role="listbox"
            aria-label="Search results"
            class="scrollbar-none pt-1 pb-2.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {#each categorizedResults as group (group.category)}
              <li class="px-4 pt-2 pb-0.5 select-none">
                <span
                  class="font-sans-title text-xxs font-bold tracking-wider text-text-muted uppercase">
                  {group.label}
                </span>
              </li>
              {#each group.items as item (item.id)}
                {@const globalIdx = indexById.get(item.id) ?? -1}
                {@const isSlashCmd =
                  item.title.startsWith('/')
                  || item.category === 'commands'
                  || item.category === 'actions'}
                <li
                  id="result-{globalIdx}"
                  role="option"
                  tabindex="-1"
                  aria-selected={activeIndex === globalIdx}
                  data-result-item
                  onclick={() => select(item)}
                  onkeydown={e => handleResultKeydown(e, item)}
                  onmouseenter={() => {
                    activeIndex = globalIdx;
                  }}
                  class="group mx-2.5 flex cursor-pointer snap-start items-center justify-between gap-3 rounded-sm px-1.5 py-1 transition-colors {(
                    activeIndex === globalIdx
                  ) ?
                    'bg-copilot/10 text-text-primary dark:bg-copilot/20'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}">
                  <div class="min-w-0 flex-1 flex-col">
                    {#if item.title.startsWith('/')}
                      <span class="font-mono text-xs font-medium">
                        {#each getHighlightChunks(item.title, rawQuery) as chunk, cIdx (cIdx)}
                          {#if chunk.text === '/'}
                            <span class="font-normal text-text-muted/60"
                              >/</span>
                          {:else if chunk.text.startsWith('/')}
                            <span class="font-normal text-text-muted/60">/</span
                            ><span
                              class={chunk.match ?
                                'font-semibold text-copilot'
                              : 'text-text-primary'}
                              >{chunk.text.slice(1)}</span>
                          {:else}
                            <span
                              class={chunk.match ?
                                'font-semibold text-copilot'
                              : 'text-text-primary'}>{chunk.text}</span>
                          {/if}
                        {/each}
                      </span>
                    {:else}
                      <span
                        class="font-sans-title text-xs font-medium text-text-primary">
                        {#each getHighlightChunks(item.title, rawQuery) as chunk, cIdx (cIdx)}
                          <span
                            class={chunk.match ?
                              'font-semibold text-copilot'
                            : ''}>{chunk.text}</span>
                        {/each}
                      </span>
                    {/if}

                    {#if item.subtitle}
                      <span
                        class="mt-0.5 line-clamp-1 font-sans text-2xs leading-snug wrap-break-word text-text-secondary">
                        {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                          {#if chunk.match}
                            <span class="font-semibold text-copilot"
                              >{chunk.text}</span>
                          {:else}
                            <span>{chunk.text}</span>
                          {/if}
                        {/each}
                      </span>
                    {/if}
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    {#if isSlashCmd}
                      <span
                        class="inline-flex h-[18px] shrink-0 items-center justify-center rounded-sm border px-1 font-mono text-3xs font-medium select-none {(
                          activeIndex === globalIdx
                        ) ?
                          'border-copilot/30 bg-copilot/25 text-copilot'
                        : 'border-border-subtle/60 bg-surface-elevated text-text-secondary'}">
                        <Command class="size-2.5" />
                      </span>
                    {/if}
                    {#if item.badge}
                      <span
                        class="inline-flex h-[18px] shrink-0 items-center rounded-sm border px-1.5 font-mono text-3xs font-medium select-none {(
                          activeIndex === globalIdx
                        ) ?
                          'border-copilot/30 bg-copilot/25 text-copilot'
                        : 'border-border-subtle/60 bg-surface-elevated text-text-secondary'}">
                        {item.badge}
                      </span>
                    {/if}
                  </div>
                </li>
              {/each}
            {/each}
          </ul>
        {/if}
      </div>

      <div
        class="hidden flex-none items-center justify-between gap-2 border-t border-border-subtle/60 px-3.5 py-2 text-2xs select-none sm:flex">
        <div
          class="flex min-w-0 flex-1 items-center font-sans-title text-2xs font-medium text-text-muted">
          {#if isLoading}
            <span>Searching…</span>
          {:else}
            <span
              >{results.length} result{results.length === 1 ? '' : 's'}</span>
          {/if}
        </div>
        <div
          class="flex shrink-0 items-center gap-2.5 font-sans-title text-2xs font-medium text-text-muted">
          <span class="flex items-center gap-1 font-sans-title">
            <kbd
              class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
              <ArrowDownUp
                class="size-9"
                strokeWidth={3} />
            </kbd>
            <span class="hidden sm:inline">Navigate</span>
          </span>
          <span class="flex items-center gap-1 font-sans-title">
            <kbd
              class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
              <CornerDownLeft
                class="size-9"
                strokeWidth={3} />
            </kbd>
            <span class="hidden sm:inline">Execute</span>
          </span>
          <span class="flex items-center gap-1 font-sans-title">
            <kbd
              class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 font-sans-title text-2xs font-medium text-text-muted dark:border-white/8">
              esc
            </kbd>
            <span class="hidden sm:inline">Close</span>
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showHelp}
  <div
    use:portal
    class="fixed inset-0 z-100000 flex items-center justify-center overscroll-contain p-4">
    <button
      type="button"
      class="fixed inset-0 cursor-default touch-none bg-overlay/80 backdrop-blur-xs transition-opacity duration-200"
      aria-label="Close reference guide"
      onclick={() => {
        showHelp = false;
        tick().then(() => inputEl?.focus());
      }}></button>

    <div
      bind:this={helpDialogEl}
      class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-sm border-0 bg-surface-card text-text-primary shadow-xl backdrop-blur-md outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-white/8"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Commands & Search Reference Guide">
      <div
        class="flex items-center justify-between border-b border-border-subtle/40 px-4 py-2.5">
        <div class="flex items-center gap-2">
          <Compass class="size-4 text-copilot" />
          <span
            class="font-sans-title text-xs font-bold tracking-wide text-text-primary uppercase select-none">
            Command & Search Reference
          </span>
        </div>
        <button
          type="button"
          onclick={() => {
            showHelp = false;
            tick().then(() => inputEl?.focus());
          }}
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
          aria-label="Close guide">
          <X class="size-3.5" />
        </button>
      </div>

      <div class="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs">
        <div class="space-y-0.5">
          {#each helpCommands as cmd (cmd.command)}
            <button
              type="button"
              onclick={() => {
                showHelp = false;
                if (cmd.command === '/refresh') {
                  if (typeof window !== 'undefined') window.location.reload();
                } else {
                  rawQuery = cmd.actionQuery || cmd.command;
                  runSearch(rawQuery);
                  tick().then(() => inputEl?.focus());
                }
              }}
              class="flex w-full cursor-pointer flex-col gap-1 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-hover/70 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center gap-2 font-mono text-2xs">
                  <span class="font-bold text-copilot">{cmd.command}</span>
                  {#if cmd.argHint}
                    <span class="text-text-muted">{cmd.argHint}</span>
                  {/if}
                </div>
                <p class="font-sans text-2xs text-text-secondary">
                  {cmd.description}
                </p>
              </div>
              {#if cmd.validArgs.length > 0}
                <div
                  class="flex flex-wrap items-center gap-1.5 font-mono text-3xs sm:max-w-xs sm:justify-end">
                  {#each cmd.validArgs as arg (arg)}
                    <span
                      class={arg.includes('[slug]') || arg.includes('[scale]') ?
                        'font-medium text-copilot'
                      : 'text-text-muted'}>
                      {arg}
                    </span>
                  {/each}
                </div>
              {/if}
            </button>
          {/each}
        </div>

        <div class="space-y-1.5">
          <div class="px-1">
            <span
              class="font-sans-title text-2xs font-bold tracking-wider text-text-muted uppercase">
              Search Filters & Toggles
            </span>
          </div>
          <div class="space-y-0.5 text-2xs">
            <div
              class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <CaseSensitive class="size-3.5 shrink-0 text-copilot" />
                <span class="font-medium text-text-primary">Match Case</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >— Case-sensitive search toggle</span>
              </div>
              <span class="font-mono text-3xs text-copilot">Aa button</span>
            </div>
            <div
              class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <WholeWord class="size-3.5 shrink-0 text-copilot" />
                <span class="font-medium text-text-primary">Whole Word</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >— Match exact whole words</span>
              </div>
              <span class="font-mono text-3xs text-copilot">ab button</span>
            </div>
            <div
              class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <Regex class="size-3.5 shrink-0 text-copilot" />
                <span class="font-medium text-text-primary">Regex Mode</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >— Regular expression pattern matching</span>
              </div>
              <span class="font-mono text-3xs text-copilot">svelte|react</span>
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="px-1">
            <span
              class="font-sans-title text-2xs font-bold tracking-wider text-text-muted uppercase">
              Keyboard Shortcuts
            </span>
          </div>
          <div class="grid grid-cols-2 grid-rows-2 gap-1.5 font-mono text-3xs">
            <div
              class="flex items-center justify-between rounded-sm px-2 py-1 transition-colors hover:bg-surface-hover/70">
              <span class="font-sans text-text-secondary">Toggle</span>
              <div class="flex items-center justify-between gap-1">
                <kbd
                  class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 font-sans-title text-2xs font-medium text-text-secondary dark:border-white/8"
                  >Ctrl+K</kbd>
                or
                <kbd
                  class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 font-sans-title text-2xs font-medium text-text-secondary dark:border-white/8"
                  >/</kbd>
              </div>
            </div>
            <div
              class="flex items-center justify-between rounded-sm px-2 py-1 transition-colors hover:bg-surface-hover/70">
              <span class="font-sans text-text-secondary">Navigate</span>
              <kbd
                class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-secondary dark:border-white/8"
                ><ArrowDownUp
                  class="size-9"
                  strokeWidth={3} /></kbd>
            </div>
            <div
              class="flex items-center justify-between rounded-sm px-2 py-1 transition-colors hover:bg-surface-hover/70">
              <span class="font-sans text-text-secondary">Complete</span>
              <kbd
                class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 font-sans-title text-2xs font-medium text-text-secondary dark:border-white/8"
                >Tab</kbd>
            </div>
            <div
              class="flex items-center justify-between rounded-sm px-2 py-1 transition-colors hover:bg-surface-hover/70">
              <span class="font-sans text-text-secondary">Execute</span>
              <kbd
                class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-secondary dark:border-white/8"
                ><CornerDownLeft
                  class="size-9"
                  strokeWidth={3} /></kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<ShareDialog
  bind:isOpen={isShareOpen}
  title={activePageContext.isBlogPost ? 'Share this Article' : (
    'Share this Page'
  )}
  articleTitle={activePageContext.title}
  url={activePageContext.url}
  showEmail
  onClose={() => (isShareOpen = false)}
  onOpenQr={() => (isQrOpen = true)} />

<QrCodeDialog
  bind:isOpen={isQrOpen}
  title={activePageContext.title}
  url={activePageContext.url}
  slug={activePageContext.slug}
  avatarUrl={activePageContext.avatarUrl}
  onClose={() => (isQrOpen = false)} />

<style>
  @reference "../../routes/global.css";

  .search-input::-webkit-search-cancel-button,
  .search-input::-webkit-search-decoration,
  .search-input::-webkit-search-results-button,
  .search-input::-webkit-search-results-decoration {
    @apply hidden appearance-none;
  }
</style>
