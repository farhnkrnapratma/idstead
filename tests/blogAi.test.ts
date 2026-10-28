import { describe, expect, test } from 'bun:test';
import {
    generatePostSummaries,
    prepareSummaryInput,
    splitForNotes
} from '../packages/lib/src/server/blogAi.ts';

function article(paragraphs: number) {
    return Array.from(
        { length: paragraphs },
        (_, i) => `Paragraph ${i} explains topic number ${i} in plain words for readers.`
    ).join('\n\n');
}

function fakeAi() {
    const inputs: { system: string; user: string }[] = [];
    return {
        inputs,
        async run(_model: string, input: { messages: { role: string; content: string }[] }) {
            const system = input.messages[0].content;
            const user = input.messages[1].content;
            inputs.push({ system, user });
            if (system.startsWith('You are a note-taking engine'))
                return { response: `Notes for a part ending with: ${user.slice(-40)}` };
            if (system.includes('extract its key points'))
                return { response: 'Topics are explained in plain words.' };
            return { response: 'The post explains a series of topics in plain words.' };
        }
    };
}

describe('prepareSummaryInput', () => {
    test('keeps the end of a long post', () => {
        const text = prepareSummaryInput(article(2000));
        expect(text.length).toBeGreaterThan(100_000);
        expect(
            text.endsWith('Paragraph 1999 explains topic number 1999 in plain words for readers.')
        ).toBe(true);
    });
});

describe('splitForNotes', () => {
    test('splits at sentence ends and keeps every sentence', () => {
        const text = prepareSummaryInput(article(2000));
        const chunks = splitForNotes(text);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.length).toBeLessThanOrEqual(6);
        for (const chunk of chunks.slice(0, -1)) expect(chunk.endsWith('.')).toBe(true);
        expect(chunks.join(' ')).toBe(text);
    });
});

describe('generatePostSummaries', () => {
    test('sends a short post to the model in one pass', async () => {
        const ai = fakeAi();
        const result = await generatePostSummaries(article(20), ai);
        expect(result.summary).toBe('The post explains a series of topics in plain words.');
        expect(result.tldr).toEqual(['Topics are explained in plain words.']);
        expect(ai.inputs.every(call => call.user.includes('Paragraph 19 explains'))).toBe(true);
    });

    test('covers the whole of a long post through notes', async () => {
        const ai = fakeAi();
        const result = await generatePostSummaries(article(2000), ai);
        const notes = ai.inputs.filter(call =>
            call.system.startsWith('You are a note-taking engine')
        );
        expect(notes.length).toBeGreaterThan(1);
        expect(notes.at(-1)?.user).toContain('Paragraph 1999 explains');
        const finals = ai.inputs.filter(
            call => !call.system.startsWith('You are a note-taking engine')
        );
        expect(finals.every(call => call.user.includes('number 1999 in plain words'))).toBe(true);
        expect(result.summary).not.toBeNull();
        expect(result.tldr).not.toBeNull();
    });
});
