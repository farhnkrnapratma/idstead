<script lang="ts">
    import SkipLink from '@fkp/ui/components/SkipLink.svelte';
    import SiteNav from '#app/components/SiteNav.svelte';
    import BottomNav from '#app/components/BottomNav.svelte';

    let { data, children } = $props();
</script>

<SkipLink />

<SiteNav
    author={data.author}
    projects={data.projects} />

{@render children()}

<BottomNav />
