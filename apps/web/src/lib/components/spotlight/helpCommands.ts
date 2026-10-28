import { API_VERSIONS } from '#lib/apiConfig.ts';
import { SHORTCUT_SECTIONS, commandSection } from '@idstead/ui/shortcutCatalog.ts';
import {
    Mail,
    RotateCw,
    SunMoon,
    Copy,
    Compass,
    Sparkles,
    HeartHandshake,
    House,
    FolderOpen,
    FileUser,
    Rss,
    CodeXml,
    Power,
    BookOpenText,
    Save,
    Printer,
    Cookie,
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
    Braces,
    Share2,
    QrCode,
    Keyboard,
    CircleQuestionMark,
    Quote,
    MessageSquareWarning,
    ScrollText,
    BotMessageSquare,
    ShieldUser,
    Lock,
    AtSign,
    Workflow,
    Bot,
    PersonStanding,
    Rocket
} from '@lucide/svelte';
import type { HelpCategory } from './types';

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
                    'ai-disclosure',
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
                argHint: '[version]',
                description: 'Open the REST API documentation, the latest version by default.',
                validArgs: [...API_VERSIONS],
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
                command: '/ai-disclosure',
                argHint: '',
                description: 'Read how this site uses AI.',
                validArgs: [],
                actionQuery: '/ai-disclosure',
                icon: BotMessageSquare
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
                icon: CircleQuestionMark
            },
            {
                command: '/exit',
                argHint: '',
                description: 'Close command palette or browser tab.',
                validArgs: [],
                actionQuery: '/exit',
                icon: Power
            }
        ]
    }
];

export const helpCategories = SHORTCUT_SECTIONS.map(section => ({
    ...section,
    commands: helpCommandCategories
        .flatMap(category => category.commands)
        .filter(command => commandSection(command.command) === section.id)
})).filter(section => section.commands.length > 0);
