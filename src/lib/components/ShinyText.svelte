<script lang="ts">
  let {
    text,
    disabled = false,
    speed = 2,
    class: className = '',
    color = 'var(--color-accent)',
    shineColor = '#ffffff',
    spread = 120,
    yoyo = false,
    pauseOnHover = false,
    direction = 'left',
    delay = 0,
    ...restProps
  } = $props<{
    text: string;
    disabled?: boolean;
    speed?: number;
    class?: string;
    color?: string;
    shineColor?: string;
    spread?: number;
    yoyo?: boolean;
    pauseOnHover?: boolean;
    direction?: 'left' | 'right';
    delay?: number;
    [key: string]: unknown;
  }>();
</script>

<span
  class={[
    'inline-block',
    '[background-image:linear-gradient(var(--spread),var(--color)_0%,var(--color)_35%,var(--shine-color)_50%,var(--color)_65%,var(--color)_100%)]',
    '[background-size:200%_100%]',
    'bg-clip-text',
    '[-webkit-background-clip:text]',
    'text-transparent',
    '[-webkit-text-fill-color:transparent]',
    '[animation-duration:var(--speed)]',
    '[animation-timing-function:linear]',
    '[animation-iteration-count:infinite]',
    '[animation-direction:var(--anim-direction)]',
    '[animation-delay:var(--delay)]',
    className,
    disabled
      && '[animation:none]! text-[var(--color)]! [-webkit-text-fill-color:var(--color)]! [background:none]!',
    pauseOnHover && 'hover:[animation-play-state:paused]',
    direction === 'left' && '[animation-name:shiny-text-left]',
    direction === 'right' && '[animation-name:shiny-text-right]'
  ]}
  style="
		--color: {color};
		--shine-color: {shineColor};
		--spread: {spread}deg;
		--speed: {speed}s;
		--delay: {delay}s;
		--anim-direction: {yoyo ? 'alternate' : 'normal'};
	"
  {...restProps}>
  {text}
</span>

<style>
  @keyframes -global-shiny-text-left {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes -global-shiny-text-right {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
