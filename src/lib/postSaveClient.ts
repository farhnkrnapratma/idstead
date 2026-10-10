export type SavedPost = {
    id: string;
    post_revision: number;
    banner_version: string | null;
    slug: string;
    published: boolean;
    deleted?: boolean;
};
export type SaveResult = { post: SavedPost; cleanupPending?: boolean };

export class PostSaveError extends Error {
    public definitive: boolean;

    constructor(message: string, definitive = false) {
        super(message);
        this.definitive = definitive;
    }
}

export function postSaveButtonLabel(
    isSubmitting: boolean,
    isRetrying: boolean,
    action: 'publish' | 'draft' | null
): string {
    if (!isSubmitting) return 'Retry Save';
    if (isRetrying) return 'Retrying…';
    return action === 'publish' ? 'Publishing…' : 'Saving draft…';
}

export async function submitPost(form: FormData, token: string): Promise<SaveResult> {
    const metadata = JSON.parse(String(form.get('post')));
    try {
        const response = await fetch('/api/internal/admin/posts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
            signal: AbortSignal.timeout(120_000)
        });
        const result = await response.json();
        if (response.ok && result.success && result.post) return result;
        if ([400, 401, 403, 409, 422].includes(response.status))
            throw new PostSaveError(
                result.error?.message || result.message || 'Post could not be saved.',
                ![401, 403].includes(response.status)
            );
    } catch (error) {
        if (error instanceof PostSaveError) throw error;
    }
    const status = await fetch(`/api/internal/admin/posts?operationId=${metadata.operationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000)
    });
    if (status.ok) {
        const result = await status.json();
        if (result.state === 'committed' && result.post) return { ...result, cleanupPending: true };
        if (result.state === 'rejected')
            throw new PostSaveError(
                'Post fields could not be committed. Check that the slug is unique.',
                true
            );
        if (result.state === 'conflict')
            throw new PostSaveError(
                'This post changed in another session. Reload before saving.',
                true
            );
    }
    throw new PostSaveError('Save is not confirmed. Retry Save to reconcile this operation.');
}

function operationDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('blog-save-operations', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('operations');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(
                new Error(
                    'Could not preserve this Save for recovery. Check browser storage permissions.'
                )
            );
    });
}

export async function rememberPostSave(key: string, form: FormData | null): Promise<void> {
    const db = await operationDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('operations', 'readwrite');
            const store = transaction.objectStore('operations');
            if (form) store.put(Array.from(form.entries()), key);
            else store.delete(key);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
}

export async function recallPostSave(key: string): Promise<FormData | null> {
    const db = await operationDatabase();
    try {
        const entries = await new Promise<[string, string | Blob][] | undefined>(
            (resolve, reject) => {
                const request = db.transaction('operations').objectStore('operations').get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        );
        if (!entries) return null;
        const form = new FormData();
        for (const [name, value] of entries) form.append(name, value);
        return form;
    } finally {
        db.close();
    }
}
