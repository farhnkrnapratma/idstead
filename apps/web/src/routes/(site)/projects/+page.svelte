<script lang="ts">
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
        staggerChildren
    } from '@idstead/ui';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { decodeHtmlEntities } from '@mdrs/core';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import ProjectCard from '#app/components/ProjectCard.svelte';
    import SiteMeta from '#app/components/SiteMeta.svelte';
    import { isRepoNew, isRepoPinned } from '#app/projectLists.ts';

    let { data } = $props();

    const projects = $derived(data.projects || []);
    const pinnedRepoNames = $derived(
        (data.pinnedRepoNames || []).map((n: string) => n.toLowerCase())
    );

    const projectFilterStore = createFilterSortStore({
        defaultSortField: 'date',
        defaultSortDir: 'desc'
    });

    const allProjectTags = $derived.by(() => {
        const set = new SvelteSet<string>();
        for (const p of projects) {
            if (p.tags) {
                p.tags.forEach(t => set.add(t));
            }
        }
        return Array.from(set);
    });

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

        const sortField = projectFilterStore.sort.field;
        const sortDir = projectFilterStore.sort.direction === 'asc' ? 1 : -1;

        return [...list].sort((a, b) => {
            if (isRepoPinned(a, pinnedRepoNames) !== isRepoPinned(b, pinnedRepoNames)) {
                return isRepoPinned(a, pinnedRepoNames) ? -1 : 1;
            }

            if (sortField === 'name') {
                return a.name.localeCompare(b.name) * sortDir;
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
        class="relative z-10 pt-6 pb-6 sm:pt-8 md:pb-8">
        <PageContainer width="standard">
            <SectionHeader
                class="mb-6"
                title="Projects"
                subtitle="Open source work on GitHub." />

            {#if projects.length > 0}
                <div class="mb-6">
                    <FilterToolbar title="Projects filter">
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
                                fields={[
                                    { value: 'name', label: 'Name' },
                                    { value: 'stars', label: 'Stars' },
                                    { value: 'license', label: 'License' }
                                ]}
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
            {/if}

            {#if projects.length === 0}
                <EmptyState
                    icon={FolderOpen}
                    title="No projects yet"
                    description="Projects will appear here." />
            {:else if filteredProjectList.length === 0}
                <FilterEmptyState
                    title="No projects match these filters"
                    description="Try adjusting your tech stack filters or search keyword."
                    onClearFilters={() => projectFilterStore.clearAllFilters()} />
            {:else}
                <div
                    use:staggerChildren
                    class="stagger-children relative z-0 mt-2 grid auto-rows-fr grid-cols-1 gap-4">
                    {#each paginatedProjectList as project (project.name)}
                        <ProjectCard
                            {project}
                            pinned={isRepoPinned(project, pinnedRepoNames)}
                            isNew={isRepoNew(project)}
                            tagItem={filterableTag} />
                    {/each}
                </div>
                <div class="mt-6">
                    <Pagination
                        page={projectPageClamped}
                        totalPages={projectTotalPages}
                        onPageChange={p => (pageSelection = { key: filterKey, page: p })} />
                </div>
            {/if}
        </PageContainer>
    </Section>

    <FooterSection divided />
</PageMain>
