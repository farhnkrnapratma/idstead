<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { FileUser } from '@lucide/svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import type { EducationItem, ExperienceItem } from '#lib/author.ts';
    import ResumeEntryCard from './ResumeEntryCard.svelte';
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
    <div class="divide-y divide-line-subtle/40 overflow-hidden rounded-md glass-card text-left">
        {#if props.kind === 'experience'}
            {#each props.entries as exp (exp.company + exp.location + exp.startYear)}
                <ResumeEntryCard
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
                <ResumeEntryCard
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
