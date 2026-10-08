<script lang="ts">
  import MailingDialog from './MailingDialog.svelte';
  import {
    parseMailingCommand,
    type MailingCommand,
    type MailingAction
  } from '#lib/mailing.ts';
  let mailingRequest = $state<MailingCommand | null>(null);
  import {SvelteMap, SvelteSet} from 'svelte/reactivity';
  import {tick, untrack} from 'svelte';
  import {goto} from '$app/navigation';
  import {page} from '$app/state';
  import {
    Search,
    Mail,
    HandHeart,
    ArrowDownUp,
    CornerDownLeft,
    SquareTerminal,
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
    MessageSquarePlus,
    FolderGit2,
    FolderGit,
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
    Rss,
    Code,
    CodeXml,
    LogOut,
    Power,
    CaseSensitive,
    WholeWord,
    Regex,
    BookOpenText,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Save,
    FingerprintPattern,
    SquareArrowRightExit,
    Printer,
    Cookie,
    SquareCode,
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
    Braces,
    Share2,
    QrCode,
    Keyboard,
    HelpCircle,
    Quote,
    StepBack,
    ArrowUpFromLine,
    StepForward,
    ArrowDownFromLine,
    MessageSquareWarning,
    MessageCircle,
    ScrollText,
    ShieldUser,
    Lock,
    AtSign,
    Workflow,
    Bot,
    PersonStanding,
    Rocket
  } from '@lucide/svelte';
  import type {Project} from '#lib/types.ts';
  import {portal} from '../utils/actions';
  import {cn} from '../utils/cn';
  import ShortcutBadge from './ShortcutBadge.svelte';
  import CommandSectionHeading from './CommandSectionHeading.svelte';
  import {SHORTCUT_SECTIONS, commandSection} from '#lib/shortcutCatalog.ts';
  import {shortcutStore} from '../stores/shortcutStore.svelte';
  import {
    CATALOG_KEY,
    COMMAND_SHORTCUTS,
    isTextEntryTarget
  } from '#lib/shortcuts.ts';
  import {lockScroll, scrollToTop, scrollToBottom} from '../utils/scroll';
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
  import {codeBlockPrefsStore} from '../stores/codeBlockPrefsStore.svelte';
  import {
    refreshCodeBlockPrefs,
    type CodeColorScheme
  } from '../utils/codeBlocks';
  import {consentStore} from '../stores/consentStore.svelte';
  import {readingModeStore} from '../stores/readingModeStore.svelte';

  export type ItemCategory =
    | 'pages'
    | 'posts'
    | 'projects'
    | 'actions'
    | 'commands'
    | 'skills'
    | 'social'
    | 'contact'
    | 'funding';

  export interface SpotlightItem {
    id: string;
    category: ItemCategory;
    title: string;
    subtitle?: string;
    description?: string;
    url?: string;
    action?: () => void;
    icon?: any;
    badge?: string;
    shortcut?: string;
    requiresArgs?: boolean;
    validArgs?: string[];
    autocompleteQuery?: string;
    author?: string;
    slug?: string;
    tags?: string[];
    date?: string;
    snippet?: string;
    topics?: string[];
    meta?: Record<string, unknown>;
  }

  interface Props {
    projects?: Project[];
    class?: string;
    wrapperClass?: string;
    variant?: 'default' | 'expanded' | 'responsive' | 'icon';
  }

  let {
    projects = [],
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
  const SECTION_PAGE_SIZE = 5;
  let linkItems = $state<SpotlightItem[] | null>(null);
  let postResults = $state<SpotlightItem[]>([]);
  let postsHasMore = $state(false);
  let postsQuery = '';
  let sectionPages = $state<Record<string, number>>({});
  let activeIndex = $state(-1);
  let isLoading = $state(false);
  let showHelp = $state(false);
  let helpActiveIndex = $state(-1);
  let isShareOpen = $state(false);
  let isQrOpen = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLElement | null>(null);
  let helpDialogEl = $state<HTMLDivElement | null>(null);
  let visualViewportHeight = $state<number | null>(null);
  let visualViewportTop = $state<number | null>(null);

  const SECTION_LABELS: Record<string, string> = {
    home: 'Home',
    blog: 'Blog',
    projects: 'Projects',
    contact: 'Contact',
    cv: 'CV',
    funding: 'Funding'
  };

  const CATEGORY_ICONS: Record<ItemCategory, typeof Search> = {
    commands: SquareTerminal,
    posts: Quote,
    projects: FolderOpen,
    pages: Compass,
    actions: Sparkles,
    skills: CodeXml,
    social: AtSign,
    contact: Mail,
    funding: HandHeart
  };

  const ALL_ICON_COMPONENTS: Record<string, typeof Search> = {
    Search,
    ArrowDownUp,
    CornerDownLeft,
    Command: SquareTerminal,
    SquareTerminal,
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
    MessageSquarePlus,
    FolderGit2,
    FolderGit,
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
    Rss,
    Code,
    CodeXml,
    LogOut,
    Power,
    CaseSensitive,
    BookOpenText,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Save,
    FingerprintPattern,
    SquareArrowRightExit,
    Printer,
    Cookie,
    SquareCode,
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
    Braces,
    Share2,
    QrCode,
    Keyboard,
    HelpCircle,
    Quote,
    StepBack,
    ArrowUpFromLine,
    StepForward,
    ArrowDownFromLine,
    MessageSquareWarning,
    MessageCircle,
    ScrollText,
    ShieldUser,
    Lock,
    AtSign,
    Workflow,
    Bot,
    PersonStanding,
    Rocket
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
    icon: typeof Search;
  }

  interface HelpCategory {
    id: string;
    label: string;
    icon: typeof Search;
    commands: HelpCommandSpec[];
  }

  const helpCommandCategories: HelpCategory[] = [
    {
      id: 'pages',
      label: 'Pages & Sections',
      icon: Compass,
      commands: [
        {
          command: '/goto',
          argHint: '[target]',
          description: 'Jump to specific page, section, or post.',
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
          actionQuery: '/goto ',
          icon: Rocket
        },
        {
          command: '/home',
          argHint: '',
          description: 'Navigate to the home section.',
          validArgs: [],
          actionQuery: '/home',
          icon: House
        },
        {
          command: '/blog',
          argHint: '',
          description: 'View published blog articles and posts.',
          validArgs: [],
          actionQuery: '/blog',
          icon: Quote
        },
        {
          command: '/projects',
          argHint: '',
          description: 'Browse featured projects and repositories.',
          validArgs: [],
          actionQuery: '/projects',
          icon: FolderOpen
        },
        {
          command: '/cv',
          argHint: '',
          description: 'View curriculum vitae and work experience.',
          validArgs: [],
          actionQuery: '/cv',
          icon: FileUser
        },
        {
          command: '/funding',
          argHint: '',
          description: 'Support open source work and development.',
          validArgs: [],
          actionQuery: '/funding',
          icon: HeartHandshake
        },
        {
          command: '/contact',
          argHint: '',
          description: 'Send a message or contact details.',
          validArgs: [],
          actionQuery: '/contact',
          icon: AtSign
        },
        {
          command: '/back',
          argHint: '',
          description: 'Navigate back to the previous page.',
          validArgs: [],
          actionQuery: '/back',
          icon: MoveLeft
        },
        {
          command: '/forward',
          argHint: '',
          description: 'Navigate forward to the next page.',
          validArgs: [],
          actionQuery: '/forward',
          icon: MoveRight
        },
        {
          command: '/top',
          argHint: '',
          description: 'Scroll to the top of page.',
          validArgs: [],
          actionQuery: '/top',
          icon: MoveUp
        },
        {
          command: '/bottom',
          argHint: '',
          description: 'Scroll to the bottom of page.',
          validArgs: [],
          actionQuery: '/bottom',
          icon: MoveDown
        }
      ]
    },
    {
      id: 'actions',
      label: 'System actions',
      icon: Sparkles,
      commands: [
        {
          command: '/theme',
          argHint: '[mode]',
          description: 'Switch between light, dark, or system theme.',
          validArgs: ['dark', 'light', 'auto'],
          actionQuery: '/theme ',
          icon: SunMoon
        },
        {
          command: '/font',
          argHint: '[style]',
          description: 'Change font style for article reading.',
          validArgs: ['sans', 'serif', 'mono'],
          actionQuery: '/font ',
          icon: CaseSensitive
        },
        {
          command: '/read',
          argHint: '',
          description: 'Toggle distraction-free reading mode for articles.',
          validArgs: [],
          actionQuery: '/read',
          icon: BookOpenText
        },
        {
          command: '/code',
          argHint: '[option]',
          description: 'Configure code block formatting and theme.',
          validArgs: ['wrap', 'lines', 'clean', 'theme'],
          actionQuery: '/code ',
          icon: CodeXml
        },
        {
          command: '/a11y',
          argHint: '[feature]',
          description: 'Configure accessibility and display preferences.',
          validArgs: [
            'high-contrast',
            'reduce-motion',
            'solid-surface',
            'focus-ring',
            'dyslexic-text',
            'text-size [scale]',
            'reset'
          ],
          actionQuery: '/a11y ',
          icon: PersonStanding
        },
        {
          command: '/copy',
          argHint: '[target]',
          description: 'Copy page link, identifier, or content.',
          validArgs: ['url', 'link', 'pid', 'md', 'txt'],
          actionQuery: '/copy ',
          icon: Copy
        },
        {
          command: '/save',
          argHint: '[target]',
          description: 'Download resume or export article file.',
          validArgs: ['cv', 'md', 'txt'],
          actionQuery: '/save ',
          icon: Save
        },
        {
          command: '/share',
          argHint: '',
          description: 'Open share dialog for current page.',
          validArgs: [],
          actionQuery: '/share',
          icon: Share2
        },
        {
          command: '/qr',
          argHint: '',
          description: 'Display QR code for current page.',
          validArgs: [],
          actionQuery: '/qr',
          icon: QrCode
        },
        {
          command: '/print',
          argHint: '',
          description: 'Print current page or export PDF.',
          validArgs: [],
          actionQuery: '/print',
          icon: Printer
        },
        {
          command: '/cookies',
          argHint: '',
          description: 'Manage cookie preferences and consent settings.',
          validArgs: [],
          actionQuery: '/cookies',
          icon: Cookie
        },
        {
          command: '/api',
          argHint: '',
          description: 'Open developer REST API documentation.',
          validArgs: [],
          actionQuery: '/api',
          icon: Braces
        },
        {
          command: '/rss',
          argHint: '',
          description: 'Open RSS and Atom web feed.',
          validArgs: [],
          actionQuery: '/rss',
          icon: Rss
        },
        {
          command: '/sitemap',
          argHint: '',
          description: 'Open website sitemap XML document.',
          validArgs: [],
          actionQuery: '/sitemap',
          icon: Workflow
        },
        {
          command: '/llms',
          argHint: '',
          description: 'Open LLM context guide for assistants.',
          validArgs: [],
          actionQuery: '/llms',
          icon: Bot
        },
        {
          command: '/security',
          argHint: '',
          description: 'View security policy and vulnerability guidelines.',
          validArgs: [],
          actionQuery: '/security',
          icon: Lock
        },
        {
          command: '/privacy',
          argHint: '',
          description: 'Read privacy policy and data practices.',
          validArgs: [],
          actionQuery: '/privacy',
          icon: ShieldUser
        },
        {
          command: '/terms',
          argHint: '',
          description: 'Read terms and conditions agreement.',
          validArgs: [],
          actionQuery: '/terms',
          icon: ScrollText
        },
        {
          command: '/mailing',
          argHint: '[subscribe/unsubscribe] <email>',
          description:
            'Subscribe or request an unsubscribe confirmation email. Omit the email to open a form.',
          validArgs: ['subscribe [email]', 'unsubscribe [email]'],
          icon: Mail,
          actionQuery: '/mailing '
        },
        {
          command: '/feedback',
          argHint: '',
          description: 'Send feedback or report an issue.',
          validArgs: [],
          actionQuery: '/feedback',
          icon: MessageSquareWarning
        },
        {
          command: '/refresh',
          argHint: '',
          description: 'Reload the current web page.',
          validArgs: [],
          actionQuery: '/refresh',
          icon: RotateCw
        },
        {
          command: '/keyboard',
          argHint: '',
          description: 'Open keyboard shortcuts catalog.',
          validArgs: [],
          actionQuery: '/keyboard',
          icon: Keyboard
        },
        {
          command: '/help',
          argHint: '',
          description: 'Show command and shortcut reference guide.',
          validArgs: [],
          actionQuery: '/help',
          icon: HelpCircle
        },
        {
          command: '/exit',
          argHint: '',
          description: 'Close command palette or browser tab.',
          validArgs: [],
          actionQuery: '/exit',
          icon: LogOut
        }
      ]
    }
  ];

  const helpCategories = SHORTCUT_SECTIONS.map(section => ({
    ...section,
    commands: helpCommandCategories
      .flatMap(category => category.commands)
      .filter(command => commandSection(command.command) === section.id)
  })).filter(section => section.commands.length > 0);

  const helpCmdIndexMap = new SvelteMap<string, number>();
  let helpCmdIdxCounter = 0;
  for (const cat of helpCategories) {
    for (const cmd of cat.commands) {
      helpCmdIndexMap.set(cmd.command, helpCmdIdxCounter++);
    }
  }

  const defaultCommands: SpotlightItem[] = [
    {
      id: 'cmd-home',
      category: 'pages',
      title: '/home',
      subtitle: 'Navigate to the home page.',
      url: '/',
      icon: House,
      badge: 'Page'
    },
    {
      id: 'cmd-projects',
      category: 'pages',
      title: '/projects',
      subtitle: 'Browse featured projects and repositories.',
      url: '/#projects',
      icon: FolderOpen,
      badge: 'Section'
    },
    {
      id: 'cmd-blog',
      category: 'pages',
      title: '/blog',
      subtitle: 'View published blog articles and posts.',
      url: '/#blog',
      icon: Quote,
      badge: 'Section'
    },
    {
      id: 'cmd-cv',
      category: 'pages',
      title: '/cv',
      subtitle: 'View curriculum vitae and work experience.',
      url: '/#cv',
      icon: FileUser,
      badge: 'Section'
    },
    {
      id: 'cmd-funding',
      category: 'pages',
      title: '/funding',
      subtitle: 'Support open source work and development.',
      url: '/#funding',
      icon: HeartHandshake,
      badge: 'Section'
    },
    {
      id: 'cmd-contact',
      category: 'pages',
      title: '/contact',
      subtitle: 'Send a message or contact details.',
      url: '/#contact',
      icon: AtSign,
      badge: 'Section'
    },
    {
      id: 'cmd-privacy',
      category: 'pages',
      title: '/privacy',
      subtitle: 'Read privacy policy and data practices.',
      url: '/privacy',
      icon: ShieldUser,
      badge: 'Legal'
    },
    {
      id: 'cmd-terms',
      category: 'pages',
      title: '/terms',
      subtitle: 'Read terms and conditions agreement.',
      url: '/terms',
      icon: ScrollText,
      badge: 'Legal'
    },
    {
      id: 'cmd-security',
      category: 'pages',
      title: '/security',
      subtitle: 'View security policy and vulnerability guidelines.',
      url: '/security',
      icon: Lock,
      badge: 'Security'
    },
    {
      id: 'cmd-feedback',
      category: 'pages',
      title: '/feedback',
      subtitle: 'Send feedback or report an issue.',
      url: '/feedback',
      icon: MessageSquareWarning,
      badge: 'Help'
    },
    {
      id: 'cmd-goto',
      category: 'actions',
      title: '/goto',
      subtitle: 'Jump to specific page, section, or post.',
      requiresArgs: true,
      autocompleteQuery: '/goto ',
      icon: Rocket,
      badge: 'Navigation'
    },
    {
      id: 'cmd-refresh',
      category: 'actions',
      title: '/refresh',
      subtitle: 'Reload the current web page.',
      action: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },
      icon: RotateCw,
      badge: 'System'
    },
    {
      id: 'cmd-theme',
      category: 'actions',
      title: '/theme',
      subtitle: 'Switch between light, dark, or system theme.',
      requiresArgs: true,
      autocompleteQuery: '/theme ',
      icon: SunMoon,
      badge: 'Theme'
    },
    {
      id: 'cmd-font',
      category: 'actions',
      title: '/font',
      subtitle: 'Change font style for article reading.',
      requiresArgs: true,
      autocompleteQuery: '/font ',
      icon: CaseSensitive,
      badge: 'Appearance'
    },
    {
      id: 'cmd-code',
      category: 'actions',
      title: '/code',
      subtitle: 'Configure code block formatting and theme.',
      requiresArgs: true,
      autocompleteQuery: '/code ',
      icon: CodeXml,
      badge: 'Code'
    },
    {
      id: 'cmd-a11y',
      category: 'actions',
      title: '/a11y',
      subtitle: 'Configure accessibility and display preferences.',
      requiresArgs: true,
      autocompleteQuery: '/a11y ',
      icon: PersonStanding,
      badge: 'Accessibility'
    },
    {
      id: 'cmd-copy',
      category: 'actions',
      title: '/copy',
      subtitle: 'Copy page link, identifier, or content.',
      requiresArgs: true,
      autocompleteQuery: '/copy ',
      icon: Copy,
      badge: 'Action'
    },
    {
      id: 'cmd-save',
      category: 'actions',
      title: '/save',
      subtitle: 'Download resume or export article file.',
      requiresArgs: true,
      autocompleteQuery: '/save ',
      icon: Save,
      badge: 'File'
    },
    {
      id: 'cmd-back',
      category: 'actions',
      title: '/back',
      subtitle: 'Navigate back to the previous page.',
      action: () => {
        close();
        if (typeof window !== 'undefined') {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            toastStore.show('No previous page in history', 'info');
          }
        }
      },
      icon: MoveLeft,
      badge: 'Navigation'
    },
    {
      id: 'cmd-forward',
      category: 'actions',
      title: '/forward',
      subtitle: 'Navigate forward to the next page.',
      action: () => {
        close();
        if (typeof window !== 'undefined') {
          window.history.forward();
        }
      },
      icon: MoveRight,
      badge: 'Navigation'
    },
    {
      id: 'cmd-top',
      category: 'actions',
      title: '/top',
      subtitle: 'Scroll to the top of page.',
      action: () => {
        close();
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            scrollToTop('smooth');
            toastStore.show('Scrolled to top of page', 'info');
          }, 50);
        }
      },
      icon: MoveUp,
      badge: 'Navigation'
    },
    {
      id: 'cmd-bottom',
      category: 'actions',
      title: '/bottom',
      subtitle: 'Scroll to the bottom of page.',
      action: () => {
        close();
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            scrollToBottom('smooth');
            toastStore.show('Scrolled to bottom of page', 'info');
          }, 50);
        }
      },
      icon: MoveDown,
      badge: 'Navigation'
    },
    {
      id: 'cmd-print',
      category: 'actions',
      title: '/print',
      subtitle: 'Print current page or export PDF.',
      action: () => {
        close();
        if (typeof window !== 'undefined') {
          setTimeout(() => window.print(), 150);
        }
      },
      icon: Printer,
      badge: 'System'
    },
    {
      id: 'cmd-cookies',
      category: 'actions',
      title: '/cookies',
      subtitle: 'Manage cookie preferences and consent settings.',
      action: () => {
        close();
        consentStore.openCustomizeModal();
      },
      icon: Cookie,
      badge: 'Privacy'
    },
    {
      id: 'cmd-rss',
      category: 'pages',
      title: '/rss',
      subtitle: 'Open RSS and Atom web feed.',
      url: '/atom.xml',
      icon: Rss,
      badge: 'Feed'
    },
    {
      id: 'cmd-llms',
      category: 'pages',
      title: '/llms',
      subtitle: 'Open LLM context guide for assistants.',
      url: '/llms.txt',
      icon: Bot,
      badge: 'AI'
    },
    {
      id: 'cmd-sitemap',
      category: 'pages',
      title: '/sitemap',
      subtitle: 'Open website sitemap XML document.',
      url: '/sitemap.xml',
      icon: Workflow,
      badge: 'System'
    },
    {
      id: 'cmd-api',
      category: 'pages',
      title: '/api',
      subtitle: 'Open developer REST API documentation.',
      url: '/api/v1/docs',
      icon: Braces,
      badge: 'API'
    },
    {
      id: 'cmd-mailing',
      category: 'actions',
      title: '/mailing',
      subtitle: 'Subscribe or unsubscribe by email.',
      requiresArgs: true,
      autocompleteQuery: '/mailing ',
      validArgs: ['subscribe', 'unsubscribe'],
      icon: Mail,
      badge: 'Mailing'
    },
    {
      id: 'cmd-share',
      category: 'actions',
      title: '/share',
      subtitle: 'Open share dialog for current page.',
      action: () => {
        isShareOpen = true;
      },
      icon: Share2,
      badge: 'Share'
    },
    {
      id: 'cmd-qr',
      category: 'actions',
      title: '/qr',
      subtitle: 'Display QR code for current page.',
      action: () => {
        isQrOpen = true;
      },
      icon: QrCode,
      badge: 'Share'
    },
    {
      id: 'cmd-exit',
      category: 'actions',
      title: '/exit',
      subtitle: 'Close command palette or browser tab.',
      action: () => {
        if (typeof window !== 'undefined') {
          window.close();
          window.location.href = 'about:blank';
        }
      },
      icon: LogOut,
      badge: 'System'
    },
    {
      id: 'cmd-keyboard',
      category: 'actions',
      title: '/keyboard',
      subtitle: 'Open keyboard shortcuts catalog.',
      action: () => {
        showHelp = false;
        close();
        shortcutStore.catalogOpen = true;
      },
      icon: Keyboard,
      badge: 'Help'
    },
    {
      id: 'cmd-help',
      category: 'actions',
      title: '/help',
      subtitle: 'Show command and shortcut reference guide.',
      action: () => {
        showHelp = true;
      },
      icon: HelpCircle,
      badge: 'Help'
    },
    {
      id: 'cmd-read',
      category: 'actions',
      title: '/read',
      subtitle: 'Toggle distraction-free reading mode for articles.',
      action: () => {
        if (page.url.pathname.startsWith('/blog/')) {
          readingModeStore.toggle();
          close();
        } else {
          toastStore.show('Reading mode is only available on blog posts');
          close();
        }
      },
      icon: BookOpenText,
      badge: 'Reading'
    }
  ];

  function applyContentFont(font: ContentFont, label: string) {
    if (contentFontStore.locked) {
      toastStore.show(
        'Reading font is locked while the dyslexic-friendly font is on',
        'info'
      );
      return;
    }
    contentFontStore.setFont(font);
    toastStore.show(`Content font set to ${label}`, 'success');
  }

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
      root === '/mailing'
      || (root.length > 2 && '/mailing'.startsWith(root))
    ) {
      const parsed = parseMailingCommand(query);
      const argument = q.split(/\s+/)[1] ?? '';
      const actions: MailingAction[] = ['subscribe', 'unsubscribe'];
      for (const action of actions) {
        if (parsed ? parsed.action !== action : !action.startsWith(argument))
          continue;
        const email = parsed?.email ?? '';
        items.push({
          id: `dyn-mailing-${action}`,
          category: 'actions',
          title: `/mailing ${action}${email ? ` ${email}` : ''}`,
          subtitle:
            action === 'subscribe' ?
              'Confirm your subscription by email.'
            : 'Receive a link to confirm unsubscribing.',
          action: () => {
            void tick().then(() => {
              mailingRequest = {action, email};
            });
          },
          icon: Mail,
          badge: 'Mailing'
        });
      }
      return items;
    }

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
          subtitle: 'Match theme to system settings.',
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
          subtitle: 'Switch to dark color theme.',
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
          subtitle: 'Switch to light color theme.',
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
          subtitle: 'Use clean sans serif font.',
          action: () => applyContentFont('sans', 'Sans-serif'),
          icon: CaseSensitive,
          badge: 'Font'
        });
      }
      if (!arg || arg === 'serif' || 'serif'.startsWith(arg)) {
        items.push({
          id: 'dyn-font-serif',
          category: 'actions',
          title: '/font serif',
          subtitle: 'Use classic serif reading font.',
          action: () => applyContentFont('serif', 'Serif'),
          icon: CaseSensitive,
          badge: 'Font'
        });
      }
      if (!arg || arg === 'mono' || 'mono'.startsWith(arg)) {
        items.push({
          id: 'dyn-font-mono',
          category: 'actions',
          title: '/font mono',
          subtitle: 'Use modern monospace coding font.',
          action: () => applyContentFont('mono', 'Monospace'),
          icon: CaseSensitive,
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
          subtitle: 'Toggle reduced animations and motion.',
          toggle: () => a11yStore.toggleReduceMotion(),
          state: () => a11yStore.current.reduceMotion
        },
        {
          key: 'solid-surface',
          name: 'Solid card surfaces',
          subtitle: 'Toggle solid background surfaces mode.',
          toggle: () => a11yStore.toggleSolidSurfaces(),
          state: () => a11yStore.current.solidSurfaces
        },
        {
          key: 'high-contrast',
          name: 'High contrast mode',
          subtitle: 'Toggle high contrast visual mode.',
          toggle: () => a11yStore.toggleHighContrast(),
          state: () => a11yStore.current.highContrast
        },
        {
          key: 'focus-ring',
          name: 'Enhanced focus indicator',
          subtitle: 'Toggle visible keyboard focus outline.',
          toggle: () => a11yStore.toggleFocusHighlight(),
          state: () => a11yStore.current.focusHighlight
        },
        {
          key: 'dyslexic-text',
          name: 'Dyslexic-friendly font',
          subtitle: 'Switch the whole site to Lexend.',
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

          if (val === 'on') {
            targetAction = () => {
              if (!feat.state()) feat.toggle();
              toastStore.show(`${feat.name}: ON`, 'success');
            };
          } else if (val === 'off') {
            targetAction = () => {
              if (feat.state()) feat.toggle();
              toastStore.show(`${feat.name}: OFF`, 'success');
            };
          }

          items.push({
            id: `dyn-a11y-${feat.key}`,
            category: 'actions',
            title: `/a11y ${feat.key}${val ? `${val}` : ''}`,
            subtitle: feat.subtitle,
            action: () => {
              targetAction();
              if (!val) {
                toastStore.show(
                  `${feat.name}: ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
                  'success'
                );
              }
            },
            icon: PersonStanding,
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
            subtitle: 'Adjust text size scaling level.',
            action: () => {
              a11yStore.setFontScale(parsedScale as FontScale);
              toastStore.show(`Text scale set to ${parsedScale}%`, 'success');
            },
            icon: PersonStanding,
            badge: 'Accessibility'
          });
        } else {
          for (const s of [100, 110, 120, 130, 140, 150] as FontScale[]) {
            if (!val || String(s).includes(val.replace('%', ''))) {
              items.push({
                id: `dyn-a11y-scale-${s}`,
                category: 'actions',
                title: `/a11y text-size ${s}%`,
                subtitle: 'Adjust text size scaling level.',
                action: () => {
                  a11yStore.setFontScale(s);
                  toastStore.show(`Text scale set to ${s}%`, 'success');
                },
                icon: PersonStanding,
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
          subtitle: 'Reset all accessibility preferences.',
          action: () => {
            a11yStore.reset();
            toastStore.show(
              'Accessibility settings reset to default',
              'success'
            );
          },
          icon: PersonStanding,
          badge: 'Accessibility'
        });
      }
    }

    if (
      q.startsWith('/goto')
      || (root.length > 2 && '/goto'.startsWith(root))
    ) {
      const parts = q.split(/\s+/);
      const sub = parts[1] || '';

      const openTargets = [
        {
          name: 'home',
          title: '/goto home',
          subtitle: 'Navigate to the main home page.',
          url: '/',
          icon: House,
          badge: 'Page'
        },
        {
          name: 'blog',
          title: '/goto blog',
          subtitle: 'Read latest articles and posts.',
          url: '/#blog',
          icon: Quote,
          badge: 'Section'
        },
        {
          name: 'projects',
          title: '/goto projects',
          subtitle: 'Explore featured projects and creations.',
          url: '/#projects',
          icon: FolderOpen,
          badge: 'Section'
        },
        {
          name: 'cv',
          title: '/goto cv',
          subtitle: 'View resume and work experience.',
          url: '/#cv',
          icon: FileUser,
          badge: 'Section'
        },
        {
          name: 'funding',
          title: '/goto funding',
          subtitle: 'Support projects and open development.',
          url: '/#funding',
          icon: HeartHandshake,
          badge: 'Section'
        },
        {
          name: 'contact',
          title: '/goto contact',
          subtitle: 'Send a message or connect.',
          url: '/#contact',
          icon: AtSign,
          badge: 'Section'
        },
        {
          name: 'terms',
          title: '/goto terms',
          subtitle: 'Read terms and conditions agreement.',
          url: '/terms',
          icon: ScrollText,
          badge: 'Legal'
        },
        {
          name: 'privacy',
          title: '/goto privacy',
          subtitle: 'Read privacy policy and practices.',
          url: '/privacy',
          icon: ShieldUser,
          badge: 'Legal'
        },
        {
          name: 'security',
          title: '/goto security',
          subtitle: 'View security policy and guidelines.',
          url: '/security',
          icon: Lock,
          badge: 'Security'
        },
        {
          name: 'feedback',
          title: '/goto feedback',
          subtitle: 'Send feedback and report issues.',
          url: '/feedback',
          icon: MessageSquareWarning,
          badge: 'Help'
        },
        {
          name: 'feed',
          title: '/goto feed',
          subtitle: 'Open RSS and Atom feed.',
          url: '/atom.xml',
          icon: Rss,
          badge: 'Feed'
        },
        {
          name: 'api',
          title: '/goto api',
          subtitle: 'Open developer API documentation.',
          url: '/api/v1/docs',
          icon: Braces,
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
          subtitle: 'Copy web page address link.',
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
        !arg
        || 'pid'.startsWith(arg)
        || 'page-id'.startsWith(arg)
        || 'id'.startsWith(arg)
      ) {
        items.push({
          id: 'dyn-copy-pid',
          category: 'actions',
          title: '/copy pid',
          subtitle: 'Copy current blog post identifier.',
          action: async () => {
            if (!isBlogPage || !currentSlug) {
              toastStore.show(
                "Command '/copy pid' is only available on blog post pages.",
                'warning'
              );
              return;
            }
            if (typeof window !== 'undefined') {
              await navigator.clipboard.writeText(currentSlug);
              toastStore.show(`Post ID copied: ${currentSlug}`, 'success');
            }
          },
          icon: FileText,
          badge: 'Copy'
        });
      }

      if (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg)) {
        items.push({
          id: 'dyn-copy-md',
          category: 'actions',
          title: '/copy md',
          subtitle: 'Copy article as markdown text.',
          action: async () => {
            if (!isBlogPage && !isLegalPage) {
              toastStore.show(
                "Command '/copy md' is only available on blog post or legal pages.",
                'warning'
              );
              return;
            }
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

      if (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg)) {
        items.push({
          id: 'dyn-copy-txt',
          category: 'actions',
          title: '/copy txt',
          subtitle: 'Copy article as plain text.',
          action: async () => {
            if (!isBlogPage && !isLegalPage) {
              toastStore.show(
                "Command '/copy txt' is only available on blog post or legal pages.",
                'warning'
              );
              return;
            }
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
          subtitle: 'Download resume document as PDF.',
          url: '/api/v1/cv',
          icon: Save,
          badge: 'File'
        });
      }

      if (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg)) {
        items.push({
          id: 'dyn-save-md',
          category: 'actions',
          title: '/save md',
          subtitle: 'Download article as markdown file.',
          action: async () => {
            if (!isBlogPage || !currentSlug) {
              toastStore.show(
                "Command '/save md' is only available on blog post pages.",
                'warning'
              );
              return;
            }
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
          icon: Save,
          badge: 'File'
        });
      }

      if (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg)) {
        items.push({
          id: 'dyn-save-txt',
          category: 'actions',
          title: '/save txt',
          subtitle: 'Download article as text file.',
          action: async () => {
            if (!isBlogPage || !currentSlug) {
              toastStore.show(
                "Command '/save txt' is only available on blog post pages.",
                'warning'
              );
              return;
            }
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
          icon: Save,
          badge: 'File'
        });
      }
    }

    if (
      q.startsWith('/code')
      || (root.length > 2 && '/code'.startsWith(root))
    ) {
      const parts = q.trim().split(/\s+/);
      const arg = (parts[1] || '').toLowerCase();
      const subArg = (parts[2] || '').toLowerCase();

      const booleanOptions = [
        {
          key: 'wrap',
          name: 'wrap',
          label: 'Code wrap',
          current: () => codeBlockPrefsStore.current.wrap,
          toggle: () => codeBlockPrefsStore.toggleWrap(),
          set: (val: boolean) => codeBlockPrefsStore.setWrap(val)
        },
        {
          key: 'lines',
          name: 'lines',
          label: 'Code line numbers',
          current: () => codeBlockPrefsStore.current.lineNumbers,
          toggle: () => codeBlockPrefsStore.toggleLineNumbers(),
          set: (val: boolean) => codeBlockPrefsStore.setLineNumbers(val)
        },
        {
          key: 'clean',
          name: 'clean',
          label: 'Code clean mode',
          current: () => codeBlockPrefsStore.current.minimal,
          toggle: () => codeBlockPrefsStore.toggleClean(),
          set: (val: boolean) => codeBlockPrefsStore.setClean(val)
        }
      ];

      for (const boolOpt of booleanOptions) {
        if (!arg || boolOpt.key.startsWith(arg)) {
          if (!subArg) {
            items.push({
              id: `dyn-code-${boolOpt.key}`,
              category: 'actions',
              title: `/code ${boolOpt.key}`,
              subtitle: `Toggle ${boolOpt.name} for code blocks.`,
              action: () => {
                boolOpt.toggle();
                refreshCodeBlockPrefs();
                toastStore.show(
                  `${boolOpt.label} ${boolOpt.current() ? 'enabled' : 'disabled'}`,
                  'info'
                );
              },
              icon: CodeXml,
              badge: 'Code'
            });
          }

          if (arg === boolOpt.key) {
            if (!subArg || 'on'.startsWith(subArg)) {
              items.push({
                id: `dyn-code-${boolOpt.key}-on`,
                category: 'actions',
                title: `/code ${boolOpt.key} on`,
                subtitle: `Enable ${boolOpt.name} for code blocks.`,
                action: () => {
                  boolOpt.set(true);
                  refreshCodeBlockPrefs();
                  toastStore.show(`${boolOpt.label} enabled`, 'info');
                },
                icon: CodeXml,
                badge: 'Code'
              });
            }
            if (!subArg || 'off'.startsWith(subArg)) {
              items.push({
                id: `dyn-code-${boolOpt.key}-off`,
                category: 'actions',
                title: `/code ${boolOpt.key} off`,
                subtitle: `Disable ${boolOpt.name} for code blocks.`,
                action: () => {
                  boolOpt.set(false);
                  refreshCodeBlockPrefs();
                  toastStore.show(`${boolOpt.label} disabled`, 'info');
                },
                icon: CodeXml,
                badge: 'Code'
              });
            }
          }
        }
      }

      if (!arg || 'theme'.startsWith(arg)) {
        if (!subArg) {
          items.push({
            id: 'dyn-code-theme',
            category: 'actions',
            title: '/code theme',
            subtitle: 'Cycle color scheme for code.',
            action: () => {
              codeBlockPrefsStore.cycleColorScheme();
              refreshCodeBlockPrefs();
              toastStore.show(
                `Code theme set to ${codeBlockPrefsStore.current.colorScheme}`,
                'info'
              );
            },
            icon: CodeXml,
            badge: 'Code'
          });
        }

        if (arg === 'theme') {
          const themes: Array<{key: CodeColorScheme; label: string}> = [
            {key: 'auto', label: 'Match site theme'},
            {key: 'dark', label: 'Dark theme'},
            {key: 'light', label: 'Light theme'}
          ];

          for (const t of themes) {
            if (!subArg || t.key.startsWith(subArg)) {
              items.push({
                id: `dyn-code-theme-${t.key}`,
                category: 'actions',
                title: `/code theme ${t.key}`,
                subtitle: `Set code color scheme to ${t.label.toLowerCase()}.`,
                action: () => {
                  codeBlockPrefsStore.setColorScheme(t.key);
                  refreshCodeBlockPrefs();
                  toastStore.show(`Code theme set to ${t.key}`, 'info');
                },
                icon: CodeXml,
                badge: 'Code'
              });
            }
          }
        }
      }
    }

    return items;
  }

  async function loadLinkItems() {
    if (linkItems) return;
    const sources = [
      {category: 'social', path: 'socials', badge: 'Social'},
      {category: 'contact', path: 'contact', badge: 'Contact'},
      {category: 'funding', path: 'funding', badge: 'Funding'}
    ] as const;
    const lists = await Promise.all(
      sources.map(async source => {
        try {
          const res = await fetch(`/api/v1/author/${source.path}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (Array.isArray(data) ? data : []).flatMap((link: any) => {
            const url = link.url || link.href;
            if (!link.platform || !url) return [];
            return [
              {
                id: `link-${source.category}-${url}`,
                category: source.category,
                title: link.platform,
                subtitle: link.displayValue || url,
                url,
                badge: source.badge
              } satisfies SpotlightItem
            ];
          });
        } catch {
          return [];
        }
      })
    );
    linkItems = lists.flat();
  }

  function toPostItem(post: any): SpotlightItem {
    return {
      id: `post-${post.url}`,
      category: 'posts',
      title: post.title,
      subtitle: post.subtitle ?? 'Blog post',
      url: post.url,
      icon: Quote,
      badge: 'Post'
    };
  }

  async function fetchPostsPage(query: string, page: number) {
    const offset = (page - 1) * SECTION_PAGE_SIZE;
    const res = await fetch(
      `/api/v1/search?q=${encodeURIComponent(query)}&limit=${SECTION_PAGE_SIZE}&offset=${offset}`,
      {signal: searchAbortController?.signal}
    );
    const data = await res.json();
    return {
      items: (data.data ?? []).map(toPostItem) as SpotlightItem[],
      hasMore: Boolean(data.pagination?.hasMore)
    };
  }

  function searchLocalItems(q: string): SpotlightItem[] {
    const cleanQ = q.trim();
    if (!cleanQ) {
      return [];
    }

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
      const projectTags = p.tags ?? [];
      const matchName = fuzzyMatch(p.name, cleanQ);
      const matchDesc = fuzzyMatch(p.desc, cleanQ);
      const tagMatch = projectTags.some(t => fuzzyMatch(t, cleanQ).matched);

      let isMatch = matchName.matched || matchDesc.matched || tagMatch;
      let score = Math.max(
        matchName.matched ? matchName.score : 0,
        matchDesc.matched ? matchDesc.score * 0.5 : 0
      );

      if (isRegexQuery) {
        if (
          compiledRegex
          && (compiledRegex.test(p.name)
            || (p.desc && compiledRegex.test(p.desc))
            || projectTags.some(t => compiledRegex.test(t)))
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
            subtitle: p.desc || '',
            url: p.url,
            tags: (p.tags ?? []).slice(0, 3),
            icon: FolderOpen,
            badge: 'Project'
          },
          score
        });
      }
    }

    if (!isCommandQuery) {
      for (const link of linkItems ?? []) {
        const matchTitle = fuzzyMatch(link.title, cleanQ);
        const matchSub = fuzzyMatch(link.subtitle ?? '', cleanQ);
        let score = Math.max(
          matchTitle.matched ? matchTitle.score : 0,
          matchSub.matched ? matchSub.score * 0.5 : 0
        );
        let isMatch = matchTitle.matched || matchSub.matched;
        if (isRegexQuery) {
          isMatch = Boolean(
            compiledRegex
            && (compiledRegex.test(link.title)
              || compiledRegex.test(link.subtitle ?? ''))
          );
          score = isMatch ? 70 : 0;
        }
        if (isMatch) matchedItems.push({item: link, score});
      }
    }

    const sorted =
      cleanQ === '/' ?
        matchedItems.sort((a, b) => a.item.title.localeCompare(b.item.title))
      : matchedItems.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (isCommandQuery) {
            return a.item.title.localeCompare(b.item.title);
          }
          const lenDiff = a.item.title.length - b.item.title.length;
          if (lenDiff !== 0) return lenDiff;
          return a.item.title.localeCompare(b.item.title);
        });

    const seenIds = new SvelteSet<string>();
    const seenTitles = new SvelteSet<string>();
    const uniqueMatches: SpotlightItem[] = [];

    for (const m of sorted) {
      const lowerTitle = m.item.title.toLowerCase();
      if (seenIds.has(m.item.id) || seenTitles.has(lowerTitle)) {
        continue;
      }
      seenIds.add(m.item.id);
      seenTitles.add(lowerTitle);
      uniqueMatches.push(m.item);
    }

    return uniqueMatches;
  }

  function dedupeItems(candidates: SpotlightItem[]): SpotlightItem[] {
    const seenIds = new SvelteSet<string>();
    const seenUrls = new SvelteSet<string>();
    const seenTitles = new SvelteSet<string>();
    const uniqueCombined: SpotlightItem[] = [];

    for (const item of candidates) {
      const lowerTitle = item.title.toLowerCase();
      if (
        seenIds.has(item.id)
        || seenTitles.has(lowerTitle)
        || (item.url && seenUrls.has(item.url))
      ) {
        continue;
      }
      seenIds.add(item.id);
      seenTitles.add(lowerTitle);
      if (item.url) seenUrls.add(item.url);
      uniqueCombined.push(item);
    }
    return uniqueCombined;
  }

  async function runSearch(inputString: string) {
    const trimmed = inputString.trim();
    sectionPages = {};
    if (trimmed.length < 1) {
      searchAbortController?.abort();
      results = [];
      postResults = [];
      postsHasMore = false;
      isLoading = false;
      activeIndex = -1;
      return;
    }

    searchAbortController?.abort();
    const controller = new AbortController();
    searchAbortController = controller;

    const isCommandQuery = trimmed.startsWith('/');
    postResults = [];
    postsHasMore = false;

    if (isCommandQuery && !trimmed.startsWith('/goto blog')) {
      results = dedupeItems(searchLocalItems(trimmed));
      activeIndex = -1;
      isLoading = false;
      return;
    }

    isLoading = true;
    if (!isCommandQuery) await loadLinkItems();
    if (controller.signal.aborted) return;

    const localMatches = searchLocalItems(trimmed);

    let candidates: SpotlightItem[];

    if (trimmed.length >= 2 && !isCommandQuery) {
      candidates = localMatches;
      postsQuery = trimmed;
      try {
        const page = await fetchPostsPage(trimmed, 1);
        if (controller.signal.aborted) return;
        postResults = page.items;
        postsHasMore = page.hasMore;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    } else if (trimmed.startsWith('/goto blog')) {
      const blogSubQuery = trimmed.replace('/goto blog', '').trim();
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
            title: `/goto blog ${post.url.replace('/blog/', '')}`,
            subtitle: post.title,
            url: post.url,
            icon: Quote,
            badge: 'Post'
          })
        );
        candidates = [...localMatches, ...postResults];
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        candidates = localMatches;
      }
    } else {
      candidates = localMatches;
    }

    if (controller.signal.aborted) return;

    results = dedupeItems(candidates);

    if (controller.signal.aborted) return;
    activeIndex = -1;
    isLoading = false;
  }

  function handleInput() {
    if (showHelp) showHelp = false;
    clearTimeout(debounceTimer);
    const trimmed = rawQuery.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('/goto blog')) {
      runSearch(rawQuery);
      return;
    }
    debounceTimer = setTimeout(() => {
      runSearch(rawQuery);
    }, 150);
  }

  const highlightCache = new SvelteMap<
    string,
    {text: string; match: boolean}[]
  >();
  const MAX_HIGHLIGHT_CACHE = 500;

  function getHighlightChunks(
    text: string,
    query: string
  ): {text: string; match: boolean}[] {
    if (!text) return [];
    const trimmed = query.trim();
    if (!trimmed) return [{text, match: false}];

    const cacheKey = `${isCaseSensitive ? '1' : '0'}:${isWholeWord ? '1' : '0'}:${isRegex ? '1' : '0'}:${trimmed}:${text}`;
    const cached = highlightCache.get(cacheKey);
    if (cached) return cached;

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
        if (!pattern) return [{text, match: false}];
        const regex = new RegExp(`(${pattern})`, flags);
        const parts = text.split(regex);
        const testRegex = new RegExp(
          `^(${pattern})$`,
          isCaseSensitive ? '' : 'i'
        );
        const result = parts
          .filter(part => part.length > 0)
          .map(part => ({text: part, match: testRegex.test(part)}));
        if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) highlightCache.clear();
        highlightCache.set(cacheKey, result);
        return result;
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
      const wordRegexes =
        isWholeWord ?
          escapedTerms.map(
            et => new RegExp(`^${et}$`, isCaseSensitive ? '' : 'i')
          )
        : null;
      const result = parts
        .filter(part => part.length > 0)
        .map(part => {
          const comp = isCaseSensitive ? part : part.toLowerCase();
          const isMatch =
            wordRegexes ?
              wordRegexes.some(re => re.test(part))
            : searchTerms.includes(comp);
          return {text: part, match: isMatch};
        });
      if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) highlightCache.clear();
      highlightCache.set(cacheKey, result);
      return result;
    } catch {
      return [{text, match: false}];
    }
  }

  let previouslyFocusedElement = $state<HTMLElement | null>(null);

  function open(initialQuery = '') {
    if (typeof document !== 'undefined') {
      previouslyFocusedElement = document.activeElement as HTMLElement;
    }
    if (!isOpen) shortcutStore.pushScope('spotlight');
    isOpen = true;
    showHelp = false;
    rawQuery = initialQuery;
    activeIndex = -1;
    runSearch(initialQuery);
    tick().then(() => {
      if (listEl) listEl.scrollTop = 0;
      inputEl?.focus();
    });
  }

  function close() {
    clearTimeout(debounceTimer);
    searchAbortController?.abort();
    searchAbortController = null;
    highlightCache.clear();
    if (isOpen) shortcutStore.popScope('spotlight');
    isOpen = false;
    showHelp = false;
    rawQuery = '';
    results = [];
    postResults = [];
    postsHasMore = false;
    activeIndex = -1;
    if (previouslyFocusedElement) {
      tick().then(() => {
        previouslyFocusedElement?.focus({preventScroll: true});
        previouslyFocusedElement = null;
      });
    }
  }

  const COMMAND_DEFAULTS: Record<string, () => void> = {
    '/theme': () => {
      const next = themeStore.cycle();
      toastStore.show(`Switched to ${next} theme`, 'success');
    },
    '/font': () => {
      const order: ContentFont[] = ['sans', 'serif', 'mono'];
      const next =
        order[(order.indexOf(contentFontStore.preference) + 1) % order.length];
      applyContentFont(next, next);
    },
    '/code': () => {
      codeBlockPrefsStore.cycleColorScheme();
      refreshCodeBlockPrefs();
      toastStore.show(
        `Code theme set to ${codeBlockPrefsStore.current.colorScheme}`,
        'success'
      );
    },
    '/copy': async () => {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(window.location.href);
      toastStore.show('Page URL copied to clipboard', 'success');
    }
  };

  /**
   * Open palette: fill the input and hand off to the argument chord, never
   * execute. Closed palette: run it outright.
   */
  function runCommandShortcut(item: SpotlightItem) {
    const takesArgs = Boolean(item.requiresArgs || item.autocompleteQuery);

    if (isOpen) {
      rawQuery = item.autocompleteQuery || `${item.title} `;
      runSearch(rawQuery);
      activeIndex = -1;
      inputEl?.focus();
      if (takesArgs) {
        tick().then(() => shortcutStore.armGroup('args'));
      }
      return;
    }

    if (!takesArgs) {
      select(item);
      return;
    }

    const runDefault = COMMAND_DEFAULTS[item.title];
    if (runDefault) {
      void runDefault();
      return;
    }

    open(`${item.title} `);
    tick().then(() => shortcutStore.armGroup('args'));
  }

  /**
   * Commands have no element to click, so they hand the registry a callback.
   * That keeps every leader key resolved in one dispatcher instead of racing
   * this component's own window listener.
   */
  $effect(() => {
    const disposers = defaultCommands
      .filter(command => COMMAND_SHORTCUTS[command.title])
      .map(command =>
        shortcutStore.registerCommand(
          COMMAND_SHORTCUTS[command.title],
          command.title,
          () => runCommandShortcut(command)
        )
      );
    return () => disposers.forEach(dispose => dispose());
  });

  function select(item: SpotlightItem) {
    if (
      item.requiresArgs
      || (item.autocompleteQuery && !rawQuery.trim().endsWith(item.title))
    ) {
      rawQuery = item.autocompleteQuery || `${item.title} `;
      runSearch(rawQuery);
      activeIndex = -1;
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
      postResults = [];
      postsHasMore = false;
      activeIndex = -1;
      return;
    }

    if (!item.id.startsWith('dyn-mailing-')) {
      searchHistoryStore.record({
        id: item.id,
        category: item.category,
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        iconName: item.icon ? ICON_NAME_BY_COMPONENT.get(item.icon) : undefined
      });
    }
    close();
    if (item.action) {
      item.action();
    } else if (item.url) {
      if (/^https?:/i.test(item.url)) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      } else if (/^(mailto|tel):/i.test(item.url)) {
        window.location.href = item.url;
      } else {
        goto(item.url);
      }
    }
  }

  function resolveHistoryItem(entry: SearchHistoryEntry): SpotlightItem | null {
    if (
      entry.id === 'dyn-code-minimal'
      || entry.title.toLowerCase() === '/code minimal'
    ) {
      const dynamic = getDynamicCommandItems('/code clean');
      const cleanItem = dynamic.find(d => d.id === 'dyn-code-clean');
      if (cleanItem) return cleanItem;
    }

    const fromDefault = defaultCommands.find(
      c =>
        c.id === entry.id || c.title.toLowerCase() === entry.title.toLowerCase()
    );
    if (fromDefault) return fromDefault;

    if (entry.title.startsWith('/')) {
      const dynamic = getDynamicCommandItems(entry.title);
      const matchedDyn = dynamic.find(
        d =>
          d.id === entry.id
          || d.title.toLowerCase() === entry.title.toLowerCase()
      );
      if (matchedDyn) return matchedDyn;
    }

    const matchedProject = projects.find(
      p =>
        `proj-${p.name}` === entry.id
        || p.name.toLowerCase() === entry.title.toLowerCase()
    );
    if (matchedProject) {
      return {
        id: `proj-${matchedProject.name}`,
        category: 'projects',
        title: matchedProject.name,
        subtitle: matchedProject.desc,
        url: matchedProject.url,
        icon: FolderOpen,
        badge: 'Project'
      };
    }

    if (entry.category === 'posts' && entry.id.startsWith('post-')) {
      const postUrl = entry.id.replace('post-', '');
      return {
        id: entry.id,
        category: 'posts',
        title: entry.title,
        subtitle: entry.subtitle,
        url: postUrl,
        icon: Quote,
        badge: 'Post'
      };
    }

    const fromResults = results.find(
      r =>
        r.id === entry.id || r.title.toLowerCase() === entry.title.toLowerCase()
    );
    if (fromResults) return fromResults;

    return null;
  }

  function getHistoryDisplay(entry: SearchHistoryEntry) {
    const icon =
      (entry.iconName && ALL_ICON_COMPONENTS[entry.iconName])
      || CATEGORY_ICONS[entry.category]
      || SquareTerminal;

    return {
      icon,
      title: entry.title,
      subtitle: entry.subtitle,
      badge: entry.badge
    };
  }

  function selectHistoryEntry(entry: SearchHistoryEntry) {
    const resolved = resolveHistoryItem(entry);
    if (resolved) {
      select(resolved);
    } else {
      rawQuery = entry.title;
      runSearch(rawQuery);
      activeIndex = -1;
      inputEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    // The shortcut registry runs first in the capture phase. When it consumed
    // the key — cancelling a chord, or picking one of a command's options —
    // this handler must not also act on it.
    if (e.defaultPrevented) return;

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

    const navLength = filteredHistory.length + flatItems.length;

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
      case 'Enter': {
        e.preventDefault();
        e.stopPropagation();
        if (
          filteredHistory.length > 0
          && activeIndex >= 0
          && activeIndex < filteredHistory.length
        ) {
          const entry = filteredHistory[activeIndex];
          if (entry) selectHistoryEntry(entry);
        } else if (
          activeIndex >= filteredHistory.length
          && activeIndex < navLength
        ) {
          const itemIdx = activeIndex - filteredHistory.length;
          if (flatItems[itemIdx]) {
            select(flatItems[itemIdx]);
          }
        } else if (filteredHistory.length > 0) {
          selectHistoryEntry(filteredHistory[0]);
        } else if (flatItems.length > 0) {
          select(flatItems[0]);
        }
        break;
      }
      case 'PageDown':
      case 'PageUp': {
        const category = activeCategory();
        if (!category) break;
        e.preventDefault();
        e.stopPropagation();
        void changeSectionPage(category, e.key === 'PageDown' ? 1 : -1);
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

  async function changeSectionPage(category: ItemCategory, delta: number) {
    const group = categorizedResults.find(g => g.category === category);
    if (
      !group
      || (delta > 0 && !group.hasNext)
      || (delta < 0 && !group.hasPrev)
    )
      return;
    const nextPage = group.page + delta;
    if (category === 'posts') {
      try {
        const page = await fetchPostsPage(postsQuery, nextPage);
        postResults = page.items;
        postsHasMore = page.hasMore;
      } catch {
        return;
      }
    }
    sectionPages = {...sectionPages, [category]: nextPage};
    await tick();
    const first = categorizedResults.find(g => g.category === category)
      ?.items[0];
    if (first) {
      activeIndex = (indexById.get(first.id) ?? 0) + filteredHistory.length;
      scrollActiveIntoView();
    }
  }

  function activeCategory(): ItemCategory | null {
    const itemIdx = activeIndex - filteredHistory.length;
    if (itemIdx >= 0 && flatItems[itemIdx]) return flatItems[itemIdx].category;
    return categorizedResults[0]?.category ?? null;
  }

  function handleDialogTab(e: KeyboardEvent) {
    if (e.defaultPrevented || e.key !== 'Tab') return;
    const dialog = e.currentTarget as HTMLElement;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]'
      )
    ).filter(
      element =>
        element.tabIndex >= 0
        && !element.matches(':disabled')
        && !element.closest('[inert]')
        && element.getClientRects().length > 0
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    if (
      e.shiftKey
      && (document.activeElement === first || document.activeElement === dialog)
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey
      && (document.activeElement === last || document.activeElement === dialog)
    ) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleItemArrowKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    handleKeydown(e);
    tick().then(() => {
      listEl?.querySelector<HTMLElement>(`#result-${activeIndex}`)?.focus();
    });
  }

  function handleResultKeydown(e: KeyboardEvent, item: SpotlightItem) {
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(item);
    } else {
      handleItemArrowKey(e);
    }
  }

  function handleHistoryKeydown(e: KeyboardEvent, entry: SearchHistoryEntry) {
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectHistoryEntry(entry);
    } else {
      handleItemArrowKey(e);
    }
  }

  function scrollActiveIntoView() {
    if (!listEl || activeIndex < 0) return;
    if (activeIndex === 0) {
      listEl.scrollTop = 0;
      return;
    }
    const items = listEl.querySelectorAll('[data-result-item]');
    items[activeIndex]?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    // The shortcut registry shares this window listener. When it has already
    // handled a key it calls preventDefault, so a visible button wins and the
    // command below stays the fallback for pages with no such button.
    if (e.defaultPrevented) return;

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

    const isK = e.key?.toLowerCase() === 'k' || e.code === 'KeyK';
    if ((e.ctrlKey || e.metaKey) && !e.altKey && isK) {
      e.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
      return;
    }

    const target = e.target as HTMLElement | null;
    const inInput = isTextEntryTarget(target);

    const isSlash =
      e.key === '/'
      || (!e.shiftKey
        && !e.ctrlKey
        && !e.metaKey
        && !e.altKey
        && (e.code === 'Slash' || e.code === 'NumpadDivide'));

    if (!inInput && isSlash) {
      e.preventDefault();
      if (!isOpen) {
        open('/');
      } else {
        inputEl?.focus();
      }
    }
  }

  $effect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      const handleViewportChange = () => {
        if (typeof window !== 'undefined' && window.visualViewport) {
          const newHeight = window.visualViewport.height;
          const newTop = window.visualViewport.offsetTop;
          if (visualViewportHeight !== newHeight) {
            visualViewportHeight = newHeight;
          }
          if (visualViewportTop !== newTop) {
            visualViewportTop = newTop;
          }
        }
      };
      untrack(handleViewportChange);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportChange);
      }
      return () => {
        unlock();
        if (typeof window !== 'undefined' && window.visualViewport) {
          window.visualViewport.removeEventListener(
            'resize',
            handleViewportChange
          );
        }
        visualViewportHeight = null;
        visualViewportTop = null;
      };
    }
  });

  $effect(() => {
    if (showHelp) {
      tick().then(() => helpDialogEl?.focus());
    }
  });

  let filteredHistory = $derived.by(() => {
    const allHistory = searchHistoryStore.current;
    if (allHistory.length === 0) return [];
    const trimmed = rawQuery.trim();
    if (!trimmed) return allHistory;

    if (trimmed === '/') {
      return allHistory;
    }

    return allHistory.filter(entry => {
      const matchTitle = fuzzyMatch(entry.title, trimmed);
      const matchSub =
        entry.subtitle ?
          fuzzyMatch(entry.subtitle, trimmed)
        : {matched: false, score: 0};
      return matchTitle.matched || matchSub.matched;
    });
  });

  let deduplicatedResults = $derived.by(() => {
    const seenIds = new SvelteSet<string>();
    const seenTitles = new SvelteSet<string>();
    const seenUrls = new SvelteSet<string>();

    if (filteredHistory.length > 0) {
      for (const h of filteredHistory) {
        seenIds.add(h.id);
        seenTitles.add(h.title.toLowerCase());
      }
    }

    const unique: SpotlightItem[] = [];
    for (const item of [...results, ...postResults]) {
      const lowerTitle = item.title.toLowerCase();
      if (seenIds.has(item.id) || seenTitles.has(lowerTitle)) {
        continue;
      }
      if (item.url && seenUrls.has(item.url)) {
        continue;
      }
      seenIds.add(item.id);
      seenTitles.add(lowerTitle);
      if (item.url) {
        seenUrls.add(item.url);
      }
      unique.push(item);
    }
    return unique;
  });

  let lastPointerX = -1;
  let lastPointerY = -1;

  function handleItemPointerMove(e: PointerEvent, index: number) {
    if (e.clientX === lastPointerX && e.clientY === lastPointerY) return;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    activeIndex = index;
  }

  let categorizedResults = $derived.by(() => {
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) return [];

    const isCommandQuery = trimmed.startsWith('/');

    if (isCommandQuery) {
      if (deduplicatedResults.length === 0) return [];
      return [
        {
          category: 'commands' as ItemCategory,
          label: 'Commands',
          items: deduplicatedResults,
          page: 1,
          pageCount: null,
          hasPrev: false,
          hasNext: false
        }
      ];
    }

    const groups: {
      category: ItemCategory;
      label: string;
      items: SpotlightItem[];
      page: number;
      pageCount: number | null;
      hasPrev: boolean;
      hasNext: boolean;
    }[] = [];
    const catMap: Record<
      ItemCategory,
      {label: string; items: SpotlightItem[]}
    > = {
      actions: {label: 'System actions', items: []},
      pages: {label: 'Pages & Sections', items: []},
      posts: {label: 'Blog posts', items: []},
      projects: {label: 'Repositories', items: []},
      commands: {label: 'Commands', items: []},
      skills: {label: 'Skills & Tools', items: []},
      social: {label: 'Social links', items: []},
      contact: {label: 'Contact', items: []},
      funding: {label: 'Funding', items: []}
    };

    for (const item of deduplicatedResults) {
      catMap[item.category]?.items.push(item);
    }

    for (const [key, val] of Object.entries(catMap)) {
      if (val.items.length === 0) continue;
      const requested = sectionPages[key] ?? 1;
      if (key === 'posts') {
        groups.push({
          category: 'posts',
          label: val.label,
          items: val.items,
          page: requested,
          pageCount: null,
          hasPrev: requested > 1,
          hasNext: postsHasMore
        });
        continue;
      }
      const pageCount = Math.ceil(val.items.length / SECTION_PAGE_SIZE);
      const page = Math.min(Math.max(requested, 1), pageCount);
      groups.push({
        category: key as ItemCategory,
        label: val.label,
        items: val.items.slice(
          (page - 1) * SECTION_PAGE_SIZE,
          page * SECTION_PAGE_SIZE
        ),
        page,
        pageCount,
        hasPrev: page > 1,
        hasNext: page < pageCount
      });
    }

    return groups;
  });

  let flatItems = $derived.by(() => {
    return categorizedResults.flatMap(group => group.items);
  });

  let indexById = $derived.by(() => {
    return new Map(flatItems.map((item, i) => [item.id, i]));
  });

  const flatHelpCommands = $derived(
    helpCategories.flatMap(cat => cat.commands)
  );

  function selectHelpCommand(cmd: HelpCommandSpec) {
    showHelp = false;
    helpActiveIndex = -1;
    if (cmd.command === '/refresh') {
      if (typeof window !== 'undefined') window.location.reload();
    } else if (cmd.command === '/keyboard') {
      close();
      shortcutStore.catalogOpen = true;
    } else {
      rawQuery = cmd.actionQuery || cmd.command;
      runSearch(rawQuery);
      tick().then(() => inputEl?.focus());
    }
  }

  function handleHelpKeydown(e: KeyboardEvent) {
    handleDialogTab(e);
    if (e.defaultPrevented) return;
    const total = flatHelpCommands.length;
    if (!total) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      helpActiveIndex = helpActiveIndex < total - 1 ? helpActiveIndex + 1 : 0;
      tick().then(() => {
        helpDialogEl
          ?.querySelector<HTMLElement>(`[data-help-idx="${helpActiveIndex}"]`)
          ?.focus();
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      helpActiveIndex = helpActiveIndex > 0 ? helpActiveIndex - 1 : total - 1;
      tick().then(() => {
        helpDialogEl
          ?.querySelector<HTMLElement>(`[data-help-idx="${helpActiveIndex}"]`)
          ?.focus();
      });
    } else if (e.key === 'Enter' && e.target === helpDialogEl) {
      e.preventDefault();
      if (helpActiveIndex >= 0 && helpActiveIndex < total) {
        selectHelpCommand(flatHelpCommands[helpActiveIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showHelp = false;
      helpActiveIndex = -1;
      tick().then(() => inputEl?.focus());
    }
  }

  function handleHelpItemPointerMove(idx: number) {
    if (helpActiveIndex !== idx) helpActiveIndex = idx;
  }
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
          'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md glass-button px-2.5 text-xs font-medium text-text-secondary hover:border-accent/50 hover:text-accent sm:h-9 sm:px-3'
        : variant === 'icon' ?
          'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface p-0 text-xs font-semibold text-text-secondary backdrop-blur-none transition-colors hover:border-accent hover:bg-surface-hover hover:text-accent sm:h-9 sm:w-9'
        : 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface p-0 text-xs font-semibold text-text-secondary backdrop-blur-none transition-colors hover:border-accent hover:bg-surface-hover hover:text-accent sm:h-9 sm:w-9 lg:h-9 lg:w-auto lg:justify-between lg:gap-2 lg:px-3',
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
          class="inline-flex h-5 items-center justify-center rounded-md border border-border-subtle/50 bg-surface-base/80 px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-text-secondary shadow-2xs">
          /
        </kbd>
      {:else if variant === 'icon'}
        <Search class="size-4 shrink-0" />
      {:else}
        <div class="flex min-w-0 items-center gap-2">
          <Search class="size-4 shrink-0 lg:hidden" />
          <span
            class="hidden truncate font-sans text-xs text-text-muted lg:inline"
            >Search...</span>
        </div>
        <div class="ml-1.5 hidden items-center gap-1 lg:flex">
          <ShortcutBadge combo="Mod+K" />
          <span class="text-xxs text-text-muted">or</span>
          <ShortcutBadge combo="/" />
        </div>
      {/if}
    </button>
  {/snippet}

  {#if variant === 'expanded'}
    {@render triggerButton()}
  {:else if variant === 'icon'}
    <Tooltip
      content="Search (Ctrl+K or /)"
      placement="bottom"
      align="center">
      {@render triggerButton()}
    </Tooltip>
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
    style:top={visualViewportTop !== null ?
      `${visualViewportTop}px`
    : undefined}
    style:height={visualViewportHeight !== null ?
      `${visualViewportHeight}px`
    : undefined}
    class="fixed inset-0 z-99999 flex items-center justify-center overscroll-contain p-4 transition-[top,height] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
    <button
      type="button"
      class="fixed inset-0 cursor-default touch-none bg-overlay/80 backdrop-blur-xs transition-opacity duration-200"
      aria-label="Close search"
      tabindex="-1"
      onwheel={e => e.preventDefault()}
      ontouchmove={e => e.preventDefault()}
      onclick={close}></button>

    <div
      style:max-height={visualViewportHeight !== null ?
        `${Math.min(visualViewportHeight * 0.85, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.8)}px`
      : undefined}
      class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface-card text-text-primary shadow-xl backdrop-blur-md transition-[max-height] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-white/8"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Command palette and search"
      inert={showHelp}
      onkeydown={handleDialogTab}>
      <div
        class="flex items-center justify-between border-b border-border-subtle/40 px-3 py-1.5 sm:px-4 sm:py-2">
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
          class="search-input min-w-0 flex-1 border-none! border-transparent! bg-transparent py-0! pt-0! pb-0! font-mono text-xs font-medium text-text-primary shadow-none! ring-0! ring-transparent! ring-offset-0! outline-none! [-webkit-box-shadow:none]! [-webkit-tap-highlight-color:transparent] placeholder:font-mono placeholder:text-xs placeholder:font-normal placeholder:text-text-muted focus:border-none! focus:border-transparent! focus:shadow-none! focus:ring-0! focus:ring-transparent! focus:outline-none! focus-visible:border-none! focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:ring-transparent! focus-visible:outline-none! active:border-none! active:border-transparent! active:shadow-none! active:ring-0! active:ring-transparent! active:outline-none!"
          aria-label="Search query"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={activeIndex >= 0 ?
            `result-${activeIndex}`
          : undefined} />

        <div
          class="flex shrink-0 items-center gap-0.5 pl-1.5 select-none sm:gap-1 sm:pl-2">
          <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Match Case ({isCaseSensitive ? 'ON' : 'OFF'})"
            aria-label="Toggle case sensitivity"
            aria-pressed={isCaseSensitive}
            onclick={() => {
              isCaseSensitive = !isCaseSensitive;
              highlightCache.clear();
              runSearch(rawQuery);
            }}>
            <CaseSensitive
              class={cn(
                'size-3 transition-colors sm:size-3.5',
                isCaseSensitive ? 'text-accent' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>

          <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Match Whole Word ({isWholeWord ? 'ON' : 'OFF'})"
            aria-label="Toggle whole word search"
            aria-pressed={isWholeWord}
            onclick={() => {
              isWholeWord = !isWholeWord;
              highlightCache.clear();
              runSearch(rawQuery);
            }}>
            <WholeWord
              class={cn(
                'size-3 transition-colors sm:size-3.5',
                isWholeWord ? 'text-accent' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>

          <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Use Regular Expression ({isRegex ? 'ON' : 'OFF'})"
            aria-label="Toggle regular expression search"
            aria-pressed={isRegex}
            onclick={() => {
              isRegex = !isRegex;
              highlightCache.clear();
              runSearch(rawQuery);
            }}>
            <Regex
              class={cn(
                'size-3 transition-colors sm:size-3.5',
                isRegex ? 'text-accent' : (
                  'text-text-muted hover:text-text-primary'
                )
              )} />
          </Button>
        </div>
      </div>

      <div
        bind:this={listEl}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {#if filteredHistory.length > 0}
          <div
            class={cn(
              'px-2.5 pt-2.5',
              deduplicatedResults.length === 0 && 'pb-2.5'
            )}>
            <div
              class="flex items-center justify-between gap-2 px-2 pb-1.5 select-none">
              <span class="text-xxs font-bold tracking-wider text-text-muted">
                Recents
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              {#each filteredHistory as entry, idx (entry.id)}
                {@const historyDisplay = getHistoryDisplay(entry)}
                {@const EntryIcon = historyDisplay.icon}
                {@const historyShortcut =
                  COMMAND_SHORTCUTS[historyDisplay.title.split(' ')[0]]}
                {@const historyShortcutKey = historyShortcut ?? ''}
                <div
                  id="result-{idx}"
                  role="option"
                  tabindex="0"
                  aria-selected={activeIndex === idx}
                  data-result-item
                  onfocus={() => (activeIndex = idx)}
                  onclick={() => selectHistoryEntry(entry)}
                  onkeydown={e => handleHistoryKeydown(e, entry)}
                  onpointermove={e => handleItemPointerMove(e, idx)}
                  class={cn(
                    'group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                    activeIndex === idx ?
                      'bg-accent/10 text-text-primary dark:bg-accent/20'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  )}>
                  <div class="flex min-w-0 flex-1 items-center gap-1.5">
                    <div
                      class={cn(
                        'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                        activeIndex === idx ? 'text-accent' : (
                          'text-text-secondary group-hover:text-accent'
                        )
                      )}>
                      <EntryIcon class="size-3.5" />
                    </div>

                    {#if historyDisplay.title.startsWith('/')}
                      {@const spaceIdx = historyDisplay.title.indexOf(' ')}
                      {@const verb =
                        spaceIdx === -1 ?
                          historyDisplay.title
                        : historyDisplay.title.slice(0, spaceIdx)}
                      {@const args =
                        spaceIdx === -1 ? '' : (
                          historyDisplay.title.slice(spaceIdx)
                        )}
                      <div class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="shrink-0 font-mono text-xs">
                          {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                              class={chunk.match ?
                                'font-semibold text-accent'
                              : 'font-medium text-text-primary'}
                              >{chunk.text}</span
                            >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                class={chunk.match ?
                                  'font-semibold text-accent'
                                : 'font-normal text-text-muted/60'}
                                >{chunk.text}</span
                              >{/each}{/if}
                        </span>
                        {#if historyDisplay.subtitle}
                          <span class="text-2xs text-text-muted/40 select-none"
                            >—</span>
                          <span
                            class="min-w-0 flex-1 truncate font-sans text-2xs text-text-muted">
                            {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                              {#if chunk.match}
                                <span class="font-semibold text-accent"
                                  >{chunk.text}</span>
                              {:else}
                                <span>{chunk.text}</span>
                              {/if}
                            {/each}
                          </span>
                        {/if}
                      </div>
                    {:else}
                      <div class="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          class="max-w-[45%] shrink-0 truncate text-xs font-medium text-text-primary sm:max-w-[55%]">
                          {#each getHighlightChunks(historyDisplay.title, rawQuery) as chunk, cIdx (cIdx)}
                            <span
                              class={chunk.match ?
                                'font-semibold text-accent'
                              : ''}>{chunk.text}</span>
                          {/each}
                        </span>
                        {#if historyDisplay.subtitle}
                          <span class="text-2xs text-text-muted/40 select-none"
                            >—</span>
                          <span
                            class="min-w-0 flex-1 truncate font-sans text-2xs text-text-muted">
                            {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                              {#if chunk.match}
                                <span class="font-semibold text-accent"
                                  >{chunk.text}</span>
                              {:else}
                                <span>{chunk.text}</span>
                              {/if}
                            {/each}
                          </span>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <div class="flex shrink-0 items-center gap-0.5">
                    {#if historyShortcut}
                      <ShortcutBadge
                        combo={historyShortcutKey}
                        leader
                        active={activeIndex === idx} />
                    {/if}
                    <span
                      aria-hidden="true"
                      class="flex size-6 shrink-0 items-center justify-center">
                      <CornerDownLeft
                        strokeWidth={1.5}
                        class={cn(
                          'size-3 text-accent transition-opacity group-hover:opacity-100',
                          activeIndex === idx ? 'opacity-100' : 'opacity-0'
                        )} />
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if isLoading && deduplicatedResults.length === 0}
          <div class="space-y-2 p-3">
            {#each [1, 2, 3] as placeholderId (placeholderId)}
              <div
                class="flex animate-pulse items-center gap-3 rounded-md border border-border-subtle bg-surface-hover p-2.5 select-none">
                <div class="size-4 shrink-0 rounded-md bg-border-default"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 w-2/5 rounded bg-border-default"></div>
                  <div class="h-2.5 w-3/5 rounded bg-border-subtle"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else if deduplicatedResults.length === 0 && filteredHistory.length === 0}
          {#if rawQuery.length === 0}
            <div
              class="flex h-full flex-col items-center justify-center gap-1 px-4 py-8 text-center select-none">
              <p class="text-xs font-medium text-text-muted">
                Search or run any commands
              </p>
              <p class="text-2xs text-text-muted">
                Type <span class="font-mono text-accent">/</span> for commands,
                or
                <span class="font-mono text-accent">/help</span> for the guide
              </p>
            </div>
          {:else}
            <div
              class="flex h-full flex-col items-center justify-center px-4 py-10 text-center select-none">
              <p class="text-xs font-medium text-text-muted">
                No results found
              </p>
            </div>
          {/if}
        {:else if deduplicatedResults.length > 0}
          <div
            id="search-results"
            role="listbox"
            aria-label="Search results"
            class="scrollbar-none px-2.5 pb-2.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {#each categorizedResults as group, gIdx (group.category)}
              <div
                class={cn(
                  'px-2 pb-1.5 select-none',
                  filteredHistory.length > 0 || gIdx > 0 ? 'pt-1.5' : 'pt-2.5'
                )}>
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-xxs font-bold tracking-wider text-text-muted">
                    {group.label}
                  </span>
                  {#if group.hasPrev || group.hasNext}
                    <div
                      class="flex items-center gap-1 text-2xs text-text-muted">
                      <button
                        type="button"
                        aria-label="Previous {group.label} page"
                        disabled={!group.hasPrev}
                        onclick={() => changeSectionPage(group.category, -1)}
                        class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                        <ChevronLeft class="size-3" />
                      </button>
                      <span class="min-w-8 text-center tabular-nums">
                        {group.pageCount ?
                          `${group.page} / ${group.pageCount}`
                        : group.page}
                      </span>
                      <button
                        type="button"
                        aria-label="Next {group.label} page"
                        disabled={!group.hasNext}
                        onclick={() => changeSectionPage(group.category, 1)}
                        class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                        <ChevronRight class="size-3" />
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex flex-col gap-0.5">
                {#each group.items as item (item.id)}
                  {@const globalIdx =
                    (indexById.get(item.id) ?? 0) + filteredHistory.length}
                  {@const ItemIcon =
                    item.icon
                    ?? CATEGORY_ICONS[item.category]
                    ?? SquareTerminal}
                  <div
                    id="result-{globalIdx}"
                    role="option"
                    tabindex="0"
                    aria-selected={activeIndex === globalIdx}
                    data-result-item
                    onfocus={() => (activeIndex = globalIdx)}
                    onclick={() => select(item)}
                    onkeydown={e => handleResultKeydown(e, item)}
                    onpointermove={e => handleItemPointerMove(e, globalIdx)}
                    class={cn(
                      'group relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                      activeIndex === globalIdx ?
                        'bg-accent/10 text-text-primary dark:bg-accent/20'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    )}>
                    <div class="flex min-w-0 flex-1 items-center gap-1.5">
                      <div
                        class={cn(
                          'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                          activeIndex === globalIdx ? 'text-accent' : (
                            'text-text-secondary group-hover:text-accent'
                          )
                        )}>
                        <ItemIcon class="size-3.5" />
                      </div>

                      {#if item.title.startsWith('/')}
                        {@const spaceIdx = item.title.indexOf(' ')}
                        {@const verb =
                          spaceIdx === -1 ?
                            item.title
                          : item.title.slice(0, spaceIdx)}
                        {@const args =
                          spaceIdx === -1 ? '' : item.title.slice(spaceIdx)}
                        <div class="flex min-w-0 flex-1 items-center gap-2">
                          <span class="shrink-0 font-mono text-xs">
                            {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                                class={chunk.match ?
                                  'font-semibold text-accent'
                                : 'font-medium text-text-primary'}
                                >{chunk.text}</span
                              >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                  class={chunk.match ?
                                    'font-semibold text-accent'
                                  : 'font-normal text-text-muted/60'}
                                  >{chunk.text}</span
                                >{/each}{/if}
                          </span>
                          {#if item.subtitle}
                            <span
                              class="text-2xs text-text-muted/40 select-none"
                              >—</span>
                            <span
                              class="min-w-0 flex-1 truncate font-sans text-2xs text-text-muted">
                              {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                {#if chunk.match}
                                  <span class="font-semibold text-accent"
                                    >{chunk.text}</span>
                                {:else}
                                  <span>{chunk.text}</span>
                                {/if}
                              {/each}
                            </span>
                          {/if}
                        </div>
                      {:else}
                        <div class="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            class="max-w-[45%] shrink-0 truncate text-xs font-medium text-text-primary sm:max-w-[55%]">
                            {#each getHighlightChunks(item.title, rawQuery) as chunk, cIdx (cIdx)}
                              <span
                                class={chunk.match ?
                                  'font-semibold text-accent'
                                : ''}>{chunk.text}</span>
                            {/each}
                          </span>
                          {#if item.subtitle}
                            <span
                              class="text-2xs text-text-muted/40 select-none"
                              >—</span>
                            <span
                              class="min-w-0 flex-1 truncate font-sans text-2xs text-text-muted">
                              {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                {#if chunk.match}
                                  <span class="font-semibold text-accent"
                                    >{chunk.text}</span>
                                {:else}
                                  <span>{chunk.text}</span>
                                {/if}
                              {/each}
                            </span>
                          {/if}
                        </div>
                      {/if}
                    </div>

                    <div class="flex shrink-0 items-center gap-0.5">
                      {#if COMMAND_SHORTCUTS[item.title]}
                        <ShortcutBadge
                          combo={COMMAND_SHORTCUTS[item.title]}
                          leader
                          active={activeIndex === globalIdx} />
                      {/if}
                      <span
                        aria-hidden="true"
                        class="flex size-6 shrink-0 items-center justify-center">
                        <CornerDownLeft
                          strokeWidth={1.5}
                          class={cn(
                            'size-3 text-accent transition-opacity group-hover:opacity-100',
                            activeIndex === globalIdx ? 'opacity-100' : (
                              'opacity-0'
                            )
                          )} />
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div
        class="hidden flex-none items-center justify-between gap-2 border-t border-border-subtle/60 px-3.5 py-2 text-2xs select-none sm:flex">
        <div
          class="flex min-w-0 flex-1 items-center text-2xs font-medium text-text-muted">
          {#if isLoading}
            <span>Searching…</span>
          {:else}
            {@const totalCount =
              filteredHistory.length + deduplicatedResults.length}
            <span>{totalCount} result{totalCount === 1 ? '' : 's'}</span>
          {/if}
        </div>
        <div
          class="flex shrink-0 items-center gap-2.5 text-2xs font-medium text-text-muted">
          <span class="flex items-center gap-1">
            <kbd
              class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
              <ArrowDownUp
                class="size-9"
                strokeWidth={3} />
            </kbd>
            <span class="hidden sm:inline">navigate</span>
          </span>
          {#if categorizedResults.some(group => group.hasPrev || group.hasNext)}
            <span class="flex items-center gap-1">
              <ShortcutBadge combo="PageUp" />
              <ShortcutBadge combo="PageDown" />
              <span class="hidden sm:inline">page</span>
            </span>
          {/if}
          <span class="flex items-center gap-1">
            <kbd
              class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
              <CornerDownLeft
                class="size-9"
                strokeWidth={3} />
            </kbd>
            <span class="hidden sm:inline">execute</span>
          </span>
          <span class="flex items-center gap-1">
            <kbd
              class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 text-2xs font-medium text-text-muted dark:border-white/8">
              esc
            </kbd>
            <span class="hidden sm:inline">close</span>
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
      tabindex="-1"
      onclick={() => {
        showHelp = false;
        helpActiveIndex = -1;
        tick().then(() => inputEl?.focus());
      }}></button>

    <div
      bind:this={helpDialogEl}
      class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface-card text-text-primary shadow-xl backdrop-blur-md outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-white/8"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Reference guide"
      onkeydown={handleHelpKeydown}>
      <div
        class="flex items-center justify-between border-b border-border-subtle/40 px-4 py-2.5">
        <span
          class="text-xs font-bold tracking-wide text-text-primary select-none">
          Reference Guide
        </span>
        <button
          type="button"
          onclick={() => {
            showHelp = false;
            helpActiveIndex = -1;
            tick().then(() => inputEl?.focus());
          }}
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label="Close guide">
          <X class="size-3.5" />
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto px-2.5 py-2.5 text-xs">
        {#each helpCategories as category (category.id)}
          <section aria-label={category.label}>
            <CommandSectionHeading
              label={category.label}
              context={category.context} />
            <div class="flex flex-col gap-0.5">
              {#each category.commands as cmd (cmd.command)}
                {@const cmdIdx = helpCmdIndexMap.get(cmd.command) ?? 0}
                {@const CmdIcon = cmd.icon}
                <button
                  type="button"
                  data-help-idx={cmdIdx}
                  onfocus={() => (helpActiveIndex = cmdIdx)}
                  onclick={() => selectHelpCommand(cmd)}
                  onpointermove={() => handleHelpItemPointerMove(cmdIdx)}
                  class={cn(
                    'group flex w-full cursor-pointer flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                    helpActiveIndex === cmdIdx ?
                      'bg-accent/10 text-text-primary dark:bg-accent/20'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  )}>
                  <div class="flex min-w-0 items-start gap-1.5">
                    <div
                      class={cn(
                        'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                        helpActiveIndex === cmdIdx ? 'text-accent' : (
                          'text-text-secondary group-hover:text-accent'
                        )
                      )}>
                      <CmdIcon class="size-3.5" />
                    </div>
                    <div
                      class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
                      <span
                        class="font-mono text-xs font-medium text-text-primary">
                        {cmd.command}{#if cmd.argHint}<span
                            class="ml-1 font-normal text-text-muted">
                            {cmd.argHint}</span
                          >{/if}
                      </span>
                      <span
                        class="hidden text-2xs text-text-muted/40 select-none sm:inline"
                        >—</span>
                      <span
                        class="min-w-0 basis-full font-sans text-2xs text-text-muted sm:flex-1 sm:basis-auto">
                        {cmd.description}
                      </span>
                    </div>
                    {#if COMMAND_SHORTCUTS[cmd.command]}
                      <span class="shrink-0 pt-1">
                        <ShortcutBadge
                          combo={COMMAND_SHORTCUTS[cmd.command]}
                          leader
                          active={helpActiveIndex === cmdIdx} />
                      </span>
                    {/if}
                  </div>
                  {#if cmd.validArgs.length > 0}
                    <div
                      class="flex flex-wrap items-center gap-1 pl-7.5 font-mono text-3xs">
                      {#each cmd.validArgs as arg (arg)}
                        <span
                          class="inline-flex items-center rounded bg-surface-hover px-1 py-0.5 leading-normal text-text-secondary"
                          >{arg}</span>
                      {/each}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </section>
        {/each}

        <div>
          <CommandSectionHeading label="Search filters" />
          <div class="space-y-0.5 text-2xs">
            <div
              class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <div
                  class="flex size-6 shrink-0 items-center justify-center text-text-secondary select-none">
                  <CaseSensitive class="size-3.5" />
                </div>
                <span class="font-medium text-text-primary">Match case</span>
                <span class="text-text-muted/40 select-none">—</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >Case-sensitive search toggle</span>
              </div>
              <span class="font-mono text-3xs text-accent">Aa</span>
            </div>
            <div
              class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <div
                  class="flex size-6 shrink-0 items-center justify-center text-text-secondary select-none">
                  <WholeWord class="size-3.5" />
                </div>
                <span class="font-medium text-text-primary">Whole word</span>
                <span class="text-text-muted/40 select-none">—</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >Match exact whole words</span>
              </div>
              <span class="font-mono text-3xs text-accent">ab</span>
            </div>
            <div
              class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
              <div class="flex min-w-0 items-center gap-2">
                <div
                  class="flex size-6 shrink-0 items-center justify-center text-text-secondary select-none">
                  <Regex class="size-3.5" />
                </div>
                <span class="font-medium text-text-primary">Regex mode</span>
                <span class="text-text-muted/40 select-none">—</span>
                <span class="hidden font-sans text-text-muted sm:inline"
                  >Regular expression pattern matching</span>
              </div>
              <span class="font-mono text-3xs text-accent">.*</span>
            </div>
          </div>
        </div>

        <div>
          <CommandSectionHeading label="Keyboard shortcuts" />
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover/70 focus-visible:outline-2 focus-visible:outline-focus-ring"
            onclick={() => {
              showHelp = false;
              close();
              shortcutStore.catalogOpen = true;
            }}>
            <div class="flex min-w-0 items-center gap-2">
              <div
                class="flex size-6 shrink-0 items-center justify-center text-text-secondary select-none">
                <Keyboard class="size-3.5" />
              </div>
              <span class="font-sans text-2xs text-text-secondary">
                Browse keyboard shortcuts on this page
              </span>
            </div>
            <span class="flex shrink-0 items-center gap-1">
              <ShortcutBadge
                combo={CATALOG_KEY}
                leader />
            </span>
          </button>
        </div>
      </div>

      <div
        class="hidden flex-none items-center justify-end gap-2.5 border-t border-border-subtle/60 px-3.5 py-2 text-2xs select-none sm:flex">
        <span class="flex items-center gap-1">
          <kbd
            class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
            <ArrowDownUp
              class="size-9"
              strokeWidth={3} />
          </kbd>
          <span class="text-text-muted">navigate</span>
        </span>
        <span class="flex items-center gap-1">
          <kbd
            class="inline-flex size-5 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent text-text-muted dark:border-white/8">
            <CornerDownLeft
              class="size-9"
              strokeWidth={3} />
          </kbd>
          <span class="text-text-muted">execute</span>
        </span>
        <span class="flex items-center gap-1">
          <kbd
            class="inline-flex h-5 min-w-6 items-center justify-center rounded-sm border border-border-subtle/60 bg-transparent px-1.5 text-2xs font-medium text-text-muted dark:border-white/8">
            esc
          </kbd>
          <span class="text-text-muted">close</span>
        </span>
      </div>
    </div>
  </div>
{/if}

<ShareDialog
  bind:isOpen={isShareOpen}
  title={activePageContext.isBlogPost ? 'Share this article' : (
    'Share this page'
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

<MailingDialog
  request={mailingRequest}
  onClose={() => (mailingRequest = null)} />

<style>
  @reference "../../routes/global.css";

  .search-input::-webkit-search-cancel-button,
  .search-input::-webkit-search-decoration,
  .search-input::-webkit-search-results-button,
  .search-input::-webkit-search-results-decoration {
    @apply hidden appearance-none;
  }
</style>
