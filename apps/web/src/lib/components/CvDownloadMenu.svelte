<script lang="ts">
    import {
        ChevronDown,
        Download,
        FileArchive,
        FileUser,
        ShieldAlert,
        ShieldCheck
    } from '@lucide/svelte';
    import Button from '@fkp/ui/components/Button.svelte';
    import CommandLine from '@fkp/ui/components/CommandLine.svelte';
    import CodeTabs from '@fkp/mdrs-ui/CodeTabs.svelte';
    import Dialog from '@fkp/ui/components/Dialog.svelte';
    import Dropdown from '@fkp/ui/components/Dropdown.svelte';
    import Tooltip from '@fkp/ui/components/Tooltip.svelte';
    import { downloadUrl as download } from '@fkp/ui/utils/fileActions.ts';
    import { CV_CHECKSUM_ALGORITHMS, type CvDocumentInfo } from '#lib/cvVerification.ts';
    import { formatFingerprint, formatUserId } from '@fkp/domain/openpgpKey.ts';

    const CV_UNAVAILABLE = 'No CV document is available yet.';

    interface Props {
        document: CvDocumentInfo | null;
        shortcutGroup?: string;
        shortcutChordKey?: string;
        placement?: 'bottom-start' | 'bottom-end';
        class?: string;
    }

    let {
        document: cv,
        shortcutGroup,
        shortcutChordKey,
        placement = 'bottom-start',
        class: className = ''
    }: Props = $props();

    let isVerifyOpen = $state(false);

    const signedDate = $derived(
        cv?.signature?.signedAt ?
            new Date(cv.signature.signedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        :   ''
    );
    const keyTabs = $derived.by(() => {
        const key = cv?.publicKey;
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
        cv ?
            CV_CHECKSUM_ALGORITHMS.map(algorithm => ({
                label: algorithm.label,
                code: `${algorithm.command} -c ${cv.filename}.${algorithm.ext}`
            }))
        :   []
    );
    const digestTabs = $derived(
        cv?.checksums ?
            CV_CHECKSUM_ALGORITHMS.map(algorithm => ({
                label: algorithm.label,
                code: cv.checksums![algorithm.ext],
                copyLabel: `${algorithm.label} checksum`,
                downloadUrl: cv.files[algorithm.ext],
                downloadLabel: `Download ${cv.filename}.${algorithm.ext}`
            }))
        :   []
    );
    const CHECKSUM_TAB_KEY = 'cv-checksum';
    const steps = $derived.by(() => {
        if (!cv) return [];
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
        if (cv.signature && keyTabs.length)
            list.push({
                text: 'Import the public key from any of these sources:',
                ariaLabel: 'Public key sources',
                tabs: keyTabs
            });
        if (cv.signature)
            list.push({
                text: 'Check the signature:',
                ariaLabel: 'Signature formats',
                tabs: [
                    {
                        label: 'Binary (.sig)',
                        code: `gpg --verify ${cv.filename}.sig`,
                        downloadUrl: cv.files.sig,
                        downloadLabel: `Download ${cv.filename}.sig`
                    },
                    {
                        label: 'Armored (.asc)',
                        code: `gpg --verify ${cv.filename}.asc`,
                        downloadUrl: cv.files.asc,
                        downloadLabel: `Download ${cv.filename}.asc`
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
        aria-disabled={cv ? undefined : 'true'}
        aria-haspopup={cv ? 'menu' : undefined}
        aria-expanded={cv ? isOpen : undefined}
        {shortcutGroup}
        shortcutChordKey={cv ? shortcutChordKey : undefined}
        shortcutLabel={cv ? 'Download CV' : undefined}
        onclick={toggle}
        class="w-full justify-center">
        {#snippet leading()}
            <Download
                class="size-3.5"
                aria-hidden="true" />
        {/snippet}
        Download CV
        {#if !cv}
            <span class="sr-only">{CV_UNAVAILABLE}</span>
        {/if}
        {#snippet trailing()}
            {#if cv}
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

{#if cv}
    {@const info = cv}
    <Dropdown
        ariaLabel="Download CV"
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
        title="Verify this CV"
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
                            <span class="text-text-primary">
                                Signed by
                                {signature.signer.map(user => formatUserId(user)).join(', ')}
                            </span>
                            {#if signedDate}
                                <span class="text-text-muted">on {signedDate}</span>
                            {/if}
                        </p>
                    </div>
                    <CommandLine
                        command={formatFingerprint(signature.fingerprint)}
                        copyValue={signature.fingerprint}
                        label="Fingerprint" />
                </section>
            {:else}
                <p class="flex gap-3 text-text-secondary">
                    <span class="flex h-lh shrink-0 items-center">
                        <ShieldAlert
                            class="size-4 text-text-muted"
                            aria-hidden="true" />
                    </span>
                    <span>Not signed yet. You can still check it against its checksum.</span>
                </p>
            {/if}

            <section aria-labelledby="cv-verify-checksum">
                <h3
                    id="cv-verify-checksum"
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

            <section aria-labelledby="cv-verify-steps">
                <h3
                    id="cv-verify-steps"
                    class="mb-2 type-card-title">
                    How to check
                </h3>
                <ol
                    role="list"
                    class="flex flex-col gap-3 text-text-secondary">
                    {#each steps as step, index (step.text)}
                        <li class="flex flex-col gap-2">
                            <div class="flex gap-3">
                                <span
                                    class="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-subtle text-2xs font-semibold text-text-secondary tabular-nums"
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
        content={CV_UNAVAILABLE}
        toggleOnClick
        wrapperClass={className}>
        {@render triggerButton()}
    </Tooltip>
{/if}
