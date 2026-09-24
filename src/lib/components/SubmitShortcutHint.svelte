<script lang="ts">
  import {keyLabel, shortcutKeyParts} from '$lib/shortcuts';
  import {platformStore} from '$lib/stores/platformStore.svelte';
  import {KEY_GROUP_CLASS, KEY_SEGMENT_CLASS} from '$lib/utils/shortcut.svelte';
  import {cn} from '../utils/cn';

  let {
    label = 'to send',
    class: className = ''
  }: {label?: string; class?: string} = $props();

  const keys = $derived(
    shortcutKeyParts('Mod+Enter', platformStore.current).map(
      token => keyLabel(token, platformStore.current).text
    )
  );
</script>

<span
  aria-hidden="true"
  class={cn(
    'inline-flex items-center gap-1.5 text-2xs text-text-muted select-none pointer-coarse:hidden',
    className
  )}>
  <span class={KEY_GROUP_CLASS}>
    {#each keys as key (key)}
      <kbd
        class="{KEY_SEGMENT_CLASS} border-border-subtle/80 bg-surface-elevated text-text-primary"
        >{key}</kbd>
    {/each}
  </span>
  {label}
</span>
