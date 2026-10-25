<script lang="ts">
    import { FileUser, Layers } from '@lucide/svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { EmptyState, PageContainer, PageMain, Section, SectionHeader } from '@idstead/ui';
    import { argKey } from '@idstead/ui/shortcuts.ts';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import CvDownloadMenu from '#app/components/CvDownloadMenu.svelte';
    import CvEntryList from '#app/components/CvEntryList.svelte';
    import SkillGroup from '#app/components/SkillGroup.svelte';
    import SiteMeta from '#app/components/SiteMeta.svelte';
    import {
        normalizeSkillGroups,
        type SkillGroup as SkillGroupData
    } from '#app/profilePageHelpers.ts';

    let { data } = $props();

    const experiences = $derived(data.cv?.experience || []);
    const education = $derived(data.cv?.education || []);
    const skills = $derived<SkillGroupData[]>(normalizeSkillGroups(data.skills || []));
    const isEmpty = $derived(
        experiences.length === 0
            && education.length === 0
            && skills.length === 0
            && !data.cvDocument
    );

    function skillGroupBasis(skillCount: number): number {
        return 160 + skillCount * 24;
    }
</script>

<SiteMeta
    title="Curriculum Vitae"
    description={data.author?.name ?
        `Experience, education and skills of ${data.author.name}.`
    :   'Experience, education and skills.'}
    path="/cv"
    siteName={data.author?.name || ''}
    siteUrl={data.author?.siteUrl || ''} />

<PageMain variant="site">
    <Section
        spacing="none"
        class={cn(
            'relative z-10 pt-6 pb-6 sm:pt-8 md:pb-8',
            isEmpty && 'flex flex-1 flex-col justify-center'
        )}>
        <PageContainer width="standard">
            {#if isEmpty}
                <EmptyState
                    icon={FileUser}
                    title="No CV yet"
                    description="Check back soon." />
            {:else}
                <SectionHeader
                    class="mb-6"
                    title="Curriculum Vitae">
                    {#snippet actions()}
                        <CvDownloadMenu
                            document={data.cvDocument}
                            placement="bottom-end"
                            shortcutGroup="save"
                            shortcutChordKey={argKey('/save', 'cv')} />
                    {/snippet}
                </SectionHeader>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Experience</h2>
                    <CvEntryList
                        kind="experience"
                        entries={experiences} />
                </div>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Education</h2>
                    <CvEntryList
                        kind="education"
                        entries={education} />
                </div>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Skills</h2>
                    {#if skills.length === 0}
                        <div class="mt-4">
                            <EmptyState
                                icon={Layers}
                                title="No skills listed yet"
                                description="Check back soon for updated skills." />
                        </div>
                    {:else}
                        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            {#each skills as group (group.category)}
                                <div
                                    class="sm:min-w-0 sm:shrink sm:grow sm:basis-(--sg-basis)"
                                    style="--sg-basis: {skillGroupBasis(group.items.length)}px">
                                    <SkillGroup
                                        category={group.category}
                                        skills={group.items}
                                        class="h-full" />
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </PageContainer>
    </Section>

    <FooterSection />
</PageMain>
