import {env} from '$env/dynamic/public'

export const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          action?: string
          size?: 'normal' | 'compact' | 'flexible'
          theme?: 'light' | 'dark' | 'auto'
          appearance?: 'always' | 'execute' | 'interaction-only'
        }
      ) => string
      reset: (widgetIdOrContainer?: string | HTMLElement) => void
      remove: (widgetIdOrContainer?: string | HTMLElement) => void
      getResponse: (
        widgetIdOrContainer?: string | HTMLElement
      ) => string | undefined
    }
  }
}

export interface TurnstileWidgetOptions {
  sitekey: string
  action?: string
  size?: 'normal' | 'compact' | 'flexible'
  theme?: 'light' | 'dark' | 'auto'
  appearance?: 'always' | 'execute' | 'interaction-only'
}

export function turnstileWidget(
  node: HTMLElement,
  options: TurnstileWidgetOptions
) {
  let destroyed = false
  let widgetId: string | undefined

  function render() {
    if (destroyed) return
    const key =
      typeof options?.sitekey === 'string' ? options.sitekey.trim()
      : typeof turnstileSiteKey === 'string' ? turnstileSiteKey.trim()
      : ''

    if (!key) return

    if (window.turnstile) {
      node.innerHTML = ''
      try {
        widgetId = window.turnstile.render(node, {
          sitekey: key,
          action: options.action ?? 'turnstile-spin-v2',
          size: options.size ?? 'flexible',
          theme: options.theme ?? 'auto',
          appearance: options.appearance ?? 'always'
        })
      } catch (err) {
        console.error('Turnstile render error:', err)
      }
    } else {
      setTimeout(render, 50)
    }
  }

  render()

  return {
    destroy() {
      destroyed = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {}
      } else if (window.turnstile) {
        try {
          window.turnstile.remove(node)
        } catch {}
      }
    }
  }
}

export function getTurnstileResponse(node: HTMLElement | null): string {
  if (!node) return ''
  return window.turnstile?.getResponse(node) ?? ''
}

export function resetTurnstile(node: HTMLElement | null) {
  if (!node) return
  window.turnstile?.reset(node)
}
