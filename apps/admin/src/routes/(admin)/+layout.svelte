<script lang="ts">
    import { supabase } from '#lib/supabase.ts';
    import { getSafeRedirectUrl } from '#lib/utils/safeRedirect.ts';
    import { clearLocalAdminSession, inspectAdminAuth } from '#lib/adminAuthState.ts';
    import { LoadingState } from '#lib/index.ts';
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import type { Snippet } from 'svelte';

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();

    let isChecking = $state(true);
    let isAuthenticated = $state(false);

    const isLoginPage = $derived(page.url.pathname === '/login');

    function redirectToLogin() {
        const target = page.url.pathname + page.url.search;
        window.location.replace(`/login?redirectTo=${encodeURIComponent(target)}`);
    }

    async function inspectSession() {
        const auth = await inspectAdminAuth(supabase);
        if (auth.status === 'invalid') console.error('Admin session check failed:', auth.error);
        return auth.status;
    }

    async function checkSession() {
        try {
            const status = await inspectSession();

            if (isLoginPage) {
                if (status === 'authenticated') {
                    const target = getSafeRedirectUrl(page.url.searchParams.get('redirectTo'));
                    window.location.replace(target);
                    return;
                }
                if (status !== 'signed-out') void clearLocalAdminSession(supabase);
                isAuthenticated = false;
                isChecking = false;
            } else {
                if (status === 'authenticated') {
                    isAuthenticated = true;
                    isChecking = false;
                } else redirectToLogin();
            }
        } catch (error) {
            console.error('Admin session check failed:', error);
            if (!isLoginPage) {
                redirectToLogin();
                return;
            }
            void clearLocalAdminSession(supabase);
            isAuthenticated = false;
            isChecking = false;
        }
    }

    onMount(() => {
        void checkSession();

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                isAuthenticated = false;
                if (page.url.pathname !== '/login') {
                    redirectToLogin();
                } else {
                    isChecking = false;
                }
            } else if (event === 'SIGNED_IN' && session && page.url.pathname !== '/login') {
                queueMicrotask(() => {
                    void (async () => {
                        try {
                            const status = await inspectSession();
                            if (status === 'authenticated') {
                                isAuthenticated = true;
                                isChecking = false;
                            } else redirectToLogin();
                        } catch (error) {
                            console.error('Admin session check failed:', error);
                            redirectToLogin();
                        }
                    })();
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    });
</script>

{#if isChecking}
    <main
        id="main"
        class="flex min-h-screen w-full items-center justify-center bg-surface-base">
        <LoadingState
            variant="spinner"
            size="lg"
            label="Checking authentication..." />
    </main>
{:else if isLoginPage || isAuthenticated}
    {@render children()}
{/if}
