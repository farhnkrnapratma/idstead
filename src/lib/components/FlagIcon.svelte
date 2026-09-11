<script lang="ts">
  import {cn} from '../utils/cn';

  interface Props {
    lang: string;
    class?: string;
  }

  let {lang, class: className = ''}: Props = $props();

  const normalized = $derived(
    lang === 'en' || lang === 'us' ? 'us' : lang.toLowerCase()
  );

  const maskId = $derived(`flag-mask-${normalized}`);
</script>

{#if normalized === 'us'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>us</title>
    <mask id={maskId}>
      <circle
        cx="256"
        cy="256"
        r="256"
        fill="#fff" />
    </mask>
    <g mask="url(#{maskId})">
      <path
        fill="#eee"
        d="M256 0h256v64l-32 32l32 32v64l-32 32l32 32v64l-32 32l32 32v64l-256 32L0 448v-64l32-32l-32-32v-64z" />
      <path
        fill="#d80027"
        d="M224 64h288v64H224Zm0 128h288v64H256ZM0 320h512v64H0Zm0 128h512v64H0Z" />
      <path
        fill="#0052b4"
        d="M0 0h256v256H0Z" />
      <path
        fill="#eee"
        d="m187 243l57-41h-70l57 41l-22-67zm-81 0l57-41H93l57 41l-22-67zm-81 0l57-41H12l57 41l-22-67zm162-81l57-41h-70l57 41l-22-67zm-81 0l57-41H93l57 41l-22-67zm-81 0l57-41H12l57 41l-22-67Zm162-82l57-41h-70l57 41l-22-67Zm-81 0l57-41H93l57 41l-22-67zm-81 0l57-41H12l57 41l-22-67Z" />
    </g>
  </svg>
{:else if normalized === 'id'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>id</title>
    <mask id={maskId}>
      <circle
        cx="256"
        cy="256"
        r="256"
        fill="#fff" />
    </mask>
    <g mask="url(#{maskId})">
      <path
        fill="#eee"
        d="m0 256l249.6-41.3L512 256v256H0z" />
      <path
        fill="#a2001d"
        d="M0 0h512v256H0z" />
    </g>
  </svg>
{:else if normalized === 'ja'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>ja</title>
    <mask id={maskId}>
      <circle
        cx="256"
        cy="256"
        r="256"
        fill="#fff" />
    </mask>
    <g mask="url(#{maskId})">
      <path
        fill="#eee"
        d="M0 0h512v512H0z" />
      <circle
        cx="256"
        cy="256"
        r="111.3"
        fill="#d80027" />
    </g>
  </svg>
{:else if normalized === 'zh'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>zh</title>
    <mask id={maskId}>
      <circle
        cx="256"
        cy="256"
        r="256"
        fill="#fff" />
    </mask>
    <g mask="url(#{maskId})">
      <path
        fill="#d80027"
        d="M0 0h512v512H0z" />
      <path
        fill="#ffda44"
        d="m140.1 155.8l22.1 68h71.5l-57.8 42.1l22.1 68l-57.9-42l-57.9 42l22.2-68l-57.9-42.1H118zm163.4 240.7l-16.9-20.8l-25 9.7l14.5-22.5l-16.9-20.9l25.9 6.9l14.6-22.5l1.4 26.8l26 6.9l-25.1 9.6zm33.6-61l8-25.6l-21.9-15.5l26.8-.4l7.9-25.6l8.7 25.4l26.8-.3l-21.5 16l8.6 25.4l-21.9-15.5zm45.3-147.6L370.6 212l19.2 18.7l-26.5-3.8l-11.8 24l-4.6-26.4l-26.6-3.8l23.8-12.5l-4.6-26.5l19.2 18.7zm-78.2-73l-2 26.7l24.9 10.1l-26.1 6.4l-1.9 26.8l-14.1-22.8l-26.1 6.4l17.3-20.5l-14.2-22.7l24.9 10.1z" />
    </g>
  </svg>
{:else if normalized === 'ko'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>ko</title>
    <mask id={maskId}>
      <circle
        cx="256"
        cy="256"
        r="256"
        fill="#fff" />
    </mask>
    <g mask="url(#{maskId})">
      <path
        fill="#eee"
        d="M0 0h512v512H0Z" />
      <path
        fill="#333"
        d="m350 335l24-24l16 16l-24 23zm-39 39l24-24l15 16l-23 24zm87 8l23-24l16 16l-24 24zm-40 39l24-23l16 15l-24 24Zm16-63l24-23l15 15l-23 24zm-39 40l23-24l16 16l-24 23zm63-221l-63-63l15-15l64 63zm-63-15l-24-24l16-16l23 24zm39 39l-24-24l16-15l24 23zm8-87l-24-23l16-16l24 24Zm39 40l-23-24l15-16l24 24ZM91 358l63 63l-16 16l-63-63zm63 16l23 24l-15 15l-24-23zm-40-39l24 23l-16 16l-23-24zm24-24l63 63l-16 16l-63-63zm16-220l-63 63l-16-16l63-63zm23 23l-63 63l-15-16l63-63zm24 24l-63 63l-16-16l63-63z" />
      <path
        fill="#d80027"
        d="M319 319L193 193a89 89 0 1 1 126 126" />
      <path
        fill="#0052b4"
        d="M319 319a89 89 0 1 1-126-126z" />
      <circle
        cx="224.5"
        cy="224.5"
        r="44.5"
        fill="#d80027" />
      <circle
        cx="287.5"
        cy="287.5"
        r="44.5"
        fill="#0052b4" />
    </g>
  </svg>
{:else}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={cn('inline-block size-4 shrink-0', className)}
    aria-hidden="true">
    <title>{normalized}</title>
    <circle
      cx="256"
      cy="256"
      r="256"
      fill="currentColor"
      opacity="0.25" />
  </svg>
{/if}
