<script lang="ts">
    import Tag from '@idstead/ui/components/Tag.svelte';
    import type { Project } from '@idstead/domain/types.ts';

    interface Props {
        project: Project;
        languageSelected?: boolean;
        languageHref?: string;
        onLanguageSelect?: (language: string) => void;
    }

    let { project, languageSelected = false, languageHref, onLanguageSelect }: Props = $props();

    const language = $derived(project.lang ?? '');
</script>

<Tag
    variant={languageSelected ? 'tinted-active' : 'tinted'}
    tint={project.langColor ?? 'var(--color-fg-muted)'}
    href={onLanguageSelect ? undefined : languageHref}
    onclick={onLanguageSelect ? () => onLanguageSelect(language) : undefined}
    aria-pressed={onLanguageSelect ? languageSelected : undefined}
    aria-label={onLanguageSelect || languageHref ? `Filter by language: ${language}` : undefined}
    class={(onLanguageSelect || languageHref) && !languageSelected ?
        'font-mono hover:bg-(--tag-tint)/20'
    :   'font-mono'}>
    {language}
</Tag>
