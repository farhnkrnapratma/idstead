/** @format */

import {tick} from 'svelte'
import {a11yStore} from '../stores/a11yStore.svelte'

export function withViewTransition(
  update: () => void | Promise<void>,
  type: 'context' | 'drill'
) {
  if (typeof document === 'undefined') {
    void update()
    return
  }

  if (!document.startViewTransition || a11yStore.current.reduceMotion) {
    void update()
    return
  }

  const root = document.documentElement
  root.dataset.transitionType = type

  const transition = document.startViewTransition(async () => {
    await update()
    await tick()
  })

  void transition.finished.finally(() => {
    delete root.dataset.transitionType
  })
}
