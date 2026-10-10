import type { FeedbackVote, PageType } from './adminActivity';

export function createFeedbackClient(target: () => { type: PageType; id: string }) {
    let pending = $state(false);
    let error = $state('');
    let confirmed = $state<string | null>(null);
    let selected = $state<FeedbackVote | null>(null);
    let operation: {
        id: string;
        targetType: PageType;
        targetId: string;
        vote: FeedbackVote;
    } | null = null;
    const key = () => `${target().type}:${target().id}`;
    async function vote(value: FeedbackVote) {
        if (pending || confirmed === key()) return;
        const current = target();
        if (
            !operation
            || operation.targetType !== current.type
            || operation.targetId !== current.id
            || operation.vote !== value
        )
            operation = {
                id: crypto.randomUUID(),
                targetType: current.type,
                targetId: current.id,
                vote: value
            };
        const attempt = operation;
        pending = true;
        error = '';
        selected = value;
        try {
            const response = await fetch('/api/internal/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationId: attempt.id,
                    targetType: attempt.targetType,
                    targetId: attempt.targetId,
                    vote: attempt.vote
                }),
                signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (
                !response.ok
                || typeof result?.recorded !== 'boolean'
                || typeof result?.replayed !== 'boolean'
            )
                throw new Error('Your feedback could not be confirmed. Please try again.');
            confirmed = `${attempt.targetType}:${attempt.targetId}`;
        } catch {
            error = 'Your feedback could not be confirmed. Please try again.';
        } finally {
            pending = false;
        }
    }
    return {
        get pending() {
            return pending;
        },
        get error() {
            return error;
        },
        get voted() {
            return confirmed === key() ? selected === 'yes' : null;
        },
        vote
    };
}
