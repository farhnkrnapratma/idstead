<script lang="ts">
    interface Props {
        action: string;
    }

    let { action }: Props = $props();
</script>

<p class="text-xs text-text-secondary">
    By {action}, you agree to our
    <a
        href="/terms"
        class="text-accent-text underline hover:text-accent-hover">Terms of Service</a>
    and
    <a
        href="/privacy"
        class="text-accent-text underline hover:text-accent-hover">Privacy Policy</a
    >.
</p>
