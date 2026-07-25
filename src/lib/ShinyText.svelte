<!-- @format -->
<script lang="ts">
  let {
    text,
    disabled = false,
    speed = 2,
    className = '',
    color = '#b5b5b5',
    shineColor = '#ffffff',
    spread = 120,
    yoyo = false,
    pauseOnHover = false,
    direction = 'left',
    delay = 0,
    ...restProps
  } = $props<{
    text: string
    disabled?: boolean
    speed?: number
    className?: string
    color?: string
    shineColor?: string
    spread?: number
    yoyo?: boolean
    pauseOnHover?: boolean
    direction?: 'left' | 'right'
    delay?: number
    [key: string]: unknown
  }>()
</script>

<span
  class="shiny-text {className}"
  class:disabled
  class:pause-on-hover={pauseOnHover}
  class:direction-left={direction === 'left'}
  class:direction-right={direction === 'right'}
  class:yoyo
  style="
		--color: {color};
		--shine-color: {shineColor};
		--spread: {spread}deg;
		--speed: {speed}s;
		--delay: {delay}s;
		--anim-direction: {yoyo ? 'alternate' : 'normal'};
		--anim-name: {direction === 'left' ? 'shiny-text-left' : 'shiny-text-right'};
	"
  {...restProps}>
  {text}
</span>
