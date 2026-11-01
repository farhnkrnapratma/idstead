<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { FolderOpen } from '@lucide/svelte';
    import {
        Dropdown,
        EmptyState,
        FilterChipGroup,
        FilterEmptyState,
        FilterToolbar,
        Input,
        PageContainer,
        PageMain,
        Pagination,
        SearchResultCount,
        Section,
        SectionHeader,
        SortControl,
        createFilterSortStore,
        sortMenuGroups,
        staggerChildren,
        type FilterMenuGroup
    } from '@idstead/ui';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { decodeHtmlEntities } from '@mdrs/core';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import ContentCard from '#app/components/ContentCard.svelte';
    import ProjectMeta from '#app/components/ProjectMeta.svelte';
    import ProjectLanguageTag from '#app/components/ProjectLanguageTag.svelte';
    import { projectCard } from '#app/contentCards.ts';
    import SiteMeta from '#app/components/SiteMeta.svelte';
    import { isRepoPinned } from '#app/projectLists.ts';

    let { data } = $props();

    const projects = $derived(data.projects || []);
    const pinnedRepoNames = $derived(
        (data.pinnedRepoNames || []).map((n: string) => n.toLowerCase())
    );

    const projectFilterStore = createFilterSortStore({
        defaultSortField: 'date',
        defaultSortDir: 'desc'
    });

    const PROJECT_SORT_FIELDS = [
        { value: 'date', label: 'Updated' },
        { value: 'name', label: 'Name' },
        { value: 'language', label: 'Language' },
        { value: 'stars', label: 'Stars' },
        { value: 'license', label: 'License' }
    ];

    const allProjectTags = $derived.by(() => {
        const set = new SvelteSet<string>();
        for (const p of projects) {
            if (p.tags) {
                p.tags.forEach(t => set.add(t));
            }
        }
        return Array.from(set);
    });

    const projectMenuGroups = $derived<FilterMenuGroup[]>([
        {
            label: 'Topics',
            mode: 'multi',
            options: allProjectTags.map(t => ({ value: t, label: t })),
            selected: projectFilterStore.filters['tag'] || [],
            onSelect: value => projectFilterStore.toggleMultiFilter('tag', value),
            searchable: true,
            searchPlaceholder: 'Search topics...'
        },
        ...sortMenuGroups({
            fields: PROJECT_SORT_FIELDS,
            field: projectFilterStore.sort.field,
            direction: projectFilterStore.sort.direction,
            onFieldChange: field => projectFilterStore.setSort(field),
            onDirectionToggle: () => projectFilterStore.toggleSortDirection()
        })
    ]);

    const filteredProjectList = $derived.by(() => {
        let list = projects;

        const q = projectFilterStore.search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                p =>
                    p.name.toLowerCase().includes(q)
                    || p.desc.toLowerCase().includes(q)
                    || (p.lang && p.lang.toLowerCase().includes(q))
            );
        }

        const selectedTags = projectFilterStore.filters['tag'] || [];
        if (selectedTags.length > 0) {
            list = list.filter(p => p.tags && p.tags.some(t => selectedTags.includes(t)));
        }

        const selectedLanguages = projectFilterStore.filters['language'] || [];
        if (selectedLanguages.length > 0) {
            list = list.filter(p => p.lang && selectedLanguages.includes(p.lang));
        }

        const sortField = projectFilterStore.sort.field;
        const sortDir = projectFilterStore.sort.direction === 'asc' ? 1 : -1;

        return [...list].sort((a, b) => {
            if (isRepoPinned(a, pinnedRepoNames) !== isRepoPinned(b, pinnedRepoNames)) {
                return isRepoPinned(a, pinnedRepoNames) ? -1 : 1;
            }

            if (sortField === 'date') {
                const updatedA = a.pushedAt ? Date.parse(a.pushedAt) : 0;
                const updatedB = b.pushedAt ? Date.parse(b.pushedAt) : 0;
                return (updatedA - updatedB) * sortDir;
            } else if (sortField === 'name') {
                return a.name.localeCompare(b.name) * sortDir;
            } else if (sortField === 'language') {
                return (a.lang || '').localeCompare(b.lang || '') * sortDir;
            } else if (sortField === 'stars') {
                return ((a.stars || 0) - (b.stars || 0)) * sortDir;
            } else if (sortField === 'license') {
                const lA = a.licenseName || '';
                const lB = b.licenseName || '';
                return lA.localeCompare(lB) * sortDir;
            } else {
                return a.name.localeCompare(b.name) * sortDir;
            }
        });
    });

    const PAGE_SIZE = 5;

    const filterKey = $derived(
        JSON.stringify([
            projectFilterStore.search,
            projectFilterStore.filters,
            projectFilterStore.sort
        ])
    );
    let pageSelection = $state({ key: '', page: 1 });
    const projectPage = $derived(pageSelection.key === filterKey ? pageSelection.page : 1);

    const projectTotalPages = $derived(
        Math.max(1, Math.ceil(filteredProjectList.length / PAGE_SIZE))
    );
    const projectPageClamped = $derived(Math.min(projectPage, projectTotalPages));
    const paginatedProjectList = $derived(
        filteredProjectList.slice(
            (projectPageClamped - 1) * PAGE_SIZE,
            projectPageClamped * PAGE_SIZE
        )
    );

    onMount(() => {
        projectFilterStore.parseFromUrl(new URL(window.location.href));
    });
</script>

<SiteMeta
    title="Projects"
    description={data.author?.name ?
        `Open source projects by ${data.author.name} on GitHub.`
    :   'Open source projects on GitHub.'}
    path="/projects"
    siteName={data.author?.name || ''}
    siteUrl={data.author?.siteUrl || ''} />

{#snippet filterableTag(tag: string)}
    {@const isSelected = projectFilterStore.filters['tag']?.includes(tag) ?? false}
    <Tag
        variant={isSelected ? 'accent-active' : 'accent'}
        onclick={() => projectFilterStore.toggleMultiFilter('tag', tag)}
        aria-pressed={isSelected}
        class={isSelected ? 'font-mono' : 'font-mono hover:bg-accent/15'}>
        {decodeHtmlEntities(tag)}
    </Tag>
{/snippet}

<PageMain variant="site">
    <Section
        spacing="none"
        class={cn(
            'relative z-10 pt-6 pb-6 sm:pt-8 md:pb-8',
            projects.length === 0 && 'flex flex-1 flex-col justify-center'
        )}>
        <PageContainer width="standard">
            {#if projects.length === 0}
                <EmptyState
                    icon={FolderOpen}
                    title="No projects yet"
                    description="Projects will appear here." />
            {:else}
                <SectionHeader
                    class="mb-6"
                    title="Projects" />

                <div class="mb-6">
                    <FilterToolbar
                        title="Projects filter"
                        mobileGroups={projectMenuGroups}
                        onClearFilters={() => projectFilterStore.clearAllFilters()}>
                        {#snippet searchSlot()}
                            <Input
                                type="search"
                                placeholder="Search projects..."
                                value={projectFilterStore.search}
                                oninput={e =>
                                    projectFilterStore.setSearch(
                                        (e.target as HTMLInputElement).value
                                    )}
                                keyboardShortcut={buttonKey('filterSearch')}
                                shortcutLabel="Search projects"
                                aria-label="Search projects" />
                        {/snippet}

                        {#snippet filterControlsSlot()}
                            {#if allProjectTags.length > 0}
                                <Dropdown
                                    multiple
                                    searchable
                                    label="Topics"
                                    options={allProjectTags.map(t => ({ value: t, label: t }))}
                                    value={projectFilterStore.filters['tag'] || []}
                                    onChange={val =>
                                        projectFilterStore.toggleMultiFilter('tag', val)} />
                            {/if}
                        {/snippet}

                        {#snippet countSlot()}
                            <SearchResultCount
                                count={filteredProjectList.length}
                                total={projects.length}
                                itemLabel="projects" />
                        {/snippet}

                        {#snippet sortSlot()}
                            <SortControl
                                fields={PROJECT_SORT_FIELDS}
                                currentField={projectFilterStore.sort.field}
                                currentDirection={projectFilterStore.sort.direction}
                                onFieldChange={field => projectFilterStore.setSort(field)}
                                onDirectionToggle={() =>
                                    projectFilterStore.toggleSortDirection()} />
                        {/snippet}

                        {#snippet chipsSlot()}
                            <FilterChipGroup
                                chips={projectFilterStore.activeChips}
                                onRemove={(type, val) => projectFilterStore.removeFilter(type, val)}
                                onClearAll={() => projectFilterStore.clearAllFilters()} />
                        {/snippet}
                    </FilterToolbar>
                </div>

                {#if filteredProjectList.length === 0}
                    <FilterEmptyState
                        title="No projects match these filters"
                        description="Try adjusting your topic filters or search keyword."
                        onClearFilters={() => projectFilterStore.clearAllFilters()} />
                {:else}
                    <div
                        use:staggerChildren
                        class="stagger-children relative z-0 mt-2 grid grid-cols-1 gap-4 sm:auto-rows-fr">
                        {#each paginatedProjectList as project (project.name)}
                            {#snippet languageTag()}
                                <ProjectLanguageTag
                                    {project}
                                    languageSelected={projectFilterStore.filters[
                                        'language'
                                    ]?.includes(project.lang ?? '') ?? false}
                                    onLanguageSelect={language =>
                                        projectFilterStore.toggleMultiFilter(
                                            'language',
                                            language
                                        )} />
                            {/snippet}
                            <ContentCard
                                {...projectCard(project, pinnedRepoNames)}
                                headingTag="h2"
                                tagItem={filterableTag}
                                leadingTag={project.lang ? languageTag : undefined}>
                                {#snippet meta()}
                                    <ProjectMeta {project} />
                                {/snippet}
                            </ContentCard>
                        {/each}
                    </div>
                    <div class="mt-6">
                        <Pagination
                            page={projectPageClamped}
                            totalPages={projectTotalPages}
                            onPageChange={p => (pageSelection = { key: filterKey, page: p })} />
                    </div>
                {/if}
            {/if}
        </PageContainer>
    </Section>

    <FooterSection />
</PageMain>
