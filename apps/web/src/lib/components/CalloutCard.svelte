<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import Card from '@idstead/ui/components/Card.svelte';
    import { GradientText } from '@idstead/ui';

    interface Props {
        icon: Component<{ class?: string; strokeWidth?: number }>;
        title: string;
        description: string;
        class?: string;
        children: Snippet;
    }

    let { icon: Icon, title, description, class: className = '', children }: Props = $props();

    const titleId = $props.id();
</script>

<section
    class={className}
    aria-labelledby={titleId}>
    <Card
        density="none"
        class="text-left">
        <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div
                class="flex size-20 shrink-0 items-center justify-center border border-dashed border-line-subtle bg-surface"
                aria-hidden="true">
                <Icon
                    class="size-10 fill-accent-tint text-fg-accent"
                    strokeWidth={1.5} />
            </div>
            <div>
                <h4
                    id={titleId}
                    class="type-card-title text-balance">
                    <GradientText>{title}</GradientText>
                </h4>
                <p class="type-body text-pretty text-fg-secondary">
                    {description}
                </p>
            </div>
        </div>
        <div class="border-t border-line-subtle px-3.5 py-3 sm:px-4">
            {@render children()}
        </div>
    </Card>
</section>
