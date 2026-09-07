<script lang="ts">
  import type {Component} from 'svelte';
  import {cn} from '../utils/cn';
  import {normalizeIconInput, parseLucideTag} from '../author';

  interface Props {
    icon?: string;
    fallback?: string;
    class?: string;
  }

  let {icon = '', fallback = '', class: className = ''}: Props = $props();

  let targetIcon = $derived(icon?.trim() ? icon.trim() : fallback.trim());
  let normalized = $derived(targetIcon ? normalizeIconInput(targetIcon) : '');
  let isLucide = $derived(normalized.startsWith('<'));
  let lucideTag = $derived(isLucide ? parseLucideTag(normalized) : null);
  let bootstrapClass = $derived(isLucide ? '' : normalized);

  function toKebabCase(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }

  const lucideIconModules = import.meta.glob<{
    default: Component<Record<string, unknown>>;
  }>('../../../node_modules/@lucide/svelte/dist/icons/*.svelte');

  async function loadLucideIcon(name: string) {
    const kebab = toKebabCase(name);
    const entry = Object.entries(lucideIconModules).find(([path]) =>
      path.endsWith(`/${kebab}.svelte`)
    );
    if (!entry) throw new Error(`Unknown lucide icon: ${name}`);
    const mod = await entry[1]();
    return mod.default;
  }
</script>

{#if isLucide && lucideTag}
  {#await loadLucideIcon(lucideTag.name)}
    <span
      class={cn('inline-block size-[1em]', className)}
      aria-hidden="true"></span>
  {:then LucideComponent}
    <LucideComponent
      {...lucideTag.props}
      class={className} />
  {:catch}
    {#if fallback.trim()}
      <i
        class={cn(
          'bi inline-flex items-center justify-center align-middle',
          normalizeIconInput(fallback),
          className
        )}
        aria-hidden="true"></i>
    {/if}
  {/await}
{:else if bootstrapClass}
  <i
    class={cn(
      'bi inline-flex items-center justify-center align-middle',
      bootstrapClass,
      className
    )}
    aria-hidden="true"></i>
{/if}
