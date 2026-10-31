<script lang="ts">
    import type { BannerCredit } from '@idstead/domain/contentLicense.ts';

    interface Props {
        credit: BannerCredit;
        linkClass: string;
    }

    let { credit, linkClass }: Props = $props();

    const suffix = $derived(
        credit.origin === 'third-party' && credit.license ? `, ${credit.license}` : ''
    );
</script>

{#if credit.origin === 'ai-generated'}
    <p>Banner: AI-generated image{credit.tool ? ` (${credit.tool})` : ''}; no license claimed.</p>
{:else if credit.url}
    <p>
        Banner by <a
            href={credit.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            class={linkClass}>{credit.author}</a
        >{suffix}.
    </p>
{:else}
    <p>Banner by {credit.author}{suffix}.</p>
{/if}
