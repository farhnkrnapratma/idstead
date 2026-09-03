function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/^---[\s\S]*?---\n*/m, '');
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '');
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  text = text.replace(/^>\s?(.*)$/gm, '$1');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/^(\s*)(?:[*+-]|\d+\.)\s+(.+)$/gm, '$1$2');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/<[^>]*>/g, '');
  text = decodeHtmlEntities(text);
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
