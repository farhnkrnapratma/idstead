<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { stableHeight } from '@idstead/ui/utils/stableHeight.ts';
    import { readJson } from '#app/readJson.ts';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { COMMENTS_PAGE_SIZE, commentAuthorName } from '#lib/commentAuthor.ts';
    import { blogBannerAlt } from '#lib/blogBanner.ts';
    import { adminUrl, navigateAdmin } from '#app/adminNavigation.ts';
    import { bannerUrl } from '#lib/blogBanner.ts';
    import { cdnBaseUrl } from '#lib/cdn.ts';
    import {
        submitPost,
        rememberPostSave,
        recallPostSave,
        PostSaveError
    } from '#app/postSaveClient.ts';
    import { FieldValidation, requiredText, emailError } from '@idstead/domain/fieldValidation.ts';
    import { mdrsContent } from '#app/mdrsValidation.ts';
    import { renderMdrsPreview } from '#app/mdrsPreview.ts';
    import { avatarSource, siteBannerSource } from '#lib/siteIdentity.ts';
    import IdentityImageUpload from '#app/components/IdentityImageUpload.svelte';
    import type { ImagePackage } from '#lib/siteIdentity.ts';
    import { processAvatar } from '#app/processAvatar.ts';
    import { processSiteBanner, type SiteBannerOutput } from '#app/processSiteBanner.ts';
    import { listFieldError } from '#app/listFieldError.ts';
    import {
        avatarFingerprint,
        avatarPreview,
        bannerFingerprint,
        generateAvatarPackage,
        generateBannerPackage,
        renderBanner
    } from '#app/identityFallback.ts';
    import { avatarSeed, type BannerInput } from '#app/identityFallbackLayout.ts';
    import * as publicEnv from '$app/env/public';
    import { page } from '$app/state';
    import { publicSiteUrl as siteUrlFor } from '#app/publicSite.ts';
    import { refreshAll } from '$app/navigation';
    import {
        AppWindow,
        ArrowDown,
        ArrowUp,
        ArrowUpRight,
        AtSign,
        Bell,
        Bolt,
        Bot,
        CircleCheckBig,
        CircleDotDashed,
        Copy,
        DatabaseArrowDown,
        DatabaseArrowUp,
        DatabaseX,
        Download,
        EyeOff,
        FileArchive,
        FileUser,
        Flag,
        FolderOpen,
        GripVertical,
        HeartHandshake,
        Image as ImageIcon,
        KeyRound,
        Layers,
        LayoutDashboard,
        Lock,
        LogOut,
        Logs,
        Menu,
        MessageCircle,
        PanelLeftClose,
        PanelLeftOpen,
        PenLine,
        Pin,
        PinOff,
        Plus,
        Quote,
        RefreshCw,
        Save,
        ScrollText,
        Send,
        Share2,
        ShieldAlert,
        ShieldCheck,
        ShieldUser,
        Sparkles,
        Trash,
        User,
        Users,
        X
    } from '@lucide/svelte';
    import { onDestroy, onMount, tick, untrack } from 'svelte';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import type { AdminNotificationRow } from '#lib/adminActivity.ts';
    import AdminHome from '#app/components/admin/AdminHome.svelte';
    import ActivityTimestamp from '#app/components/admin/ActivityTimestamp.svelte';
    import SessionTimeoutDialog from '#app/components/admin/SessionTimeoutDialog.svelte';
    import { SESSION_WARNING_SECONDS, extendedTimeoutMinutes } from '#app/sessionTimeout.ts';
    import { formatAdminDateTime } from '#lib/adminDateFormat.ts';
    import { cleanAdminParams } from '#app/adminUrl.ts';
    import { adminDisplayStore } from '#app/stores/adminDisplayStore.svelte.ts';
    import { startAdminSettingsSync } from '#app/stores/adminSettingsSync.svelte.ts';
    import { adminActivityRequest } from '#app/adminActivityClient.ts';
    import { ACCESS_LOGOUT_URL, adminFetch, adminRequest } from '#app/adminClient.ts';
    import type { AdminAuthorSnapshot, IdentityVersionMeta, LegalPage } from '@idstead/data';
    import {
        ADMIN_WORKSPACE_PAGE_SIZE,
        type WorkspaceArea,
        type WorkspacePage
    } from '#lib/adminWorkspace.ts';
    import {
        lockScroll,
        preferredScrollBehavior,
        whenScrollSettles
    } from '@idstead/ui/utils/scroll.ts';
    import { adminNotificationsStore } from '#app/stores/adminNotificationsStore.svelte.ts';

    const loadActivityWorkspace = () => import('#app/components/admin/ActivityWorkspace.svelte');
    const loadActivityLogWorkspace = () =>
        import('#app/components/admin/ActivityLogWorkspace.svelte');
    const loadAccountSettings = () => import('#app/components/admin/AccountSettings.svelte');
    const loadIdentityProviderSettings = () =>
        import('#app/components/admin/IdentityProviderSettings.svelte');
    const loadPostEditor = () => import('#app/components/admin/PostEditor.svelte');
    const loadMarkdownEditor = () => import('@mdrs/editor');
    import { formatBadgeCount } from '@idstead/domain/formatters.ts';
    import { LEGAL_SLUGS, isLegalSlug, type LegalSlug } from '@idstead/domain/legal.ts';
    import {
        Button,
        Badge,
        Card,
        Textarea,
        FormField,
        FieldMessage,
        Input,
        Checkbox,
        ConfirmationDialog,
        LoadingState,
        EmptyState,
        SkeletonBlock,
        ErrorState,
        RefineImage,
        SkipLink,
        FilterToolbar,
        Dropdown,
        SortControl,
        SearchResultCount,
        FilterChipGroup,
        FilterEmptyState,
        Pagination,
        toastStore,
        createFilterSortStore,
        ThemeSelect,
        Tooltip,
        StatusBanner,
        FormSection,
        FormActions,
        PillInput,
        splitEscapedCommas,
        FileUploadField,
        IconButton,
        sortMenuGroups,
        type FilterMenuGroup
    } from '@idstead/ui';
    import { BrandIcon, CommentThread } from '#lib/index.ts';
    import CodeTabs from '@mdrs/dom/CodeTabs.svelte';
    import { formatReadTime, sanitizeInput } from '@idstead/domain';
    import { decodeHtmlEntities } from '@mdrs/core';
    import ActionMenu from '@idstead/ui/components/ActionMenu.svelte';
    import ArticleMeta from '#lib/article/ArticleMeta.svelte';

    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import {
        normalizeIconInput,
        type AuthorProfile,
        type ExperienceItem,
        type EducationItem,
        type SponsorshipLink,
        type ContactInfo,
        type SocialLink,
        type SkillItem,
        type ResumeDocument
    } from '#lib/author.ts';
    import { RESUME_CHECKSUM_ALGORITHMS, resumeFileUrl } from '#lib/resumeVerification.ts';
    import { copyText, downloadUrl as downloadFrom } from '@idstead/ui/utils/fileActions.ts';
    import {
        KEYSERVER_PRESETS,
        formatFingerprint,
        formatUserId,
        wkdEmails,
        type OpenPgpKeyserver,
        type PublicOpenPgpKey
    } from '@idstead/domain/openpgpKey.ts';

    const hasSavedProfile = $derived(Boolean((page.data as { author?: unknown })?.author));
    const publicSiteUrl = $derived(siteUrlFor(page.data));

    interface AdminPost {
        id: string;
        title: string;
        slug: string;
        published: boolean;
        pinned: boolean;
        created_at: string;
        updated_at?: string | null;
        banner_version?: string | null;
        post_revision: number;
        excerpt?: string | null;
        tags?: string[] | null;
        read_minutes: number | null;
        comment_count: number;
        views_count: number;
        helpful_yes: number;
        helpful_no: number;
    }

    const failedBanners = new SvelteSet<string>();

    function markBannerFailed(postId: string) {
        failedBanners.add(postId);
    }

    const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

    function isPostNew(post: AdminPost) {
        if (!post.created_at) return false;
        return Date.now() - new Date(post.created_at).getTime() < NEW_ITEM_WINDOW_MS;
    }

    let isLoading = $state(true);
    let postsLoading = $state(false);
    let postsLoadError = $state('');
    let posts = $state<AdminPost[]>([]);
    let isLoggingOut = $state(false);
    let adminUserEmail = $state('');

    const filterStore = createFilterSortStore({ defaultSortField: 'date', defaultSortDir: 'desc' });

    let showDeletePostDialog = $state(false);
    let postToDelete = $state<AdminPost | null>(null);
    let showDeleteCommentDialog = $state(false);
    let commentIdToDelete = $state<string | null>(null);
    let showDeleteAllDialog = $state(false);
    let hasExportedAllData = $state(false);
    let isExportingAllData = $state(false);
    let showDeleteResumeDocDialog = $state(false);
    let showLogoutDialog = $state(false);

    interface AdminComment {
        id: string;
        post_id: string;
        parent_id: string | null;
        author_name: string;
        content: string;
        is_anonymous?: boolean;
        is_admin?: boolean;
        is_approved: boolean;
        created_at: string;
        posts?: { title: string };
        reports?: number;
    }

    let comments = $state<AdminComment[]>([]);
    let commentsLoading = $state<Record<string, boolean>>({});
    let commentsError = $state<Record<string, string>>({});
    let replyTo = $state<AdminComment | null>(null);
    let commentContent = $state('');
    let replyError = $state('');
    const replyValidation = new FieldValidation();
    replyValidation.register('content', {
        value: () => commentContent,
        baseline: () => '',
        validate: requiredText('Reply', 1000),
        report: result => {
            replyError = result.error;
        }
    });
    onDestroy(() => replyValidation.destroy());
    let isSubmitting = $state(false);

    let focusedCommentId = $state<string | null>(null);
    let focusHighlightTimer: ReturnType<typeof setTimeout>;
    let cancelCommentScrollWait = () => {};
    onDestroy(() => {
        cancelCommentScrollWait();
        clearTimeout(focusHighlightTimer);
    });

    function selectNotification(item: AdminNotificationRow) {
        if (item.kind === 'comment_report' && !item.comment_id) return;
        if (item.kind === 'comment_new') {
            if (item.post_id && item.comment_id) void focusComment(item.post_id, item.comment_id);
            return;
        }
        if (
            item.kind === 'comment_report'
            || item.kind === 'post_feedback'
            || item.kind === 'legal_feedback'
        ) {
            if (!item.page_id || !item.page_type) return;
            openWorkspace(
                item.kind === 'comment_report' ? 'reports' : 'feedback',
                item.kind === 'comment_report' ?
                    (item.comment_id ?? undefined)
                :   `${item.page_type}:${item.page_id}`,
                item.source_id ?? undefined,
                item.id
            );
        }
    }

    function showPublishedPosts() {
        selectTab('posts');
        filterStore.clearAllFilters();
        filterStore.setSingleFilter('status', 'published');
        postsPage = 1;
    }

    async function focusPost(postId: string) {
        selectTab('posts');
        filterStore.clearAllFilters();
        await tick();
        const index = filteredPosts.findIndex(p => p.id === postId);
        if (index >= 0) postsPage = Math.floor(index / POSTS_PAGE_SIZE) + 1;
        await tick();
        document
            .getElementById(`post-${postId}`)
            ?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    }

    function waitForElement(id: string, timeoutMs = 2000) {
        return new Promise<HTMLElement | null>(resolve => {
            const existing = document.getElementById(id);
            if (existing) {
                resolve(existing);
                return;
            }
            const startedAt = Date.now();
            const poll = () => {
                const el = document.getElementById(id);
                if (el) {
                    resolve(el);
                    return;
                }
                if (Date.now() - startedAt >= timeoutMs) {
                    resolve(null);
                    return;
                }
                requestAnimationFrame(poll);
            };
            requestAnimationFrame(poll);
        });
    }

    async function focusComment(postId: string, commentId: string) {
        await ensureTabData('posts');
        await fetchComments(postId);
        await focusPost(postId);
        expandedPostIds.add(postId);
        focusedCommentId = commentId;
        await tick();

        const target = await waitForElement(`comment-${commentId}`);
        target?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' });

        clearTimeout(focusHighlightTimer);
        cancelCommentScrollWait();
        const main = document.getElementById('main');
        cancelCommentScrollWait = whenScrollSettles(
            main && main.scrollHeight > main.clientHeight ? main : window,
            () => {
                focusHighlightTimer = setTimeout(() => {
                    if (focusedCommentId === commentId) focusedCommentId = null;
                }, 4000);
            }
        );
    }

    const ADMIN_TAB_IDS = [
        'home',
        'reports',
        'feedback',
        'notifications',
        'logs',
        'posts',
        'projects',
        'profile',
        'resume',
        'skills',
        'socials',
        'funding',
        'contact',
        'apps',
        'privacy',
        'security',
        'terms',
        'ai-disclosure',
        'account'
    ] as const;

    type AdminTab = (typeof ADMIN_TAB_IDS)[number];

    function resolveInitialTab(value: string | null): AdminTab {
        return ADMIN_TAB_IDS.includes(value as AdminTab) ? (value as AdminTab) : 'home';
    }

    let activeAdminTab = $derived(resolveInitialTab(adminUrl().searchParams.get('tab')));
    let sidebarMobileOpen = $state(false);
    let sidebarCollapsed = $state(false);
    let sidebarWidth = $state(224);
    let sidebarResizing = $state(false);

    async function closeMobileSidebar() {
        sidebarMobileOpen = false;
        await tick();
        document.getElementById('admin-sidebar-toggle')?.focus();
    }

    function manageSidebar(element: HTMLElement) {
        const open = sidebarMobileOpen;
        const desktop = window.matchMedia('(min-width: 768px)');
        const updateInert = () => {
            element.inert = !desktop.matches && !open;
        };
        updateInert();
        desktop.addEventListener('change', updateInert);
        const release = open ? manageMobileSidebar(element) : undefined;
        return () => {
            desktop.removeEventListener('change', updateInert);
            element.inert = false;
            release?.();
        };
    }

    function manageMobileSidebar(element: HTMLElement) {
        const desktop = window.matchMedia('(min-width: 768px)');
        if (desktop.matches) return;
        const background = [
            document.getElementById('main'),
            document.getElementById('admin-mobile-header')
        ];
        const previousInert = background.map(node => node?.inert ?? false);
        const unlock = lockScroll();
        for (const node of background) if (node) node.inert = true;
        const focusable = () =>
            Array.from(
                element.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), a[href], [tabindex="0"]'
                )
            ).filter(node => node.getClientRects().length > 0);
        let closed = false;
        void tick().then(() => {
            if (!closed) focusable()[0]?.focus();
        });
        const onKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                void closeMobileSidebar();
            } else if (event.key === 'Tab') {
                const nodes = focusable();
                const first = nodes[0];
                const last = nodes.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        const onDesktop = () => {
            if (desktop.matches) {
                sidebarMobileOpen = false;
                void tick().then(() =>
                    document.getElementById('main')?.focus({ preventScroll: true })
                );
            }
        };
        element.addEventListener('keydown', onKeydown);
        desktop.addEventListener('change', onDesktop);
        return () => {
            closed = true;
            unlock();
            background.forEach((node, index) => {
                if (node) node.inert = previousInert[index];
            });
            element.removeEventListener('keydown', onKeydown);
            desktop.removeEventListener('change', onDesktop);
        };
    }

    function toggleSidebarCollapsed() {
        sidebarCollapsed = !sidebarCollapsed;
        try {
            localStorage.setItem('admin-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
        } catch {}
    }

    function startSidebarResize(event: PointerEvent) {
        event.preventDefault();
        const startX = event.clientX;
        const min = window.innerWidth * 0.15;
        const max = window.innerWidth * 0.2;
        const startWidth = sidebarCollapsed ? min : sidebarWidth;
        document.body.classList.add('select-none');
        sidebarResizing = true;
        let rafId = 0;
        let pendingClientX = event.clientX;
        const applyWidth = () => {
            rafId = 0;
            const next = startWidth + (pendingClientX - startX);
            if (next < min) {
                sidebarCollapsed = true;
                return;
            }
            sidebarCollapsed = false;
            sidebarWidth = Math.min(max, next);
        };
        const onMove = (moveEvent: PointerEvent) => {
            pendingClientX = moveEvent.clientX;
            if (!rafId) rafId = requestAnimationFrame(applyWidth);
        };
        const onUp = () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('blur', onUp);
            document.body.classList.remove('select-none');
            sidebarResizing = false;
            persistSidebarSize();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('blur', onUp);
    }

    function persistSidebarSize() {
        try {
            localStorage.setItem('admin-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
            if (!sidebarCollapsed)
                localStorage.setItem('admin-sidebar-width', String(sidebarWidth));
        } catch {}
    }

    function resizeSidebarFromKey(event: KeyboardEvent) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const min = window.innerWidth * 0.15;
        const max = window.innerWidth * 0.2;
        const step = event.key === 'ArrowRight' ? 16 : -16;
        if (sidebarCollapsed) {
            if (step < 0) return;
            sidebarCollapsed = false;
            sidebarWidth = min;
        } else if (sidebarWidth + step < min) {
            sidebarCollapsed = true;
        } else {
            sidebarWidth = Math.min(max, sidebarWidth + step);
        }
        persistSidebarSize();
    }

    function selectTab(id: AdminTab) {
        sidebarMobileOpen = false;
        const url = adminUrl();
        if (id === 'home') url.searchParams.delete('tab');
        else url.searchParams.set('tab', id);
        for (const key of [
            'settings',
            'selected',
            'notificationId',
            'cursor',
            'detailCursor',
            'focus',
            'detailQuery',
            'detailReason',
            'detailSort',
            'query',
            'type',
            'read',
            'sort',
            'direction',
            'minimum',
            'postId',
            'reason',
            'vote'
        ])
            url.searchParams.delete(key);
        navigateAdmin(url);
        void tick().then(() => document.getElementById('main')?.focus({ preventScroll: true }));
        void ensureTabData(id);
        if (isLegalSlug(id)) {
            checkLegalDrafts();
        }
    }

    let editPostParam = $derived(adminUrl().searchParams.get('editPost'));
    function openPostEditor(id: string) {
        const url = adminUrl();
        url.searchParams.set('tab', 'posts');
        url.searchParams.set('editPost', id);
        navigateAdmin(url);
    }
    function closePostEditor() {
        const url = adminUrl();
        url.searchParams.delete('editPost');
        navigateAdmin(url);
    }
    async function handlePostSaved() {
        closePostEditor();
        await fetchPosts();
    }

    const MONTHS = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ] as const;

    const currentYear = new Date().getFullYear();

    function getStartYearOptions() {
        const years: number[] = [];
        for (let y = currentYear; y >= currentYear - 100; y--) {
            years.push(y);
        }
        return years;
    }

    function getEndYearOptions(startYear?: number | null) {
        const start = startYear || currentYear;
        const years: number[] = [];
        for (let y = start; y <= currentYear + 100; y++) {
            years.push(y);
        }
        return years;
    }

    const EMPLOYMENT_TYPES = [
        'Full-time',
        'Part-time',
        'Self-employed',
        'Freelance',
        'Contract',
        'Internship',
        'Apprenticeship',
        'Seasonal'
    ] as const;

    const LOCATION_TYPES = ['On-Site', 'Remote', 'Hybrid'] as const;

    let siteAuthorName = $state('');
    async function loadSiteAuthorName() {
        if (siteAuthorName) return;
        try {
            const { profile } = await adminRequest<{ profile: AuthorProfile | null }>('author', {
                params: { part: 'profile' }
            });
            siteAuthorName = profile?.name ?? '';
        } catch {}
    }
    let authorState = $state<AuthorProfile>({
        name: '',
        pronunciation: '',
        username: '',
        headline: '',
        jobTitle: '',
        bio: '',
        avatar: '',
        email: '',
        city: '',
        postalCode: '',
        country: '',
        siteUrl: '',
        skills: []
    });
    const adminUserName = $derived(authorState.name);

    let legalPagesData = $state<Record<string, { title: string; content: string }>>({
        privacy: { title: 'Privacy Policy', content: '' },
        security: { title: 'Security Policy', content: '' },
        terms: { title: 'Terms of Service', content: '' },
        'ai-disclosure': { title: 'AI Disclosure', content: '' }
    });
    let initialLegalPagesContent = $state<Record<string, string>>(
        Object.fromEntries(LEGAL_SLUGS.map(slug => [slug, '']))
    );
    let legalDrafts = $state<Record<string, { content: string; timestamp?: number } | null>>(
        Object.fromEntries(LEGAL_SLUGS.map(slug => [slug, null]))
    );
    let isSavingLegal = $state(false);
    let legalSaveError = $state('');
    let legalFieldErrors = $state<Record<string, string>>({});
    const legalValidation = new FieldValidation();
    for (const slug of LEGAL_SLUGS)
        legalValidation.register(slug, {
            value: () => legalPagesData[slug].content,
            baseline: () => initialLegalPagesContent[slug],
            validate: mdrsContent('Content'),
            report: result => {
                legalFieldErrors[slug] = result.error;
            }
        });
    onDestroy(() => legalValidation.destroy());

    const isLegalDirty = $derived.by(() => {
        return LEGAL_SLUGS.some(
            slug => (legalPagesData[slug]?.content || '') !== (initialLegalPagesContent[slug] || '')
        );
    });

    function checkLegalDrafts() {
        if (typeof window === 'undefined') return;
        for (const slug of LEGAL_SLUGS) {
            const key = `autosave_legal_${slug}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed.content === 'string') {
                        const currentContent = legalPagesData[slug]?.content || '';
                        const initialContent = initialLegalPagesContent[slug] || '';
                        if (
                            parsed.content.trim()
                            && parsed.content !== currentContent
                            && parsed.content !== initialContent
                        ) {
                            legalDrafts[slug] = {
                                content: parsed.content,
                                timestamp: parsed.timestamp
                            };
                        } else {
                            legalDrafts[slug] = null;
                        }
                    }
                } catch {
                    legalDrafts[slug] = null;
                }
            } else {
                legalDrafts[slug] = null;
            }
        }
    }

    function restoreLegalDraft(slug: LegalSlug) {
        const draft = legalDrafts[slug];
        if (draft && legalPagesData[slug]) {
            legalPagesData[slug].content = draft.content;
            legalDrafts[slug] = null;
            toastStore.success(`Restored draft for ${legalPagesData[slug].title}`);
        }
    }

    function discardLegalDraft(slug: LegalSlug) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(`autosave_legal_${slug}`);
        }
        legalDrafts[slug] = null;
        toastStore.show(`Discarded draft for ${legalPagesData[slug].title}`);
    }

    async function loadLegalPages() {
        try {
            const { pages } = await adminRequest<{ pages: LegalPage[] }>('legal', {
                fallbackMessage: 'Legal pages could not be loaded.'
            });
            if (pages.length > 0) {
                for (const item of pages) {
                    if (item.slug && legalPagesData[item.slug]) {
                        const fetchedContent = item.content ?? '';
                        legalPagesData[item.slug] = {
                            title: item.title || legalPagesData[item.slug].title || '',
                            content: fetchedContent
                        };
                        initialLegalPagesContent[item.slug] = fetchedContent;
                    }
                }
            }
            checkLegalDrafts();
        } catch {}
    }

    let pendingLegalImport = $state<{ slug: LegalSlug; content: string } | null>(null);

    async function handleLegalImport(file: File) {
        const slug = activeAdminTab as LegalSlug;
        if (!legalPagesData[slug]) return;
        if (!/\.(?:md|mdrs|markdown)$/i.test(file.name)) {
            toastStore.error('Choose a .md or .mdrs file.');
            return;
        }
        if (file.size > 1024 * 1024) {
            toastStore.error('That file is too large to import.');
            return;
        }
        let content: string;
        try {
            content = await file.text();
        } catch {
            toastStore.error('The file could not be read.');
            return;
        }
        if (legalPagesData[slug].content.trim()) {
            pendingLegalImport = { slug, content };
            return;
        }
        applyLegalImport({ slug, content });
    }

    function applyLegalImport(imported: { slug: LegalSlug; content: string }) {
        pendingLegalImport = null;
        legalPagesData[imported.slug].content = imported.content;
        legalValidation.input(imported.slug);
        toastStore.success('File imported.');
    }

    async function handleSaveLegalPage(targetSlug?: LegalSlug, e?: SubmitEvent) {
        if (e) e.preventDefault();
        if (isSavingLegal) return;
        const slugToSave = targetSlug || (activeAdminTab as LegalSlug);
        if (!slugToSave || !legalPagesData[slugToSave]) return;
        if (!(await legalValidation.submit([slugToSave], !initialLegalPagesContent[slugToSave])))
            return;

        isSavingLegal = true;
        legalSaveError = '';

        const pageToSave = legalPagesData[slugToSave];
        try {
            await adminRequest('legal', {
                body: { slug: slugToSave, title: pageToSave.title, content: pageToSave.content },
                fallbackMessage: 'Failed to save legal page'
            });

            if (typeof window !== 'undefined') {
                localStorage.removeItem(`autosave_legal_${slugToSave}`);
            }
            legalDrafts[slugToSave] = null;
            initialLegalPagesContent[slugToSave] = pageToSave.content;
            legalValidation.clear(slugToSave);

            toastStore.success(`${pageToSave.title} saved successfully`);
        } catch (err) {
            legalSaveError = err instanceof Error ? err.message : 'Failed to save legal page';
            toastStore.error(`Error: ${legalSaveError}`);
        } finally {
            isSavingLegal = false;
        }
    }
    let isSavingAuthor = $state(false);
    let preparedImage = $state.raw<ImagePackage | null>(null);
    let preparedBanner = $state.raw<SiteBannerOutput | null>(null);
    let preparingImage = $state(false);
    let preparingBanner = $state(false);
    let avatarRemoved = $state(false);
    let bannerRemoved = $state(false);
    let identityMeta = $state<{
        avatar: IdentityVersionMeta | null;
        banner: IdentityVersionMeta | null;
    }>({ avatar: null, banner: null });
    let generatedBanner = $state('');
    let bannerPreviewError = $state('');
    let renderingBanner = $state(false);
    let syncingIdentity = false;
    let authorSaveSuccess = $state(false);
    let authorSaveError = $state('');

    let authorErrors = $state({
        name: '',
        username: '',
        jobTitle: '',
        headline: '',
        avatar: '',
        email: '',
        city: '',
        postalCode: '',
        country: '',
        siteUrl: '',
        bio: ''
    });

    let authorValid = $state({
        name: false,
        username: false,
        jobTitle: false,
        headline: false,
        avatar: false,
        email: false,
        city: false,
        postalCode: false,
        country: false,
        siteUrl: false,
        bio: false
    });

    let authorInitial = $state<typeof authorState | null>(null);

    const authorIsDirty = $derived(
        preparedImage !== null
            || preparedBanner !== null
            || avatarRemoved
            || bannerRemoved
            || (authorInitial !== null
                && JSON.stringify({
                    name: authorState.name,
                    pronunciation: authorState.pronunciation,
                    username: authorState.username,
                    jobTitle: authorState.jobTitle,
                    headline: authorState.headline,
                    avatar: authorState.avatar,
                    email: authorState.email,
                    city: authorState.city,
                    postalCode: authorState.postalCode,
                    country: authorState.country,
                    siteUrl: authorState.siteUrl,
                    bio: authorState.bio
                })
                    !== JSON.stringify({
                        name: authorInitial.name,
                        pronunciation: authorInitial.pronunciation,
                        username: authorInitial.username,
                        jobTitle: authorInitial.jobTitle,
                        headline: authorInitial.headline,
                        avatar: authorInitial.avatar,
                        email: authorInitial.email,
                        city: authorInitial.city,
                        postalCode: authorInitial.postalCode,
                        country: authorInitial.country,
                        siteUrl: authorInitial.siteUrl,
                        bio: authorInitial.bio
                    }))
    );

    let savedAvatarPreview = $state('');
    let savedBannerPreview = $state('');

    const adminAvatarUrl = $derived(
        savedAvatarPreview || avatarSource(authorState) || '/avatar.png'
    );

    const authorValidation = new FieldValidation();
    const authorLabels: Record<string, string> = {
        name: 'Name',
        username: 'Username',
        jobTitle: 'Job title',
        headline: 'Headline',
        email: 'Email',
        city: 'City',
        postalCode: 'Postal code',
        country: 'Country',
        siteUrl: 'Site URL',
        bio: 'Description',
        avatar: 'Profile image'
    };
    for (const field of Object.keys(authorErrors) as (keyof typeof authorErrors)[]) {
        authorValidation.register(field, {
            value: () => (field === 'avatar' && preparedImage ? 'prepared' : authorState[field]),
            baseline: () => (field === 'avatar' ? undefined : authorInitial?.[field]),
            validate: value => {
                if (field === 'avatar') return '';
                const required = requiredText(authorLabels[field])(String(value || ''));
                if (required) return required;
                if (field === 'email') return emailError(value);
                if (field === 'siteUrl') {
                    try {
                        const url = new URL(value);
                        if (
                            !['https:', 'http:'].includes(url.protocol)
                            || url.username
                            || url.password
                            || url.pathname !== '/'
                            || url.search
                            || url.hash
                        )
                            throw new Error();
                    } catch {
                        return 'Site URL must be an HTTP or HTTPS origin.';
                    }
                }
                return '';
            },
            report: ({ error, valid }) => {
                authorErrors[field] = error;
                authorValid[field] = valid;
            }
        });
    }
    onDestroy(() => authorValidation.destroy());
    function onAuthorInput(field: keyof typeof authorErrors) {
        queueMicrotask(() => authorValidation.input(field));
    }
    function validateAllAuthorFields() {
        return authorValidation.submit(undefined, !authorState.id);
    }

    let resumeState = $state<{ experience: ExperienceItem[]; education: EducationItem[] }>({
        experience: [],
        education: []
    });

    let skillsState = $state<SkillItem[]>([]);
    let socialState = $state<SocialLink[]>([]);
    let sponsorshipState = $state<SponsorshipLink[]>([]);
    let contactState = $state<ContactInfo[]>([]);
    let pinnedReposState = $state<string[]>([]);
    let excludedReposState = $state<string[]>([]);

    let resumeInitial = $state<typeof resumeState | null>(null);
    let skillsInitial = $state<SkillItem[] | null>(null);
    let socialInitial = $state<SocialLink[] | null>(null);

    type IdentityPlan = {
        avatar?: { files: ImagePackage; meta: IdentityVersionMeta };
        banner?: { files: SiteBannerOutput; meta: IdentityVersionMeta };
    };

    const avatarSeedValue = $derived(avatarSeed(authorState.name, authorState.id));
    const bannerInput = $derived<BannerInput>({
        name: authorState.name,
        siteUrl: authorState.siteUrl.trim() || publicEnv.PUBLIC_SITE_URL || '',
        social:
            socialInitial?.[0] ?
                {
                    url: socialInitial[0].url,
                    platform: socialInitial[0].platform,
                    icon: socialInitial[0].icon
                }
            :   null
    });
    const avatarGenerated = $derived(
        !preparedImage
            && (avatarRemoved
                || !authorState.avatarVersion
                || identityMeta.avatar?.source === 'generated')
    );
    const bannerGenerated = $derived(
        !preparedBanner
            && (bannerRemoved
                || !authorState.bannerVersion
                || identityMeta.banner?.source === 'generated')
    );

    $effect(() => {
        if (!bannerGenerated) {
            bannerPreviewError = '';
            return;
        }
        const input = bannerInput;
        let cancelled = false;
        const timer = setTimeout(async () => {
            renderingBanner = true;
            try {
                const canvas = await renderBanner(input);
                if (cancelled) return;
                generatedBanner = canvas.toDataURL('image/png');
                bannerPreviewError = '';
            } catch (error) {
                if (cancelled) return;
                generatedBanner = '';
                bannerPreviewError =
                    error instanceof Error ?
                        error.message
                    :   'Banner preview could not be generated.';
            } finally {
                if (!cancelled) renderingBanner = false;
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    });

    async function processBannerFile(file: File) {
        const output = await processSiteBanner(file);
        return {
            value: output,
            preview: output.wide.webp,
            sizeLabel: `${Math.ceil(output.wide.webp.size / 1000)} KB · 1280 × 640`
        };
    }

    async function processAvatarFile(file: File, signal: AbortSignal) {
        const output = await processAvatar(file, signal);
        return {
            value: output,
            preview: new Blob([output.files['avatar.png']], { type: 'image/png' }),
            sizeLabel: `${Math.ceil(output.files['avatar.png'].byteLength / 1000)} KB · 512 × 512`
        };
    }

    async function planIdentity(): Promise<IdentityPlan> {
        const plan: IdentityPlan = {};
        try {
            if (preparedImage)
                plan.avatar = {
                    files: preparedImage,
                    meta: { source: 'custom', fingerprint: null }
                };
            else if (avatarGenerated) {
                const seed = avatarSeedValue;
                const fingerprint = await avatarFingerprint(seed);
                if (
                    avatarRemoved
                    || !authorState.avatarVersion
                    || identityMeta.avatar?.fingerprint !== fingerprint
                )
                    plan.avatar = {
                        files: await generateAvatarPackage(seed, new AbortController().signal),
                        meta: { source: 'generated', fingerprint }
                    };
            }
            if (preparedBanner)
                plan.banner = {
                    files: preparedBanner,
                    meta: { source: 'custom', fingerprint: null }
                };
            else if (bannerGenerated) {
                const input = $state.snapshot(bannerInput);
                const fingerprint = await bannerFingerprint(input);
                if (
                    bannerRemoved
                    || !authorState.bannerVersion
                    || identityMeta.banner?.fingerprint !== fingerprint
                )
                    plan.banner = {
                        files: await generateBannerPackage(input),
                        meta: { source: 'generated', fingerprint }
                    };
            }
        } catch (error) {
            throw new Error(
                `Generated images could not be created: ${error instanceof Error ? error.message : 'unknown error'}`,
                { cause: error }
            );
        }
        return plan;
    }

    async function submitProfile(profile: Record<string, unknown>, plan: IdentityPlan) {
        const form = new FormData();
        form.set(
            'profile',
            JSON.stringify({
                ...profile,
                id: authorState.id || null,
                revision: authorState.revision ?? 0
            })
        );
        if (plan.avatar) {
            for (const [name, bytes] of Object.entries(plan.avatar.files.files))
                form.set(name, new Blob([bytes]), name);
            form.set('vector', JSON.stringify(plan.avatar.files.paths));
        }
        if (plan.banner) {
            form.set('banner.webp', plan.banner.files.wide.webp, 'banner.webp');
            form.set('banner.avif', plan.banner.files.wide.avif, 'banner.avif');
            form.set('banner-og.webp', plan.banner.files.og.webp, 'banner-og.webp');
        }
        if (plan.avatar || plan.banner)
            form.set(
                'identity',
                JSON.stringify({ avatar: plan.avatar?.meta, banner: plan.banner?.meta })
            );
        const response = await adminFetch('/api/internal/admin/profile', {
            method: 'POST',
            body: form
        });
        return { response, result: await readJson(response) };
    }

    function replacePreview(current: string, blob: Blob) {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
    }

    function applyIdentity(profile: Record<string, any>, plan: IdentityPlan) {
        if (plan.avatar)
            savedAvatarPreview = replacePreview(
                savedAvatarPreview,
                new Blob([plan.avatar.files.files['avatar.png']], { type: 'image/png' })
            );
        if (plan.banner)
            savedBannerPreview = replacePreview(savedBannerPreview, plan.banner.files.wide.webp);
        authorState.id = profile.id;
        authorState.avatar = profile.avatar;
        authorState.revision = profile.profile_revision;
        authorState.avatarVersion = profile.avatar_version;
        authorState.bannerVersion = profile.banner_version;
        if (plan.avatar) identityMeta.avatar = plan.avatar.meta;
        if (plan.banner) identityMeta.banner = plan.banner.meta;
        preparedImage = null;
        preparedBanner = null;
        avatarRemoved = false;
        bannerRemoved = false;
    }

    async function syncGeneratedIdentity() {
        if (
            syncingIdentity
            || !authorState.id
            || isSavingAuthor
            || preparedImage
            || preparedBanner
            || avatarRemoved
            || bannerRemoved
        )
            return;
        syncingIdentity = true;
        try {
            const plan = await planIdentity();
            if (!plan.avatar && !plan.banner) return;
            const { response, result } = await submitProfile({}, plan);
            if (!response.ok)
                throw new Error(
                    result.error?.message
                        || result.message
                        || 'Generated images could not be saved.'
                );
            applyIdentity(result.profile, plan);
            if (authorInitial)
                authorInitial = {
                    ...authorInitial,
                    id: authorState.id,
                    avatar: authorState.avatar,
                    revision: authorState.revision,
                    avatarVersion: authorState.avatarVersion,
                    bannerVersion: authorState.bannerVersion
                };
        } catch (error) {
            toastStore.error(
                error instanceof Error ? error.message : 'Generated images could not be saved.'
            );
        } finally {
            syncingIdentity = false;
        }
    }
    let sponsorshipInitial = $state<SponsorshipLink[] | null>(null);
    let contactInitial = $state<ContactInfo[] | null>(null);
    let pinnedReposInitial = $state<string[] | null>(null);
    let excludedReposInitial = $state<string[] | null>(null);

    const termValidation = new FieldValidation();
    let termFeedback = $state<Record<string, { error: string; valid: boolean }>>({});
    const termFields = {
        pinned: {
            value: () => pinnedReposState,
            baseline: () => pinnedReposInitial,
            max: 3,
            length: 100
        },
        excluded: {
            value: () => excludedReposState,
            baseline: () => excludedReposInitial,
            max: 50,
            length: 100
        }
    };
    for (const [key, field] of Object.entries(termFields))
        termValidation.register(key, {
            value: field.value,
            baseline: field.baseline,
            validate: (values: string[]) =>
                values.length > field.max ? `Use at most ${field.max} items.`
                : values.some(value => !value.trim() || value.trim().length > field.length) ?
                    `Each item must contain 1–${field.length} characters.`
                :   '',
            report: result => {
                termFeedback[key] = result;
            }
        });
    onDestroy(() => termValidation.destroy());

    const resumeIsDirty = $derived(
        resumeInitial !== null && JSON.stringify(resumeState) !== JSON.stringify(resumeInitial)
    );
    const skillsIsDirty = $derived(
        skillsInitial !== null && JSON.stringify(skillsState) !== JSON.stringify(skillsInitial)
    );
    const socialIsDirty = $derived(
        socialInitial !== null && JSON.stringify(socialState) !== JSON.stringify(socialInitial)
    );
    const sponsorshipIsDirty = $derived(
        sponsorshipInitial !== null
            && JSON.stringify(sponsorshipState) !== JSON.stringify(sponsorshipInitial)
    );
    const contactIsDirty = $derived(
        contactInitial !== null && JSON.stringify(contactState) !== JSON.stringify(contactInitial)
    );
    const projectsIsDirty = $derived(
        pinnedReposInitial !== null
            && (JSON.stringify(pinnedReposState) !== JSON.stringify(pinnedReposInitial)
                || JSON.stringify(excludedReposState) !== JSON.stringify(excludedReposInitial))
    );
    let isSavingProjects = $state(false);
    let resumeDocState = $state<ResumeDocument>({
        filename: '',
        fileUrl: '',
        hash: '',
        isActive: false
    });
    let isGeneratingPdf = $state(false);
    let isDownloadingResume = $state(false);

    const isResumeAvailable = $derived(
        Boolean(resumeDocState?.filename && resumeDocState?.isActive)
    );

    const resumeLastUpdated = $derived.by(() => {
        if (!resumeDocState?.updatedAt) return '';
        const d = new Date(resumeDocState.updatedAt);
        if (isNaN(d.getTime())) return '';
        return formatAdminDateTime(d, undefined, adminDisplayStore.current);
    });

    const resumeVersion = $derived.by(() => {
        if (resumeDocState?.version) return `v${resumeDocState.version}`;
        const match = resumeDocState?.filename?.match(/-v(\d+\.\d+(?:\.\d+)?)\.pdf$/i);
        return match ? `v${match[1]}` : '';
    });

    async function downloadResumeDocument() {
        if (!resumeDocState.fileUrl) return;
        isDownloadingResume = true;
        try {
            const res = await fetch(resumeDocState.fileUrl);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = resumeDocState.filename || 'resume.pdf';
            a.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            toastStore.error('Could not download directly, opening in a new tab');
            window.open(resumeDocState.fileUrl, '_blank');
        } finally {
            isDownloadingResume = false;
        }
    }

    let isSavingSignature = $state(false);
    let signatureError = $state('');
    let openPgpKey = $state<PublicOpenPgpKey | null>(null);
    let isSavingKey = $state(false);
    let keyError = $state('');
    let keyserverError = $state('');
    let showRemoveSignatureDialog = $state(false);
    let keyserverChoice = $state<Record<string, boolean>>({});
    let customKeyserver = $state('');
    let showRemoveKeyDialog = $state(false);

    const resumeSignedByKey = $derived(
        Boolean(
            resumeDocState.signedAt
            && openPgpKey
            && resumeDocState.signerFingerprint === openPgpKey.fingerprint
        )
    );
    const resumeChecksumTabs = $derived(
        resumeDocState.checksums ?
            RESUME_CHECKSUM_ALGORITHMS.map(algorithm => ({
                label: algorithm.label,
                code: resumeDocState.checksums![algorithm.ext],
                copyLabel: `${algorithm.label} checksum`,
                downloadUrl: resumeApiFile(algorithm.ext),
                downloadLabel: `Download ${resumeDocState.filename}.${algorithm.ext}`
            }))
        :   []
    );
    const resumeSignTabs = $derived(
        openPgpKey ?
            [
                {
                    label: 'Binary',
                    code: `gpg --local-user ${openPgpKey.fingerprint} --detach-sign ${resumeDocState.filename}`
                },
                {
                    label: 'Armored',
                    code: `gpg --local-user ${openPgpKey.fingerprint} --armor --detach-sign ${resumeDocState.filename}`
                }
            ]
        :   []
    );
    const keyExpiresSoon = $derived(
        Boolean(
            openPgpKey?.expiresAt
            && new Date(openPgpKey.expiresAt).getTime() - Date.now() < 30 * 86_400_000
        )
    );
    const keyWkdEmails = $derived.by(() => {
        if (!openPgpKey || !URL.canParse(publicSiteUrl)) return [];
        return wkdEmails(openPgpKey.userIds, new URL(publicSiteUrl).host);
    });

    const resumeSignedAt = $derived(
        resumeDocState.signedAt ?
            formatAdminDateTime(
                new Date(resumeDocState.signedAt),
                undefined,
                adminDisplayStore.current
            )
        :   ''
    );
    const keyCreated = $derived(
        openPgpKey?.createdAt ?
            formatAdminDateTime(
                new Date(openPgpKey.createdAt),
                undefined,
                adminDisplayStore.current
            )
        :   ''
    );
    const keyExpires = $derived(
        openPgpKey?.expiresAt ?
            formatAdminDateTime(
                new Date(openPgpKey.expiresAt),
                undefined,
                adminDisplayStore.current
            )
        :   ''
    );

    function resumeApiFile(output: Parameters<typeof resumeFileUrl>[0]) {
        return resumeFileUrl(output, publicEnv.PUBLIC_API_BASE_URL);
    }

    function syncKeyserverChoice(key: PublicOpenPgpKey | null) {
        const urls = new Set(key?.keyservers.map(server => server.url) ?? []);
        keyserverChoice = Object.fromEntries(
            KEYSERVER_PRESETS.map(preset => [
                preset.id,
                Boolean(key && urls.has(preset.url(key.fingerprint)))
            ])
        );
        const presetUrls = new Set(
            key ? KEYSERVER_PRESETS.map(preset => preset.url(key.fingerprint)) : []
        );
        customKeyserver = key?.keyservers.find(server => !presetUrls.has(server.url))?.url ?? '';
    }

    async function responseMessage(response: Response, fallback: string) {
        const res = await response.json().catch(() => ({}));
        if (response.ok && res.success) return { res, error: '' };
        return { res, error: res?.message ?? res?.error?.message ?? fallback };
    }

    async function updateResumeSignature(file: File | null) {
        signatureError = '';
        if (!file) return;
        if (file.size > 16 * 1024) {
            signatureError = 'Signature files are at most 16 KiB.';
            return;
        }
        isSavingSignature = true;
        try {
            const response = await adminFetch('/api/internal/admin/resume/signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: await file.arrayBuffer()
            });
            const { res, error } = await responseMessage(response, 'Upload failed.');
            if (error) throw new Error(error);
            resumeDocState = {
                ...resumeDocState,
                signedAt: res.signedAt,
                signerFingerprint: res.signerFingerprint
            };
            toastStore.success('Signature verified and published.');
        } catch (err) {
            signatureError = err instanceof Error ? err.message : 'Upload failed.';
        } finally {
            isSavingSignature = false;
        }
    }

    async function removeResumeSignature() {
        showRemoveSignatureDialog = false;
        isSavingSignature = true;
        signatureError = '';
        try {
            const response = await adminFetch('/api/internal/admin/resume/signature', {
                method: 'DELETE'
            });
            const { error } = await responseMessage(response, 'Removal failed.');
            if (error) throw new Error(error);
            resumeDocState = { ...resumeDocState, signedAt: null, signerFingerprint: null };
            toastStore.success('Resume signature deleted.');
        } catch (err) {
            signatureError = err instanceof Error ? err.message : 'Removal failed.';
        } finally {
            isSavingSignature = false;
        }
    }

    function chosenKeyservers(fingerprint: string): OpenPgpKeyserver[] {
        const servers: OpenPgpKeyserver[] = KEYSERVER_PRESETS.filter(
            preset => keyserverChoice[preset.id]
        ).map(preset => ({ label: preset.label, url: preset.url(fingerprint) }));
        const custom = customKeyserver.trim();
        if (custom) {
            const parsed = new URL(custom);
            if (parsed.protocol !== 'https:') throw new Error('Keyservers must use https.');
            servers.push({ label: parsed.host, url: custom });
        }
        return servers;
    }

    async function saveOpenPgpKey(file: File | null = null) {
        keyError = '';
        keyserverError = '';
        if (file && file.size > 64 * 1024) {
            keyError = 'Public keys must be at most 64 KiB.';
            return;
        }
        isSavingKey = true;
        try {
            let key: { armored?: string; base64?: string } | undefined;
            if (file) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const text = new TextDecoder().decode(bytes);
                key =
                    text.trimStart().startsWith('-----BEGIN PGP ') ?
                        { armored: text }
                    :   {
                            base64: btoa(
                                Array.from(bytes, byte => String.fromCharCode(byte)).join('')
                            )
                        };
            }
            let keyservers: OpenPgpKeyserver[] = [];
            try {
                keyservers = openPgpKey && !file ? chosenKeyservers(openPgpKey.fingerprint) : [];
            } catch {
                throw new Error('The custom keyserver must be a full https:// URL.');
            }
            const response = await adminFetch('/api/internal/admin/openpgp-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key,
                    keyservers: file ? (openPgpKey?.keyservers ?? []) : keyservers
                })
            });
            const { res, error } = await responseMessage(response, 'Could not save the key.');
            if (error) throw new Error(error);
            openPgpKey = { ...res.key, armored: res.key.armored ?? '' };
            syncKeyserverChoice(openPgpKey);
            if (res.signatureCleared) {
                resumeDocState = { ...resumeDocState, signedAt: null, signerFingerprint: null };
                toastStore.success('Key saved. Sign the resume again with the new key.');
            } else toastStore.success(file ? 'OpenPGP key published.' : 'Keyservers saved.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not save the key.';
            if (file) keyError = message;
            else keyserverError = message;
        } finally {
            isSavingKey = false;
        }
    }

    async function removeOpenPgpKey() {
        showRemoveKeyDialog = false;
        isSavingKey = true;
        keyError = '';
        try {
            const response = await adminFetch('/api/internal/admin/openpgp-key', {
                method: 'DELETE'
            });
            const { error } = await responseMessage(response, 'Could not delete the key.');
            if (error) throw new Error(error);
            openPgpKey = null;
            syncKeyserverChoice(null);
            resumeDocState = { ...resumeDocState, signedAt: null, signerFingerprint: null };
            toastStore.success('OpenPGP key deleted.');
        } catch (err) {
            toastStore.error(err instanceof Error ? err.message : 'Could not delete the key.');
        } finally {
            isSavingKey = false;
        }
    }

    const listValidation = new FieldValidation();
    onDestroy(() => listValidation.destroy());
    let experienceErrors = $state<Record<string, Record<string, string>>>({});
    let experienceValid = $state<Record<string, Record<string, boolean>>>({});
    let educationErrors = $state<Record<string, Record<string, string>>>({});
    let educationValid = $state<Record<string, Record<string, boolean>>>({});
    let skillsErrors = $state<Record<string, Record<string, string>>>({});
    let skillsValid = $state<Record<string, Record<string, boolean>>>({});
    let socialErrors = $state<Record<string, Record<string, string>>>({});
    let socialValid = $state<Record<string, Record<string, boolean>>>({});
    let sponsorshipErrors = $state<Record<string, Record<string, string>>>({});
    let sponsorshipValid = $state<Record<string, Record<string, boolean>>>({});
    let contactErrors = $state<Record<string, Record<string, string>>>({});
    let contactValid = $state<Record<string, Record<string, boolean>>>({});
    type ListGroup = 'experience' | 'education' | 'skills' | 'social' | 'sponsorship' | 'contact';
    function listConfig(group: ListGroup) {
        const configs = {
            experience: {
                items: resumeState.experience,
                baseline: resumeInitial?.experience,
                errors: experienceErrors,
                valid: experienceValid,
                fields: {
                    title: 'Title',
                    type: 'Employment type',
                    locType: 'Location type',
                    company: 'Company',
                    location: 'Location',
                    description: 'Description'
                }
            },
            education: {
                items: resumeState.education,
                baseline: resumeInitial?.education,
                errors: educationErrors,
                valid: educationValid,
                fields: {
                    institution: 'Institution',
                    degree: 'Degree',
                    field: 'Field of study',
                    grade: 'Grade',
                    description: 'Description'
                }
            },
            skills: {
                items: skillsState,
                baseline: skillsInitial,
                errors: skillsErrors,
                valid: skillsValid,
                fields: { category: 'Area of expertise' }
            },
            social: {
                items: socialState,
                baseline: socialInitial,
                errors: socialErrors,
                valid: socialValid,
                fields: { icon: 'Icon', platform: 'Platform', url: 'URL' }
            },
            sponsorship: {
                items: sponsorshipState,
                baseline: sponsorshipInitial,
                errors: sponsorshipErrors,
                valid: sponsorshipValid,
                fields: {
                    icon: 'Icon',
                    platform: 'Platform',
                    displayValue: 'Display text',
                    url: 'URL'
                }
            },
            contact: {
                items: contactState,
                baseline: contactInitial,
                errors: contactErrors,
                valid: contactValid,
                fields: {
                    icon: 'Icon',
                    platform: 'Platform',
                    displayValue: 'Display text',
                    href: 'URL'
                }
            }
        };
        return configs[group];
    }
    const OPTIONAL_LIST_FIELDS = new Set(['education:grade']);
    function listField(group: ListGroup, item: { id?: string }, field: string, label: string) {
        const id = item.id!;
        const key = `${group}:${id}:${field}`;
        const value = (entry: unknown) =>
            (entry as Record<string, unknown> | undefined)?.[field] ?? '';
        listValidation.register(key, {
            value: () => value(item),
            baseline: () => {
                const entry = listConfig(group).baseline?.find(entry => entry.id === id);
                return entry ? value(entry) : undefined;
            },
            validate: value =>
                listFieldError(
                    field,
                    label,
                    String(value),
                    OPTIONAL_LIST_FIELDS.has(`${group}:${field}`)
                ),
            report: result => {
                const config = listConfig(group);
                config.errors[id] ??= {};
                config.valid[id] ??= {};
                config.errors[id][field] = result.error;
                config.valid[id][field] = result.valid;
            }
        });
        return key;
    }
    function listInput(group: ListGroup, idx: number, field: string, label: string, blur = false) {
        const item = listConfig(group).items[idx];
        if (!item) return;
        queueMicrotask(() => {
            const key = listField(group, item, field, label);
            if (blur) void listValidation.check(key);
            else listValidation.input(key);
        });
    }
    function dateField(group: 'experience' | 'education', item: ExperienceItem | EducationItem) {
        const key = `${group}:${item.id}:dates`;
        const dates = (entry?: ExperienceItem | EducationItem) =>
            entry ?
                [
                    entry.startMonth,
                    entry.startYear,
                    entry.endMonth,
                    entry.endYear,
                    entry.currentlyIn
                ]
            :   undefined;
        listValidation.register(key, {
            value: () => dates(item),
            baseline: () =>
                dates(
                    listConfig(group).baseline?.find(entry => entry.id === item.id) as
                        ExperienceItem | EducationItem | undefined
                ),
            validate: () => {
                if (!MONTHS.some(month => month === item.startMonth) || !item.startYear)
                    return 'Start month and year are required.';
                if (item.currentlyIn) return '';
                if (!!item.endMonth !== !!item.endYear) return 'Select both end month and year.';
                if (
                    item.endMonth
                    && item.endYear
                    && item.endYear * 12 + MONTHS.findIndex(month => month === item.endMonth)
                        < item.startYear * 12 + MONTHS.findIndex(month => month === item.startMonth)
                )
                    return 'End date must be on or after the start date.';
                return '';
            },
            report: result => {
                const config = listConfig(group);
                config.errors[item.id!] ??= {};
                config.errors[item.id!].dates = result.error;
            }
        });
        return key;
    }
    function onDateInput(group: 'experience' | 'education', item: ExperienceItem | EducationItem) {
        queueMicrotask(() => {
            void listValidation.check(dateField(group, item));
        });
    }
    async function validateList(group: ListGroup) {
        const config = listConfig(group);
        const keys = config.items.flatMap(item => {
            const keys = Object.entries(config.fields).map(([field, label]) =>
                listField(group, item, field, label)
            );
            if (group === 'experience' || group === 'education')
                keys.push(dateField(group, item as ExperienceItem | EducationItem));
            return keys;
        });
        return listValidation.submit(keys);
    }
    function validateExperienceField(idx: number, field: string, label = field) {
        listInput('experience', idx, field, label);
    }
    function validateEducationField(idx: number, field: string, label = field) {
        listInput('education', idx, field, label);
    }
    function validateSkillField(idx: number) {
        listInput('skills', idx, 'category', 'Area of expertise');
    }
    function validateSocialField(idx: number, field: string, label = field) {
        listInput('social', idx, field, label);
    }
    function validateSponsorshipField(idx: number, field: string, label = field) {
        listInput('sponsorship', idx, field, label);
    }
    function validateContactField(idx: number, field: string, label = field) {
        listInput('contact', idx, field, label);
    }
    function validateAllExperience() {
        return validateList('experience');
    }
    function validateAllEducation() {
        return validateList('education');
    }
    function validateAllSkills() {
        return validateList('skills');
    }
    function validateAllSocials() {
        return validateList('social');
    }
    function validateAllSponsorship() {
        return validateList('sponsorship');
    }
    function validateAllContact() {
        return validateList('contact');
    }
    let isDeletingAllData = $state(false);

    let pdfUploadError = $state('');
    let pdfGeneratedFilename = $state('');
    let pdfDeleteSuccess = $state(false);

    let isSavingResume = $state(false);
    let resumeSaveSuccess = $state(false);
    let isSavingSkills = $state(false);
    let skillsSaveSuccess = $state(false);
    let isSavingSocials = $state(false);
    let socialsSaveSuccess = $state(false);
    let isSavingSponsorship = $state(false);
    let sponsorshipSaveSuccess = $state(false);
    let isSavingContact = $state(false);
    let contactSaveSuccess = $state(false);

    function parsePastedSkillsText(text: string): { category: string | null; skills: string[] } {
        const colonIdx = text.indexOf(':');
        if (colonIdx === -1) {
            return { category: null, skills: splitEscapedCommas(text) };
        }
        const category = text.slice(0, colonIdx).trim();
        return { category: category || null, skills: splitEscapedCommas(text.slice(colonIdx + 1)) };
    }

    function mergeSkills(existing: string[], toAdd: string[]): string[] {
        const result = [...existing];
        for (const s of toAdd) {
            if (s && !result.includes(s)) result.push(s);
        }
        return result;
    }

    function handleCategoryPaste(idx: number, e: ClipboardEvent) {
        const text = e.clipboardData?.getData('text/plain') ?? '';
        const parsed = parsePastedSkillsText(text);
        if (parsed.category === null) return;
        e.preventDefault();
        skillsState[idx].category = parsed.category;
        skillsState[idx].skills = mergeSkills(skillsState[idx].skills, parsed.skills);
        validateSkillField(idx);
    }

    function handleSkillsSetPaste(idx: number, e: ClipboardEvent) {
        const text = e.clipboardData?.getData('text/plain') ?? '';
        const parsed = parsePastedSkillsText(text);
        if (parsed.skills.length === 0 && parsed.category === null) return;
        e.preventDefault();
        if (parsed.category !== null) {
            skillsState[idx].category = parsed.category;
            validateSkillField(idx);
        }
        skillsState[idx].skills = mergeSkills(skillsState[idx].skills, parsed.skills);
        (e.currentTarget as HTMLInputElement).value = '';
    }

    const statusFilter = $derived(filterStore.filters['status']?.[0] || 'all');

    const allPostTags = $derived.by(() => {
        const set = new SvelteSet<string>();
        for (const post of posts) {
            if (post.tags) {
                post.tags.forEach(t => set.add(decodeHtmlEntities(t)));
            }
        }
        return Array.from(set).sort();
    });

    const POST_STATUS_OPTIONS = [
        { value: 'all', label: 'All' },
        { value: 'published', label: 'Published' },
        { value: 'draft', label: 'Draft' }
    ];
    const POST_SORT_FIELDS = [
        { value: 'date', label: 'Date' },
        { value: 'title', label: 'Title' },
        { value: 'status', label: 'Status' },
        { value: 'views', label: 'Views' },
        { value: 'comments', label: 'Comments' }
    ];
    const togglePostSortDirection = () =>
        filterStore.setSort(
            filterStore.sort.field,
            filterStore.sort.direction === 'asc' ? 'desc' : 'asc'
        );
    const postMenuGroups = $derived<FilterMenuGroup[]>([
        {
            label: 'Status',
            mode: 'single',
            options: POST_STATUS_OPTIONS,
            selected: [statusFilter],
            defaultValue: 'all',
            onSelect: value => filterStore.setSingleFilter('status', value)
        },
        {
            label: 'Tag',
            mode: 'multi',
            options: allPostTags.map(t => ({ value: t, label: t })),
            selected: filterStore.filters['tag'] || [],
            onSelect: value => filterStore.toggleMultiFilter('tag', value),
            searchable: true,
            searchPlaceholder: 'Search tags...'
        },
        ...sortMenuGroups({
            fields: POST_SORT_FIELDS,
            field: filterStore.sort.field,
            direction: filterStore.sort.direction,
            onFieldChange: field => filterStore.setSort(field, filterStore.sort.direction),
            onDirectionToggle: togglePostSortDirection
        })
    ]);

    const postCommentCounts = new SvelteMap<string, number>();

    function getPostComments(postId: string): AdminComment[] {
        return comments.filter(c => c.post_id === postId);
    }

    let filteredPosts = $derived.by(() => {
        let result = [...posts];

        if (filterStore.search.trim()) {
            const q = filterStore.search.toLowerCase().trim();
            result = result.filter(
                p =>
                    p.title.toLowerCase().includes(q)
                    || p.slug.toLowerCase().includes(q)
                    || (p.excerpt && p.excerpt.toLowerCase().includes(q))
            );
        }

        if (statusFilter === 'published') {
            result = result.filter(p => p.published);
        } else if (statusFilter === 'draft') {
            result = result.filter(p => !p.published);
        }

        const selectedTags = filterStore.filters['tag'] || [];
        if (selectedTags.length > 0) {
            result = result.filter(p => p.tags && p.tags.some(t => selectedTags.includes(t)));
        }

        const { field, direction } = filterStore.sort;
        const mult = direction === 'asc' ? 1 : -1;

        result.sort((a, b) => {
            if (field === 'date') {
                return mult * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            }
            if (field === 'title') {
                return mult * a.title.localeCompare(b.title);
            }
            if (field === 'status') {
                return mult * (Number(a.published) - Number(b.published));
            }
            if (field === 'views') {
                const vA = a.views_count;
                const vB = b.views_count;
                return mult * (vA - vB);
            }
            if (field === 'comments') {
                const cA = postCommentCounts.get(a.id) ?? a.comment_count;
                const cB = postCommentCounts.get(b.id) ?? b.comment_count;
                return mult * (cA - cB);
            }
            if (field === 'readingTime') {
                const rA = a.read_minutes ?? 0;
                const rB = b.read_minutes ?? 0;
                return mult * (rA - rB);
            }
            return 0;
        });

        return result;
    });

    const POSTS_PAGE_SIZE = 4;

    let postsPage = $state(1);

    const postsTotalPages = $derived(
        Math.max(1, Math.ceil(filteredPosts.length / POSTS_PAGE_SIZE))
    );
    const postsPageClamped = $derived(Math.min(postsPage, postsTotalPages));
    const paginatedPosts = $derived(
        filteredPosts.slice(
            (postsPageClamped - 1) * POSTS_PAGE_SIZE,
            postsPageClamped * POSTS_PAGE_SIZE
        )
    );

    $effect(() => {
        void filterStore.search;
        void filterStore.filters;
        void filterStore.sort;
        untrack(() => {
            postsPage = 1;
        });
    });

    const expandedPostIds = new SvelteSet<string>();
    function toggleComments(postId: string) {
        if (expandedPostIds.has(postId)) {
            expandedPostIds.delete(postId);
        } else {
            expandedPostIds.add(postId);
            void fetchComments(postId);
        }
    }

    async function handleAdminSubmit(e: SubmitEvent, parentId: string, postId: string) {
        e.preventDefault();
        if (isSubmitting) return;

        const trimmed = commentContent.trim();
        if (!(await replyValidation.submit(undefined, true))) return;

        isSubmitting = true;
        try {
            const res = await adminFetch('/api/internal/admin/comments/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    parentId,
                    authorName: authorState.name || siteAuthorName,
                    content: trimmed
                })
            });

            const resData = await res.json().catch(() => null);
            if (!res.ok) {
                const msg =
                    typeof resData?.error?.message === 'string' ? resData.error.message
                    : typeof resData?.message === 'string' ? resData.message
                    : 'Failed to post reply.';
                throw new Error(msg);
            }

            if (resData?.comment) {
                await fetchComments(postId);
                commentContent = '';
                replyValidation.reset();
                replyTo = null;
                toastStore.success('Reply posted.');
            }
        } catch (err) {
            console.error('Error posting admin reply:', err);
            toastStore.error(err instanceof Error ? err.message : 'Failed to post reply.');
        } finally {
            isSubmitting = false;
        }
    }

    let sessionTimeoutMultiplier = $state(1);
    const MAX_IDLE_TIMEOUT_MULTIPLIER = 4;
    let BASE_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
    const SESSION_WARNING_MS = SESSION_WARNING_SECONDS * 1000;
    let idleWarnTimer: ReturnType<typeof setTimeout>;
    let signOutTimer: ReturnType<typeof setTimeout>;
    let showSessionTimeoutDialog = $state(false);
    let sessionDeadline = $state(0);
    const extendMinutes = $derived(
        extendedTimeoutMinutes(
            BASE_IDLE_TIMEOUT_MS,
            sessionTimeoutMultiplier,
            MAX_IDLE_TIMEOUT_MULTIPLIER
        )
    );

    function startIdleTimer() {
        clearTimeout(idleWarnTimer);
        clearTimeout(signOutTimer);
        const warnMs = BASE_IDLE_TIMEOUT_MS * sessionTimeoutMultiplier - SESSION_WARNING_MS;

        idleWarnTimer = setTimeout(() => {
            sessionDeadline = Date.now() + SESSION_WARNING_MS;
            showSessionTimeoutDialog = true;
            signOutTimer = setTimeout(handleLogout, SESSION_WARNING_MS);
        }, warnMs);
    }

    async function handleExtendSession() {
        sessionTimeoutMultiplier = Math.min(
            sessionTimeoutMultiplier * 2,
            MAX_IDLE_TIMEOUT_MULTIPLIER
        );
        showSessionTimeoutDialog = false;
        clearTimeout(signOutTimer);
        startIdleTimer();
    }

    function handleVisibilityChange() {
        if (
            document.visibilityState === 'visible'
            && showSessionTimeoutDialog
            && Date.now() >= sessionDeadline
        ) {
            void handleLogout();
        }
    }

    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

    function handleUserActivity() {
        if (!showSessionTimeoutDialog) {
            startIdleTimer();
        }
    }

    onMount(() => {
        let active = true;
        try {
            sidebarCollapsed = localStorage.getItem('admin-sidebar-collapsed') === '1';
            const min = window.innerWidth * 0.15;
            const max = window.innerWidth * 0.2;
            const savedWidth = Number(localStorage.getItem('admin-sidebar-width'));
            sidebarWidth = savedWidth ? Math.min(max, Math.max(min, savedWidth)) : min;
        } catch {}
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isLegalDirty) {
                e.preventDefault();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        (async () => {
            if (!active) return;
            adminUserEmail = page.data.admin?.email ?? '';

            const pendingToast = sessionStorage.getItem('admin_toast');
            if (pendingToast) {
                sessionStorage.removeItem('admin_toast');
                try {
                    const { message, type } = JSON.parse(pendingToast);
                    if (message) toastStore.show(message, type);
                } catch (err) {
                    console.error('Failed to parse pending toast:', err);
                }
            }

            startIdleTimer();
            ACTIVITY_EVENTS.forEach(evt =>
                window.addEventListener(evt, handleUserActivity, { passive: true })
            );

            try {
                await Promise.allSettled([
                    ensureTabData(activeAdminTab),
                    adminNotificationsStore.load()
                ]);
                if (active) adminNotificationsStore.subscribe();
            } catch (err) {
                console.error('Error loading admin dashboard data:', err);
            } finally {
                isLoading = false;
            }
        })();

        const currentUrl = adminUrl();
        if (
            cleanAdminParams(currentUrl.searchParams).toString()
            !== currentUrl.searchParams.toString()
        )
            navigateAdmin(currentUrl, true);
        const stopDisplaySync = adminDisplayStore.init();
        const stopSettingsSync = startAdminSettingsSync();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            stopDisplaySync?.();
            stopSettingsSync();
            clearTimeout(idleWarnTimer);
            clearTimeout(signOutTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            adminNotificationsStore.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleUserActivity));
            }
        };
    });

    async function loadAdminData() {
        try {
            const {
                profile: p,
                identity,
                resume,
                funding: sp,
                contact: ct,
                social: soc,
                skills: sk,
                resumeDocument: doc,
                repoRules: rules,
                openPgpKey: pgpKey
            } = await adminRequest<AdminAuthorSnapshot>('author', {
                fallbackMessage: 'Author data could not be loaded.'
            });
            if (p) authorState = p;
            identityMeta = identity;
            authorInitial = { ...authorState };
            if (resume) resumeState = resume;
            resumeInitial = $state.snapshot(resumeState);
            listValidation.reset();
            if (sp) sponsorshipState = sp;
            sponsorshipInitial = $state.snapshot(sponsorshipState);
            listValidation.reset();
            if (ct) contactState = ct;
            contactInitial = $state.snapshot(contactState);
            listValidation.reset();
            if (soc) socialState = soc;
            socialInitial = $state.snapshot(socialState);
            listValidation.reset();
            if (sk) skillsState = sk;
            skillsInitial = $state.snapshot(skillsState);
            listValidation.reset();
            if (rules) {
                pinnedReposState = [...rules.pinned];
                excludedReposState = [...rules.excluded];
                pinnedReposInitial = $state.snapshot(pinnedReposState);
                excludedReposInitial = $state.snapshot(excludedReposState);
            }
            resumeDocState = doc || { filename: '', fileUrl: '', hash: '', isActive: false };
            openPgpKey = pgpKey;
            syncKeyserverChoice(pgpKey);
        } catch (err) {
            console.error('Failed to load admin supplementary data:', err);
        }
        void syncGeneratedIdentity();
    }

    let postsRequest = 0;

    async function fetchPosts() {
        if (postsLoading) return true;
        const current = ++postsRequest;
        postsLoading = true;
        postsLoadError = '';
        try {
            const { posts: loaded } = await adminRequest<{ posts: AdminPost[] }>('posts/list', {
                fallbackMessage: 'Posts could not be loaded. Please try again.'
            });
            if (current !== postsRequest) return true;
            posts = loaded;
            postCommentCounts.clear();
            return true;
        } catch (err) {
            console.error('Error fetching admin posts:', err);
            postsLoadError = 'Posts could not be loaded. Please try again.';
            return false;
        } finally {
            postsLoading = false;
        }
    }

    const MAX_COMMENT_PAGES = 50;

    async function fetchComments(postId?: string) {
        if (!postId) {
            await Promise.all([...expandedPostIds].map(id => fetchComments(id)));
            return true;
        }
        commentsLoading[postId] = true;
        try {
            type CommentsPage = Omit<WorkspacePage, 'items'> & {
                items: { comment: AdminComment }[];
            };
            const request = (extra: Record<string, string> = {}) =>
                adminActivityRequest<CommentsPage>('workspace', {
                    section: 'comments',
                    id: postId,
                    ...extra
                });
            const first = await request();
            const pages = Math.min(
                MAX_COMMENT_PAGES,
                Math.ceil((first.total ?? 0) / ADMIN_WORKSPACE_PAGE_SIZE)
            );
            const rest = await Promise.all(
                Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
                    request({ page: String(index + 2), asOf: first.asOf })
                )
            );
            const items = [first, ...rest].flatMap(result => result.items);
            comments = [
                ...comments.filter(c => c.post_id !== postId),
                ...items.map(item => item.comment)
            ];
            postCommentCounts.set(postId, first.total ?? items.length);
            commentsError[postId] = '';
            return true;
        } catch (caught) {
            commentsError[postId] =
                caught instanceof Error ? caught.message : 'Unable to load comments.';
            return false;
        } finally {
            commentsLoading[postId] = false;
        }
    }

    let supplementaryLoaded = false;
    let legalLoaded = false;
    let postsLoaded = false;
    const tabRequests: Partial<Record<string, Promise<void>>> = {};
    async function ensureTabData(tab: AdminTab) {
        if (['home', 'reports', 'feedback', 'notifications', 'logs'].includes(tab)) return;
        const group =
            tab === 'posts' ? 'posts'
            : isLegalSlug(tab) ? 'legal'
            : 'supplementary';
        if (
            (group === 'posts' && postsLoaded)
            || (group === 'legal' && legalLoaded)
            || (group === 'supplementary' && supplementaryLoaded)
        )
            return;
        if (tabRequests[group]) return tabRequests[group];
        const request = (async () => {
            if (group === 'posts')
                [postsLoaded] = await Promise.all([fetchPosts(), loadSiteAuthorName()]);
            else if (group === 'legal') {
                await loadLegalPages();
                legalLoaded = true;
            } else {
                await loadAdminData();
                supplementaryLoaded = true;
            }
        })();
        tabRequests[group] = request;
        try {
            await request;
        } finally {
            delete tabRequests[group];
        }
    }
    function openWorkspace(
        area: WorkspaceArea,
        id?: string,
        eventId?: string,
        notificationId?: string
    ) {
        selectTab(area);
        const url = adminUrl();
        if (id) url.searchParams.set('selected', id);
        if (eventId) url.searchParams.set('focus', eventId);
        if (notificationId) url.searchParams.set('notificationId', notificationId);
        navigateAdmin(url, true);
    }

    async function requestLogout() {
        if (sidebarMobileOpen) await closeMobileSidebar();
        showLogoutDialog = true;
    }

    async function handleLogout() {
        isLoggingOut = true;
        try {
            adminNotificationsStore.unsubscribe();
            window.location.href = ACCESS_LOGOUT_URL;
        } catch (err) {
            console.error('Error signing out:', err);
            isLoggingOut = false;
        }
    }

    async function handleTogglePublished(post: AdminPost) {
        try {
            const nextPublished = !post.published;
            if (nextPublished && !post.excerpt?.trim()) {
                toastStore.error('Add a manual excerpt before publishing this post.');
                return;
            }
            const updatedPost = await adminRequest<{ post_revision: number }>('posts/flags', {
                body: { id: post.id, published: nextPublished }
            });
            posts = posts.map(p =>
                p.id === post.id ?
                    { ...p, published: nextPublished, post_revision: updatedPost.post_revision }
                :   p
            );
            toastStore.success(nextPublished ? 'Post published.' : 'Post unpublished.');
        } catch (err) {
            console.error('Error updating post published status:', err);
            toastStore.error(err instanceof Error ? err.message : 'Failed to update post status.');
        }
    }

    async function handleTogglePinned(post: AdminPost) {
        try {
            const nextPinned = !post.pinned;
            if (nextPinned) {
                const pinnedCount = posts.filter(p => p.pinned).length;
                if (pinnedCount >= 3) {
                    toastStore.error('Maximum of 3 pinned posts allowed.');
                    return;
                }
            }
            const updatedPost = await adminRequest<{ post_revision: number }>('posts/flags', {
                body: { id: post.id, pinned: nextPinned }
            });
            posts = posts.map(p =>
                p.id === post.id ?
                    { ...p, pinned: nextPinned, post_revision: updatedPost.post_revision }
                :   p
            );
            toastStore.success(nextPinned ? 'Post pinned.' : 'Post unpinned.');
        } catch (err) {
            console.error('Error updating post pinned status:', err);
            toastStore.error(err instanceof Error ? err.message : 'Failed to update pin status.');
        }
    }

    function confirmDeletePost(post: AdminPost) {
        postToDelete = post;
        showDeletePostDialog = true;
    }

    let deletingPost = $state(false);

    async function executeDeletePost() {
        if (!postToDelete || deletingPost) return;
        deletingPost = true;
        const post = postToDelete;
        const key = `post-delete:${post.id}`;
        try {
            let form = await recallPostSave(key);
            if (!form) {
                form = new FormData();
                form.set(
                    'post',
                    JSON.stringify({
                        operationId: crypto.randomUUID(),
                        id: post.id,
                        revision: post.post_revision,
                        kind: 'delete'
                    })
                );
                await rememberPostSave(key, form);
            }
            await submitPost(form);
            await rememberPostSave(key, null);
            posts = posts.filter(p => p.id !== post.id);
            toastStore.success('Post deleted.');
            showDeletePostDialog = false;
            postToDelete = null;
        } catch (error) {
            if (error instanceof PostSaveError && error.definitive)
                await rememberPostSave(key, null);
            toastStore.error(
                error instanceof Error ?
                    error.message
                :   'Delete is not confirmed. Retry to check its status.'
            );
        } finally {
            deletingPost = false;
        }
    }

    function confirmDeleteComment(id: string) {
        commentIdToDelete = id;
        showDeleteCommentDialog = true;
    }

    async function executeDeleteComment() {
        if (!commentIdToDelete) return;
        try {
            const postId = comments.find(comment => comment.id === commentIdToDelete)?.post_id;
            await adminActivityRequest(
                'workspace',
                {},
                { action: 'delete_comment', id: commentIdToDelete }
            );
            if (postId) await fetchComments(postId);
            await adminNotificationsStore.load();
            toastStore.success('Comment deleted.');
        } catch (err) {
            console.error('Error deleting comment:', err);
            toastStore.error('Failed to delete comment.');
        } finally {
            showDeleteCommentDialog = false;
            commentIdToDelete = null;
        }
    }

    async function dismissCommentReports(commentId: string) {
        try {
            const res = await adminFetch('/api/internal/admin/comments/dismiss-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId })
            });
            if (!res.ok) throw new Error('Failed to dismiss reports');
            comments = comments.map(comment =>
                comment.id === commentId ? { ...comment, reports: 0 } : comment
            );
            await adminNotificationsStore.load();
            toastStore.success('Reports dismissed.');
        } catch (err) {
            console.error('Error dismissing comment reports:', err);
            toastStore.error('Failed to dismiss reports.');
        }
    }

    function moveArrayItem<T>(arr: T[], fromIndex: number, direction: 'up' | 'down'): T[] {
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= arr.length) return arr;
        const updated = [...arr];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        return updated;
    }

    async function handleSaveAuthor(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingAuthor || preparingImage || preparingBanner) return;
        if (!(await validateAllAuthorFields())) return;
        isSavingAuthor = true;
        authorSaveSuccess = false;
        authorSaveError = '';
        try {
            let cleanUsername = authorState.username.trim();
            if (cleanUsername.startsWith('@')) {
                cleanUsername = cleanUsername.replace(/^@+/, '');
            }
            cleanUsername = cleanUsername.replace(/\s+/g, '');

            const payload: Record<string, unknown> = {
                name: sanitizeInput(authorState.name.trim()),
                pronunciation: authorState.pronunciation || '',
                username: sanitizeInput(cleanUsername),
                headline: sanitizeInput(authorState.headline.trim()),
                job_title: sanitizeInput(authorState.jobTitle.trim()),
                bio: sanitizeInput(authorState.bio.trim()),
                email: authorState.email.trim(),
                city: sanitizeInput(authorState.city.trim()),
                postal_code: sanitizeInput(authorState.postalCode.trim()),
                country: sanitizeInput(authorState.country.trim()),
                site_url: authorState.siteUrl.trim()
            };

            const fieldNames: Record<string, keyof typeof authorState> = {
                name: 'name',
                pronunciation: 'pronunciation',
                username: 'username',
                headline: 'headline',
                job_title: 'jobTitle',
                bio: 'bio',
                email: 'email',
                city: 'city',
                postal_code: 'postalCode',
                country: 'country',
                site_url: 'siteUrl'
            };
            if (authorState.id && authorInitial)
                for (const [key, field] of Object.entries(fieldNames)) {
                    if (authorState[field] === authorInitial[field]) delete payload[key];
                }
            const plan = await planIdentity();
            const { response, result } = await submitProfile(payload, plan);
            if (!response.ok) {
                const details = result.error?.details ?? result.details;
                const fields =
                    typeof details === 'string' ? JSON.parse(details).fields : details?.fields;
                if (fields)
                    authorValidation.serverErrors(
                        Object.fromEntries(
                            Object.entries(fields).map(([key, value]) => [
                                fieldNames[key] || key,
                                String(value)
                            ])
                        )
                    );
                throw new Error(
                    result.error?.message || result.message || 'Could not save profile.'
                );
            }
            for (const [key, field] of Object.entries(fieldNames)) {
                if (typeof result.profile[key] === 'string')
                    (authorState as unknown as Record<string, unknown>)[field] =
                        key === 'pronunciation' ?
                            result.profile[key]
                        :   decodeHtmlEntities(result.profile[key]);
            }
            applyIdentity(result.profile, plan);

            authorState.username = cleanUsername;
            authorSaveSuccess = true;
            authorInitial = { ...authorState };
            authorValidation.reset();
            setTimeout(() => (authorSaveSuccess = false), 2500);
            toastStore.success('Author profile saved.');
            const currentAdminUrl = adminUrl();
            await refreshAll();
            navigateAdmin(currentAdminUrl, true);
            executeGenerateResumePdf();
        } catch (err: any) {
            console.error('Error saving author profile:', err);
            authorSaveError = err.message || 'Failed to save author profile.';
            toastStore.error(authorSaveError);
        } finally {
            isSavingAuthor = false;
        }
    }

    let profileImportInput = $state<HTMLInputElement | null>(null);
    let isImportingProfile = $state(false);

    async function handleImportProfileFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (isImportingProfile || isDeletingAllData) return;
        isImportingProfile = true;
        try {
            const text = await file.text();
            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch {
                throw new Error('That file is not valid JSON.');
            }
            const res = await adminFetch('/api/internal/admin/profile/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || 'Import failed.');
            const { applied, errors } = body as {
                applied: string[];
                errors: Record<string, string>;
            };
            supplementaryLoaded = false;
            await loadAdminData();
            if (applied.length) toastStore.success(`Imported: ${applied.join(', ')}.`);
            if (errors && Object.keys(errors).length)
                toastStore.error(
                    `Some sections failed: ${Object.entries(errors)
                        .map(([k, v]) => `${k} (${v})`)
                        .join(', ')}`
                );
        } catch (err: any) {
            console.error('Profile import failed:', err);
            toastStore.error(err?.message || 'Import failed.');
        } finally {
            isImportingProfile = false;
        }
    }

    function confirmDeleteAllData() {
        if (!hasExportedAllData) return;
        showDeleteAllDialog = true;
    }

    async function exportAllData() {
        if (isExportingAllData) return;
        isExportingAllData = true;
        try {
            const now = new Date();
            const pad = (value: number) => String(value).padStart(2, '0');
            const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const res = await adminFetch(`/api/internal/admin/data/export?stamp=${stamp}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || 'Export failed.');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export_${stamp}.zip`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            const warnings = Number(res.headers.get('X-Export-Warnings') ?? 0);
            if (warnings > 0)
                toastStore.error(
                    `Export incomplete: ${warnings} item${warnings === 1 ? '' : 's'} could not be read. See manifest.json in the archive.`
                );
            else hasExportedAllData = true;
        } catch (err: any) {
            toastStore.error(err?.message || 'Export failed.');
        } finally {
            isExportingAllData = false;
        }
    }

    async function executeDeleteAllData() {
        if (isDeletingAllData) return;
        isDeletingAllData = true;
        try {
            const res = await adminFetch('/api/internal/admin/data/delete-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'DELETE' })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || 'Failed to delete site data.');
            }

            supplementaryLoaded = false;
            await loadAdminData();
            showDeleteAllDialog = false;
            toastStore.success('All site data deleted.');
        } catch (err: any) {
            console.error('Failed to delete all data:', err);
            toastStore.error(err?.message || 'Failed to delete all data.');
        } finally {
            isDeletingAllData = false;
        }
    }

    async function handleSaveResume(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingResume) return;
        const experienceOk = await validateAllExperience();
        const educationOk = await validateAllEducation();
        if (!experienceOk || !educationOk) {
            toastStore.error('Please fix the errors below before saving.');
            return;
        }
        isSavingResume = true;
        resumeSaveSuccess = false;
        try {
            const experiences = resumeState.experience.map((item, idx) => ({
                title: sanitizeInput(item.title.trim()),
                type: item.type || '',
                company: sanitizeInput(item.company.trim()),
                start_month: item.startMonth || '',
                start_year: item.startYear || currentYear,
                end_month: item.currentlyIn ? null : item.endMonth || null,
                end_year: item.currentlyIn ? null : item.endYear || null,
                currently_in: item.currentlyIn || false,
                location: sanitizeInput((item.location || '').trim()),
                loc_type: item.locType || '',
                description: sanitizeInput(item.description.trim()),
                sort_order: idx + 1
            }));

            const education = resumeState.education.map((item, idx) => ({
                institution: sanitizeInput(item.institution.trim()),
                degree: sanitizeInput(item.degree.trim()),
                field: sanitizeInput(item.field.trim()),
                start_month: item.startMonth || 'September',
                start_year: item.startYear || currentYear,
                end_month: item.currentlyIn ? null : item.endMonth || null,
                end_year: item.currentlyIn ? null : item.endYear || null,
                currently_in: item.currentlyIn || false,
                grade: sanitizeInput(item.grade.trim()),
                description: sanitizeInput(item.description.trim()),
                sort_order: idx + 1
            }));

            const res = await adminFetch('/api/internal/admin/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ experiences, education })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || 'Failed to save resume entries.');
            }

            resumeInitial = $state.snapshot(resumeState);
            listValidation.reset();
            resumeSaveSuccess = true;
            setTimeout(() => (resumeSaveSuccess = false), 2500);
            toastStore.success('Resume entries saved.');
            executeGenerateResumePdf();
        } catch (err: any) {
            console.error('Error saving resume entries:', err);
            const msg = err?.message || err?.error || 'Failed to save resume entries.';
            toastStore.error(msg);
        } finally {
            isSavingResume = false;
        }
    }

    async function handleSaveSkills(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingSkills) return;
        if (!(await validateAllSkills())) {
            toastStore.error('Please fix the errors below before saving.');
            return;
        }
        isSavingSkills = true;
        skillsSaveSuccess = false;
        try {
            const categories = skillsState.map((item, idx) => ({
                category: sanitizeInput(item.category.trim()),
                sort_order: idx + 1,
                skills:
                    Array.isArray(item.skills) ?
                        item.skills.map(s => sanitizeInput(s.trim())).filter(Boolean)
                    :   []
            }));

            const res = await adminFetch('/api/internal/admin/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || 'Failed to save skills.');
            }

            skillsInitial = $state.snapshot(skillsState);
            listValidation.reset();
            skillsSaveSuccess = true;
            setTimeout(() => (skillsSaveSuccess = false), 2500);
            toastStore.success('Skills saved.');
            executeGenerateResumePdf();
        } catch (err: any) {
            console.error('Error saving skills:', err);
            const msg = err?.message || err?.error || 'Failed to save skills.';
            toastStore.error(msg);
        } finally {
            isSavingSkills = false;
        }
    }

    async function handleSaveProjects(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingProjects) return;
        if (!(await termValidation.submit(['pinned', 'excluded']))) return;
        isSavingProjects = true;
        try {
            const cleanPinned = pinnedReposState.map(r => sanitizeInput(r.trim())).filter(Boolean);
            if (cleanPinned.length > 3) {
                toastStore.error('Maximum of 3 pinned repositories allowed.');
                return;
            }

            const cleanExcluded = excludedReposState
                .map(r => sanitizeInput(r.trim()))
                .filter(Boolean);
            await adminRequest('projects', {
                body: { pinned: cleanPinned, excluded: cleanExcluded },
                fallbackMessage: 'Failed to save project rules.'
            });

            pinnedReposInitial = $state.snapshot(pinnedReposState);
            excludedReposInitial = $state.snapshot(excludedReposState);
            termValidation.clear('pinned');
            termValidation.clear('excluded');
            toastStore.success('Projects rules saved.');
        } catch (err) {
            console.error('Error saving project rules:', err);
            toastStore.error(err instanceof Error ? err.message : 'Failed to save project rules.');
        } finally {
            isSavingProjects = false;
        }
    }

    interface LinkRow {
        platform: string;
        displayValue?: string;
        url: string;
        icon?: string | null;
        description?: string | null;
    }

    async function postLinks(
        category: 'social' | 'funding' | 'contact',
        rows: LinkRow[],
        failureMessage: string
    ) {
        const items = rows.map((item, idx) => ({
            platform: sanitizeInput(item.platform.trim()),
            display_value:
                item.displayValue === undefined ? null : sanitizeInput(item.displayValue.trim()),
            url: item.url.trim(),
            icon: normalizeIconInput(item.icon),
            description: sanitizeInput((item.description || '').trim()),
            sort_order: idx + 1
        }));
        const res = await adminFetch('/api/internal/admin/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, items })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.message || failureMessage);
        }
    }

    async function handleSaveSocials(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingSocials) return;
        if (!(await validateAllSocials())) {
            toastStore.error('Please fix the errors below before saving.');
            return;
        }
        isSavingSocials = true;
        socialsSaveSuccess = false;
        try {
            await postLinks(
                'social',
                socialState.map(({ platform, url, icon, description }) => ({
                    platform,
                    url,
                    icon,
                    description
                })),
                'Failed to save social links.'
            );

            socialInitial = $state.snapshot(socialState);
            listValidation.reset();
            void syncGeneratedIdentity();
            socialsSaveSuccess = true;
            setTimeout(() => (socialsSaveSuccess = false), 2500);
            toastStore.success('Social links saved.');
        } catch (err: any) {
            console.error('Error saving socials:', err);
            const msg = err?.message || err?.error || 'Failed to save social links.';
            toastStore.error(msg);
        } finally {
            isSavingSocials = false;
        }
    }

    async function handleSaveSponsorship(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingSponsorship) return;
        if (!(await validateAllSponsorship())) {
            toastStore.error('Please fix the errors below before saving.');
            return;
        }
        isSavingSponsorship = true;
        sponsorshipSaveSuccess = false;
        try {
            await postLinks('funding', sponsorshipState, 'Failed to save funding links.');

            sponsorshipInitial = $state.snapshot(sponsorshipState);
            listValidation.reset();
            sponsorshipSaveSuccess = true;
            setTimeout(() => (sponsorshipSaveSuccess = false), 2500);
            toastStore.success('Funding links saved.');
        } catch (err: any) {
            console.error('Error saving funding links:', err);
            const msg = err?.message || err?.error || 'Failed to save funding links.';
            toastStore.error(msg);
        } finally {
            isSavingSponsorship = false;
        }
    }

    async function handleSaveContact(e: SubmitEvent) {
        e.preventDefault();
        if (isSavingContact) return;
        if (!(await validateAllContact())) {
            toastStore.error('Please fix the errors below before saving.');
            return;
        }
        isSavingContact = true;
        contactSaveSuccess = false;
        try {
            await postLinks(
                'contact',
                contactState.map(item => ({ ...item, url: item.href })),
                'Failed to save contact info.'
            );

            contactInitial = $state.snapshot(contactState);
            listValidation.reset();
            contactSaveSuccess = true;
            setTimeout(() => (contactSaveSuccess = false), 2500);
            toastStore.success('Contact info saved.');
        } catch (err: any) {
            console.error('Error saving contact info:', err);
            const msg = err?.message || err?.error || 'Failed to save contact info.';
            toastStore.error(msg);
        } finally {
            isSavingContact = false;
        }
    }

    async function executeGenerateResumePdf(options: { force?: boolean; manual?: boolean } = {}) {
        isGeneratingPdf = true;
        pdfUploadError = '';
        pdfGeneratedFilename = '';
        pdfDeleteSuccess = false;

        try {
            const response = await adminFetch('/api/internal/admin/resume/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: options.force === true })
            });

            const res = await readJson(response);
            if (!response.ok || !res.success) {
                const errorMsg =
                    typeof res?.message === 'string' ? res.message
                    : typeof res?.error?.message === 'string' ? res.error.message
                    : typeof res?.error === 'string' ? res.error
                    : 'Failed to generate resume PDF';
                throw new Error(errorMsg);
            }

            if (res.upToDate) {
                if (options.manual || options.force)
                    toastStore.success(`The resume is already up to date (v${res.version}).`);
                return;
            }

            resumeDocState = {
                filename: res.filename,
                fileUrl: res.fileUrl,
                hash: res.hash,
                checksums: res.checksums ?? null,
                version: res.version,
                signedAt: null,
                signerFingerprint: null,
                isActive: true,
                updatedAt: new Date().toISOString()
            };

            pdfGeneratedFilename = res.filename;
            toastStore.success(
                `Resume PDF generated (v${res.version}: ${(res.reasons ?? []).join(', ')})`
            );
        } catch (err: any) {
            console.error('PDF generation error:', err);
            pdfUploadError =
                typeof err?.message === 'string' ? err.message
                : typeof err === 'string' ? err
                : 'Failed to generate resume PDF';
            toastStore.error(pdfUploadError);
        } finally {
            isGeneratingPdf = false;
        }
    }

    function confirmDeleteResumeDoc() {
        if (!resumeDocState.filename) return;
        showDeleteResumeDocDialog = true;
    }

    async function executeDeleteResumeDoc() {
        showDeleteResumeDocDialog = false;
        try {
            const response = await adminFetch('/api/internal/admin/resume/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: resumeDocState.filename })
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok) {
                resumeDocState = {
                    filename: '',
                    fileUrl: '',
                    hash: '',
                    isActive: false,
                    updatedAt: undefined
                };
                pdfGeneratedFilename = '';
                pdfDeleteSuccess = true;
                setTimeout(() => (pdfDeleteSuccess = false), 3000);
                toastStore.success('Resume deleted.');
            } else {
                const errMsg =
                    typeof result?.message === 'string' ? result.message
                    : typeof result?.error?.message === 'string' ? result.error.message
                    : typeof result?.error === 'string' ? result.error
                    : 'Failed to delete resume document.';
                toastStore.error(errMsg);
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Failed to delete resume document.';
            console.error('Failed to delete resume document:', err);
            toastStore.error(message);
        }
    }

    function handleAddResumeEntry(type: 'experience' | 'education') {
        if (type === 'experience') {
            resumeState.experience = [
                ...resumeState.experience,
                {
                    id: crypto.randomUUID(),
                    title: '',
                    type: '',
                    company: '',
                    startMonth: '',
                    startYear: null,
                    endMonth: null,
                    endYear: null,
                    currentlyIn: false,
                    location: '',
                    locType: '',
                    description: ''
                }
            ];
        } else {
            resumeState.education = [
                ...resumeState.education,
                {
                    id: crypto.randomUUID(),
                    institution: '',
                    degree: '',
                    field: '',
                    startMonth: '',
                    startYear: null,
                    endMonth: null,
                    endYear: null,
                    currentlyIn: false,
                    grade: '',
                    description: ''
                }
            ];
        }
    }

    type RemovableEntry =
        'resume-experience' | 'resume-education' | 'skill' | 'social' | 'sponsorship' | 'contact';
    let showRemoveEntryDialog = $state(false);
    let pendingRemove = $state<{ type: RemovableEntry; idx: number } | null>(null);

    const removeEntryLabels: Record<RemovableEntry, string> = {
        'resume-experience': 'this experience entry',
        'resume-education': 'this education entry',
        skill: 'this skill category',
        social: 'this social link',
        sponsorship: 'this funding link',
        contact: 'this contact'
    };
    const removeEntryTitles: Record<RemovableEntry, string> = {
        'resume-experience': 'Delete Experience',
        'resume-education': 'Delete Education',
        skill: 'Delete Skill Category',
        social: 'Delete Social Link',
        sponsorship: 'Delete Funding',
        contact: 'Delete Contact'
    };
    const removeEntryMessage = $derived(
        pendingRemove ?
            `Are you sure you want to remove ${removeEntryLabels[pendingRemove.type]}? This won't be saved until you click Save.`
        :   ''
    );

    function confirmRemoveResumeEntry(type: 'experience' | 'education', idx: number) {
        pendingRemove = {
            type: type === 'experience' ? 'resume-experience' : 'resume-education',
            idx
        };
        showRemoveEntryDialog = true;
    }

    function confirmRemoveSkill(idx: number) {
        pendingRemove = { type: 'skill', idx };
        showRemoveEntryDialog = true;
    }

    function confirmRemoveSocial(idx: number) {
        pendingRemove = { type: 'social', idx };
        showRemoveEntryDialog = true;
    }

    function confirmRemoveSponsorship(idx: number) {
        pendingRemove = { type: 'sponsorship', idx };
        showRemoveEntryDialog = true;
    }

    function confirmRemoveContact(idx: number) {
        pendingRemove = { type: 'contact', idx };
        showRemoveEntryDialog = true;
    }

    function executeRemoveEntry() {
        if (!pendingRemove) return;
        const { type, idx } = pendingRemove;
        if (type === 'resume-experience') {
            resumeState.experience = resumeState.experience.filter((_, i) => i !== idx);
        } else if (type === 'resume-education') {
            resumeState.education = resumeState.education.filter((_, i) => i !== idx);
        } else if (type === 'skill') {
            skillsState = skillsState.filter((_, i) => i !== idx);
        } else if (type === 'social') {
            socialState = socialState.filter((_, i) => i !== idx);
        } else if (type === 'sponsorship') {
            sponsorshipState = sponsorshipState.filter((_, i) => i !== idx);
        } else if (type === 'contact') {
            contactState = contactState.filter((_, i) => i !== idx);
        }
        pendingRemove = null;
        showRemoveEntryDialog = false;
    }

    function handleAddSkill() {
        skillsState = [...skillsState, { id: crypto.randomUUID(), category: '', skills: [] }];
    }

    function handleAddSocial() {
        socialState = [
            ...socialState,
            { id: crypto.randomUUID(), platform: '', url: '', icon: '', description: '' }
        ];
    }

    function handleAddSponsorship() {
        sponsorshipState = [
            ...sponsorshipState,
            {
                id: crypto.randomUUID(),
                platform: '',
                displayValue: '',
                url: '',
                icon: '',
                description: ''
            }
        ];
    }

    function handleAddContact() {
        contactState = [
            ...contactState,
            {
                id: crypto.randomUUID(),
                platform: '',
                displayValue: '',
                href: '',
                icon: '',
                description: ''
            }
        ];
    }

    const adminNavSections: {
        id: 'overview' | 'content' | 'community' | 'profile' | 'legal' | 'administration';
        title: string;
    }[] = [
        { id: 'overview', title: '' },
        { id: 'content', title: 'Content' },
        { id: 'community', title: 'Community' },
        { id: 'profile', title: 'Identity' },
        { id: 'legal', title: 'Legal' },
        { id: 'administration', title: 'Administration' }
    ];

    const adminNavLinks: {
        id: AdminTab;
        label: string;
        icon: any;
        section: (typeof adminNavSections)[number]['id'];
    }[] = [
        { id: 'home', label: 'Overview', icon: LayoutDashboard, section: 'overview' },
        { id: 'reports', label: 'Reports', icon: Flag, section: 'community' },
        { id: 'feedback', label: 'Feedback', icon: Users, section: 'community' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'overview' },
        { id: 'logs', label: 'Activity Log', icon: Logs, section: 'administration' },
        { id: 'account', label: 'Settings', icon: Bolt, section: 'administration' },
        { id: 'posts', label: 'Posts', icon: Quote, section: 'content' },
        { id: 'projects', label: 'Projects', icon: FolderOpen, section: 'content' },
        { id: 'profile', label: 'Profile', icon: User, section: 'profile' },
        { id: 'resume', label: 'Resume', icon: FileUser, section: 'profile' },
        { id: 'skills', label: 'Skills', icon: Layers, section: 'profile' },
        { id: 'socials', label: 'Socials', icon: Share2, section: 'profile' },
        { id: 'funding', label: 'Funding', icon: HeartHandshake, section: 'profile' },
        { id: 'contact', label: 'Contact', icon: AtSign, section: 'profile' },
        { id: 'apps', label: 'Connected apps', icon: AppWindow, section: 'profile' },
        { id: 'privacy', label: 'Privacy Policy', icon: ShieldUser, section: 'legal' },
        { id: 'security', label: 'Security Policy', icon: Lock, section: 'legal' },
        { id: 'terms', label: 'Terms of Service', icon: ScrollText, section: 'legal' },
        { id: 'ai-disclosure', label: 'AI Disclosure', icon: Bot, section: 'legal' }
    ];
</script>

<svelte:head>
    <title>Admin Console</title>
</svelte:head>

<SkipLink />

<SessionTimeoutDialog
    isOpen={showSessionTimeoutDialog}
    deadline={sessionDeadline}
    {extendMinutes}
    isSigningOut={isLoggingOut}
    onExtend={handleExtendSession}
    onSignOut={handleLogout} />

<div
    id="admin-mobile-header"
    class="fixed top-0 z-40 flex h-12 w-full items-center justify-between border-b border-line-subtle bg-surface px-4 md:hidden">
    <div class="flex items-center gap-2">
        <Button
            id="admin-sidebar-toggle"
            type="secondary"
            size="2xs"
            class="size-7 shrink-0 p-0"
            onclick={() => (sidebarMobileOpen = !sidebarMobileOpen)}
            aria-expanded={sidebarMobileOpen}
            aria-controls="admin-sidebar"
            aria-label={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}
            title={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}>
            {#if sidebarMobileOpen}
                <X class="size-4" />
            {:else}
                <Menu class="size-4" />
            {/if}
        </Button>
        <span class="truncate text-sm font-bold text-fg">{adminUserName || 'Admin'}</span>
    </div>
    <div class="flex items-center gap-1.5">
        <ThemeSelect
            variant="ghost"
            size="2xs"
            theme={themeStore.current}
            onThemeChange={themeStore.apply} />
    </div>
</div>

<div class="flex min-h-screen pt-12 md:pt-0">
    <aside
        id="admin-sidebar"
        aria-label="Admin sidebar"
        {@attach manageSidebar}
        style="--sidebar-width: {sidebarWidth}px"
        class="fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col justify-between overflow-hidden border-r border-line-subtle bg-surface md:sticky md:top-0 md:h-dvh md:translate-x-0 {(
            sidebarResizing
        ) ?
            'transition-none will-change-[width]'
        :   'transition-[width,transform] duration-200 ease-linear'} {sidebarMobileOpen ?
            'translate-x-0 shadow-2xl'
        :   '-translate-x-full'} {sidebarCollapsed ? 'md:w-11' : 'md:w-(--sidebar-width)'}">
        <div
            role="slider"
            aria-orientation="horizontal"
            aria-label="Sidebar width"
            aria-valuemin={0}
            aria-valuemax={Math.round(window.innerWidth * 0.2)}
            aria-valuenow={sidebarCollapsed ? 0 : Math.round(sidebarWidth)}
            aria-valuetext={sidebarCollapsed ? 'Collapsed' : `${Math.round(sidebarWidth)} pixels`}
            tabindex="0"
            onpointerdown={startSidebarResize}
            onkeydown={resizeSidebarFromKey}
            class="group absolute inset-y-0 right-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-2 focus-visible:outline-focus-ring md:flex">
            <span
                class="pointer-events-none flex h-10 w-3.5 items-center justify-center rounded-sm text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <GripVertical class="size-3" />
            </span>
        </div>
        <div
            class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line-subtle bg-surface {(
                sidebarCollapsed
            ) ?
                'px-3 md:justify-center md:px-0'
            :   'px-3'}">
            <div class="flex min-w-0 items-center gap-2">
                <Button
                    type="secondary"
                    size="2xs"
                    class="size-7 shrink-0 p-0 md:hidden"
                    onclick={closeMobileSidebar}
                    aria-label="Close sidebar"
                    title="Close sidebar">
                    <X class="size-4" />
                </Button>
                <RefineImage
                    src={adminAvatarUrl}
                    alt={`Profile picture of ${adminUserName || 'the account owner'}`}
                    variant="avatar"
                    rounded="rounded-md"
                    class="size-7 shrink-0" />
                <span
                    class="flex min-w-0 flex-col transition-opacity duration-150 ease-linear starting:opacity-0 {(
                        sidebarCollapsed
                    ) ?
                        'md:hidden'
                    :   ''}">
                    {#if isLoading || (!adminUserName && !adminUserEmail)}
                        <SkeletonBlock
                            height="h-3"
                            width="w-20" />
                        <SkeletonBlock
                            height="h-2"
                            width="w-24"
                            class="mt-1" />
                    {:else}
                        <span class="truncate text-xs leading-tight font-bold text-fg"
                            >{adminUserName}</span>
                        <span
                            class="truncate text-xxs leading-tight text-fg-muted"
                            title={adminUserEmail}>{adminUserEmail}</span>
                    {/if}
                </span>
            </div>
        </div>

        <nav
            class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-1.5 font-sans {(
                sidebarCollapsed
            ) ?
                'md:overflow-y-hidden'
            :   ''}"
            aria-label="Admin Navigation">
            {#each adminNavSections as section, sectionIndex (section.id)}
                {#if section.title}
                    <div
                        class="px-2 pt-1 pb-1 text-xxs font-bold whitespace-nowrap text-fg-muted transition-opacity duration-150 ease-linear select-none starting:opacity-0 {(
                            sectionIndex > 0
                        ) ?
                            'mt-1.5'
                        :   ''} {sidebarCollapsed ? 'md:hidden' : ''}">
                        {section.title}
                    </div>
                {/if}
                <div
                    class="flex shrink-0 flex-col gap-0.5 {sidebarCollapsed ? 'md:min-h-0 md:shrink'
                    :   ''} {sectionIndex > 0 && sidebarCollapsed ?
                        'md:mt-1 md:border-t md:border-line-subtle md:pt-1'
                    :   ''}">
                    {#each adminNavLinks.filter(l => l.section === section.id) as link (link.id)}
                        <Tooltip
                            content={link.label}
                            placement="right"
                            disabled={!sidebarCollapsed}
                            wrapperClass="flex w-full {sidebarCollapsed ?
                                'md:min-h-0 md:shrink md:basis-7'
                            :   ''}">
                            <button
                                type="button"
                                aria-label={link.label}
                                aria-current={activeAdminTab === link.id ? 'page' : undefined}
                                onclick={() => selectTab(link.id)}
                                class="group relative flex min-h-11 w-full shrink-0 items-center rounded-sm text-left text-xs font-semibold transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-focus-ring {(
                                    sidebarCollapsed
                                ) ?
                                    'gap-2 px-2 md:h-full md:min-h-0 md:justify-center md:gap-0 md:px-0'
                                :   'gap-2 px-2 md:min-h-7 md:pointer-coarse:min-h-11'} {(
                                    activeAdminTab === link.id
                                ) ?
                                    'bg-accent-subtle font-bold text-fg-accent shadow-2xs'
                                :   'text-fg hover:bg-surface-hover hover:text-fg-accent'}">
                                <link.icon
                                    class="size-3.5 max-h-full shrink-0 transition-colors {(
                                        activeAdminTab === link.id
                                    ) ?
                                        'text-fg-accent'
                                    :   'text-fg-muted group-hover:text-fg-accent'}" />
                                <span
                                    class="truncate transition-opacity duration-150 ease-linear starting:opacity-0 {(
                                        sidebarCollapsed
                                    ) ?
                                        'md:hidden'
                                    :   ''}">{link.label}</span>
                                {#if link.id === 'notifications' && adminNotificationsStore.unreadCount > 0}
                                    <Badge
                                        variant="accent"
                                        circle
                                        class={sidebarCollapsed ?
                                            'ml-auto md:absolute md:top-0 md:right-0 md:ml-0'
                                        :   'ml-auto'}
                                        >{formatBadgeCount(
                                            adminNotificationsStore.unreadCount
                                        )}<span class="sr-only"> unread</span></Badge>
                                {/if}
                            </button>
                        </Tooltip>
                    {/each}
                </div>
            {/each}
        </nav>

        <div class="shrink-0 border-t border-line-subtle bg-surface px-2 py-1.5">
            <div
                class="flex items-center justify-between {sidebarCollapsed ? 'md:justify-center' : (
                    ''
                )}">
                <Button
                    type="ghost"
                    size="2xs"
                    class="hidden size-7 shrink-0 p-0 md:inline-flex"
                    onclick={toggleSidebarCollapsed}
                    aria-expanded={!sidebarCollapsed}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {#if sidebarCollapsed}
                        <PanelLeftOpen class="size-4" />
                    {:else}
                        <PanelLeftClose class="size-4" />
                    {/if}
                </Button>

                <Button
                    type="ghost"
                    size="2xs"
                    disabled={isLoggingOut}
                    class="size-7 shrink-0 p-0 transition-opacity duration-150 ease-linear starting:opacity-0 {(
                        sidebarCollapsed
                    ) ?
                        'md:hidden'
                    :   ''}"
                    onclick={requestLogout}
                    aria-label="Sign out"
                    title="Sign out">
                    <LogOut class="size-4" />
                </Button>
            </div>
        </div>
    </aside>

    {#if sidebarMobileOpen}
        <button
            type="button"
            class="fixed inset-0 z-40 bg-overlay md:hidden"
            onclick={closeMobileSidebar}
            tabindex="-1"
            aria-label="Close sidebar"></button>
    {/if}

    <main
        id="main"
        tabindex="-1"
        {@attach element => {
            const tab = activeAdminTab;
            const scroll = page.state.adminScroll;
            if (!isLoading)
                untrack(() => {
                    void ensureTabData(tab);
                });
            if (typeof scroll === 'number') queueMicrotask(() => element.scrollTo({ top: scroll }));
        }}
        class="flex-1 p-4 pb-24 font-sans sm:p-6 md:h-dvh md:overflow-y-auto {(
            isLegalSlug(activeAdminTab) || (activeAdminTab === 'posts' && !!editPostParam)
        ) ?
            'pt-0! pb-0!'
        :   ''}">
        {#if isLoading}
            <LoadingState
                variant="post-card"
                label="Loading dashboard..."
                count={3} />
        {:else if activeAdminTab === 'home'}
            <AdminHome
                onNavigate={openWorkspace}
                onPublished={showPublishedPosts} />
        {:else if activeAdminTab === 'reports' || activeAdminTab === 'feedback' || activeAdminTab === 'notifications'}
            {#key activeAdminTab}
                {#await loadActivityWorkspace()}
                    <LoadingState
                        variant="spinner"
                        label="Loading activity..." />
                {:then { default: ActivityWorkspace }}
                    <ActivityWorkspace
                        area={activeAdminTab}
                        onSelectNotification={selectNotification} />
                {/await}
            {/key}
        {:else if activeAdminTab === 'logs'}
            {#await loadActivityLogWorkspace()}
                <LoadingState
                    variant="spinner"
                    label="Loading activity log..." />
            {:then { default: ActivityLogWorkspace }}
                <ActivityLogWorkspace />
            {/await}
        {:else if activeAdminTab === 'posts'}
            {#if editPostParam}
                {#await loadPostEditor()}
                    <LoadingState
                        variant="post-editor"
                        label="Loading post..." />
                {:then { default: PostEditor }}
                    <PostEditor
                        postId={editPostParam === 'new' ? undefined : editPostParam}
                        onCancel={closePostEditor}
                        onSaved={handlePostSaved} />
                {/await}
            {:else}
                <div class="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <h1 class="type-page-title">Posts</h1>
                        <p class="mt-1 type-body text-fg-secondary">
                            Write, edit, and moderate your blog posts.
                        </p>
                    </div>

                    <Button
                        onclick={() => openPostEditor('new')}
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="New Post"
                        title="New Post">
                        {#snippet leading()}
                            <Plus class="size-3.5" />
                        {/snippet}
                        New Post
                    </Button>
                </div>

                {#if posts.length > 0}
                    <FilterToolbar
                        title="Posts filter"
                        mobileGroups={postMenuGroups}
                        onClearFilters={filterStore.clearAllFilters}
                        class="mb-6">
                        {#snippet searchSlot()}
                            <Input
                                type="search"
                                placeholder="Search posts..."
                                value={filterStore.search}
                                oninput={e =>
                                    filterStore.setSearch((e.target as HTMLInputElement).value)}
                                aria-label="Search blog posts" />
                        {/snippet}
                        {#snippet countSlot()}
                            <SearchResultCount
                                count={filteredPosts.length}
                                total={posts.length}
                                itemLabel="posts" />
                        {/snippet}
                        {#snippet filterControlsSlot()}
                            <div
                                class="flex w-max flex-nowrap items-center gap-2 sm:w-auto sm:flex-wrap">
                                <Dropdown
                                    label="Status"
                                    value={statusFilter}
                                    options={POST_STATUS_OPTIONS}
                                    onChange={val => filterStore.setSingleFilter('status', val)} />
                                {#if allPostTags.length > 0}
                                    <Dropdown
                                        multiple
                                        searchable
                                        label="Tag"
                                        options={allPostTags.map(t => ({ value: t, label: t }))}
                                        value={filterStore.filters['tag'] || []}
                                        onChange={val =>
                                            filterStore.toggleMultiFilter('tag', val)} />
                                {/if}
                            </div>
                        {/snippet}
                        {#snippet sortSlot()}
                            <SortControl
                                currentField={filterStore.sort.field}
                                currentDirection={filterStore.sort.direction}
                                fields={POST_SORT_FIELDS}
                                onFieldChange={val =>
                                    filterStore.setSort(val, filterStore.sort.direction)}
                                onDirectionToggle={togglePostSortDirection} />
                        {/snippet}
                    </FilterToolbar>

                    <FilterChipGroup
                        chips={filterStore.activeChips}
                        onRemove={filterStore.removeFilter}
                        onClearAll={filterStore.clearAllFilters}
                        class="mb-6" />
                {/if}

                <div {@attach stableHeight}>
                    {#if postsLoading}
                        <LoadingState
                            variant="post-card"
                            label="Loading posts..."
                            count={4} />
                    {:else if postsLoadError}
                        <ErrorState
                            title="Unable to load posts"
                            description={postsLoadError}
                            onRetry={() => fetchPosts()} />
                    {:else if filteredPosts.length === 0}
                        {#if posts.length > 0 && filterStore.isFiltered}
                            <FilterEmptyState onClearFilters={filterStore.clearAllFilters} />
                        {:else}
                            <EmptyState
                                icon={Quote}
                                title="No posts yet"
                                description="Create a post to get started." />
                        {/if}
                    {:else}
                        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                            {#each paginatedPosts as post (post.id)}
                                <div class="flex min-w-0 flex-col">
                                    <Card
                                        id="post-{post.id}"
                                        density="none"
                                        class="relative flex flex-col text-left {(
                                            expandedPostIds.has(post.id)
                                        ) ?
                                            'rounded-b-none'
                                        :   ''}">
                                        <div
                                            class="relative aspect-2/1 w-full shrink-0 overflow-hidden border-b border-line-subtle">
                                            {#if post.banner_version && !failedBanners.has(post.id)}
                                                <RefineImage
                                                    src={bannerUrl(post, cdnBaseUrl())}
                                                    alt={blogBannerAlt(post.title, post.excerpt)}
                                                    rounded=""
                                                    onerror={() => markBannerFailed(post.id)}
                                                    class="h-full w-full object-cover" />
                                            {:else}
                                                <div
                                                    class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                                                    <ImageIcon class="size-10 text-fg-muted" />
                                                </div>
                                            {/if}
                                        </div>

                                        <div
                                            class="flex min-w-0 flex-1 flex-col justify-between gap-2.5 p-4 font-sans">
                                            <div class="flex flex-col gap-1">
                                                <div>
                                                    <h3
                                                        class="type-card-title transition-colors hover:text-fg-accent">
                                                        <a
                                                            href="{publicSiteUrl}/blog/{post.slug}"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            class="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent">
                                                            {post.title}
                                                        </a>
                                                        <span
                                                            class="ml-1.5 inline-flex items-center gap-1 align-middle select-none">
                                                            {#if post.published}
                                                                <span
                                                                    class="inline-flex size-4.5 items-center justify-center rounded-md bg-discovery-subtle text-discovery"
                                                                    title="Published"
                                                                    aria-label="Published"
                                                                    role="img">
                                                                    <CircleCheckBig
                                                                        class="size-3 shrink-0" />
                                                                </span>
                                                            {:else}
                                                                <span
                                                                    class="inline-flex size-4.5 items-center justify-center rounded-md bg-warning-subtle text-fg-warning"
                                                                    title="Draft"
                                                                    aria-label="Draft"
                                                                    role="img">
                                                                    <CircleDotDashed
                                                                        class="size-3 shrink-0" />
                                                                </span>
                                                            {/if}
                                                            {#if post.pinned}
                                                                <span
                                                                    class="inline-flex size-4.5 items-center justify-center rounded-md bg-success-subtle text-fg-success"
                                                                    title="Pinned post"
                                                                    aria-label="Pinned post"
                                                                    role="img">
                                                                    <Pin class="size-3 shrink-0" />
                                                                </span>
                                                            {/if}
                                                            {#if isPostNew(post)}
                                                                <span
                                                                    class="inline-flex size-4.5 items-center justify-center rounded-md bg-info-subtle text-info"
                                                                    title="New post"
                                                                    aria-label="New post"
                                                                    role="img">
                                                                    <Sparkles
                                                                        class="size-3 shrink-0" />
                                                                </span>
                                                            {/if}
                                                        </span>
                                                    </h3>
                                                </div>

                                                <ArticleMeta
                                                    status={null}
                                                    size="xs"
                                                    layout="single"
                                                    class="min-h-4.5"
                                                    date={post.created_at}
                                                    updatedAt={post.updated_at}
                                                    readingTime={formatReadTime(post.read_minutes)}
                                                    commentsCount={postCommentCounts.get(post.id)
                                                        ?? post.comment_count}
                                                    views={post.views_count} />

                                                {#if post.excerpt}
                                                    <p class="type-body text-fg-secondary">
                                                        {post.excerpt}
                                                    </p>
                                                {/if}

                                                {#if post.tags && post.tags.length > 0}
                                                    <div
                                                        class="flex flex-wrap items-center gap-1.5 pt-1">
                                                        {#each post.tags as tag (tag)}
                                                            {@const cleanTag =
                                                                decodeHtmlEntities(tag)}
                                                            {@const isSelected =
                                                                filterStore.filters[
                                                                    'tag'
                                                                ]?.includes(tag) ?? false}
                                                            <Tag
                                                                variant={isSelected ?
                                                                    'accent-active'
                                                                :   'accent'}
                                                                onclick={() =>
                                                                    filterStore.toggleMultiFilter(
                                                                        'tag',
                                                                        tag
                                                                    )}
                                                                aria-pressed={isSelected}
                                                                class={isSelected ? 'font-mono' : (
                                                                    'font-mono hover:bg-accent/15'
                                                                )}>
                                                                {cleanTag}
                                                            </Tag>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>

                                            <div
                                                class="mt-auto flex w-full flex-wrap items-center justify-between gap-1.5 border-t border-line-subtle pt-3 sm:gap-2">
                                                <Button
                                                    onclick={() => openPostEditor(post.id)}
                                                    type="primary"
                                                    size="sm"
                                                    class="order-1 w-full px-2.5 sm:px-3 md:w-auto"
                                                    aria-label="Edit post"
                                                    title="Edit Post">
                                                    {#snippet leading()}
                                                        <PenLine class="size-3.5" />
                                                    {/snippet}
                                                    Edit post
                                                </Button>

                                                <div
                                                    class="order-2 flex items-center gap-1.5 sm:gap-2">
                                                    <Button
                                                        htmlType="button"
                                                        type="secondary"
                                                        size="sm"
                                                        responsiveIconOnly
                                                        aria-label={post.published ?
                                                            'Unpublish post'
                                                        :   'Publish post'}
                                                        title={post.published ? 'Unpublish post' : (
                                                            'Publish post'
                                                        )}
                                                        onclick={() => handleTogglePublished(post)}>
                                                        {#snippet leading()}
                                                            {#if post.published}
                                                                <EyeOff class="size-3.5" />
                                                            {:else}
                                                                <Send class="size-3.5" />
                                                            {/if}
                                                        {/snippet}
                                                        {post.published ? 'Unpublish' : 'Publish'}
                                                    </Button>

                                                    <Button
                                                        htmlType="button"
                                                        type="secondary"
                                                        size="sm"
                                                        responsiveIconOnly
                                                        aria-label={post.pinned ? 'Unpin post' : (
                                                            'Pin post'
                                                        )}
                                                        title={post.pinned ? 'Unpin post' : (
                                                            'Pin post'
                                                        )}
                                                        onclick={() => handleTogglePinned(post)}>
                                                        {#snippet leading()}
                                                            {#if post.pinned}
                                                                <PinOff class="size-3.5" />
                                                            {:else}
                                                                <Pin class="size-3.5" />
                                                            {/if}
                                                        {/snippet}
                                                        {post.pinned ? 'Unpin' : 'Pin'}
                                                    </Button>

                                                    <Button
                                                        htmlType="button"
                                                        type="secondary"
                                                        size="sm"
                                                        responsiveIconOnly
                                                        aria-label="{expandedPostIds.has(post.id) ?
                                                            'Hide'
                                                        :   'Show'} comments"
                                                        title="{expandedPostIds.has(post.id) ?
                                                            'Hide'
                                                        :   'Show'} comments"
                                                        aria-expanded={expandedPostIds.has(post.id)}
                                                        aria-controls="comments-{post.id}"
                                                        onclick={() => toggleComments(post.id)}>
                                                        {#snippet leading()}
                                                            <MessageCircle class="size-3.5" />
                                                        {/snippet}
                                                        Comments
                                                    </Button>
                                                </div>

                                                <Button
                                                    htmlType="button"
                                                    type="danger"
                                                    size="sm"
                                                    responsiveIconOnly
                                                    aria-label="Delete post"
                                                    title="Delete post"
                                                    class="order-3 md:ml-auto"
                                                    onclick={() => confirmDeletePost(post)}>
                                                    {#snippet leading()}
                                                        <Trash class="size-3.5" />
                                                    {/snippet}
                                                    Delete post
                                                </Button>
                                            </div>
                                        </div></Card>
                                    <div>
                                        {#if expandedPostIds.has(post.id)}
                                            <div
                                                id="comments-{post.id}"
                                                class="rounded-b-md glass-card border-t border-line-subtle p-4 text-left">
                                                <div
                                                    class="mb-3 flex items-center justify-between gap-2">
                                                    <h4 class="type-card-title">
                                                        Comments ({postCommentCounts.get(post.id)
                                                            ?? post.comment_count})
                                                    </h4>
                                                </div>
                                                {#if commentsError[post.id]}<ErrorState
                                                        title="Unable to load comments"
                                                        description={commentsError[post.id]}
                                                        onRetry={() =>
                                                            fetchComments(post.id)} />{/if}
                                                <div {@attach stableHeight}>
                                                    {#if commentsLoading[post.id] && getPostComments(post.id).length === 0}<LoadingState
                                                            label="Loading comments…" />
                                                    {:else if getPostComments(post.id).length === 0}
                                                        <EmptyState
                                                            icon={MessageCircle}
                                                            class="p-5"
                                                            title="No comments yet"
                                                            description="Comments on this post will appear here." />
                                                    {:else}
                                                        <CommentThread
                                                            comments={getPostComments(post.id)}
                                                            authorName={authorState.name
                                                                || siteAuthorName}
                                                            isAdmin={true}
                                                            controls
                                                            pageSize={COMMENTS_PAGE_SIZE}
                                                            focusCommentId={focusedCommentId}
                                                            onDelete={c =>
                                                                confirmDeleteComment(c.id)}
                                                            {replyTo}>
                                                            {#snippet statusBadge(comment)}
                                                                {#if comment.reports}<Button
                                                                        type="ghost"
                                                                        size="xs"
                                                                        onclick={() =>
                                                                            openWorkspace(
                                                                                'reports',
                                                                                comment.id
                                                                            )}
                                                                        >Reported ({comment.reports})</Button
                                                                    >{/if}
                                                            {/snippet}

                                                            {#snippet actions(comment)}
                                                                <ActivityTimestamp
                                                                    date={comment.created_at} />
                                                                <button
                                                                    type="button"
                                                                    onclick={() => {
                                                                        replyTo = comment;
                                                                        commentContent = '';
                                                                    }}
                                                                    class="cursor-pointer font-bold text-fg-muted transition-colors hover:text-fg-accent">
                                                                    Reply
                                                                </button>
                                                                {#if comment.reports}
                                                                    <button
                                                                        type="button"
                                                                        onclick={() =>
                                                                            dismissCommentReports(
                                                                                comment.id
                                                                            )}
                                                                        class="cursor-pointer font-bold text-fg-accent transition-colors hover:underline">
                                                                        Dismiss Reports
                                                                    </button>
                                                                {/if}
                                                            {/snippet}

                                                            {#snippet replyForm(comment)}
                                                                <form
                                                                    novalidate
                                                                    onsubmit={e =>
                                                                        handleAdminSubmit(
                                                                            e,
                                                                            comment.id,
                                                                            comment.post_id
                                                                        )}
                                                                    class="max-w-xl rounded-sm border border-line-subtle bg-surface p-3 shadow-2xs">
                                                                    <div
                                                                        class="mb-2 flex items-center justify-between gap-2">
                                                                        <p
                                                                            class="text-xs text-fg-secondary">
                                                                            Replying to <span
                                                                                class="font-semibold text-fg-accent"
                                                                                >{commentAuthorName(
                                                                                    comment,
                                                                                    authorState.name
                                                                                        || siteAuthorName
                                                                                )}</span>
                                                                        </p>
                                                                        <button
                                                                            type="button"
                                                                            onclick={() =>
                                                                                (replyTo = null)}
                                                                            class="touch-target relative inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus-ring"
                                                                            aria-label="Cancel reply">
                                                                            <X class="size-3.5" />
                                                                        </button>
                                                                    </div>

                                                                    <Textarea
                                                                        id="admin-reply-msg-{comment.id}"
                                                                        rows={2}
                                                                        maxlength={1000}
                                                                        bind:value={
                                                                            () => commentContent,
                                                                            value => {
                                                                                commentContent =
                                                                                    value;
                                                                                replyValidation.input(
                                                                                    'content'
                                                                                );
                                                                            }
                                                                        }
                                                                        onblur={() => {
                                                                            void replyValidation.check(
                                                                                'content'
                                                                            );
                                                                        }}
                                                                        error={!!replyError}
                                                                        placeholder="Write an admin reply..."
                                                                        class="min-h-15 py-2 type-body" />
                                                                    {#if replyError}<FieldMessage
                                                                            message={replyError} />{/if}

                                                                    <div
                                                                        class="mt-2 flex items-center justify-between gap-2">
                                                                        <span
                                                                            class="text-xs text-fg-muted tabular-nums">
                                                                            {1000
                                                                                - commentContent.length}
                                                                            left
                                                                        </span>
                                                                        <div
                                                                            class="flex items-center gap-1.5">
                                                                            <Button
                                                                                type="ghost"
                                                                                size="xs"
                                                                                onclick={() =>
                                                                                    (replyTo =
                                                                                        null)}>
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                htmlType="submit"
                                                                                type="primary"
                                                                                size="xs"
                                                                                disabled={isSubmitting
                                                                                    || !commentContent.trim()}
                                                                                isLoading={isSubmitting}>
                                                                                {isSubmitting ?
                                                                                    'Replying...'
                                                                                :   'Reply'}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </form>
                                                            {/snippet}
                                                        </CommentThread>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <div class="mt-6">
                            <Pagination
                                page={postsPageClamped}
                                totalPages={postsTotalPages}
                                onPageChange={p => (postsPage = p)} />
                        </div>
                    {/if}
                </div>
            {/if}
        {:else if activeAdminTab === 'projects'}
            <FormSection
                onsubmit={handleSaveProjects}
                title="Projects"
                titleTag="h1"
                titleClass="type-page-title"
                description="Pin or hide the GitHub repositories shown in your portfolio. Repositories come from the GitHub account in your social links."
                class="gap-4! p-4! sm:p-5!">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormField
                        id="proj-pinned"
                        label="Pinned"
                        variant="floating"
                        error={termFeedback.pinned?.error}
                        valid={termFeedback.pinned?.valid}
                        counter={`${pinnedReposState.length}/3`}
                        hideFeedbackSlot>
                        <PillInput
                            id="proj-pinned"
                            bind:value={
                                () => pinnedReposState,
                                value => {
                                    pinnedReposState = value;
                                    termValidation.input('pinned');
                                }
                            }
                            onblur={() => {
                                void termValidation.check('pinned');
                            }}
                            itemLabel="Repository"
                            placeholderEmpty="Type repository and press comma..."
                            placeholderFilled="Add repository..."
                            maxItems={3}
                            maxItemLength={100} />
                    </FormField>

                    <FormField
                        id="proj-excluded"
                        label="Excluded"
                        variant="floating"
                        error={termFeedback.excluded?.error}
                        valid={termFeedback.excluded?.valid}
                        counter={`${excludedReposState.length}`}
                        hideFeedbackSlot>
                        <PillInput
                            id="proj-excluded"
                            bind:value={
                                () => excludedReposState,
                                value => {
                                    excludedReposState = value;
                                    termValidation.input('excluded');
                                }
                            }
                            onblur={() => {
                                void termValidation.check('excluded');
                            }}
                            itemLabel="Repository"
                            placeholderEmpty="Type repository and press comma..."
                            placeholderFilled="Add repository..."
                            maxItems={50}
                            maxItemLength={100} />
                    </FormField>
                </div>

                {#snippet actions()}
                    <FormActions class="mt-0!">
                        {#if projectsIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Projects"
                            title="Save Projects"
                            disabled={!projectsIsDirty}
                            isLoading={isSavingProjects}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Projects
                        </Button>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'profile'}
            <FormSection
                onsubmit={handleSaveAuthor}
                title="Profile"
                description="Manage your public author profile and contact details."
                titleTag="h1"
                titleClass="type-page-title"
                class="gap-8">
                {#if authorSaveError}<StatusBanner
                        variant="error"
                        message={authorSaveError} />{/if}
                {#if authorSaveSuccess}<StatusBanner
                        variant="success"
                        message="Profile saved successfully!" />{/if}

                <div class="flex flex-col gap-6">
                    <div class="flex flex-col gap-6">
                        <IdentityImageUpload
                            id="profile-image-file"
                            title="Profile image"
                            alt={`Profile picture of ${authorState.name || adminUserName} — preview`}
                            aspect="square"
                            hint="PNG, JPEG, WebP, AVIF, GIF, BMP · up to 10 MB · at least 512 × 512"
                            uploadingLabel="Preparing avatar and icons…"
                            note={avatarGenerated ?
                                'Generated from your name. Upload an image to replace it.'
                            :   'Images are cropped to a square from the center. Animated images use their first frame.'}
                            readyNote="Image and icons are ready. Save Profile to publish your changes."
                            saved={savedAvatarPreview || avatarSource(authorState)}
                            generated={avatarPreview(avatarSeedValue)}
                            useGenerated={avatarGenerated}
                            canRemove={!avatarRemoved
                                && !!authorState.avatarVersion
                                && identityMeta.avatar?.source !== 'generated'}
                            validationError={authorErrors.avatar}
                            disabled={isSavingAuthor}
                            process={processAvatarFile}
                            onprepared={(value: ImagePackage | null) => {
                                preparedImage = value;
                                if (value) avatarRemoved = false;
                                onAuthorInput('avatar');
                            }}
                            onbusy={(value: boolean) => {
                                preparingImage = value;
                            }}
                            onremove={() => {
                                avatarRemoved = true;
                            }} />
                        <IdentityImageUpload
                            id="site-banner-file"
                            title="Website banner"
                            alt="Website banner preview"
                            aspect="wide"
                            hint="PNG, JPEG, WebP, AVIF, GIF, BMP · up to 10 MB / 40 MP · at least 1280 × 640"
                            uploadingLabel="Preparing banner…"
                            note={bannerGenerated ?
                                'Generated from your name, site URL and first social link. Upload an image to replace it.'
                            :   'Images are cropped to 2:1 from the center. Animated images use their first frame.'}
                            readyNote="Banner is ready. Save Profile to publish your changes."
                            saved={savedBannerPreview || siteBannerSource(authorState)}
                            validationError={bannerPreviewError}
                            generated={generatedBanner}
                            useGenerated={bannerGenerated}
                            generating={renderingBanner}
                            canRemove={!bannerRemoved
                                && !!authorState.bannerVersion
                                && identityMeta.banner?.source !== 'generated'}
                            disabled={isSavingAuthor}
                            process={processBannerFile}
                            onprepared={(value: SiteBannerOutput | null) => {
                                preparedBanner = value;
                                if (value) bannerRemoved = false;
                            }}
                            onbusy={(value: boolean) => {
                                preparingBanner = value;
                            }}
                            onremove={() => {
                                bannerRemoved = true;
                            }} />
                    </div>
                    <section aria-labelledby="section-identity">
                        <h3
                            id="section-identity"
                            class="mb-2.5 text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
                            Identity
                        </h3>
                        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <FormField
                                id="author-name"
                                label="Name"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.name}
                                valid={authorValid.name}>
                                <Input
                                    id="author-name"
                                    bind:value={authorState.name}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.name}
                                    valid={authorValid.name}
                                    oninput={() => onAuthorInput('name')}
                                    onblur={() => {
                                        void authorValidation.check('name');
                                    }} />
                            </FormField>

                            <FormField
                                id="author-pronunciation"
                                label="Pronunciation"
                                variant="floating"
                                hint="Optional. e.g. /ˈælbərt ˈaɪnstaɪn/">
                                <Input
                                    id="author-pronunciation"
                                    bind:value={authorState.pronunciation}
                                    maxlength={250} />
                            </FormField>

                            <FormField
                                id="author-username"
                                label="Username"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.username}
                                valid={authorValid.username}>
                                <Input
                                    id="author-username"
                                    bind:value={authorState.username}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.username}
                                    valid={authorValid.username}
                                    oninput={() => onAuthorInput('username')}
                                    onblur={() => {
                                        void authorValidation.check('username');
                                    }} />
                            </FormField>

                            <FormField
                                id="author-job"
                                label="Job Title"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.jobTitle}
                                valid={authorValid.jobTitle}>
                                <Input
                                    id="author-job"
                                    bind:value={authorState.jobTitle}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.jobTitle}
                                    valid={authorValid.jobTitle}
                                    oninput={() => onAuthorInput('jobTitle')}
                                    onblur={() => {
                                        void authorValidation.check('jobTitle');
                                    }} />
                            </FormField>

                            <FormField
                                id="author-headline"
                                class="sm:col-span-2"
                                label="Headline"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.headline}
                                valid={authorValid.headline}>
                                <Textarea
                                    id="author-headline"
                                    bind:value={authorState.headline}
                                    rows={1}
                                    maxlength={100}
                                    aria-required="true"
                                    error={!!authorErrors.headline}
                                    valid={authorValid.headline}
                                    oninput={() => onAuthorInput('headline')}
                                    onblur={() => {
                                        void authorValidation.check('headline');
                                    }} />
                            </FormField>
                        </div>
                    </section>

                    <section aria-labelledby="section-contact">
                        <h3
                            id="section-contact"
                            class="mb-2.5 text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
                            Contact
                        </h3>
                        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <FormField
                                id="author-email"
                                label="Email"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.email}
                                valid={authorValid.email}>
                                <Input
                                    id="author-email"
                                    type="text"
                                    bind:value={authorState.email}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.email}
                                    valid={authorValid.email}
                                    oninput={() => onAuthorInput('email')}
                                    onblur={() => {
                                        void authorValidation.check('email');
                                    }} />
                            </FormField>
                            <FormField
                                id="author-site"
                                label="Site URL"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.siteUrl}
                                valid={authorValid.siteUrl}>
                                <Input
                                    id="author-site"
                                    bind:value={authorState.siteUrl}
                                    maxlength={100}
                                    aria-required="true"
                                    error={!!authorErrors.siteUrl}
                                    valid={authorValid.siteUrl}
                                    oninput={() => onAuthorInput('siteUrl')}
                                    onblur={() => {
                                        void authorValidation.check('siteUrl');
                                    }} />
                            </FormField>
                        </div>
                    </section>

                    <section aria-labelledby="section-location">
                        <h3
                            id="section-location"
                            class="mb-2.5 text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
                            Location
                        </h3>
                        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                            <FormField
                                id="author-city"
                                label="City"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.city}
                                valid={authorValid.city}>
                                <Input
                                    id="author-city"
                                    bind:value={authorState.city}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.city}
                                    valid={authorValid.city}
                                    oninput={() => onAuthorInput('city')}
                                    onblur={() => {
                                        void authorValidation.check('city');
                                    }} />
                            </FormField>

                            <FormField
                                id="author-postal"
                                label="Postal Code"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.postalCode}
                                valid={authorValid.postalCode}>
                                <Input
                                    id="author-postal"
                                    bind:value={authorState.postalCode}
                                    maxlength={10}
                                    aria-required="true"
                                    error={!!authorErrors.postalCode}
                                    valid={authorValid.postalCode}
                                    oninput={() => onAuthorInput('postalCode')}
                                    onblur={() => {
                                        void authorValidation.check('postalCode');
                                    }} />
                            </FormField>

                            <FormField
                                id="author-country"
                                label="Country"
                                variant="floating"
                                required
                                hideAsterisk
                                error={authorErrors.country}
                                valid={authorValid.country}>
                                <Input
                                    id="author-country"
                                    bind:value={authorState.country}
                                    maxlength={50}
                                    aria-required="true"
                                    error={!!authorErrors.country}
                                    valid={authorValid.country}
                                    oninput={() => onAuthorInput('country')}
                                    onblur={() => {
                                        void authorValidation.check('country');
                                    }} />
                            </FormField>
                        </div>
                    </section>

                    <section aria-labelledby="section-about">
                        <h3
                            id="section-about"
                            class="mb-2.5 text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
                            About
                        </h3>
                        <div class="flex flex-col gap-3.5">
                            <FormField
                                id="author-bio"
                                label="Description"
                                variant="floating"
                                required
                                hideAsterisk
                                counter={`${(authorState.bio || '').length}/1000`}
                                error={authorErrors.bio}
                                valid={authorValid.bio}>
                                <Textarea
                                    id="author-bio"
                                    bind:value={authorState.bio}
                                    rows={4}
                                    maxlength={1000}
                                    aria-required="true"
                                    error={!!authorErrors.bio}
                                    valid={authorValid.bio}
                                    oninput={() => onAuthorInput('bio')}
                                    onblur={() => {
                                        void authorValidation.check('bio');
                                    }} />
                            </FormField>
                        </div>
                    </section>
                </div>

                {#snippet actions()}
                    <FormActions>
                        {#if authorIsDirty}
                            <p class="text-xs text-fg-secondary select-none sm:mr-auto">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <div
                            class="flex w-full flex-col-reverse gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                            <Button
                                htmlType="submit"
                                type="primary"
                                size="md"
                                class="w-full sm:w-auto"
                                aria-label="Save Profile"
                                title="Save Profile"
                                disabled={!authorIsDirty || preparingImage || preparingBanner}
                                isLoading={isSavingAuthor}>
                                {#snippet leading()}
                                    <Save class="size-3.5" />
                                {/snippet}
                                Save Profile
                            </Button>
                        </div>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'resume'}
            <div class="mb-6">
                <h1 class="type-page-title">Resume</h1>
                <p class="mt-1 type-body text-fg-secondary">
                    Manage work experience, education, and the resume document.
                </p>
            </div>

            <form
                onsubmit={handleSaveResume}
                novalidate
                class="flex flex-col gap-8">
                {#if resumeSaveSuccess}
                    <StatusBanner
                        variant="success"
                        message="Resume saved successfully!" />
                {/if}

                <Card>
                    <div
                        class="mb-6 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                        <div class="min-w-0 flex-1 select-none">
                            <h2 class="type-section-title">Experiences</h2>
                            <p class="mt-1 type-body text-fg-secondary">
                                List your work history, most recent first. Fields are required
                                unless marked optional.
                            </p>
                        </div>
                        <Button
                            htmlType="button"
                            type="primary"
                            size="sm"
                            responsiveIconOnly
                            aria-label="Add Experience"
                            title="Add Experience"
                            onclick={() => handleAddResumeEntry('experience')}>
                            {#snippet leading()}
                                <Plus class="size-3.5" />
                            {/snippet}
                            Add Experience
                        </Button>
                    </div>
                    <div class="flex flex-col gap-6">
                        {#if resumeState.experience.length === 0}
                            <EmptyState
                                icon={FileUser}
                                title="No experience entries yet"
                                description="Add your first experience entry below." />
                        {/if}
                        {#each resumeState.experience as exp, idx (exp.id)}
                            <div
                                class="flex flex-col gap-4 rounded-sm border border-line-subtle bg-surface p-4">
                                <div
                                    class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                    <span
                                        class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                        >Experience Entry #{idx + 1}</span>
                                    <div class="flex items-center gap-1">
                                        <Button
                                            htmlType="button"
                                            type="ghost"
                                            size="sm"
                                            aria-label="Move experience item up"
                                            title="Move experience item up"
                                            disabled={idx === 0}
                                            onclick={() =>
                                                (resumeState.experience = moveArrayItem(
                                                    resumeState.experience,
                                                    idx,
                                                    'up'
                                                ))}><ArrowUp class="size-3.5" /></Button>
                                        <Button
                                            htmlType="button"
                                            type="ghost"
                                            size="sm"
                                            aria-label="Move experience item down"
                                            title="Move experience item down"
                                            disabled={idx === resumeState.experience.length - 1}
                                            onclick={() =>
                                                (resumeState.experience = moveArrayItem(
                                                    resumeState.experience,
                                                    idx,
                                                    'down'
                                                ))}><ArrowDown class="size-3.5" /></Button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField
                                        id={'exp-title-' + idx}
                                        label="Title"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={experienceErrors[exp.id!]?.title}
                                        valid={experienceValid[exp.id!]?.title}>
                                        <Input
                                            id={'exp-title-' + idx}
                                            bind:value={exp.title}
                                            maxlength={50}
                                            error={!!experienceErrors[exp.id!]?.title}
                                            valid={experienceValid[exp.id!]?.title}
                                            oninput={() => {
                                                validateExperienceField(idx, 'title', 'Title');
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'experience',
                                                    idx,
                                                    'title',
                                                    'Title',
                                                    true
                                                )} />
                                    </FormField>

                                    <FormField
                                        id={'exp-type-' + idx}
                                        label="Employment type"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={experienceErrors[exp.id!]?.type}
                                        valid={experienceValid[exp.id!]?.type}>
                                        <Dropdown
                                            fullWidth
                                            placeholder="Employment type"
                                            options={EMPLOYMENT_TYPES.map(t => ({
                                                value: t,
                                                label: t
                                            }))}
                                            bind:value={exp.type}
                                            class="w-full"
                                            onChange={() =>
                                                listInput(
                                                    'experience',
                                                    idx,
                                                    'type',
                                                    'Employment type',
                                                    true
                                                )} />
                                    </FormField>
                                </div>

                                <FormField
                                    id={'exp-company-' + idx}
                                    label="Company or organization"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={experienceErrors[exp.id!]?.company}
                                    valid={experienceValid[exp.id!]?.company}>
                                    <Input
                                        id={'exp-company-' + idx}
                                        bind:value={exp.company}
                                        maxlength={100}
                                        error={!!experienceErrors[exp.id!]?.company}
                                        valid={experienceValid[exp.id!]?.company}
                                        oninput={() => {
                                            validateExperienceField(idx, 'company', 'Company');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'experience',
                                                idx,
                                                'company',
                                                'Company',
                                                true
                                            )} />
                                </FormField>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField
                                        id={'exp-location-' + idx}
                                        label="Location"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={experienceErrors[exp.id!]?.location}
                                        valid={experienceValid[exp.id!]?.location}>
                                        <Input
                                            id={'exp-location-' + idx}
                                            bind:value={exp.location}
                                            maxlength={100}
                                            error={!!experienceErrors[exp.id!]?.location}
                                            valid={experienceValid[exp.id!]?.location}
                                            oninput={() => {
                                                validateExperienceField(
                                                    idx,
                                                    'location',
                                                    'Location'
                                                );
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'experience',
                                                    idx,
                                                    'location',
                                                    'Location',
                                                    true
                                                )} />
                                    </FormField>

                                    <FormField
                                        id={'exp-loctype-' + idx}
                                        label="Location type"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={experienceErrors[exp.id!]?.locType}
                                        valid={experienceValid[exp.id!]?.locType}>
                                        <Dropdown
                                            fullWidth
                                            placeholder="Location type"
                                            options={LOCATION_TYPES.map(lt => ({
                                                value: lt,
                                                label: lt
                                            }))}
                                            bind:value={exp.locType}
                                            class="w-full"
                                            onChange={() =>
                                                listInput(
                                                    'experience',
                                                    idx,
                                                    'locType',
                                                    'Location type',
                                                    true
                                                )} />
                                    </FormField>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div class="grid grid-cols-2 gap-2">
                                        <FormField
                                            id={'exp-start-month-' + idx}
                                            label="Start month"
                                            variant="floating"
                                            required
                                            hideAsterisk>
                                            <Dropdown
                                                fullWidth
                                                placeholder="Month"
                                                options={MONTHS.map(m => ({ value: m, label: m }))}
                                                bind:value={exp.startMonth}
                                                class="w-full"
                                                onChange={() => onDateInput('experience', exp)} />
                                        </FormField>
                                        <FormField
                                            id={'exp-start-year-' + idx}
                                            label="Start year"
                                            variant="floating"
                                            required
                                            hideAsterisk>
                                            <Dropdown
                                                fullWidth
                                                placeholder="Year"
                                                options={[
                                                    { value: null, label: 'Year' },
                                                    ...getStartYearOptions().map(y => ({
                                                        value: y,
                                                        label: String(y)
                                                    }))
                                                ]}
                                                bind:value={exp.startYear}
                                                class="w-full"
                                                onChange={() => onDateInput('experience', exp)} />
                                        </FormField>
                                    </div>

                                    <div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <FormField
                                                id={'exp-end-month-' + idx}
                                                label="End month"
                                                variant="floating">
                                                <Dropdown
                                                    fullWidth
                                                    placeholder="Month"
                                                    disabled={exp.currentlyIn}
                                                    options={[
                                                        { value: null, label: 'Month' },
                                                        ...MONTHS.map(m => ({ value: m, label: m }))
                                                    ]}
                                                    bind:value={exp.endMonth}
                                                    class="w-full"
                                                    onChange={() =>
                                                        onDateInput('experience', exp)} />
                                            </FormField>
                                            <FormField
                                                id={'exp-end-year-' + idx}
                                                label="End year"
                                                variant="floating">
                                                <Dropdown
                                                    fullWidth
                                                    placeholder="Year"
                                                    disabled={exp.currentlyIn}
                                                    options={[
                                                        { value: null, label: 'Year' },
                                                        ...getEndYearOptions(exp.startYear).map(
                                                            y => ({ value: y, label: String(y) })
                                                        )
                                                    ]}
                                                    bind:value={exp.endYear}
                                                    class="w-full"
                                                    onChange={() =>
                                                        onDateInput('experience', exp)} />
                                            </FormField>
                                        </div>
                                        <div class="mt-2">
                                            <Checkbox
                                                bind:checked={exp.currentlyIn}
                                                label="I'm currently here"
                                                onchange={e => {
                                                    if (
                                                        (e.currentTarget as HTMLInputElement)
                                                            .checked
                                                    ) {
                                                        exp.endMonth = null;
                                                        exp.endYear = null;
                                                    }
                                                    onDateInput('experience', exp);
                                                }} />
                                        </div>
                                    </div>
                                </div>

                                {#if experienceErrors[exp.id!]?.dates}<FieldMessage
                                        message={experienceErrors[exp.id!].dates} />{/if}
                                <FormField
                                    id={'exp-desc-' + idx}
                                    label="Description"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={experienceErrors[exp.id!]?.description}
                                    valid={experienceValid[exp.id!]?.description}
                                    counter={`${(exp.description || '').length}/1000`}>
                                    <Textarea
                                        id={'exp-desc-' + idx}
                                        bind:value={exp.description}
                                        rows={3}
                                        maxlength={1000}
                                        error={!!experienceErrors[exp.id!]?.description}
                                        valid={experienceValid[exp.id!]?.description}
                                        oninput={() => {
                                            validateExperienceField(
                                                idx,
                                                'description',
                                                'Description'
                                            );
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'experience',
                                                idx,
                                                'description',
                                                'Description',
                                                true
                                            )} />
                                </FormField>

                                <div
                                    class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                    <Button
                                        htmlType="button"
                                        type="danger"
                                        tone="critical"
                                        size="sm"
                                        class="w-full sm:w-auto"
                                        aria-label="Delete Experience"
                                        title="Delete Experience"
                                        onclick={() => confirmRemoveResumeEntry('experience', idx)}>
                                        {#snippet leading()}
                                            <Trash class="size-3.5" />
                                        {/snippet}
                                        Delete Experience
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <FormActions>
                        {#if resumeIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Experiences"
                            title="Save Experiences"
                            disabled={!resumeIsDirty}
                            isLoading={isSavingResume}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Experiences
                        </Button>
                    </FormActions>
                </Card>

                <Card>
                    <div
                        class="mb-6 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                        <div class="min-w-0 flex-1 select-none">
                            <h2 class="type-section-title">Education</h2>
                            <p class="mt-1 type-body text-fg-secondary">
                                List your degrees and certifications, most recent first. Fields are
                                required unless marked optional.
                            </p>
                        </div>
                        <Button
                            htmlType="button"
                            type="primary"
                            size="sm"
                            responsiveIconOnly
                            aria-label="Add Education"
                            title="Add Education"
                            onclick={() => handleAddResumeEntry('education')}>
                            {#snippet leading()}
                                <Plus class="size-3.5" />
                            {/snippet}
                            Add Education
                        </Button>
                    </div>
                    <div class="flex flex-col gap-6">
                        {#if resumeState.education.length === 0}
                            <EmptyState
                                icon={FileUser}
                                title="No education entries yet"
                                description="Add your first education entry below." />
                        {/if}
                        {#each resumeState.education as edu, idx (edu.id)}
                            <div
                                class="flex flex-col gap-4 rounded-sm border border-line-subtle bg-surface p-4">
                                <div
                                    class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                    <span
                                        class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                        >Education Entry #{idx + 1}</span>
                                    <div class="flex items-center gap-1">
                                        <Button
                                            htmlType="button"
                                            type="ghost"
                                            size="sm"
                                            aria-label="Move education item up"
                                            title="Move education item up"
                                            disabled={idx === 0}
                                            onclick={() =>
                                                (resumeState.education = moveArrayItem(
                                                    resumeState.education,
                                                    idx,
                                                    'up'
                                                ))}><ArrowUp class="size-3.5" /></Button>
                                        <Button
                                            htmlType="button"
                                            type="ghost"
                                            size="sm"
                                            aria-label="Move education item down"
                                            title="Move education item down"
                                            disabled={idx === resumeState.education.length - 1}
                                            onclick={() =>
                                                (resumeState.education = moveArrayItem(
                                                    resumeState.education,
                                                    idx,
                                                    'down'
                                                ))}><ArrowDown class="size-3.5" /></Button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField
                                        id={'edu-inst-' + idx}
                                        label="Institution"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={educationErrors[edu.id!]?.institution}
                                        valid={educationValid[edu.id!]?.institution}>
                                        <Input
                                            id={'edu-inst-' + idx}
                                            bind:value={edu.institution}
                                            maxlength={100}
                                            error={!!educationErrors[edu.id!]?.institution}
                                            valid={educationValid[edu.id!]?.institution}
                                            oninput={() => {
                                                validateEducationField(
                                                    idx,
                                                    'institution',
                                                    'Institution'
                                                );
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'education',
                                                    idx,
                                                    'institution',
                                                    'Institution',
                                                    true
                                                )} />
                                    </FormField>

                                    <FormField
                                        id={'edu-degree-' + idx}
                                        label="Degree"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={educationErrors[edu.id!]?.degree}
                                        valid={educationValid[edu.id!]?.degree}>
                                        <Input
                                            id={'edu-degree-' + idx}
                                            bind:value={edu.degree}
                                            maxlength={100}
                                            error={!!educationErrors[edu.id!]?.degree}
                                            valid={educationValid[edu.id!]?.degree}
                                            oninput={() => {
                                                validateEducationField(idx, 'degree', 'Degree');
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'education',
                                                    idx,
                                                    'degree',
                                                    'Degree',
                                                    true
                                                )} />
                                    </FormField>

                                    <FormField
                                        id={'edu-field-' + idx}
                                        label="Field of Study"
                                        variant="floating"
                                        required
                                        hideAsterisk
                                        error={educationErrors[edu.id!]?.field}
                                        valid={educationValid[edu.id!]?.field}>
                                        <Input
                                            id={'edu-field-' + idx}
                                            bind:value={edu.field}
                                            maxlength={100}
                                            error={!!educationErrors[edu.id!]?.field}
                                            valid={educationValid[edu.id!]?.field}
                                            oninput={() => {
                                                validateEducationField(
                                                    idx,
                                                    'field',
                                                    'Field of study'
                                                );
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'education',
                                                    idx,
                                                    'field',
                                                    'Field of study',
                                                    true
                                                )} />
                                    </FormField>

                                    <FormField
                                        id={'edu-grade-' + idx}
                                        label="Grade (optional)"
                                        variant="floating"
                                        error={educationErrors[edu.id!]?.grade}
                                        valid={educationValid[edu.id!]?.grade}>
                                        <Input
                                            id={'edu-grade-' + idx}
                                            bind:value={edu.grade}
                                            maxlength={50}
                                            error={!!educationErrors[edu.id!]?.grade}
                                            valid={educationValid[edu.id!]?.grade}
                                            oninput={() => {
                                                validateEducationField(idx, 'grade', 'Grade');
                                            }}
                                            onblur={() =>
                                                listInput(
                                                    'education',
                                                    idx,
                                                    'grade',
                                                    'Grade',
                                                    true
                                                )} />
                                    </FormField>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div class="grid grid-cols-2 gap-2">
                                        <FormField
                                            id={'edu-start-month-' + idx}
                                            label="Start month"
                                            variant="floating"
                                            required
                                            hideAsterisk>
                                            <Dropdown
                                                fullWidth
                                                placeholder="Month"
                                                options={MONTHS.map(m => ({ value: m, label: m }))}
                                                bind:value={edu.startMonth}
                                                class="w-full"
                                                onChange={() => onDateInput('education', edu)} />
                                        </FormField>
                                        <FormField
                                            id={'edu-start-year-' + idx}
                                            label="Start year"
                                            variant="floating"
                                            required
                                            hideAsterisk>
                                            <Dropdown
                                                fullWidth
                                                placeholder="Year"
                                                options={[
                                                    { value: null, label: 'Year' },
                                                    ...getStartYearOptions().map(y => ({
                                                        value: y,
                                                        label: String(y)
                                                    }))
                                                ]}
                                                bind:value={edu.startYear}
                                                class="w-full"
                                                onChange={() => onDateInput('education', edu)} />
                                        </FormField>
                                    </div>

                                    <div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <FormField
                                                id={'edu-end-month-' + idx}
                                                label="End month"
                                                variant="floating">
                                                <Dropdown
                                                    fullWidth
                                                    placeholder="Month"
                                                    disabled={edu.currentlyIn}
                                                    options={[
                                                        { value: null, label: 'Month' },
                                                        ...MONTHS.map(m => ({ value: m, label: m }))
                                                    ]}
                                                    bind:value={edu.endMonth}
                                                    class="w-full"
                                                    onChange={() =>
                                                        onDateInput('education', edu)} />
                                            </FormField>
                                            <FormField
                                                id={'edu-end-year-' + idx}
                                                label="End year"
                                                variant="floating">
                                                <Dropdown
                                                    fullWidth
                                                    placeholder="Year"
                                                    disabled={edu.currentlyIn}
                                                    options={[
                                                        { value: null, label: 'Year' },
                                                        ...getEndYearOptions(edu.startYear).map(
                                                            y => ({ value: y, label: String(y) })
                                                        )
                                                    ]}
                                                    bind:value={edu.endYear}
                                                    class="w-full"
                                                    onChange={() =>
                                                        onDateInput('education', edu)} />
                                            </FormField>
                                        </div>
                                        <div class="mt-2">
                                            <Checkbox
                                                bind:checked={edu.currentlyIn}
                                                label="I'm currently here"
                                                onchange={e => {
                                                    if (
                                                        (e.currentTarget as HTMLInputElement)
                                                            .checked
                                                    ) {
                                                        edu.endMonth = null;
                                                        edu.endYear = null;
                                                    }
                                                    onDateInput('education', edu);
                                                }} />
                                        </div>
                                    </div>
                                </div>

                                {#if educationErrors[edu.id!]?.dates}<FieldMessage
                                        message={educationErrors[edu.id!].dates} />{/if}
                                <FormField
                                    id={'edu-desc-' + idx}
                                    label="Description"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={educationErrors[edu.id!]?.description}
                                    valid={educationValid[edu.id!]?.description}
                                    counter={`${(edu.description || '').length}/1000`}>
                                    <Textarea
                                        id={'edu-desc-' + idx}
                                        bind:value={edu.description}
                                        rows={3}
                                        maxlength={1000}
                                        error={!!educationErrors[edu.id!]?.description}
                                        valid={educationValid[edu.id!]?.description}
                                        oninput={() => {
                                            validateEducationField(
                                                idx,
                                                'description',
                                                'Description'
                                            );
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'education',
                                                idx,
                                                'description',
                                                'Description',
                                                true
                                            )} />
                                </FormField>

                                <div
                                    class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                    <Button
                                        htmlType="button"
                                        type="danger"
                                        tone="critical"
                                        size="sm"
                                        class="w-full sm:w-auto"
                                        aria-label="Delete Education"
                                        title="Delete Education"
                                        onclick={() => confirmRemoveResumeEntry('education', idx)}>
                                        {#snippet leading()}
                                            <Trash class="size-3.5" />
                                        {/snippet}
                                        Delete Education
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <FormActions>
                        {#if resumeIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Education"
                            title="Save Education"
                            disabled={!resumeIsDirty}
                            isLoading={isSavingResume}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Education
                        </Button>
                    </FormActions>
                </Card>
            </form>

            {#snippet bandLabel(id: string, text: string)}
                <h3
                    {id}
                    class="text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
                    {text}
                </h3>
            {/snippet}

            <Card
                variant="glass"
                class="mt-10 flex flex-col gap-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h2 class="type-section-title">Resume Document</h2>
                        <p class="mt-1 type-body text-fg-secondary">
                            The PDF visitors download from your resume section and the public API.
                        </p>
                    </div>
                    {#if isResumeAvailable}
                        <ActionMenu
                            ariaLabel="More resume actions"
                            items={[
                                {
                                    label: 'Regenerate',
                                    icon: RefreshCw,
                                    disabled: isGeneratingPdf,
                                    onSelect: () => executeGenerateResumePdf({ force: true })
                                },
                                { divider: true },
                                {
                                    label: 'Delete resume',
                                    icon: Trash,
                                    danger: true,
                                    onSelect: confirmDeleteResumeDoc
                                }
                            ]} />
                    {/if}
                </div>

                {#if pdfUploadError}
                    <StatusBanner
                        variant="error"
                        message={pdfUploadError} />
                {/if}

                {#if pdfGeneratedFilename}
                    <StatusBanner variant="success">
                        <span
                            >Generated <strong class="font-bold">{pdfGeneratedFilename}</strong
                            >.</span>
                    </StatusBanner>
                {/if}

                {#if pdfDeleteSuccess}
                    <StatusBanner
                        variant="success"
                        message="Resume deleted." />
                {/if}

                {#if !isResumeAvailable}
                    <EmptyState
                        icon={FileUser}
                        title="No resume generated yet"
                        description={hasSavedProfile ?
                            'Build a PDF from your profile, experience, education, skills and pinned projects. Visitors can then download it from the resume section and the API.'
                        :   'Save your profile first. The resume is built from it.'}>
                        {#snippet actions()}
                            <Button
                                htmlType="button"
                                type="primary"
                                size="sm"
                                isLoading={isGeneratingPdf}
                                disabled={isGeneratingPdf || !hasSavedProfile}
                                onclick={() => executeGenerateResumePdf({ manual: true })}>
                                {#snippet leading()}
                                    <RefreshCw class="size-3.5" />
                                {/snippet}
                                <span>Generate resume</span>
                            </Button>
                        {/snippet}
                    </EmptyState>
                {:else}
                    <div class="rounded-sm border border-line-subtle bg-surface">
                        <div
                            class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                            <div class="flex min-w-0 items-center gap-3.5">
                                <div
                                    class="flex size-11 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent-subtle text-fg-accent">
                                    <FileUser class="size-5.5" />
                                </div>
                                <div class="min-w-0">
                                    <p class="font-mono text-sm font-semibold break-all text-fg">
                                        {resumeDocState.filename}
                                    </p>
                                    <div
                                        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                                        {#if resumeVersion}
                                            <Badge size="sm">{resumeVersion}</Badge>
                                        {/if}
                                        {#if resumeSignedByKey}
                                            <Badge
                                                size="sm"
                                                variant="success">
                                                <ShieldCheck
                                                    class="size-3 shrink-0"
                                                    aria-hidden="true" />
                                                Signed
                                            </Badge>
                                        {:else if resumeDocState.signedAt}
                                            <Badge
                                                size="sm"
                                                variant="warning">
                                                <ShieldAlert
                                                    class="size-3 shrink-0"
                                                    aria-hidden="true" />
                                                Signed with another key
                                            </Badge>
                                        {:else}
                                            <Badge
                                                size="sm"
                                                variant="warning">
                                                <ShieldAlert
                                                    class="size-3 shrink-0"
                                                    aria-hidden="true" />
                                                Unsigned
                                            </Badge>
                                        {/if}
                                        {#if resumeLastUpdated}
                                            <span>Updated {resumeLastUpdated}</span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                            <div class="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                                <Button
                                    htmlType="button"
                                    type="secondary"
                                    size="sm"
                                    onclick={() =>
                                        window.open(resumeDocState.fileUrl, '_blank', 'noopener')}>
                                    {#snippet leading()}
                                        <ArrowUpRight
                                            strokeWidth={1.5}
                                            class="size-3.5" />
                                    {/snippet}
                                    <span>View PDF</span>
                                </Button>
                                <Button
                                    htmlType="button"
                                    type="secondary"
                                    size="sm"
                                    onclick={() => downloadFrom(resumeApiFile('zip'))}>
                                    {#snippet leading()}
                                        <FileArchive class="size-3.5" />
                                    {/snippet}
                                    <span>Download all</span>
                                </Button>
                                <Button
                                    htmlType="button"
                                    type="primary"
                                    size="sm"
                                    class="col-span-2 sm:col-auto"
                                    disabled={isDownloadingResume}
                                    isLoading={isDownloadingResume}
                                    onclick={downloadResumeDocument}>
                                    {#snippet leading()}
                                        <Download class="size-3.5" />
                                    {/snippet}
                                    <span>Download PDF</span>
                                </Button>
                            </div>
                        </div>

                        <section
                            aria-labelledby="resume-checksums-heading"
                            class="border-t border-line-subtle p-4">
                            {@render bandLabel('resume-checksums-heading', 'Checksums')}
                            {#if resumeChecksumTabs.length}
                                <CodeTabs
                                    class="mt-3"
                                    tabs={resumeChecksumTabs}
                                    ariaLabel="Checksums" />
                            {:else}
                                <p class="mt-2 text-xs text-fg-muted">
                                    Checksums are recorded on the next build.
                                </p>
                            {/if}
                        </section>

                        <section
                            aria-labelledby="resume-signature-heading"
                            class="flex flex-col gap-3 border-t border-line-subtle p-4">
                            {@render bandLabel('resume-signature-heading', 'GPG signature')}
                            {#if !openPgpKey}
                                <p class="text-sm text-fg-secondary">
                                    Add your OpenPGP public key below first. Visitors use it to
                                    confirm that you signed this file.
                                </p>
                            {:else if resumeSignedByKey}
                                <dl
                                    class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                                    {#each openPgpKey.userIds as user, index (index)}
                                        <dt class="text-fg-muted">Signed by</dt>
                                        <dd class="min-w-0 wrap-break-word text-fg">
                                            {formatUserId(user)}
                                        </dd>
                                    {/each}
                                    <dt class="text-fg-muted">Fingerprint</dt>
                                    <dd
                                        class="min-w-0 font-mono text-xs leading-5 wrap-break-word text-fg tabular-nums">
                                        {formatFingerprint(openPgpKey.fingerprint)}
                                    </dd>
                                    {#if resumeSignedAt}
                                        <dt class="text-fg-muted">Signed</dt>
                                        <dd class="text-fg">{resumeSignedAt}</dd>
                                    {/if}
                                </dl>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Button
                                        htmlType="button"
                                        type="secondary"
                                        size="xs"
                                        onclick={() => downloadFrom(resumeApiFile('sig'))}>
                                        {#snippet leading()}
                                            <Download class="size-3.5" />
                                        {/snippet}
                                        <span>.sig</span>
                                    </Button>
                                    <Button
                                        htmlType="button"
                                        type="secondary"
                                        size="xs"
                                        onclick={() => downloadFrom(resumeApiFile('asc'))}>
                                        {#snippet leading()}
                                            <Download class="size-3.5" />
                                        {/snippet}
                                        <span>.asc</span>
                                    </Button>
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        tone="critical"
                                        size="xs"
                                        disabled={isSavingSignature}
                                        onclick={() => (showRemoveSignatureDialog = true)}>
                                        <span>Delete signature</span>
                                    </Button>
                                </div>
                            {:else}
                                {#if resumeDocState.signedAt}
                                    <StatusBanner
                                        variant="warning"
                                        message="The stored signature was made with a different key. Sign this PDF again with your active key." />
                                {/if}
                                <p class="text-sm text-fg-secondary">
                                    Sign this exact PDF on your machine in either format, then
                                    upload the file. Both formats are published.
                                </p>
                                <CodeTabs
                                    command
                                    tabs={resumeSignTabs}
                                    ariaLabel="Signing commands" />
                            {/if}
                            {#if openPgpKey}
                                <FileUploadField
                                    id="resume-signature-file"
                                    compact
                                    label={resumeSignedByKey ? 'Replace the signature' : (
                                        'Upload the signature'
                                    )}
                                    hint=".sig, .gpg or .asc · detached signature, at most 16 KiB"
                                    accept=".asc,.sig,.gpg,application/pgp-signature,application/octet-stream,text/plain"
                                    disabled={isSavingSignature}
                                    isUploading={isSavingSignature}
                                    uploadingLabel="Verifying signature…"
                                    error={signatureError}
                                    onFileSelect={updateResumeSignature} />
                            {/if}
                        </section>
                    </div>
                {/if}
            </Card>

            <Card
                variant="glass"
                class="mt-6 flex flex-col gap-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h2
                            id="openpgp-key"
                            class="type-section-title">
                            OpenPGP key
                        </h2>
                        <p class="mt-1 type-body text-fg-secondary">
                            The public key that signs your resume, published at /pgp.asc and through
                            WKD.
                        </p>
                    </div>
                    {#if openPgpKey}
                        <ActionMenu
                            ariaLabel="More key actions"
                            disabled={isSavingKey}
                            items={[
                                {
                                    label: 'Delete key',
                                    icon: Trash,
                                    danger: true,
                                    onSelect: () => (showRemoveKeyDialog = true)
                                }
                            ]} />
                    {/if}
                </div>

                {#if !openPgpKey}
                    <FileUploadField
                        id="openpgp-key-file"
                        compact
                        label="Upload your public key"
                        hint={authorState.email ?
                            `Export it with gpg --armor --export ${authorState.email}`
                        :   'Export it with gpg --armor --export followed by your key email'}
                        accept=".asc,.gpg,.pgp,.pub,.key,application/pgp-keys,application/octet-stream,text/plain"
                        disabled={isSavingKey}
                        isUploading={isSavingKey}
                        uploadingLabel="Checking key…"
                        error={keyError}
                        onFileSelect={file => file && saveOpenPgpKey(file)} />
                {:else}
                    <div class="rounded-sm border border-line-subtle bg-surface">
                        <div class="flex min-w-0 items-start gap-3.5 p-4">
                            <div
                                class="flex size-11 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent-subtle text-fg-accent">
                                <KeyRound class="size-5.5" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start gap-1">
                                    <p
                                        class="min-w-0 font-mono text-sm leading-6 font-semibold wrap-break-word text-fg tabular-nums">
                                        {formatFingerprint(openPgpKey.fingerprint)}
                                    </p>
                                    <IconButton
                                        ariaLabel="Copy fingerprint"
                                        variant="ghost"
                                        size="xs"
                                        onclick={() =>
                                            copyText(openPgpKey!.fingerprint, 'Fingerprint')}>
                                        <Copy class="size-3.5" />
                                    </IconButton>
                                </div>
                                <div
                                    class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                                    <span>{openPgpKey.algorithm}</span>
                                    {#if keyCreated}
                                        <span aria-hidden="true">·</span>
                                        <span>Created {keyCreated}</span>
                                    {/if}
                                    <span aria-hidden="true">·</span>
                                    {#if keyExpiresSoon}
                                        <Badge
                                            size="sm"
                                            variant="warning">Expires {keyExpires}</Badge>
                                    {:else}
                                        <span
                                            >{keyExpires ?
                                                `Expires ${keyExpires}`
                                            :   'Never expires'}</span>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <section
                            aria-labelledby="openpgp-identity-heading"
                            class="border-t border-line-subtle p-4">
                            {@render bandLabel('openpgp-identity-heading', 'Identity')}
                            <ul class="mt-2 flex flex-col gap-1 text-sm text-fg">
                                {#each openPgpKey.userIds as user, index (index)}
                                    <li class="wrap-break-word">{formatUserId(user)}</li>
                                {/each}
                            </ul>
                            <p class="mt-2 text-xs text-fg-muted">
                                {#if keyWkdEmails.length}
                                    WKD lookup works for {keyWkdEmails.join(', ')}.
                                {:else}
                                    No user ID uses your site's domain, so WKD lookups will not find
                                    this key.
                                {/if}
                            </p>
                        </section>

                        <section
                            aria-labelledby="openpgp-keyservers-heading"
                            class="flex flex-col gap-3 border-t border-line-subtle p-4">
                            <div>
                                {@render bandLabel('openpgp-keyservers-heading', 'Keyservers')}
                                <p class="mt-1 text-xs text-fg-muted">
                                    Listed as independent sources on your resume. Each one is
                                    checked for this exact key when you save.
                                </p>
                            </div>
                            <div class="flex flex-col gap-2">
                                {#each KEYSERVER_PRESETS as preset (preset.id)}
                                    <Checkbox
                                        bind:checked={keyserverChoice[preset.id]}
                                        label={preset.label} />
                                {/each}
                            </div>
                            <FormField
                                id="openpgp-custom-keyserver"
                                label="Other keyserver URL"
                                variant="floating"
                                hint="Optional. A https:// URL that returns this key."
                                error={keyserverError}>
                                <Input
                                    id="openpgp-custom-keyserver"
                                    type="url"
                                    bind:value={customKeyserver}
                                    maxlength={500} />
                            </FormField>
                            <FormActions>
                                <Button
                                    htmlType="button"
                                    type="primary"
                                    size="sm"
                                    isLoading={isSavingKey}
                                    disabled={isSavingKey}
                                    onclick={() => saveOpenPgpKey()}>
                                    {#snippet leading()}
                                        <Save class="size-3.5" />
                                    {/snippet}
                                    <span>Save keyservers</span>
                                </Button>
                            </FormActions>
                        </section>

                        <section
                            aria-labelledby="openpgp-replace-heading"
                            class="flex flex-col gap-2 border-t border-line-subtle p-4">
                            {@render bandLabel('openpgp-replace-heading', 'Replace key')}
                            <FileUploadField
                                id="openpgp-key-file"
                                compact
                                label="Upload a new public key"
                                hint="A different key removes the current resume signature."
                                accept=".asc,.gpg,.pgp,.pub,.key,application/pgp-keys,application/octet-stream,text/plain"
                                disabled={isSavingKey}
                                isUploading={isSavingKey}
                                uploadingLabel="Checking key…"
                                error={keyError}
                                onFileSelect={file => file && saveOpenPgpKey(file)} />
                        </section>
                    </div>
                {/if}
            </Card>
        {:else if activeAdminTab === 'skills'}
            <FormSection
                onsubmit={handleSaveSkills}
                title="Skills"
                titleTag="h1"
                titleClass="type-page-title"
                description="Group your skills into categories.">
                {#snippet headerActions()}
                    <Button
                        htmlType="button"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Add Skill"
                        title="Add Skill"
                        onclick={handleAddSkill}>
                        {#snippet leading()}
                            <Plus class="size-3.5" />
                        {/snippet}
                        Add Skill
                    </Button>
                {/snippet}

                {#if skillsSaveSuccess}<StatusBanner
                        variant="success"
                        message="Skills saved successfully!" />{/if}

                <div class="flex flex-col gap-4">
                    {#if skillsState.length === 0}
                        <EmptyState
                            icon={Layers}
                            title="No skill groups yet"
                            description="Add your first skill group below." />
                    {/if}
                    {#each skillsState as item, idx (item.id)}
                        <div
                            class="flex flex-col gap-3 rounded-sm border border-line-subtle bg-surface p-4">
                            <div
                                class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                <span
                                    class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                    >Category #{idx + 1}</span>
                                <div class="flex items-center gap-1">
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move skill up"
                                        title="Move skill up"
                                        disabled={idx === 0}
                                        onclick={() =>
                                            (skillsState = moveArrayItem(skillsState, idx, 'up'))}
                                        ><ArrowUp class="size-3.5" /></Button>
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move skill down"
                                        title="Move skill down"
                                        disabled={idx === skillsState.length - 1}
                                        onclick={() =>
                                            (skillsState = moveArrayItem(skillsState, idx, 'down'))}
                                        ><ArrowDown class="size-3.5" /></Button>
                                </div>
                            </div>

                            <FormField
                                id={'sk-cat-' + idx}
                                label="Area of Expertise"
                                variant="floating"
                                required
                                hideAsterisk
                                error={skillsErrors[item.id!]?.category}
                                valid={skillsValid[item.id!]?.category}>
                                <Input
                                    id={'sk-cat-' + idx}
                                    bind:value={item.category}
                                    maxlength={100}
                                    error={!!skillsErrors[item.id!]?.category}
                                    valid={skillsValid[item.id!]?.category}
                                    oninput={() => {
                                        validateSkillField(idx);
                                    }}
                                    onpaste={e => handleCategoryPaste(idx, e)}
                                    onblur={() =>
                                        listInput(
                                            'skills',
                                            idx,
                                            'category',
                                            'Area of expertise',
                                            true
                                        )} />
                            </FormField>

                            <FormField
                                id={'sk-list-' + idx}
                                label="Skills Set"
                                variant="floating"
                                counter={`${item.skills.length}/20`}>
                                <PillInput
                                    id={'sk-list-' + idx}
                                    bind:value={item.skills}
                                    itemLabel="Skill"
                                    placeholderEmpty="Type skill and press comma..."
                                    placeholderFilled="Add skill..."
                                    maxItems={20}
                                    maxItemLength={50}
                                    onPaste={e => handleSkillsSetPaste(idx, e)} />
                            </FormField>

                            <div
                                class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                <Button
                                    htmlType="button"
                                    type="danger"
                                    tone="critical"
                                    size="sm"
                                    class="w-full sm:w-auto"
                                    aria-label="Delete Category"
                                    title="Delete Category"
                                    onclick={() => confirmRemoveSkill(idx)}>
                                    {#snippet leading()}
                                        <Trash class="size-3.5" />
                                    {/snippet}
                                    Delete Category
                                </Button>
                            </div>
                        </div>
                    {/each}
                </div>

                {#snippet actions()}
                    <FormActions>
                        {#if skillsIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Skills"
                            title="Save Skills"
                            disabled={!skillsIsDirty}
                            isLoading={isSavingSkills}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Skills
                        </Button>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'socials'}
            <FormSection
                onsubmit={handleSaveSocials}
                title="Social Links"
                titleTag="h1"
                titleClass="type-page-title"
                description="Manage links to your social media profiles.">
                {#snippet headerActions()}
                    <Button
                        htmlType="button"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Add Social Link"
                        title="Add Social Link"
                        onclick={handleAddSocial}>
                        {#snippet leading()}
                            <Plus class="size-3.5" />
                        {/snippet}
                        Add Social Link
                    </Button>
                {/snippet}

                {#if socialsSaveSuccess}<StatusBanner
                        variant="success"
                        message="Social links saved successfully!" />{/if}

                <div class="flex flex-col gap-4">
                    {#if socialState.length === 0}
                        <EmptyState
                            icon={Share2}
                            title="No social links yet"
                            description="Add your first social link below." />
                    {/if}
                    {#each socialState as item, idx (item.id)}
                        <div
                            class="flex flex-col gap-3 rounded-sm border border-line-subtle bg-surface p-4">
                            <div
                                class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                <span
                                    class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                    >Social #{idx + 1}</span>
                                <div class="flex items-center gap-1">
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move social link up"
                                        title="Move social link up"
                                        disabled={idx === 0}
                                        onclick={() =>
                                            (socialState = moveArrayItem(socialState, idx, 'up'))}
                                        ><ArrowUp class="size-3.5" /></Button>
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move social link down"
                                        title="Move social link down"
                                        disabled={idx === socialState.length - 1}
                                        onclick={() =>
                                            (socialState = moveArrayItem(socialState, idx, 'down'))}
                                        ><ArrowDown class="size-3.5" /></Button>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FormField
                                    id={'soc-icon-' + idx}
                                    label="Icon"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={socialErrors[item.id!]?.icon}
                                    valid={socialValid[item.id!]?.icon}>
                                    <Input
                                        id={'soc-icon-' + idx}
                                        bind:value={item.icon}
                                        placeholder="Ex: bi-github or <Github />"
                                        oninput={() => listInput('social', idx, 'icon', 'Icon')}
                                        onblur={() =>
                                            listInput('social', idx, 'icon', 'Icon', true)}
                                        error={!!socialErrors[item.id!]?.icon}
                                        valid={socialValid[item.id!]?.icon}
                                        maxlength={100}>
                                        {#snippet leadingSlot()}
                                            <div
                                                class="flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-subtle bg-surface text-accent shadow-2xs">
                                                <BrandIcon
                                                    icon={item.icon}
                                                    class="size-4 shrink-0 text-base leading-none {(
                                                        item.icon?.trim()
                                                    ) ?
                                                        'text-accent'
                                                    :   'text-fg-muted'}" />
                                            </div>
                                        {/snippet}
                                    </Input>
                                </FormField>

                                <FormField
                                    id={'soc-plat-' + idx}
                                    label="Platform"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={socialErrors[item.id!]?.platform}
                                    valid={socialValid[item.id!]?.platform}>
                                    <Input
                                        id={'soc-plat-' + idx}
                                        bind:value={item.platform}
                                        maxlength={50}
                                        error={!!socialErrors[item.id!]?.platform}
                                        valid={socialValid[item.id!]?.platform}
                                        oninput={() => {
                                            validateSocialField(idx, 'platform');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'social',
                                                idx,
                                                'platform',
                                                'Platform',
                                                true
                                            )} />
                                </FormField>
                            </div>

                            <FormField
                                id={'soc-url-' + idx}
                                label="URL"
                                variant="floating"
                                required
                                hideAsterisk
                                error={socialErrors[item.id!]?.url}
                                valid={socialValid[item.id!]?.url}>
                                <Input
                                    id={'soc-url-' + idx}
                                    bind:value={item.url}
                                    maxlength={100}
                                    error={!!socialErrors[item.id!]?.url}
                                    valid={socialValid[item.id!]?.url}
                                    oninput={() => {
                                        validateSocialField(idx, 'url');
                                    }}
                                    onblur={() => listInput('social', idx, 'url', 'URL', true)} />
                            </FormField>

                            <FormField
                                id={'soc-desc-' + idx}
                                label="Description"
                                variant="floating"
                                hideAsterisk
                                counter={`${(item.description || '').length}/1000`}>
                                <Textarea
                                    id={'soc-desc-' + idx}
                                    bind:value={item.description}
                                    placeholder="Describe this social link..."
                                    rows={2}
                                    maxlength={1000} />
                            </FormField>

                            <div
                                class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                <Button
                                    htmlType="button"
                                    type="danger"
                                    tone="critical"
                                    size="sm"
                                    class="w-full sm:w-auto"
                                    aria-label="Delete Social Link"
                                    title="Delete Social Link"
                                    onclick={() => confirmRemoveSocial(idx)}>
                                    {#snippet leading()}
                                        <Trash class="size-3.5" />
                                    {/snippet}
                                    Delete Social Link
                                </Button>
                            </div>
                        </div>
                    {/each}
                </div>

                {#snippet actions()}
                    <FormActions>
                        {#if socialIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Social Links"
                            title="Save Social Links"
                            disabled={!socialIsDirty}
                            isLoading={isSavingSocials}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Social Links
                        </Button>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'funding'}
            <FormSection
                onsubmit={handleSaveSponsorship}
                title="Funding"
                titleTag="h1"
                titleClass="type-page-title"
                description="Manage the funding and donation platforms shown on your site.">
                {#snippet headerActions()}
                    <Button
                        htmlType="button"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Add Funding"
                        title="Add Funding"
                        onclick={handleAddSponsorship}>
                        {#snippet leading()}
                            <Plus class="size-3.5" />
                        {/snippet}
                        Add Funding
                    </Button>
                {/snippet}

                {#if sponsorshipSaveSuccess}<StatusBanner
                        variant="success"
                        message="Funding links saved successfully!" />{/if}

                <div class="flex flex-col gap-4">
                    {#if sponsorshipState.length === 0}
                        <EmptyState
                            icon={HeartHandshake}
                            title="No funding platforms yet"
                            description="Add your first funding platform below." />
                    {/if}
                    {#each sponsorshipState as item, idx (item.id)}
                        <div
                            class="flex flex-col gap-3 rounded-sm border border-line-subtle bg-surface p-4">
                            <div
                                class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                <span
                                    class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                    >Funding #{idx + 1}</span>
                                <div class="flex items-center gap-1">
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move funding link up"
                                        title="Move funding link up"
                                        disabled={idx === 0}
                                        onclick={() =>
                                            (sponsorshipState = moveArrayItem(
                                                sponsorshipState,
                                                idx,
                                                'up'
                                            ))}><ArrowUp class="size-3.5" /></Button>
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move funding link down"
                                        title="Move funding link down"
                                        disabled={idx === sponsorshipState.length - 1}
                                        onclick={() =>
                                            (sponsorshipState = moveArrayItem(
                                                sponsorshipState,
                                                idx,
                                                'down'
                                            ))}><ArrowDown class="size-3.5" /></Button>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FormField
                                    id={'sp-icon-' + idx}
                                    label="Icon"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={sponsorshipErrors[item.id!]?.icon}
                                    valid={sponsorshipValid[item.id!]?.icon}>
                                    <Input
                                        id={'sp-icon-' + idx}
                                        bind:value={item.icon}
                                        placeholder="Ex: bi-currency-dollar or <Heart />"
                                        oninput={() =>
                                            listInput('sponsorship', idx, 'icon', 'Icon')}
                                        onblur={() =>
                                            listInput('sponsorship', idx, 'icon', 'Icon', true)}
                                        error={!!sponsorshipErrors[item.id!]?.icon}
                                        valid={sponsorshipValid[item.id!]?.icon}
                                        maxlength={100}>
                                        {#snippet leadingSlot()}
                                            <div
                                                class="flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-subtle bg-surface text-accent shadow-2xs">
                                                <BrandIcon
                                                    icon={item.icon}
                                                    class="size-4 shrink-0 text-base leading-none {(
                                                        item.icon?.trim()
                                                    ) ?
                                                        'text-accent'
                                                    :   'text-fg-muted'}" />
                                            </div>
                                        {/snippet}
                                    </Input>
                                </FormField>

                                <FormField
                                    id={'sp-plat-' + idx}
                                    label="Platform"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={sponsorshipErrors[item.id!]?.platform}
                                    valid={sponsorshipValid[item.id!]?.platform}>
                                    <Input
                                        id={'sp-plat-' + idx}
                                        bind:value={item.platform}
                                        maxlength={50}
                                        error={!!sponsorshipErrors[item.id!]?.platform}
                                        valid={sponsorshipValid[item.id!]?.platform}
                                        oninput={() => {
                                            validateSponsorshipField(idx, 'platform');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'sponsorship',
                                                idx,
                                                'platform',
                                                'Platform',
                                                true
                                            )} />
                                </FormField>

                                <FormField
                                    id={'sp-val-' + idx}
                                    label="Display Text"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={sponsorshipErrors[item.id!]?.displayValue}
                                    valid={sponsorshipValid[item.id!]?.displayValue}>
                                    <Input
                                        id={'sp-val-' + idx}
                                        bind:value={item.displayValue}
                                        maxlength={50}
                                        error={!!sponsorshipErrors[item.id!]?.displayValue}
                                        valid={sponsorshipValid[item.id!]?.displayValue}
                                        oninput={() => {
                                            validateSponsorshipField(idx, 'displayValue');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'sponsorship',
                                                idx,
                                                'displayValue',
                                                'Display text',
                                                true
                                            )} />
                                </FormField>

                                <FormField
                                    id={'sp-url-' + idx}
                                    label="URL"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={sponsorshipErrors[item.id!]?.url}
                                    valid={sponsorshipValid[item.id!]?.url}>
                                    <Input
                                        id={'sp-url-' + idx}
                                        bind:value={item.url}
                                        maxlength={100}
                                        error={!!sponsorshipErrors[item.id!]?.url}
                                        valid={sponsorshipValid[item.id!]?.url}
                                        oninput={() => {
                                            validateSponsorshipField(idx, 'url');
                                        }}
                                        onblur={() =>
                                            listInput('sponsorship', idx, 'url', 'URL', true)} />
                                </FormField>
                            </div>

                            <FormField
                                id={'sp-desc-' + idx}
                                label="Description"
                                variant="floating"
                                hideAsterisk
                                counter={`${(item.description || '').length}/1000`}>
                                <Textarea
                                    id={'sp-desc-' + idx}
                                    bind:value={item.description}
                                    placeholder="Describe why they must sponsoring you..."
                                    rows={2}
                                    maxlength={1000} />
                            </FormField>

                            <div
                                class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                <Button
                                    htmlType="button"
                                    type="danger"
                                    tone="critical"
                                    size="sm"
                                    class="w-full sm:w-auto"
                                    aria-label="Delete Funding"
                                    title="Delete Funding"
                                    onclick={() => confirmRemoveSponsorship(idx)}>
                                    {#snippet leading()}
                                        <Trash class="size-3.5" />
                                    {/snippet}
                                    Delete Funding
                                </Button>
                            </div>
                        </div>
                    {/each}
                </div>

                {#snippet actions()}
                    <FormActions>
                        {#if sponsorshipIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Funding"
                            title="Save Funding"
                            disabled={!sponsorshipIsDirty}
                            isLoading={isSavingSponsorship}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Funding
                        </Button>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'contact'}
            <FormSection
                onsubmit={handleSaveContact}
                title="Contact"
                titleTag="h1"
                titleClass="type-page-title"
                description="Manage the contact channels shown on your public Contact page.">
                {#snippet headerActions()}
                    <Button
                        htmlType="button"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Add Contact"
                        title="Add Contact"
                        onclick={handleAddContact}>
                        {#snippet leading()}
                            <Plus class="size-3.5" />
                        {/snippet}
                        Add Contact
                    </Button>
                {/snippet}

                {#if contactSaveSuccess}<StatusBanner
                        variant="success"
                        message="Contact info saved successfully!" />{/if}

                <div class="flex flex-col gap-4">
                    {#if contactState.length === 0}
                        <EmptyState
                            icon={AtSign}
                            title="No contact channels yet"
                            description="Add your first contact channel below." />
                    {/if}
                    {#each contactState as item, idx (item.id)}
                        <div
                            class="flex flex-col gap-3 rounded-sm border border-line-subtle bg-surface p-4">
                            <div
                                class="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                                <span
                                    class="min-w-0 truncate font-mono text-xs font-light text-fg-muted"
                                    >Contact #{idx + 1}</span>
                                <div class="flex items-center gap-1">
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move contact item up"
                                        title="Move contact item up"
                                        disabled={idx === 0}
                                        onclick={() =>
                                            (contactState = moveArrayItem(contactState, idx, 'up'))}
                                        ><ArrowUp class="size-3.5" /></Button>
                                    <Button
                                        htmlType="button"
                                        type="ghost"
                                        size="sm"
                                        aria-label="Move contact item down"
                                        title="Move contact item down"
                                        disabled={idx === contactState.length - 1}
                                        onclick={() =>
                                            (contactState = moveArrayItem(
                                                contactState,
                                                idx,
                                                'down'
                                            ))}><ArrowDown class="size-3.5" /></Button>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FormField
                                    id={'ct-icon-' + idx}
                                    label="Icon"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={contactErrors[item.id!]?.icon}
                                    valid={contactValid[item.id!]?.icon}>
                                    <Input
                                        id={'ct-icon-' + idx}
                                        bind:value={item.icon}
                                        placeholder="Ex: bi-envelope or <Mail />"
                                        oninput={() => listInput('contact', idx, 'icon', 'Icon')}
                                        onblur={() =>
                                            listInput('contact', idx, 'icon', 'Icon', true)}
                                        error={!!contactErrors[item.id!]?.icon}
                                        valid={contactValid[item.id!]?.icon}
                                        maxlength={100}>
                                        {#snippet leadingSlot()}
                                            <div
                                                class="flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-subtle bg-surface text-accent shadow-2xs">
                                                <BrandIcon
                                                    icon={item.icon}
                                                    class="size-4 shrink-0 text-base leading-none {(
                                                        item.icon?.trim()
                                                    ) ?
                                                        'text-accent'
                                                    :   'text-fg-muted'}" />
                                            </div>
                                        {/snippet}
                                    </Input>
                                </FormField>

                                <FormField
                                    id={'ct-plat-' + idx}
                                    label="Platform"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={contactErrors[item.id!]?.platform}
                                    valid={contactValid[item.id!]?.platform}>
                                    <Input
                                        id={'ct-plat-' + idx}
                                        bind:value={item.platform}
                                        maxlength={50}
                                        error={!!contactErrors[item.id!]?.platform}
                                        valid={contactValid[item.id!]?.platform}
                                        oninput={() => {
                                            validateContactField(idx, 'platform');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'contact',
                                                idx,
                                                'platform',
                                                'Platform',
                                                true
                                            )} />
                                </FormField>

                                <FormField
                                    id={'ct-val-' + idx}
                                    label="Display Text"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={contactErrors[item.id!]?.displayValue}
                                    valid={contactValid[item.id!]?.displayValue}>
                                    <Input
                                        id={'ct-val-' + idx}
                                        bind:value={item.displayValue}
                                        maxlength={50}
                                        error={!!contactErrors[item.id!]?.displayValue}
                                        valid={contactValid[item.id!]?.displayValue}
                                        oninput={() => {
                                            validateContactField(idx, 'displayValue');
                                        }}
                                        onblur={() =>
                                            listInput(
                                                'contact',
                                                idx,
                                                'displayValue',
                                                'Display text',
                                                true
                                            )} />
                                </FormField>

                                <FormField
                                    id={'ct-url-' + idx}
                                    label="URL"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    error={contactErrors[item.id!]?.href}
                                    valid={contactValid[item.id!]?.href}>
                                    <Input
                                        id={'ct-url-' + idx}
                                        bind:value={item.href}
                                        maxlength={100}
                                        error={!!contactErrors[item.id!]?.href}
                                        valid={contactValid[item.id!]?.href}
                                        oninput={() => {
                                            validateContactField(idx, 'href');
                                        }}
                                        onblur={() =>
                                            listInput('contact', idx, 'href', 'URL', true)} />
                                </FormField>
                            </div>

                            <FormField
                                id={'ct-desc-' + idx}
                                label="Description"
                                variant="floating"
                                hideAsterisk
                                counter={`${(item.description || '').length}/1000`}>
                                <Textarea
                                    id={'ct-desc-' + idx}
                                    bind:value={item.description}
                                    placeholder="Describe this contact channel..."
                                    rows={2}
                                    maxlength={1000} />
                            </FormField>

                            <div
                                class="mt-0.5 flex items-center justify-end border-t border-line-subtle pt-2.5">
                                <Button
                                    htmlType="button"
                                    type="danger"
                                    tone="critical"
                                    size="sm"
                                    class="w-full sm:w-auto"
                                    aria-label="Delete Contact"
                                    title="Delete Contact"
                                    onclick={() => confirmRemoveContact(idx)}>
                                    {#snippet leading()}
                                        <Trash class="size-3.5" />
                                    {/snippet}
                                    Delete Contact
                                </Button>
                            </div>
                        </div>
                    {/each}
                </div>

                {#snippet actions()}
                    <FormActions>
                        {#if contactIsDirty}
                            <p class="text-xs text-fg-secondary select-none">
                                You have unsaved changes.
                            </p>
                        {/if}
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            aria-label="Save Contact"
                            title="Save Contact"
                            disabled={!contactIsDirty}
                            isLoading={isSavingContact}>
                            {#snippet leading()}
                                <Save class="size-3.5" />
                            {/snippet}
                            Save Contact
                        </Button>
                    </FormActions>
                {/snippet}
            </FormSection>
        {:else if activeAdminTab === 'privacy'}
            <FormSection
                title="Privacy Policy"
                titleTag="h1"
                titleClass="type-page-title"
                description="Edit and publish your website Privacy Policy in Markdown."
                onsubmit={e => handleSaveLegalPage('privacy', e)}
                class="py-4 sm:py-6"
                bare>
                {#snippet headerActions()}
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Save Privacy Policy"
                        title="Save Privacy Policy"
                        isLoading={isSavingLegal}
                        disabled={isSavingLegal}>
                        {#snippet leading()}
                            <Save class="size-3.5" />
                        {/snippet}
                        Save Privacy Policy
                    </Button>
                {/snippet}
                {#if legalDrafts.privacy}
                    <StatusBanner
                        variant="warning"
                        class="mb-4">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span
                                >Autosaved local draft found (different from saved database
                                version).</span>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    type="secondary"
                                    size="sm"
                                    onclick={() => restoreLegalDraft('privacy')}>
                                    Restore draft
                                </Button>
                                <Button
                                    type="ghost"
                                    size="sm"
                                    onclick={() => discardLegalDraft('privacy')}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    </StatusBanner>
                {/if}
                {#if legalFieldErrors.privacy}<FieldMessage
                        message={legalFieldErrors.privacy} />{/if}
                {#await loadMarkdownEditor()}
                    <LoadingState
                        variant="spinner"
                        label="Loading editor..." />
                {:then { MarkdownEditor }}
                    <MarkdownEditor
                        render={renderMdrsPreview}
                        bind:value={
                            () => legalPagesData.privacy.content,
                            value => {
                                legalPagesData.privacy.content = value;
                                legalValidation.input('privacy');
                            }
                        }
                        onblur={() => {
                            void legalValidation.check('privacy');
                        }}
                        autosaveKey="autosave_legal_privacy"
                        placeholder="Write your Privacy Policy content in markdown..."
                        minHeight="500px"
                        stickyTopClass="top-12 md:top-0"
                        onImport={handleLegalImport} />
                {/await}
            </FormSection>
        {:else if activeAdminTab === 'security'}
            <FormSection
                title="Security Policy"
                titleTag="h1"
                titleClass="type-page-title"
                description="Edit and publish your website Security Policy & Vulnerability Disclosure Guidelines."
                onsubmit={e => handleSaveLegalPage('security', e)}
                class="py-4 sm:py-6"
                bare>
                {#snippet headerActions()}
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Save Security Policy"
                        title="Save Security Policy"
                        isLoading={isSavingLegal}
                        disabled={isSavingLegal}>
                        {#snippet leading()}
                            <Save class="size-3.5" />
                        {/snippet}
                        Save Security Policy
                    </Button>
                {/snippet}
                {#if legalDrafts.security}
                    <StatusBanner
                        variant="warning"
                        class="mb-4">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span
                                >Autosaved local draft found (different from saved database
                                version).</span>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    type="secondary"
                                    size="sm"
                                    onclick={() => restoreLegalDraft('security')}>
                                    Restore draft
                                </Button>
                                <Button
                                    type="ghost"
                                    size="sm"
                                    onclick={() => discardLegalDraft('security')}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    </StatusBanner>
                {/if}
                {#if legalFieldErrors.security}<FieldMessage
                        message={legalFieldErrors.security} />{/if}
                {#await loadMarkdownEditor()}
                    <LoadingState
                        variant="spinner"
                        label="Loading editor..." />
                {:then { MarkdownEditor }}
                    <MarkdownEditor
                        render={renderMdrsPreview}
                        bind:value={
                            () => legalPagesData.security.content,
                            value => {
                                legalPagesData.security.content = value;
                                legalValidation.input('security');
                            }
                        }
                        onblur={() => {
                            void legalValidation.check('security');
                        }}
                        autosaveKey="autosave_legal_security"
                        placeholder="Write your Security Policy content in markdown..."
                        minHeight="500px"
                        stickyTopClass="top-12 md:top-0"
                        onImport={handleLegalImport} />
                {/await}
            </FormSection>
        {:else if activeAdminTab === 'terms'}
            <FormSection
                title="Terms of Service"
                titleTag="h1"
                titleClass="type-page-title"
                description="Edit and publish your website Terms of Service."
                onsubmit={e => handleSaveLegalPage('terms', e)}
                class="py-4 sm:py-6"
                bare>
                {#snippet headerActions()}
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Save Terms of Service"
                        title="Save Terms of Service"
                        isLoading={isSavingLegal}
                        disabled={isSavingLegal}>
                        {#snippet leading()}
                            <Save class="size-3.5" />
                        {/snippet}
                        Save Terms of Service
                    </Button>
                {/snippet}
                {#if legalDrafts.terms}
                    <StatusBanner
                        variant="warning"
                        class="mb-4">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span
                                >Autosaved local draft found (different from saved database
                                version).</span>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    type="secondary"
                                    size="sm"
                                    onclick={() => restoreLegalDraft('terms')}>
                                    Restore draft
                                </Button>
                                <Button
                                    type="ghost"
                                    size="sm"
                                    onclick={() => discardLegalDraft('terms')}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    </StatusBanner>
                {/if}
                {#if legalFieldErrors.terms}<FieldMessage message={legalFieldErrors.terms} />{/if}
                {#await loadMarkdownEditor()}
                    <LoadingState
                        variant="spinner"
                        label="Loading editor..." />
                {:then { MarkdownEditor }}
                    <MarkdownEditor
                        render={renderMdrsPreview}
                        bind:value={
                            () => legalPagesData.terms.content,
                            value => {
                                legalPagesData.terms.content = value;
                                legalValidation.input('terms');
                            }
                        }
                        onblur={() => {
                            void legalValidation.check('terms');
                        }}
                        autosaveKey="autosave_legal_terms"
                        placeholder="Write your Terms of Service content in markdown..."
                        minHeight="500px"
                        stickyTopClass="top-12 md:top-0"
                        onImport={handleLegalImport} />
                {/await}
            </FormSection>
        {:else if activeAdminTab === 'ai-disclosure'}
            <FormSection
                title="AI Disclosure"
                titleTag="h1"
                titleClass="type-page-title"
                description="Edit and publish how your website uses AI."
                onsubmit={e => handleSaveLegalPage('ai-disclosure', e)}
                class="py-4 sm:py-6"
                bare>
                {#snippet headerActions()}
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        responsiveIconOnly
                        aria-label="Save AI Disclosure"
                        title="Save AI Disclosure"
                        isLoading={isSavingLegal}
                        disabled={isSavingLegal}>
                        {#snippet leading()}
                            <Save class="size-3.5" />
                        {/snippet}
                        Save AI Disclosure
                    </Button>
                {/snippet}
                {#if legalDrafts['ai-disclosure']}
                    <StatusBanner
                        variant="warning"
                        class="mb-4">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span
                                >Autosaved local draft found (different from saved database
                                version).</span>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    type="secondary"
                                    size="sm"
                                    onclick={() => restoreLegalDraft('ai-disclosure')}>
                                    Restore draft
                                </Button>
                                <Button
                                    type="ghost"
                                    size="sm"
                                    onclick={() => discardLegalDraft('ai-disclosure')}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    </StatusBanner>
                {/if}
                {#if legalFieldErrors['ai-disclosure']}<FieldMessage
                        message={legalFieldErrors['ai-disclosure']} />{/if}
                {#await loadMarkdownEditor()}
                    <LoadingState
                        variant="spinner"
                        label="Loading editor..." />
                {:then { MarkdownEditor }}
                    <MarkdownEditor
                        render={renderMdrsPreview}
                        bind:value={
                            () => legalPagesData['ai-disclosure'].content,
                            value => {
                                legalPagesData['ai-disclosure'].content = value;
                                legalValidation.input('ai-disclosure');
                            }
                        }
                        onblur={() => {
                            void legalValidation.check('ai-disclosure');
                        }}
                        autosaveKey="autosave_legal_ai-disclosure"
                        placeholder="Write your AI Disclosure content in markdown..."
                        minHeight="500px"
                        stickyTopClass="top-12 md:top-0"
                        onImport={handleLegalImport} />
                {/await}
            </FormSection>
        {:else if activeAdminTab === 'apps'}
            {#await loadIdentityProviderSettings()}
                <LoadingState
                    variant="spinner"
                    label="Loading apps..." />
            {:then { default: IdentityProviderSettings }}
                <IdentityProviderSettings />
            {/await}
        {:else if activeAdminTab === 'account'}
            {#await loadAccountSettings()}
                <LoadingState
                    variant="spinner"
                    label="Loading settings..." />
            {:then { default: AccountSettings }}
                <AccountSettings>
                    <Card
                        variant="bordered"
                        class="border-line-subtle! bg-surface!">
                        <FormSection
                            title="Import profile"
                            titleClass="type-card-title"
                            description="Import profile data from a JSON file."
                            bare>
                            <input
                                bind:this={profileImportInput}
                                type="file"
                                name="profile-import"
                                accept="application/json,.json"
                                class="hidden"
                                onchange={handleImportProfileFile} />
                            <div>
                                <Button
                                    type="secondary"
                                    size="md"
                                    isLoading={isImportingProfile}
                                    disabled={isImportingProfile || isDeletingAllData}
                                    onclick={() => profileImportInput?.click()}>
                                    {#snippet leading()}<DatabaseArrowUp
                                            class="size-3.5" />{/snippet}
                                    Import data
                                </Button>
                            </div>
                        </FormSection>
                    </Card>
                    <Card
                        variant="bordered"
                        class="border-line-subtle! bg-surface!">
                        <FormSection
                            title="Export data"
                            titleClass="type-card-title"
                            description="Download all your content as one archive."
                            bare>
                            <div>
                                <Button
                                    type="secondary"
                                    size="md"
                                    isLoading={isExportingAllData}
                                    disabled={isExportingAllData}
                                    onclick={exportAllData}>
                                    {#snippet leading()}<DatabaseArrowDown
                                            class="size-3.5" />{/snippet}
                                    Export data
                                </Button>
                            </div>
                        </FormSection>
                    </Card>
                    <Card
                        variant="bordered"
                        class="border-danger/30 bg-danger-subtle/40">
                        <FormSection
                            title="Danger zone"
                            titleClass="type-card-title"
                            description="Permanently delete all your data including post and profile. This can't be undone."
                            bare>
                            <div>
                                <Button
                                    type="danger"
                                    tone="critical"
                                    size="md"
                                    disabled={!hasExportedAllData
                                        || isImportingProfile
                                        || isDeletingAllData}
                                    title={hasExportedAllData ? undefined : (
                                        'Export your data first.'
                                    )}
                                    onclick={confirmDeleteAllData}
                                    isLoading={isDeletingAllData}>
                                    {#snippet leading()}<DatabaseX class="size-3.5" />{/snippet}
                                    Delete all data
                                </Button>
                                {#if !hasExportedAllData}
                                    <p class="mt-2 text-xs text-fg-muted">
                                        Export your data first before deleting.
                                    </p>
                                {/if}
                            </div>
                        </FormSection>
                    </Card>
                </AccountSettings>
            {/await}
        {/if}
    </main>
</div>

<ConfirmationDialog
    isOpen={pendingLegalImport !== null}
    title="Replace the current content?"
    message="Importing replaces everything in this editor with the file."
    confirmLabel="Import file"
    cancelLabel="Keep editing"
    isDestructive
    onConfirm={() => pendingLegalImport && applyLegalImport(pendingLegalImport)}
    onCancel={() => (pendingLegalImport = null)} />

<ConfirmationDialog
    bind:isOpen={showLogoutDialog}
    title="Sign out"
    message="Are you sure you want to sign out of the admin console?"
    confirmLabel="Sign out"
    isDestructive
    isLoading={isLoggingOut}
    onConfirm={handleLogout}>
    {#snippet confirmIcon()}
        <LogOut class="size-3.5" />
    {/snippet}
</ConfirmationDialog>

<ConfirmationDialog
    bind:isOpen={showDeletePostDialog}
    title="Delete Post"
    message={`Are you sure you want to delete post "${postToDelete?.title}"?`}
    confirmLabel="Delete Post"
    isDestructive
    onConfirm={executeDeletePost} />

<ConfirmationDialog
    bind:isOpen={showDeleteCommentDialog}
    title="Delete Comment"
    message="Are you sure you want to delete this comment?"
    confirmLabel="Delete Comment"
    isDestructive
    onConfirm={executeDeleteComment} />

<ConfirmationDialog
    bind:isOpen={showDeleteAllDialog}
    title="Delete all site data?"
    message="Permanently delete all your data including post and profile. This can't be undone."
    confirmLabel="Delete everything"
    requiredKeyword="DELETE"
    isDestructive
    isLoading={isDeletingAllData}
    onConfirm={executeDeleteAllData}>
    <p class="mt-3 font-sans text-xs text-fg-muted">
        For safety, this needs a sign-in from the last 10 minutes. If it is older, sign out and sign
        in again first.
    </p>
</ConfirmationDialog>

<ConfirmationDialog
    bind:isOpen={showDeleteResumeDocDialog}
    title="Delete resume?"
    message="Permanently delete this resume and all its files. This can't be undone."
    confirmLabel="Delete resume"
    requiredKeyword="DELETE"
    isDestructive
    onConfirm={executeDeleteResumeDoc} />

<ConfirmationDialog
    bind:isOpen={showRemoveSignatureDialog}
    title="Delete signature?"
    message="Permanently delete the resume signature. The resume stays available without it."
    confirmLabel="Delete signature"
    requiredKeyword="DELETE"
    isDestructive
    onConfirm={removeResumeSignature} />

<ConfirmationDialog
    bind:isOpen={showRemoveKeyDialog}
    title="Delete OpenPGP key?"
    message="Permanently delete your public key and the resume signature. This can't be undone."
    confirmLabel="Delete key"
    requiredKeyword="DELETE"
    isDestructive
    onConfirm={removeOpenPgpKey} />

<ConfirmationDialog
    bind:isOpen={showRemoveEntryDialog}
    title={pendingRemove ? removeEntryTitles[pendingRemove.type] : 'Delete Entry'}
    message={removeEntryMessage}
    confirmLabel={pendingRemove ? removeEntryTitles[pendingRemove.type] : 'Delete Entry'}
    isDestructive
    onConfirm={executeRemoveEntry}
    onCancel={() => (pendingRemove = null)} />
