<script lang="ts">
  import './global.css';
  import {onMount} from 'svelte';
  import {onNavigate} from '$app/navigation';
  import {page} from '$app/state';
  import {ConsentBanner, Toast, ScrollToTopButton, FeedbackButton} from '$lib';

  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {scrollStore} from '$lib/stores/scrollStore.svelte';
  import {readingModeStore} from '$lib/stores/readingModeStore.svelte';
  import {refreshCodeBlockPrefs} from '$lib/utils/codeBlocks';

  const {data, children} = $props();

  let name = $derived(data?.author?.name || '');
  let siteUrl = $derived((data?.author?.siteUrl || '').replace(/\/$/, ''));

  let feedTitle = $derived(
    name ?
      `${name}${siteUrl ? ` (${siteUrl}/blog)` : ''} — RSS Feed`
    : `${siteUrl ? siteUrl.replace(/^https?:\/\//, '') + '/blog' : 'Blog'} — RSS Feed`
  );

  const isAdminPage = $derived(page.url.pathname.startsWith('/admin'));
  const isPostEditorPage = $derived(page.url.pathname === '/admin/new');
  const isBlogPost = $derived(page.route.id === '/blog/[slug]');
  const isPageWithFeedback = $derived(
    !page.error
      && page.url.pathname !== '/feedback'
      && !page.url.pathname.startsWith('/admin')
  );

  onMount(() => {
    const cleanupTheme = themeStore.init();
    const cleanupA11y = a11yStore.init();
    const cleanupCodeBlockPrefs = codeBlockPrefsStore.init(
      refreshCodeBlockPrefs
    );
    const cleanupScroll = scrollStore.init();
    return () => {
      cleanupTheme?.();
      cleanupA11y?.();
      cleanupCodeBlockPrefs?.();
      cleanupScroll?.();
    };
  });

  $effect(() => {
    if (typeof document !== 'undefined') {
      if (readingModeStore.active) {
        document.documentElement.dataset.readingMode = 'true';
        document.documentElement.classList.add('reading-mode');
      } else {
        delete document.documentElement.dataset.readingMode;
        document.documentElement.classList.remove('reading-mode');
      }
    }
  });

  const BLOG_POST_ROUTE_ID = '/blog/[slug]';

  onNavigate(navigation => {
    if (!document.startViewTransition || a11yStore.current.reduceMotion) return;

    const isBlogPostTransition =
      navigation.to?.route.id === BLOG_POST_ROUTE_ID
      || navigation.from?.route.id === BLOG_POST_ROUTE_ID;
    if (!isBlogPostTransition) return;

    return new Promise(resolve => {
      const root = document.documentElement;
      root.dataset.transitionType = 'drill';
      const transition = document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
      void transition.finished.finally(() => {
        delete root.dataset.transitionType;
      });
    });
  });
</script>

<svelte:head>
  <link
    rel="alternate"
    type="application/atom+xml"
    title={feedTitle}
    href="/atom.xml" />
  <link
    rel="describedby"
    type="text/markdown"
    title="LLM & AI Agent Directory"
    href="/llms.txt" />
  <link
    rel="describedby"
    type="text/markdown"
    title="Public API Documentation"
    href="/api/v1" />
</svelte:head>

{@render children()}

<ScrollToTopButton
  show={scrollStore.pastThreshold
    && (!isAdminPage || isPostEditorPage)
    && !readingModeStore.active}
  class={isPostEditorPage ? 'hidden md:block' : ''} />
<FeedbackButton show={isPageWithFeedback && !readingModeStore.active} />

<ConsentBanner />
<Toast />
