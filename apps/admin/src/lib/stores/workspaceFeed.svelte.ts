import { adminActivityRequest } from '../adminActivityClient.ts';
import type { WorkspacePage } from '#lib/adminWorkspace.ts';

export class WorkspaceFeed {
    data = $state.raw<WorkspacePage | null>(null);
    error = $state('');
    loading = $state(false);
    private controller: AbortController | undefined;
    private generation = 0;
    private key = '';
    private cache: Array<{ key: string; data: WorkspacePage }> = [];
    async load(params: Record<string, string>, refresh = false) {
        const key = JSON.stringify(params);
        if (!refresh && key === this.key) return;
        this.key = key;
        const generation = ++this.generation;
        this.controller?.abort();
        const cached = this.cache.find(entry => entry.key === key);
        if (!refresh && cached) {
            this.data = cached.data;
            this.error = '';
            this.loading = false;
            return;
        }
        this.controller = new AbortController();
        this.loading = true;
        try {
            const data = await adminActivityRequest<WorkspacePage>(
                'workspace',
                params,
                undefined,
                this.controller.signal
            );
            if (generation !== this.generation) return;
            this.data = { ...data, series: data.series ?? this.data?.series };
            this.cache = [
                ...this.cache.filter(entry => entry.key !== key),
                { key, data: this.data }
            ].slice(-3);
            this.error = '';
        } catch (error) {
            if (generation === this.generation && !this.controller.signal.aborted)
                this.error = error instanceof Error ? error.message : 'Unable to load activity.';
        } finally {
            if (generation === this.generation) this.loading = false;
        }
    }
    invalidate() {
        this.cache = [];
        this.key = '';
    }
    dispose() {
        this.generation++;
        this.controller?.abort();
        this.cache = [];
    }
}
