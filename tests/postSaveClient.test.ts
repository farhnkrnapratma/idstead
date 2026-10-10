import { describe, expect, test } from 'bun:test';
import { postSaveButtonLabel } from '../src/lib/postSaveClient';

describe('post save button label', () => {
    test('shows the initial publish and draft progress labels', () => {
        expect(postSaveButtonLabel(true, false, 'publish')).toBe('Publishing…');
        expect(postSaveButtonLabel(true, false, 'draft')).toBe('Saving draft…');
    });

    test('shows retry labels only for an existing save or when idle', () => {
        expect(postSaveButtonLabel(true, true, 'publish')).toBe('Retrying…');
        expect(postSaveButtonLabel(false, false, 'publish')).toBe('Retry Save');
    });
});
