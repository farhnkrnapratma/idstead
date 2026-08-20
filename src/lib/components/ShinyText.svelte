<script lang="ts">
  let {
    text,
    disabled = false,
    speed = 2,
    class: className = '',
    color = 'var(--color-copilot)',
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
    'shiny-text',
    className,
    disabled && 'disabled',
    pauseOnHover && 'pause-on-hover',
    direction === 'left' && 'direction-left',
    direction === 'right' && 'direction-right',
    yoyo && 'yoyo'
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
  .shiny-text {
    display: inline-block;
    background-image: linear-gradient(
      var(--spread),
      var(--color) 0%,
      var(--color) 35%,
      var(--shine-color) 50%,
      var(--color) 65%,
      var(--color) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    animation-duration: var(--speed);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-direction: var(--anim-direction);
    animation-delay: var(--delay);
  }

  .shiny-text.direction-left {
    animation-name: shiny-text-left;
  }

  .shiny-text.direction-right {
    animation-name: shiny-text-right;
  }

  .shiny-text.disabled {
    animation: none;
    background: none;
    color: var(--color);
    -webkit-text-fill-color: var(--color);
  }

  .shiny-text.pause-on-hover:hover {
    animation-play-state: paused;
  }

  @keyframes shiny-text-left {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes shiny-text-right {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
