const EXTENSIONS: Record<string, string> = {
    js: 'js',
    javascript: 'js',
    ts: 'ts',
    typescript: 'ts',
    html: 'html',
    css: 'css',
    rust: 'rs',
    rs: 'rs',
    python: 'py',
    py: 'py',
    bash: 'sh',
    sh: 'sh',
    shell: 'sh',
    json: 'json',
    yaml: 'yml',
    yml: 'yml',
    xml: 'xml',
    md: 'md',
    markdown: 'md',
    go: 'go',
    golang: 'go',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    cs: 'cs',
    sql: 'sql',
    tsx: 'tsx',
    jsx: 'jsx',
    svelte: 'svelte',
    toml: 'toml',
    java: 'java',
    php: 'php',
    ruby: 'rb',
    rb: 'rb',
    zsh: 'sh',
    powershell: 'ps1',
    ps1: 'ps1',
    diff: 'diff'
};

const MAX_FILENAME_LENGTH = 100;

export function sanitizeFilename(value: string | undefined): string {
    const base = (value ?? '').split(/[\\/]/).pop() ?? '';
    const cleaned = Array.from(base)
        .filter(char => {
            const code = char.charCodeAt(0);
            return (
                code > 31
                && code !== 127
                && !(code >= 0x202a && code <= 0x202e)
                && !(code >= 0x2066 && code <= 0x2069)
                && code !== 0x200e
                && code !== 0x200f
            );
        })
        .join('')
        .replace(/[<>:"|?*]/g, '')
        .trim()
        .slice(0, MAX_FILENAME_LENGTH);
    return /^\.*$/.test(cleaned) ? '' : cleaned;
}

export function getDownloadFilename(className: string, filename?: string): string {
    const custom = sanitizeFilename(filename);
    if (custom) return custom;

    const match = className.match(/language-(\S+)/);
    const lang = match?.[1]?.toLowerCase() || '';

    if (lang === 'dockerfile' || lang === 'docker') return 'Dockerfile';

    const ext = EXTENSIONS[lang];
    return ext ? `snippet.${ext}` : 'snippet.txt';
}
