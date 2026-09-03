<script lang="ts">
  import {onMount} from 'svelte';
  import {a11yStore} from '../stores/a11yStore.svelte';
  import {cn} from '../utils/cn';

  export interface LogoItem {
    src?: string;
    srcSet?: string;
    sizes?: string;
    width?: number;
    height?: number;
    alt?: string;
    title?: string;
    href?: string;
    ariaLabel?: string;
  }

  interface Props {
    logos: LogoItem[];
    speed?: number;
    direction?: 'left' | 'right' | 'up' | 'down';
    width?: number | string;
    logoHeight?: number;
    logoHeightMobile?: number;
    logoHeightMd?: number;
    gap?: number;
    pauseOnHover?: boolean;
    hoverSpeed?: number;
    fadeOut?: boolean;
    fadeOutColor?: string;
    scaleOnHover?: boolean;
    ariaLabel?: string;
    class?: string;
  }

  let {
    logos = [],
    speed = 120,
    direction = 'left',
    width = '100%',
    logoHeight = 28,
    logoHeightMobile = Math.round(logoHeight * 0.6),
    logoHeightMd = Math.round(logoHeight * 0.8),
    gap = 32,
    pauseOnHover = true,
    hoverSpeed,
    fadeOut = false,
    fadeOutColor,
    scaleOnHover = false,
    ariaLabel = 'Partner logos',
    class: className = ''
  }: Props = $props();

  const ANIMATION_CONFIG = {SMOOTH_TAU: 0.25, MIN_COPIES: 2, COPY_HEADROOM: 2};

  let isReducedMotion = $derived(a11yStore.current.reduceMotion);

  let containerEl = $state<HTMLDivElement | null>(null);
  let trackEl = $state<HTMLDivElement | null>(null);
  let seqEl = $state<HTMLUListElement | null>(null);

  let seqWidth = $state(0);
  let seqHeight = $state(0);
  let copyCount = $state(ANIMATION_CONFIG.MIN_COPIES);
  let isHovered = $state(false);

  let effectiveHoverSpeed = $derived.by(() => {
    if (hoverSpeed !== undefined) return hoverSpeed;
    if (pauseOnHover === true) return 0;
    if (pauseOnHover === false) return undefined;
    return 0;
  });

  let isVertical = $derived(direction === 'up' || direction === 'down');

  let targetVelocity = $derived.by(() => {
    const magnitude = Math.abs(speed);
    let directionMultiplier: number;
    if (isVertical) {
      directionMultiplier = direction === 'up' ? 1 : -1;
    } else {
      directionMultiplier = direction === 'left' ? 1 : -1;
    }
    const speedMultiplier = speed < 0 ? -1 : 1;
    return magnitude * directionMultiplier * speedMultiplier;
  });

  function toCssLength(value: number | string | undefined): string | undefined {
    if (typeof value === 'number') return `${value}px`;
    return value ?? undefined;
  }

  function updateDimensions() {
    if (isReducedMotion || !containerEl || !seqEl) return;
    const containerWidth = containerEl.clientWidth ?? 0;
    const sequenceRect = seqEl.getBoundingClientRect();
    const sequenceWidth = sequenceRect?.width ?? 0;
    const sequenceHeight = sequenceRect?.height ?? 0;

    if (isVertical) {
      const parentHeight = containerEl.parentElement?.clientHeight ?? 0;
      if (parentHeight > 0) {
        containerEl.style.height = `${Math.ceil(parentHeight)}px`;
      }
      if (sequenceHeight > 0) {
        seqHeight = Math.ceil(sequenceHeight);
        const viewport =
          containerEl.clientHeight || parentHeight || sequenceHeight;
        const copiesNeeded =
          Math.ceil(viewport / sequenceHeight) + ANIMATION_CONFIG.COPY_HEADROOM;
        copyCount = Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded);
      }
    } else if (sequenceWidth > 0) {
      seqWidth = Math.ceil(sequenceWidth);
      const copiesNeeded =
        Math.ceil(containerWidth / sequenceWidth)
        + ANIMATION_CONFIG.COPY_HEADROOM;
      copyCount = Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded);
    }
  }

  onMount(() => {
    updateDimensions();

    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      if (containerEl) resizeObserver.observe(containerEl);
      if (seqEl) resizeObserver.observe(seqEl);
    } else {
      window.addEventListener('resize', updateDimensions);
    }

    let rafId: number | null = null;
    let lastTimestamp: number | null = null;
    let offset = 0;
    let velocity = 0;

    const animate = (timestamp: number) => {
      if (isReducedMotion || !trackEl) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const deltaTime = Math.max(0, timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const target =
        isHovered && effectiveHoverSpeed !== undefined ?
          effectiveHoverSpeed
        : targetVelocity;

      const easingFactor =
        1 - Math.exp(-deltaTime / ANIMATION_CONFIG.SMOOTH_TAU);
      velocity += (target - velocity) * easingFactor;

      const seqSize = isVertical ? seqHeight : seqWidth;

      if (seqSize > 0) {
        offset += velocity * deltaTime;
        offset = ((offset % seqSize) + seqSize) % seqSize;

        const transformValue =
          isVertical ?
            `translate3d(0, ${-offset}px, 0)`
          : `translate3d(${-offset}px, 0, 0)`;
        trackEl.style.transform = transformValue;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateDimensions);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  });

  function handleMouseEnter() {
    if (effectiveHoverSpeed !== undefined) isHovered = true;
  }

  function handleMouseLeave() {
    if (effectiveHoverSpeed !== undefined) isHovered = false;
  }

  function handleImageLoad() {
    updateDimensions();
  }

  let copiesArray = $derived(Array.from({length: copyCount}));
</script>

{#if isReducedMotion}
  <div
    role="region"
    aria-label={ariaLabel}
    class={cn('w-full select-none', className)}
    style="--logoloop-gap: {gap}px; --logoloop-logoHeight-mobile: {logoHeightMobile}px; --logoloop-logoHeight-md: {logoHeightMd}px; --logoloop-logoHeight: {logoHeight}px;">
    <ul
      role="list"
      class="flex flex-wrap items-center justify-center gap-6 py-2 sm:gap-8 md:gap-10">
      {#each logos as item, itemIndex (`static-${itemIndex}`)}
        <li
          role="listitem"
          class="flex shrink-0 items-center justify-center p-1.5">
          {#if item.href}
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={item.ariaLabel
                || item.alt
                || item.title
                || 'logo link'}
              class="group inline-flex items-center rounded-sm transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copilot">
              <img
                src={item.src}
                srcset={item.srcSet}
                sizes={item.sizes}
                width={item.width}
                height={item.height}
                alt={item.alt ?? ''}
                title={item.title}
                loading="lazy"
                decoding="async"
                draggable="false"
                class={cn(
                  'block h-(--logoloop-logoHeight-mobile) w-auto object-contain select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                  scaleOnHover
                    && 'transition-transform duration-200 group-hover:scale-110'
                )} />
            </a>
          {:else}
            <img
              src={item.src}
              srcset={item.srcSet}
              sizes={item.sizes}
              width={item.width}
              height={item.height}
              alt={item.alt ?? ''}
              title={item.title}
              loading="lazy"
              decoding="async"
              draggable="false"
              class={cn(
                'block h-(--logoloop-logoHeight-mobile) w-auto object-contain select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                scaleOnHover
                  && 'transition-transform duration-200 hover:scale-110'
              )} />
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <div
    bind:this={containerEl}
    role="region"
    aria-label={ariaLabel}
    class={cn(
      'relative overflow-hidden select-none',
      isVertical ? 'inline-block h-full' : 'w-full',
      fadeOut
        && (isVertical ?
          'before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-0 before:z-10 before:h-12 before:bg-linear-to-b before:from-(--logoloop-fadeColor,var(--color-surface,var(--color-surface-card))) before:to-transparent after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:z-10 after:h-12 after:bg-linear-to-t after:from-(--logoloop-fadeColor,var(--color-surface,var(--color-surface-card))) after:to-transparent'
        : 'before:pointer-events-none before:absolute before:top-0 before:bottom-0 before:left-0 before:z-10 before:w-12 before:bg-linear-to-r before:from-(--logoloop-fadeColor,var(--color-surface,var(--color-surface-card))) before:to-transparent after:pointer-events-none after:absolute after:top-0 after:right-0 after:bottom-0 after:z-10 after:w-12 after:bg-linear-to-l after:from-(--logoloop-fadeColor,var(--color-surface,var(--color-surface-card))) after:to-transparent sm:before:w-20 sm:after:w-20'),
      className
    )}
    style="--logoloop-gap: {gap}px; --logoloop-logoHeight-mobile: {logoHeightMobile}px; --logoloop-logoHeight-md: {logoHeightMd}px; --logoloop-logoHeight: {logoHeight}px; {(
      fadeOutColor
    ) ?
      `--logoloop-fadeColor: ${fadeOutColor};`
    : ''} width: {isVertical ?
      toCssLength(width) === '100%' ?
        undefined
      : toCssLength(width)
    : (toCssLength(width) ?? '100%')};">
    <div
      bind:this={trackEl}
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
      role="presentation"
      class={cn(
        'relative z-0 flex w-max will-change-transform',
        isVertical && 'h-max w-full flex-col'
      )}>
      {#each copiesArray as _, copyIndex (copyIndex)}
        {#if copyIndex === 0}
          <ul
            bind:this={seqEl}
            role="list"
            class={cn('flex items-center', isVertical && 'flex-col')}>
            {#each logos as item, itemIndex (`0-${itemIndex}`)}
              <li
                role="listitem"
                class={cn(
                  'shrink-0 leading-none transition-transform duration-300 ease-out',
                  isVertical ? 'mb-(--logoloop-gap)' : 'mr-(--logoloop-gap)'
                )}>
                {#if item.href}
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={item.ariaLabel
                      || item.alt
                      || item.title
                      || 'logo link'}
                    class="group inline-flex items-center rounded-sm transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copilot">
                    <img
                      src={item.src}
                      srcset={item.srcSet}
                      sizes={item.sizes}
                      width={item.width}
                      height={item.height}
                      alt={item.alt ?? ''}
                      title={item.title}
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      onload={handleImageLoad}
                      onerror={handleImageLoad}
                      class={cn(
                        'pointer-events-none block h-(--logoloop-logoHeight-mobile) w-auto object-contain transition-transform duration-300 ease-out select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                        scaleOnHover && 'group-hover:scale-125'
                      )} />
                  </a>
                {:else}
                  <img
                    src={item.src}
                    srcset={item.srcSet}
                    sizes={item.sizes}
                    width={item.width}
                    height={item.height}
                    alt={item.alt ?? ''}
                    title={item.title}
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                    onload={handleImageLoad}
                    onerror={handleImageLoad}
                    class={cn(
                      'pointer-events-none block h-(--logoloop-logoHeight-mobile) w-auto object-contain transition-transform duration-300 ease-out select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                      scaleOnHover && 'hover:scale-125'
                    )} />
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <ul
            role="list"
            aria-hidden="true"
            class={cn('flex items-center', isVertical && 'flex-col')}>
            {#each logos as item, itemIndex (`${copyIndex}-${itemIndex}`)}
              <li
                role="listitem"
                class={cn(
                  'shrink-0 leading-none transition-transform duration-300 ease-out',
                  isVertical ? 'mb-(--logoloop-gap)' : 'mr-(--logoloop-gap)'
                )}>
                {#if item.href}
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={item.ariaLabel
                      || item.alt
                      || item.title
                      || 'logo link'}
                    class="group inline-flex items-center rounded-sm transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copilot">
                    <img
                      src={item.src}
                      srcset={item.srcSet}
                      sizes={item.sizes}
                      width={item.width}
                      height={item.height}
                      alt={item.alt ?? ''}
                      title={item.title}
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      onload={handleImageLoad}
                      onerror={handleImageLoad}
                      class={cn(
                        'pointer-events-none block h-(--logoloop-logoHeight-mobile) w-auto object-contain transition-transform duration-300 ease-out select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                        scaleOnHover && 'group-hover:scale-125'
                      )} />
                  </a>
                {:else}
                  <img
                    src={item.src}
                    srcset={item.srcSet}
                    sizes={item.sizes}
                    width={item.width}
                    height={item.height}
                    alt={item.alt ?? ''}
                    title={item.title}
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                    onload={handleImageLoad}
                    onerror={handleImageLoad}
                    class={cn(
                      'pointer-events-none block h-(--logoloop-logoHeight-mobile) w-auto object-contain transition-transform duration-300 ease-out select-none md:h-(--logoloop-logoHeight-md) lg:h-(--logoloop-logoHeight)',
                      scaleOnHover && 'hover:scale-125'
                    )} />
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/each}
    </div>
  </div>
{/if}
