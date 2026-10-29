<script lang="ts">
    import {
        ChevronDown,
        Download,
        FileArchive,
        FileUser,
        ShieldAlert,
        ShieldCheck
    } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import CommandLine from '@idstead/ui/components/CommandLine.svelte';
    import CodeTabs from '@mdrs/dom/CodeTabs.svelte';
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import Tooltip from '@idstead/ui/components/Tooltip.svelte';
    import { downloadUrl as download } from '@idstead/ui/utils/fileActions.ts';
    import {
        RESUME_CHECKSUM_ALGORITHMS,
        type ResumeDocumentInfo
    } from '#lib/resumeVerification.ts';
    import { formatFingerprint, formatUserId } from '@idstead/domain/openpgpKey.ts';

    const RESUME_UNAVAILABLE = 'No resume document is available yet.';

    interface Props {
        document: ResumeDocumentInfo | null;
        shortcutGroup?: string;
        shortcutChordKey?: string;
        placement?: 'bottom-start' | 'bottom-end';
        class?: string;
    }

    let {
        document: resume,
        shortcutGroup,
        shortcutChordKey,
        placement = 'bottom-start',
        class: className = ''
    }: Props = $props();

    let isVerifyOpen = $state(false);

    const signedDate = $derived(
        resume?.signature?.signedAt ?
            new Date(resume.signature.signedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        :   ''
    );
    const keyTabs = $derived.by(() => {
        const key = resume?.publicKey;
        if (!key) return [];
        return [
            ...key.wkd.map(email => ({
                label: key.wkd.length > 1 ? `WKD (${email})` : 'WKD',
                code: `gpg --locate-keys ${email}`
            })),
            ...(key.url ?
                [{ label: new URL(key.url).host, code: `curl -sSf ${key.url} | gpg --import` }]
            :   []),
            ...key.keyservers.map(server => ({
                label: server.label,
                code: `curl -sSf '${server.url}' | gpg --import`
            }))
        ];
    });
    const checksumTabs = $derived(
        resume ?
            RESUME_CHECKSUM_ALGORITHMS.map(algorithm => ({
                label: algorithm.label,
                code: `${algorithm.command} -c ${resume.filename}.${algorithm.ext}`
            }))
        :   []
    );
    const digestTabs = $derived(
        resume?.checksums ?
            RESUME_CHECKSUM_ALGORITHMS.map(algorithm => ({
                label: algorithm.label,
                code: resume.checksums![algorithm.ext],
                copyLabel: `${algorithm.label} checksum`,
                downloadUrl: resume.files[algorithm.ext],
                downloadLabel: `Download ${resume.filename}.${algorithm.ext}`
            }))
        :   []
    );
    const CHECKSUM_TAB_KEY = 'resume-checksum';
    const steps = $derived.by(() => {
        if (!resume) return [];
        const list: {
            text: string;
            ariaLabel?: string;
            syncKey?: string;
            tabs?: { label: string; code: string; downloadUrl?: string; downloadLabel?: string }[];
        }[] = [
            { text: 'Download all and extract the archive.' },
            {
                text: 'Compare a checksum:',
                ariaLabel: 'Checksum commands',
                syncKey: CHECKSUM_TAB_KEY,
                tabs: checksumTabs
            }
        ];
        if (resume.signature && keyTabs.length)
            list.push({
                text: 'Import the public key from any of these sources:',
                ariaLabel: 'Public key sources',
                tabs: keyTabs
            });
        if (resume.signature)
            list.push({
                text: 'Check the signature:',
                ariaLabel: 'Signature formats',
                tabs: [
                    {
                        label: 'Binary',
                        code: `gpg --verify ${resume.filename}.sig`,
                        downloadUrl: resume.files.sig,
                        downloadLabel: `Download ${resume.filename}.sig`
                    },
                    {
                        label: 'Armored',
                        code: `gpg --verify ${resume.filename}.asc`,
                        downloadUrl: resume.files.asc,
                        downloadLabel: `Download ${resume.filename}.asc`
                    }
                ]
            });
        return list;
    });
</script>

{#snippet triggerButton(toggle?: () => void, isOpen = false)}
    <Button
        type="primary"
        tone="neutral"
        size="md"
        aria-disabled={resume ? undefined : 'true'}
        aria-haspopup={resume ? 'menu' : undefined}
        aria-expanded={resume ? isOpen : undefined}
        {shortcutGroup}
        shortcutChordKey={resume ? shortcutChordKey : undefined}
        shortcutLabel={resume ? 'Download resume' : undefined}
        onclick={toggle}
        class="w-full justify-center">
        {#snippet leading()}
            <Download
                class="size-3.5"
                aria-hidden="true" />
        {/snippet}
        Download resume
        {#if !resume}
            <span class="sr-only">{RESUME_UNAVAILABLE}</span>
        {/if}
        {#snippet trailing()}
            {#if resume}
                <ChevronDown
                    class="size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none {(
                        isOpen
                    ) ?
                        'rotate-180'
                    :   ''}"
                    aria-hidden="true" />
            {/if}
        {/snippet}
    </Button>
{/snippet}

{#if resume}
    {@const info = resume}
    <Dropdown
        ariaLabel="Download resume"
        {placement}
        class={className}
        actions={[
            { label: 'Download PDF', icon: FileUser, onSelect: () => download(info.files.pdf) },
            { label: 'Download all', icon: FileArchive, onSelect: () => download(info.files.zip) },
            { label: 'Verify integrity', icon: ShieldCheck, onSelect: () => (isVerifyOpen = true) }
        ]}>
        {#snippet trigger({ isOpen, toggle })}
            {@render triggerButton(toggle, isOpen)}
        {/snippet}
    </Dropdown>

    <Dialog
        isOpen={isVerifyOpen}
        title="Verify this resume"
        description={info.filename}
        size="lg"
        scrollBody
        onClose={() => (isVerifyOpen = false)}>
        <div class="flex flex-col gap-6 text-sm">
            {#if info.signature}
                {@const signature = info.signature}
                <section
                    aria-label="Signature"
                    class="flex flex-col gap-2">
                    <div class="flex gap-3">
                        <span class="flex h-lh shrink-0 items-center">
                            <ShieldCheck
                                class="size-4 text-success"
                                aria-hidden="true" />
                        </span>
                        <p class="flex min-w-0 flex-1 flex-col">
                            <span class="text-fg">
                                Signed by
                                {signature.signer.map(user => formatUserId(user)).join(', ')}
                            </span>
                            {#if signedDate}
                                <span class="text-fg-muted">on {signedDate}</span>
                            {/if}
                        </p>
                    </div>
                    <CommandLine
                        command={formatFingerprint(signature.fingerprint)}
                        copyValue={signature.fingerprint}
                        label="Fingerprint" />
                </section>
            {:else}
                <p class="flex gap-3 text-fg-secondary">
                    <span class="flex h-lh shrink-0 items-center">
                        <ShieldAlert
                            class="size-4 text-fg-muted"
                            aria-hidden="true" />
                    </span>
                    <span>Not signed yet. You can still check it against its checksum.</span>
                </p>
            {/if}

            <section aria-labelledby="resume-verify-checksum">
                <h3
                    id="resume-verify-checksum"
                    class="mb-2 type-card-title">
                    Checksums
                </h3>
                {#if digestTabs.length}
                    <CodeTabs
                        tabs={digestTabs}
                        syncKey={CHECKSUM_TAB_KEY}
                        ariaLabel="Checksums" />
                {/if}
            </section>

            <section aria-labelledby="resume-verify-steps">
                <h3
                    id="resume-verify-steps"
                    class="mb-2 type-card-title">
                    How to check
                </h3>
                <ol
                    role="list"
                    class="flex flex-col gap-3 text-fg-secondary">
                    {#each steps as step, index (step.text)}
                        <li class="flex flex-col gap-2">
                            <div class="flex gap-3">
                                <span
                                    class="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-subtle text-2xs font-semibold text-fg-secondary tabular-nums"
                                    aria-hidden="true">{index + 1}</span>
                                <span class="min-w-0 flex-1">{step.text}</span>
                            </div>
                            {#if step.tabs?.length}
                                <CodeTabs
                                    command
                                    tabs={step.tabs}
                                    syncKey={step.syncKey}
                                    ariaLabel={step.ariaLabel ?? step.text} />
                            {/if}
                        </li>
                    {/each}
                </ol>
            </section>
        </div>

        {#snippet footer()}
            <Button
                type="secondary"
                size="sm"
                onclick={() => download(info.files.zip)}>
                {#snippet leading()}
                    <FileArchive
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                Download all
            </Button>
            <Button
                type="primary"
                size="sm"
                onclick={() => download(info.files.pdf)}>
                {#snippet leading()}
                    <FileUser
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                Download PDF
            </Button>
        {/snippet}
    </Dialog>
{:else}
    <Tooltip
        content={RESUME_UNAVAILABLE}
        toggleOnClick
        wrapperClass={className}>
        {@render triggerButton()}
    </Tooltip>
{/if}
