<script lang="ts">
    import { FileUser } from '@lucide/svelte';
    import EmptyState from '@fkp/ui/components/EmptyState.svelte';
    import type { EducationItem, ExperienceItem } from '#lib/author.ts';
    import CvEntryCard from './CvEntryCard.svelte';
    import { formatPeriod } from '../profilePageHelpers';

    type Props =
        | { kind: 'experience'; entries: ExperienceItem[] }
        | { kind: 'education'; entries: EducationItem[] };

    let props: Props = $props();

    const emptyTitle = $derived(
        props.kind === 'experience' ? 'No experience listed yet' : 'No education listed yet'
    );
    const emptyDescription = $derived(
        props.kind === 'experience' ?
            'Check back soon for career history.'
        :   'Check back soon for academic history.'
    );
</script>

{#if props.entries.length === 0}
    <EmptyState
        icon={FileUser}
        title={emptyTitle}
        description={emptyDescription} />
{:else}
    <div class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card text-left">
        {#if props.kind === 'experience'}
            {#each props.entries as exp (exp.company + exp.location + exp.startYear)}
                <CvEntryCard
                    role={exp.title}
                    organization={exp.company}
                    location={exp.location}
                    period={formatPeriod(
                        exp.startMonth,
                        exp.startYear,
                        exp.endMonth,
                        exp.endYear,
                        exp.currentlyIn
                    )}
                    description={exp.description} />
            {/each}
        {:else}
            {#each props.entries as edu (edu.institution + edu.startYear)}
                <CvEntryCard
                    role={edu.degree}
                    organization={edu.institution}
                    period={formatPeriod(
                        edu.startMonth,
                        edu.startYear,
                        edu.endMonth,
                        edu.endYear,
                        edu.currentlyIn
                    )}
                    description={edu.description} />
            {/each}
        {/if}
    </div>
{/if}
