export const INDENT_SIZES = [2, 4, 8] as const;
export type IndentSize = (typeof INDENT_SIZES)[number];
export type IndentMode = 'spaces' | 'tabs';
export type LineWrapMode = 'soft' | 'none';

const STORAGE_KEY = 'markdown_editor_preferences';

export class EditorPreferences {
    indentMode = $state<IndentMode>('spaces');
    indentSize = $state<IndentSize>(4);
    lineWrapMode = $state<LineWrapMode>('soft');
    showLineNumbers = $state(true);
    autosaveEnabled = $state(true);
    ready = $state(false);

    get indent(): string {
        return this.indentMode === 'spaces' ? ' '.repeat(this.indentSize) : '\t';
    }

    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed: unknown = stored ? JSON.parse(stored) : null;
            if (parsed && typeof parsed === 'object') {
                const saved = parsed as Record<string, unknown>;
                if (saved.indentMode === 'spaces' || saved.indentMode === 'tabs')
                    this.indentMode = saved.indentMode;
                if (INDENT_SIZES.includes(saved.indentSize as IndentSize))
                    this.indentSize = saved.indentSize as IndentSize;
                if (saved.lineWrapMode === 'soft' || saved.lineWrapMode === 'none')
                    this.lineWrapMode = saved.lineWrapMode;
                if (typeof saved.showLineNumbers === 'boolean')
                    this.showLineNumbers = saved.showLineNumbers;
                if (typeof saved.autosaveEnabled === 'boolean')
                    this.autosaveEnabled = saved.autosaveEnabled;
            }
        } catch {}
        this.ready = true;
    }

    private persist() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    indentMode: this.indentMode,
                    indentSize: this.indentSize,
                    lineWrapMode: this.lineWrapMode,
                    showLineNumbers: this.showLineNumbers,
                    autosaveEnabled: this.autosaveEnabled
                })
            );
        } catch {}
    }

    toggleIndentMode() {
        this.indentMode = this.indentMode === 'spaces' ? 'tabs' : 'spaces';
        this.persist();
    }

    setIndentSize(size: IndentSize) {
        this.indentSize = size;
        this.persist();
    }

    toggleLineWrap() {
        this.lineWrapMode = this.lineWrapMode === 'soft' ? 'none' : 'soft';
        this.persist();
    }

    toggleLineNumbers() {
        this.showLineNumbers = !this.showLineNumbers;
        this.persist();
    }

    toggleAutosave() {
        this.autosaveEnabled = !this.autosaveEnabled;
        this.persist();
    }
}
