<script lang="ts">
  import {supabase} from '$lib/supabase';
  import {getSafeRedirectUrl} from '$lib/utils/safeRedirect';
  import {LoadingState} from '$lib';
  import {page} from '$app/state';
  import {onMount} from 'svelte';
  import type {Snippet} from 'svelte';

  interface Props {
    children: Snippet;
  }

  let {children}: Props = $props();

  let isChecking = $state(true);
  let isAuthenticated = $state(false);

  const isLoginPage = $derived(page.url.pathname === '/admin/login');

  async function checkSession() {
    try {
      const {data, error} = await supabase.auth.getSession();
      const hasSession = !error && !!data?.session;

      if (isLoginPage) {
        if (hasSession) {
          const target = getSafeRedirectUrl(
            page.url.searchParams.get('redirectTo')
          );
          window.location.replace(target);
          return;
        }
        isAuthenticated = false;
        isChecking = false;
      } else {
        if (!hasSession) {
          const target = page.url.pathname + page.url.search;
          const redirectUrl = `/admin/login?redirectTo=${encodeURIComponent(target)}`;
          window.location.replace(redirectUrl);
          return;
        }
        isAuthenticated = true;
        isChecking = false;
      }
    } catch {
      if (!isLoginPage) {
        const target = page.url.pathname + page.url.search;
        const redirectUrl = `/admin/login?redirectTo=${encodeURIComponent(target)}`;
        window.location.replace(redirectUrl);
        return;
      }
      isAuthenticated = false;
      isChecking = false;
    }
  }

  onMount(() => {
    void checkSession();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        isAuthenticated = false;
        if (page.url.pathname !== '/admin/login') {
          const target = page.url.pathname + page.url.search;
          const redirectUrl = `/admin/login?redirectTo=${encodeURIComponent(target)}`;
          window.location.replace(redirectUrl);
        } else {
          isChecking = false;
        }
      } else if (event === 'SIGNED_IN' && session) {
        isAuthenticated = true;
        if (page.url.pathname === '/admin/login') {
          const target = getSafeRedirectUrl(
            page.url.searchParams.get('redirectTo')
          );
          window.location.replace(target);
        } else {
          isChecking = false;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  });
</script>

{#if isChecking}
  <main
    id="main-content"
    class="flex min-h-screen w-full items-center justify-center bg-surface-base">
    <LoadingState
      variant="spinner"
      size="lg"
      label="Checking authentication..." />
  </main>
{:else if isLoginPage || isAuthenticated}
  {@render children()}
{/if}
