export interface LegacyConversion {
  markdown: string;
  notes: string[];
}

const TOKEN_RE = /(\d+)/g;
const FENCE_RE =
  /^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*\1[ \t]*$/gm;
const DEFINE_RE = /^:::define[^\n]*\r?\n[\s\S]*?\r?\n:::[ \t]*$/m;
const IGNORE_RENDER_RE =
  /^[ \t]*:::ignore-render[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*:::[ \t]*$/gim;
const INLINE_CODE_RE = /(`+)(?:[^\n`]|`(?!\1))+\1/g;
const INTERPOLATION_RE = /\$\{[^}\n]*\}/g;
const CONFIG_RE = /^\s*:::config[^\n]*\r?\n[\s\S]*?\r?\n:::[ \t]*(?:\r?\n)*/i;
const ALERT_START_RE =
  /^([ \t]*)>[ \t]?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i;
const DIRECTIVE_LINE_RE =
  /^([ \t]*):{3,}(callout|embed|tabs|tab-group)(?:\{([^}\n]*)\})?[ \t]*$/;
const TAB_BRACE_RE = /^([ \t]*)::tab\{([^}\n]*)\}[ \t]*$/;
const WIDE_CLOSER_RE = /^([ \t]*):{4,}[ \t]*$/;
const DETAILS_OPEN_RE =
  /^([ \t]*)<details\b[^>]*>[ \t]*(?:\r?\n[ \t]*)?<summary\b[^>]*>([\s\S]*?)<\/summary>[ \t]*$/gim;
const DETAILS_BARE_OPEN_RE = /^([ \t]*)<details\b[^>]*>[ \t]*$/gim;
const DETAILS_CLOSE_RE = /^([ \t]*)<\/details>[ \t]*$/gim;
const VIDEO_RE = /<video\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>\s*<\/video>/gi;
const BLOCK_MATH_RE = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;
const INLINE_MATH_RE = /\\\(([\s\S]+?)\\\)|(?<!\\)\$((?!\s)[^$\n]+?(?!\s))\$/g;
const MODERN_SYNTAX_RE =
  /^[ \t]*(?::::*(?:math|snippets|note|tip|important|warning|caution|details)\b|:::callout[ \t]+title=)|\bmark=[\d.,]+|::tab[ \t]+label=/im;

function normaliseAttrs(inner: string): string {
  return inner.replace(/"\s*,\s*/g, '" ').trim();
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function rewriteFenceMeta(fence: string): string {
  const lineEnd = fence.indexOf('\n');
  const first = lineEnd === -1 ? fence : fence.slice(0, lineEnd);
  const rest = lineEnd === -1 ? '' : fence.slice(lineEnd);
  const opening = first.match(/^([ \t]*(?:`{3,}|~{3,}))(.*)$/);
  const meta = opening?.[2].match(/\{([\d,\s-]+)\}/);
  if (!opening || !meta) return fence;
  const spec = meta[1].replace(/\s+/g, '').replace(/(\d)-(\d)/g, '$1..$2');
  const info = opening[2].replace(meta[0], '').trimEnd();
  return `${opening[1]}${info} mark=${spec}${rest}`;
}

function convertAlerts(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const start = lines[index].match(ALERT_START_RE);
    if (!start) {
      output.push(lines[index]);
      continue;
    }
    const [, indent, type, first] = start;
    output.push(`${indent}:::${type.toLowerCase()}`);
    if (first.trim()) output.push(`${indent}${first.trim()}`);
    while (index + 1 < lines.length && /^[ \t]*>/.test(lines[index + 1])) {
      index++;
      const body = lines[index].replace(/^[ \t]*>[ \t]?/, '');
      output.push(body.trim() ? `${indent}${body}` : '');
    }
    output.push(`${indent}:::`);
  }
  return output.join('\n');
}

function firstTabUsesBraces(lines: string[], from: number): boolean | null {
  for (let index = from; index < lines.length; index++) {
    if (/^[ \t]*::tab\{/.test(lines[index])) return true;
    if (/^[ \t]*::tab[ \t]/.test(lines[index])) return false;
    if (/^[ \t]*:{3,}[ \t]*$/.test(lines[index])) return null;
  }
  return null;
}

function convertDirectives(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, index) => {
      const directive = line.match(DIRECTIVE_LINE_RE);
      if (directive) {
        const [, indent, name, braces] = directive;
        const attrs = braces ? ` ${normaliseAttrs(braces)}` : '';
        if (name === 'tab-group') return `${indent}:::tabs`;
        if (name === 'tabs') {
          const legacy =
            braces !== undefined
            || firstTabUsesBraces(lines, index + 1) === true;
          return legacy ? `${indent}:::snippets${attrs}` : line;
        }
        return braces !== undefined ? `${indent}:::${name}${attrs}` : line;
      }
      const tab = line.match(TAB_BRACE_RE);
      if (tab) return `${tab[1]}::tab ${normaliseAttrs(tab[2])}`;
      const wide = line.match(WIDE_CLOSER_RE);
      return wide ? `${wide[1]}:::` : line;
    })
    .join('\n');
}

export function convertLegacyMarkdownWithNotes(
  markdown: string
): LegacyConversion {
  const notes: string[] = [];
  const store: string[] = [];
  const keep = (value: string) => `${store.push(value) - 1}`;
  const protect = (
    text: string,
    pattern: RegExp,
    transform: (match: string) => string = match => match
  ) => text.replace(pattern, match => keep(transform(match)));

  const crlf = markdown.includes('\r\n');
  let text = crlf ? markdown.replace(/\r\n/g, '\n') : markdown;
  if (CONFIG_RE.test(text)) {
    text = text.replace(CONFIG_RE, '');
    notes.push('removed :::config block');
  }

  text = protect(text, FENCE_RE, rewriteFenceMeta);
  text = protect(text, DEFINE_RE);
  text = protect(text, IGNORE_RENDER_RE);
  text = protect(text, INLINE_CODE_RE);
  text = protect(text, INTERPOLATION_RE);
  const modern = MODERN_SYNTAX_RE.test(text);

  text = convertAlerts(text);
  text = convertDirectives(text);

  text = text.replace(DETAILS_OPEN_RE, (_, indent: string, summary: string) => {
    const title =
      summary
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Details';
    return `${indent}:::details summary="${escapeAttrValue(title)}"`;
  });
  text = text.replace(DETAILS_BARE_OPEN_RE, '$1:::details summary="Details"');
  text = text.replace(DETAILS_CLOSE_RE, '$1:::');
  text = text.replace(VIDEO_RE, '![Video]($1)');

  text = text.replace(
    BLOCK_MATH_RE,
    (
      match,
      bracket: string | undefined,
      dollars: string | undefined,
      offset: number,
      whole: string
    ) => {
      const isBracket = bracket !== undefined;
      if (modern && !isBracket) return match;
      const formula = (bracket ?? dollars ?? '').trim();
      const lineStart = whole.lastIndexOf('\n', offset - 1) + 1;
      const before = whole.slice(lineStart, offset);
      const afterEnd = whole.indexOf('\n', offset + match.length);
      const after = whole.slice(
        offset + match.length,
        afterEnd === -1 ? whole.length : afterEnd
      );
      const alone = !before.trim() && !after.trim();
      if (alone || formula.includes('\n')) {
        const indent = before.trim() ? '' : before;
        const body = formula
          .split('\n')
          .map(line => `${indent}${line.trim()}`)
          .join('\n');
        const block = `:::math\n${body}\n${indent}:::`;
        return keep(before.trim() ? `\n\n${block}\n\n` : block);
      }
      return keep(`$$ ${formula} $$`);
    }
  );

  text = text.replace(
    INLINE_MATH_RE,
    (match, bracket: string | undefined, dollars: string | undefined) =>
      modern && bracket === undefined ?
        match
      : keep(`$$ ${(bracket ?? dollars ?? '').trim()} $$`)
  );

  for (let pass = 0; pass < 8 && TOKEN_RE.test(text); pass++) {
    TOKEN_RE.lastIndex = 0;
    text = text.replace(TOKEN_RE, (_, index: string) => store[Number(index)]);
  }
  TOKEN_RE.lastIndex = 0;

  return {markdown: crlf ? text.replace(/\n/g, '\r\n') : text, notes};
}

export function convertLegacyMarkdown(markdown: string): string {
  return convertLegacyMarkdownWithNotes(markdown).markdown;
}
