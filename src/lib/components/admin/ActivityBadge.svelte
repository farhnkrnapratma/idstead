<script lang="ts">
  import Badge from '../Badge.svelte';
  import {isFeedbackActivity} from '#lib/adminActivity.ts';
  import {activityTone, activityToneStyles} from './activityTone';

  let {
    kind,
    vote,
    class: className = ''
  }: {kind: string; vote?: string | null; class?: string} = $props();

  const style = $derived(
    activityToneStyles[
      isFeedbackActivity({kind}) ? 'feedback' : activityTone(kind, vote)
    ]
  );
</script>

<Badge
  variant="custom"
  color={style.color}
  class={`font-normal whitespace-nowrap ${className}`}>
  {style.label}
</Badge>
