<script lang="ts">
    interface Props {
        text: string;
        required: boolean;
    }

    let { text, required }: Props = $props();
</script>

{text}
{#if required}
    <span
        class="text-danger"
        aria-hidden="true">*</span>
{/if}
