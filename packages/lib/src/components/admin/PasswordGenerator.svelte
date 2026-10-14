<script lang="ts">
    import { RefreshCw, Settings, Sparkles, X } from '@lucide/svelte';
    import {
        Button,
        Checkbox,
        Dialog,
        Dropdown,
        FieldMessage,
        IconButton,
        toastStore
    } from '#lib/index.ts';
    import {
        DEFAULT_RANDOM_PASSWORD,
        DEFAULT_MEMORABLE_PASSWORD,
        generatePassword,
        type PasswordGeneratorOptions,
        type MemorablePasswordOptions
    } from '#lib/passwordGenerator.ts';

    let { disabled = false, onuse }: { disabled?: boolean; onuse: (password: string) => void } =
        $props();
    let isOpen = $state(false);
    let mode = $state<'random' | 'memorable'>('random');
    let randomOptions = $state({ ...DEFAULT_RANDOM_PASSWORD });
    let memorableOptions = $state({ ...DEFAULT_MEMORABLE_PASSWORD });
    let preview = $state('');
    let generationError = $state('');
    let generation = $state(0);
    let advancedOpen = $state(false);
    let isCopying = $state(false);
    const advancedOptionsId = $props.id();
    const dropdownFocus =
        '[&>button[aria-expanded=true]]:border-border-default [&>button:focus-visible]:ring-text-muted';
    const sliderClass =
        'h-5 w-full cursor-pointer appearance-none rounded-full border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-text-muted [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-(image:--slider-background) [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-(image:--slider-background) [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent';
    const sliderProgress = $derived(
        mode === 'random' ?
            ((randomOptions.length - 15) / 49) * 100
        :   ((memorableOptions.words - 8) / 2) * 100
    );
    const sliderBackground = $derived(
        `linear-gradient(to right, var(--color-accent) ${sliderProgress}%, var(--color-border-default) ${sliderProgress}%)`
    );
    const previewParts = $derived(
        Array.from(preview.matchAll(/[a-zA-Z]+|\d+|[^a-zA-Z\d]+/g), match => ({
            key: `${generation}:${match.index}`,
            text: match[0],
            color:
                /^\d/.test(match[0]) ? 'text-copilot'
                : /^[a-zA-Z]/.test(match[0]) ? 'text-text-primary'
                : 'text-accent-hover'
        }))
    );
    const options: PasswordGeneratorOptions = $derived(
        mode === 'random' ? randomOptions : memorableOptions
    );

    function regenerate() {
        preview = '';
        generationError = '';
        try {
            preview = generatePassword(options);
            generation++;
        } catch {
            generationError = 'Could not generate a password. Try again.';
        }
    }

    function open() {
        if (disabled) return;
        regenerate();
        advancedOpen = false;
        isOpen = true;
    }

    function close() {
        isOpen = false;
        preview = '';
        generationError = '';
    }

    async function copyAndClose() {
        if (!preview || disabled || isCopying) return;
        const password = preview;
        const copiedGeneration = generation;
        isCopying = true;
        try {
            await navigator.clipboard.writeText(password);
        } catch {
            toastStore.error('Could not copy to clipboard.');
            return;
        } finally {
            isCopying = false;
        }
        if (!isOpen || generation !== copiedGeneration || preview !== password || disabled) return;
        onuse(password);
        close();
        toastStore.success('Password copied to clipboard.');
    }
</script>

<Button
    type="outline"
    size="sm"
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    class="focus-visible:outline-text-muted"
    onclick={open}>
    {#snippet leading()}<Sparkles class="size-3.5" />{/snippet}
    Generate password
</Button>

<Dialog
    {isOpen}
    title="Generate password"
    size="sm"
    class="[--color-focus-ring:var(--color-text-muted)]"
    compact
    scrollBody
    showCloseButton={false}
    onClose={close}>
    {#snippet header()}
        <div class="flex items-center justify-between gap-2 px-1">
            <IconButton
                ariaLabel="Close dialog"
                variant="ghost"
                size="sm"
                class="rounded-full bg-surface-hover"
                onclick={close}>
                <X class="size-3.5" />
            </IconButton>
            <div class="flex items-center gap-2">
                <Button
                    type="primary"
                    size="sm"
                    class="rounded-full"
                    disabled={disabled || !preview}
                    isLoading={isCopying}
                    onclick={copyAndClose}>Copy and close</Button>
                <IconButton
                    ariaLabel="Regenerate password"
                    variant="ghost"
                    size="sm"
                    class="rounded-full bg-surface-hover"
                    disabled={isCopying}
                    onclick={regenerate}>
                    <RefreshCw class="size-3.5" />
                </IconButton>
            </div>
        </div>
    {/snippet}
    <div class="flex min-w-0 flex-col gap-4 p-1">
        <div class="rounded-md border border-border-subtle bg-transparent p-4">
            {#if preview}
                <p
                    data-sentry-mask
                    aria-label="Generated password"
                    class="font-mono text-base break-all whitespace-pre-wrap text-text-primary select-text">
                    {#each previewParts as part (part.key)}<span class={part.color}
                            >{part.text}</span
                        >{/each}
                </p>
            {:else}
                <FieldMessage message={generationError} />
            {/if}
        </div>
        <span
            class="sr-only"
            aria-live="polite"
            >{generation ? `Password preview updated. Generation ${generation}.` : ''}</span>
        <Dropdown
            label="Type"
            class={dropdownFocus}
            ariaLabel="Password type"
            value={mode}
            fullWidth
            options={[
                { value: 'random', label: 'Random password' },
                { value: 'memorable', label: 'Memorable password' }
            ]}
            onChange={value => {
                mode = value;
                advancedOpen = false;
                regenerate();
            }} />

        {#if mode === 'random'}
            <label class="flex flex-col gap-2 text-xs text-text-secondary">
                <span>{randomOptions.length} characters</span>
                <input
                    type="range"
                    min="15"
                    max="64"
                    step="1"
                    aria-label="Password length"
                    class={sliderClass}
                    style:--slider-background={sliderBackground}
                    bind:value={
                        () => randomOptions.length,
                        value => {
                            randomOptions.length = value;
                            regenerate();
                        }
                    } />
            </label>
            <Checkbox
                label="Special characters"
                bind:checked={
                    () => randomOptions.symbols,
                    value => {
                        randomOptions.symbols = value;
                        regenerate();
                    }
                } />
        {:else}
            <label class="flex flex-col gap-2 text-xs text-text-secondary">
                <span>{memorableOptions.words} words</span>
                <input
                    type="range"
                    min="8"
                    max="10"
                    step="1"
                    aria-label="Word count"
                    class={sliderClass}
                    style:--slider-background={sliderBackground}
                    bind:value={
                        () => memorableOptions.words,
                        value => {
                            memorableOptions.words = value;
                            regenerate();
                        }
                    } />
            </label>
            <Checkbox
                label="Capitalize words"
                bind:checked={
                    () => memorableOptions.capitalize,
                    value => {
                        memorableOptions.capitalize = value;
                        regenerate();
                    }
                } />
        {/if}

        <div class="flex flex-col gap-4">
            <div
                id={advancedOptionsId}
                class={advancedOpen ? 'flex flex-col gap-4' : 'hidden'}>
                {#if mode === 'random'}
                    <Checkbox
                        label="Capital letters (A–Z)"
                        bind:checked={
                            () => randomOptions.uppercase,
                            value => {
                                randomOptions.uppercase = value;
                                regenerate();
                            }
                        } />
                    <Checkbox
                        label="Include numbers (0–9)"
                        bind:checked={
                            () => randomOptions.numbers,
                            value => {
                                randomOptions.numbers = value;
                                regenerate();
                            }
                        } />
                {:else}
                    <Dropdown
                        label="Separator"
                        class={dropdownFocus}
                        ariaLabel="Word separator"
                        value={memorableOptions.separator}
                        fullWidth
                        options={[
                            { value: '-', label: 'Hyphens' },
                            { value: ' ', label: 'Spaces' },
                            { value: '.', label: 'Periods' }
                        ]}
                        onChange={value => {
                            memorableOptions.separator =
                                value as MemorablePasswordOptions['separator'];
                            regenerate();
                        }} />
                    <Checkbox
                        label="Include numbers"
                        description="Add a random digit after each word."
                        bind:checked={
                            () => memorableOptions.numbers,
                            value => {
                                memorableOptions.numbers = value;
                                regenerate();
                            }
                        } />
                {/if}
            </div>
            <Button
                type="ghost"
                size="2xs"
                class="self-end hover:text-text-primary"
                aria-expanded={advancedOpen}
                aria-controls={advancedOptionsId}
                onclick={() => (advancedOpen = !advancedOpen)}>
                {#snippet leading()}
                    {#if advancedOpen}
                        <X class="size-3.5" />
                    {:else}
                        <Settings class="size-3.5" />
                    {/if}
                {/snippet}
                {advancedOpen ? 'Close advanced options' : 'Advanced options'}
            </Button>
        </div>
    </div>
</Dialog>
