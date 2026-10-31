// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as env from '$app/env/public';

export const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY || '';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    action?: string;
                    size?: 'normal' | 'compact' | 'flexible';
                    theme?: 'light' | 'dark' | 'auto';
                    appearance?: 'always' | 'execute' | 'interaction-only';
                    execution?: 'render' | 'execute';
                    'before-interactive-callback'?: () => void;
                    'after-interactive-callback'?: () => void;
                    callback?: (token: string) => void;
                    'error-callback'?: (err: unknown) => void;
                    'expired-callback'?: () => void;
                    'timeout-callback'?: () => void;
                }
            ) => string;
            execute: (
                widgetIdOrContainer?: string | HTMLElement,
                options?: Record<string, unknown>
            ) => void;
            reset: (widgetIdOrContainer?: string | HTMLElement) => void;
            remove: (widgetIdOrContainer?: string | HTMLElement) => void;
            getResponse: (widgetIdOrContainer?: string | HTMLElement) => string | undefined;
        };
    }
}

export interface TurnstileWidgetOptions {
    sitekey: string;
    action?: string;
    size?: 'normal' | 'compact' | 'flexible';
    theme?: 'light' | 'dark' | 'auto';
    appearance?: 'always' | 'execute' | 'interaction-only';
    execution?: 'render' | 'execute';
    'before-interactive-callback'?: () => void;
    'after-interactive-callback'?: () => void;
    callback?: (token: string) => void;
    'error-callback'?: (err: unknown) => void;
    'expired-callback'?: () => void;
    'timeout-callback'?: () => void;
}

const executionResolvers = new WeakMap<HTMLElement, (token: string) => void>();
const pendingRenders = new WeakMap<HTMLElement, () => Promise<void>>();
const widgetAppearances = new WeakMap<HTMLElement, TurnstileWidgetOptions['appearance']>();
const widgetExecutions = new WeakMap<HTMLElement, TurnstileWidgetOptions['execution']>();
const LAZY_RENDER_MARGIN = '200px';
let turnstileScriptPromise: Promise<void> | undefined;

export function ensureTurnstileScript() {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return Promise.reject(new Error('Turnstile can only load in a browser.'));
    }
    if (window.turnstile) return Promise.resolve();
    if (turnstileScriptPromise) return turnstileScriptPromise;

    const existing = document.querySelector<HTMLScriptElement>(
        'script[src*="challenges.cloudflare.com/turnstile"]'
    );
    const script = existing ?? document.createElement('script');

    turnstileScriptPromise = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
            window.clearTimeout(timeoutId);
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
        };

        const fail = (error: Error) => {
            cleanup();
            script.remove();
            reject(error);
        };

        const onLoad = () => {
            if (window.turnstile) {
                cleanup();
                resolve();
            } else {
                fail(new Error('Turnstile loaded without exposing its API.'));
            }
        };

        const onError = () => {
            fail(new Error('Failed to load the Turnstile script.'));
        };

        const timeoutId = window.setTimeout(() => {
            fail(new Error('Timed out while loading the Turnstile script.'));
        }, 15000);
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });

        if (!existing) {
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    }).catch(error => {
        turnstileScriptPromise = undefined;
        throw error;
    });

    return turnstileScriptPromise;
}

export function turnstileWidget(node: HTMLElement, options: TurnstileWidgetOptions) {
    let destroyed = false;
    let widgetId: string | undefined;
    let renderPromise: Promise<void> | undefined;
    let observer: IntersectionObserver | undefined;
    const form = node.closest('form');

    const appearance = options.appearance ?? 'interaction-only';
    const isInteractionOnly = appearance === 'interaction-only';
    widgetAppearances.set(node, appearance);
    widgetExecutions.set(node, options.execution ?? 'execute');

    function collapseNode() {
        if (!isInteractionOnly) return;
        node.style.position = 'absolute';
        node.style.width = '1px';
        node.style.height = '0';
        node.style.minHeight = '0';
        node.style.opacity = '0';
        node.style.margin = '0';
        node.style.padding = '0';
        node.style.overflow = 'hidden';
        node.style.pointerEvents = 'none';
    }

    function expandNode() {
        node.style.position = 'relative';
        node.style.width = '100%';
        node.style.height = 'auto';
        node.style.minHeight = '65px';
        node.style.opacity = '1';
        node.style.margin = '0.5rem 0';
        node.style.padding = '';
        node.style.overflow = 'visible';
        node.style.pointerEvents = 'auto';
    }

    collapseNode();

    function render() {
        if (destroyed) return;
        const key =
            typeof options?.sitekey === 'string' ? options.sitekey.trim()
            : typeof turnstileSiteKey === 'string' ? turnstileSiteKey.trim()
            : '';

        if (!key) return;

        if (window.turnstile) {
            node.innerHTML = '';
            try {
                widgetId = window.turnstile.render(node, {
                    sitekey: key,
                    action: options.action ?? 'turnstile-spin-v2',
                    size: options.size ?? 'flexible',
                    theme: options.theme ?? 'auto',
                    appearance: options.appearance ?? 'interaction-only',
                    execution: options.execution ?? 'execute',
                    'before-interactive-callback': () => {
                        expandNode();
                        options['before-interactive-callback']?.();
                    },
                    'after-interactive-callback': () => {
                        collapseNode();
                        options['after-interactive-callback']?.();
                    },
                    callback: (token: string) => {
                        collapseNode();
                        const resolver = executionResolvers.get(node);
                        if (resolver) {
                            executionResolvers.delete(node);
                            resolver(token);
                        }
                        options.callback?.(token);
                    },
                    'error-callback': (err: unknown) => {
                        collapseNode();
                        const resolver = executionResolvers.get(node);
                        if (resolver) {
                            executionResolvers.delete(node);
                            resolver('');
                        }
                        options['error-callback']?.(err);
                    },
                    'expired-callback': () => {
                        collapseNode();
                        options['expired-callback']?.();
                    },
                    'timeout-callback': () => {
                        collapseNode();
                        const resolver = executionResolvers.get(node);
                        if (resolver) {
                            executionResolvers.delete(node);
                            resolver('');
                        }
                        options['timeout-callback']?.();
                    }
                });
            } catch (err) {
                console.error('Turnstile render error:', err);
            }
        } else {
            throw new Error('Turnstile API was unavailable after loading.');
        }
    }

    function failPending(error: unknown) {
        if (destroyed) return;
        collapseNode();
        const resolver = executionResolvers.get(node);
        if (resolver) {
            executionResolvers.delete(node);
            resolver('');
        }
        console.error('Turnstile script failed to load:', error);
        options['error-callback']?.(error);
    }

    function stopWatching() {
        observer?.disconnect();
        observer = undefined;
        form?.removeEventListener('focusin', renderNow);
    }

    function renderNow() {
        stopWatching();
        pendingRenders.delete(node);
        renderPromise ??= ensureTurnstileScript().then(render).catch(failPending);
        return renderPromise;
    }

    pendingRenders.set(node, renderNow);
    void ensureTurnstileScript().catch(() => {});

    if (typeof IntersectionObserver === 'undefined') {
        void renderNow();
    } else {
        observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) void renderNow();
            },
            { rootMargin: LAZY_RENDER_MARGIN }
        );
        observer.observe(form ?? node);
        form?.addEventListener('focusin', renderNow);
    }

    return {
        destroy() {
            destroyed = true;
            stopWatching();
            pendingRenders.delete(node);
            widgetAppearances.delete(node);
            widgetExecutions.delete(node);
            executionResolvers.delete(node);
            if (widgetId && window.turnstile) {
                try {
                    window.turnstile.remove(widgetId);
                } catch {}
            } else if (window.turnstile) {
                try {
                    window.turnstile.remove(node);
                } catch {}
            }
        }
    };
}

export async function executeTurnstile(node: HTMLElement | null): Promise<string> {
    if (!node) return '';
    const key = typeof turnstileSiteKey === 'string' ? turnstileSiteKey.trim() : '';
    if (!key) return '';

    const pendingRender = pendingRenders.get(node);
    if (pendingRender) await pendingRender();

    if (window.turnstile) {
        const existing = window.turnstile.getResponse(node);
        if (existing) return existing;
    }

    if (!window.turnstile) {
        try {
            await ensureTurnstileScript();
        } catch (error) {
            console.error('Turnstile script failed to load:', error);
            return '';
        }
    }

    return new Promise(resolve => {
        executionResolvers.set(node, resolve);

        if (widgetExecutions.get(node) !== 'render') {
            try {
                window.turnstile?.execute(node);
            } catch {
                executionResolvers.delete(node);
                resolve('');
            }
        }

        setTimeout(() => {
            if (executionResolvers.has(node)) {
                executionResolvers.delete(node);
                resolve(window.turnstile?.getResponse(node) ?? '');
            }
        }, 15000);
    });
}

export function resetTurnstile(node: HTMLElement | null) {
    if (!node) return;
    executionResolvers.delete(node);
    window.turnstile?.reset(node);
    if ((widgetAppearances.get(node) ?? 'interaction-only') === 'interaction-only') {
        node.style.position = 'absolute';
        node.style.width = '1px';
        node.style.height = '0';
        node.style.minHeight = '0';
        node.style.opacity = '0';
        node.style.margin = '0';
        node.style.padding = '0';
        node.style.overflow = 'hidden';
        node.style.pointerEvents = 'none';
    }
}
