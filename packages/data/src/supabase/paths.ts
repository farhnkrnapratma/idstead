const MARKDOWN_PATH_RE = /^(posts\/[0-9a-f-]{36}\/[0-9a-f-]{36})\.md$/;

export function postRenderPath(storagePath: string | null | undefined): string | null {
    const match = storagePath?.match(MARKDOWN_PATH_RE);
    return match ? `${match[1]}.render.json` : null;
}

export function postMarkdownPath(postId: string, operationId: string): string {
    return `posts/${postId}/${operationId}.md`;
}
