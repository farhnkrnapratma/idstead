import type { PostOperation, PostOperationStore } from '@fkp/data';
import type { parsePostInput } from './blogPostInput';

type Input = Awaited<ReturnType<typeof parsePostInput>>;
export type { PostOperation };

export class BannerRequiredError extends Error {
    constructor() {
        super('Banner image is required.');
    }
}

export class OperationReusedError extends Error {
    constructor() {
        super('This operation ID was used for different post data.');
    }
}

export async function savePostOperation(
    operations: PostOperationStore,
    actor: string,
    input: Input,
    upload: () => Promise<void>,
    render: string | null = null
) {
    const prepared = await operations.prepare({
        operationId: input.operationId,
        actor,
        postId: input.id,
        hash: input.hash,
        revision: input.revision,
        kind: input.kind,
        post: input.post,
        banner: input.banner
    });
    if (prepared.status === 'reused') throw new OperationReusedError();
    let operation = prepared.operation;
    if (
        operation.state === 'committed'
        || operation.state === 'conflict'
        || operation.state === 'rejected'
    )
        return operation;
    if (input.kind === 'save' && input.banner.operation === 'keep') {
        const current = await operations.revision(input.id);
        if (current?.post_revision === input.revision && !current.banner_version)
            throw new BannerRequiredError();
    }
    if (operation.state === 'pending') {
        if (input.kind === 'save') {
            if (input.image) await upload();
            try {
                await operations.writeMarkdown(input.id, input.operationId, input.markdown);
            } catch {
                throw new Error('Markdown upload failed. Retry the same Save operation.');
            }
            if (render)
                await operations
                    .writeRender(input.id, input.operationId, render)
                    .catch(error => console.error('Post render upload failed:', error));
        }
        await operations.ready(input.operationId, actor);
    }
    try {
        operation = await operations.commit(input.operationId, actor);
    } catch (error) {
        const saved = await operations.find(input.operationId, actor).catch(() => null);
        if (!saved || !['committed', 'conflict', 'rejected'].includes(saved.state)) throw error;
        operation = saved;
    }
    return operation;
}
