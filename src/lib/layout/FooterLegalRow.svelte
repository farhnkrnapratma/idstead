<script lang="ts">
  import {cn} from '../utils/cn';
  import {consentStore} from '../stores/consentStore.svelte';
  import {buttonKey} from '$lib/shortcuts';
  import {shortcut} from '../utils/shortcut.svelte';

  interface Props {
    name?: string;
    class?: string;
  }

  let {name = '', class: className = ''}: Props = $props();
</script>

<div
  class={cn(
    'flex w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs font-medium text-text-muted',
    className
  )}>
  <span class="inline-flex shrink-0 items-center text-text-muted">
    &copy; {new Date().getFullYear()}{name ? ` ${name}.` : '.'}
  </span>
  <a
    href="/terms"
    use:shortcut={{combo: buttonKey('termsLink'), label: 'Terms'}}
    class="relative inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Terms
  </a>
  <a
    href="/privacy"
    use:shortcut={{combo: buttonKey('privacyLink'), label: 'Privacy'}}
    class="relative inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Privacy
  </a>
  <a
    href="/security"
    use:shortcut={{combo: buttonKey('securityLink'), label: 'Security'}}
    class="relative inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Security
  </a>
  <button
    type="button"
    onclick={() => consentStore.openCustomizeModal()}
    use:shortcut={{combo: buttonKey('cookiesLink'), label: 'Cookies'}}
    class="relative inline-flex shrink-0 cursor-pointer items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Cookies
  </button>
  <a
    href="/sitemap.xml"
    use:shortcut={{combo: buttonKey('sitemapLink'), label: 'Sitemap'}}
    class="relative inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Sitemap
  </a>
  <a
    href="/atom.xml"
    use:shortcut={{combo: buttonKey('feed'), label: 'RSS'}}
    class="relative inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    RSS
  </a>
</div>
