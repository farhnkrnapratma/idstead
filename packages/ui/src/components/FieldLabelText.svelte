<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

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
