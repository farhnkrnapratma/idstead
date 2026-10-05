const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function sanitizeUrl(href: string): string | null {
  const value = href.trim();
  if (value.includes('@@')) return null;
  const probe = Array.from(value)
    .filter(char => char.charCodeAt(0) > 32 && char.charCodeAt(0) !== 127)
    .join('');
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !SAFE_URL_SCHEMES.has(`${scheme[1].toLowerCase()}:`)) {
    return null;
  }
  return value;
}

const HTML_TAGS = new Set(
  'a abbr b blockquote br button code del details div em h1 h2 h3 h4 h5 h6 hr i iframe img ins kbd li mark ol p pre s section span strong sub summary sup table tbody td tfoot th thead tr u ul video'.split(
    ' '
  )
);
const SVG_SHAPES = new Set(
  'path circle rect line ellipse polyline polygon'.split(' ')
);
const SVG_TAGS = new Set(['svg', ...SVG_SHAPES]);
const MATH_TAGS = new Set(
  'math semantics annotation mrow mi mn mo mtext mspace msub msup msubsup mfrac msqrt mroot mover munder munderover mtable mtr mtd mstyle mpadded mphantom menclose mmultiscripts mprescripts none'.split(
    ' '
  )
);
const HTML_VOID = new Set(['br', 'hr', 'img']);
const DROP_WITH_CONTENT = new Set(
  'script style textarea title noscript template noembed noframes xmp plaintext object embed applet'.split(
    ' '
  )
);

const GLOBAL_ATTRS = new Set([
  'class',
  'role',
  'title',
  'hidden',
  'aria-hidden',
  'aria-label',
  'aria-selected',
  'aria-describedby',
  'data-tab-label',
  'data-tab-group-key',
  'data-content',
  'data-chart-content',
  'data-highlight-lines',
  'data-filename',
  'data-footnote-ref',
  'data-footnote-backref',
  'data-footnotes'
]);
const SVG_ATTRS = new Set(
  'xmlns width height viewbox fill stroke stroke-width stroke-linecap stroke-linejoin preserveaspectratio d cx cy r x y rx ry x1 x2 y1 y2 points'.split(
    ' '
  )
);
const MATH_ATTRS = new Set(
  'xmlns encoding display displaystyle scriptlevel mathvariant mathcolor mathbackground mathsize columnalign columnlines columnspacing rowlines rowspacing rowalign notation accent accentunder fence stretchy minsize maxsize lspace rspace linethickness voffset depth width height separator symmetric largeop movablelimits form lquote rquote equalrows equalcolumns side'.split(
    ' '
  )
);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'loading', 'decoding', 'width', 'height']),
  video: new Set([
    'src',
    'controls',
    'preload',
    'playsinline',
    'width',
    'height'
  ]),
  iframe: new Set(['src', 'loading', 'allowfullscreen']),
  button: new Set(['type']),
  ol: new Set(['start']),
  td: new Set(['align', 'colspan', 'rowspan']),
  th: new Set(['align', 'colspan', 'rowspan']),
  details: new Set(['open']),
  span: new Set(['style'])
};
const BOOLEAN_ATTRS = new Set([
  'hidden',
  'controls',
  'playsinline',
  'allowfullscreen',
  'open'
]);
const URL_ATTRS = new Set(['href', 'src']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  tab: '\t',
  newline: '\n',
  nbsp: '\u00a0',
  sol: '/',
  lpar: '(',
  rpar: ')',
  period: '.',
  comma: ',',
  semi: ';',
  equals: '=',
  num: '#',
  percnt: '%',
  excl: '!',
  quest: '?',
  lsqb: '[',
  rsqb: ']'
};

const ATTR_CANONICAL: Record<string, string> = {
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio'
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g,
    (match, dec, hex, name) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
      const code = dec ? Number(dec) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
  );
}

function escapeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CLASS_TOKEN_RE = /^[\w:/[\]&.%()#,*>!+=~@-]+$/;
const CLASS_FORBIDDEN_RE =
  /(?:^|:)(?:fixed|absolute|sticky|-?(?:inset|top|left|right|bottom|start|end)(?:-[\w./[\]%-]+)?|z-[\w[\]-]+)$/;
const STYLE_DECLARATION_RE =
  /^(?:position:\s*relative|(?:height|width|min-width|max-width|top|bottom|left|right|margin(?:-(?:left|right|top|bottom))?|padding(?:-(?:left|right|top|bottom))?|vertical-align|border-(?:top|bottom|left|right)-width|color):[-+\w.#%(),\s]+)$/i;
const ID_RE = /^footnote[\w-]*$/;
const YOUTUBE_EMBED_SRC_RE = /^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/;
const CODEPEN_EMBED_SRC_RE =
  /^https:\/\/codepen\.io\/[\w-]+\/embed\/[\w-]+(?:\?default-tab=result)?$/;

function safeClass(value: string): string {
  return value
    .split(/\s+/)
    .filter(
      token =>
        token && CLASS_TOKEN_RE.test(token) && !CLASS_FORBIDDEN_RE.test(token)
    )
    .join(' ');
}

function safeStyle(value: string): string {
  const declarations = value
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);
  if (!declarations.every(part => STYLE_DECLARATION_RE.test(part))) return '';
  return declarations.join(';');
}

function isMediaUrl(value: string): boolean {
  return /^(?:https?:\/\/|\/|[^:]*$)/i.test(value);
}

function allowedAttr(tag: string, name: string): boolean {
  if (GLOBAL_ATTRS.has(name) || name === 'id') return true;
  if (TAG_ATTRS[tag]?.has(name)) return true;
  if (SVG_TAGS.has(tag)) return SVG_ATTRS.has(name);
  if (MATH_TAGS.has(tag)) return MATH_ATTRS.has(name);
  return false;
}

function cleanAttrs(
  tag: string,
  source: string
): {attrs: string; drop: boolean} {
  const seen = new Set<string>();
  let out = '';
  let target = '';
  for (const match of source.matchAll(ATTR_RE)) {
    const name = match[1].toLowerCase();
    if (seen.has(name) || name.startsWith('on') || !allowedAttr(tag, name)) {
      continue;
    }
    seen.add(name);
    const raw = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');

    if (BOOLEAN_ATTRS.has(name)) {
      out += ` ${name}`;
    } else if (URL_ATTRS.has(name)) {
      const url = sanitizeUrl(raw);
      if (url === null) continue;
      if (name === 'src' && tag !== 'iframe' && !isMediaUrl(url)) continue;
      if (tag === 'iframe') {
        if (
          !YOUTUBE_EMBED_SRC_RE.test(url)
          && !CODEPEN_EMBED_SRC_RE.test(url)
        ) {
          return {attrs: '', drop: true};
        }
      }
      out += ` ${name}="${escapeValue(url)}"`;
    } else if (name === 'class') {
      const value = safeClass(raw);
      if (value) out += ` class="${escapeValue(value)}"`;
    } else if (name === 'style') {
      const value = safeStyle(raw);
      if (value) out += ` style="${escapeValue(value)}"`;
    } else if (name === 'id') {
      if (ID_RE.test(raw)) out += ` id="${escapeValue(raw)}"`;
    } else if (name === 'target') {
      if (raw === '_blank') target = raw;
    } else if (name === 'rel') {
      continue;
    } else if (name === 'type' && tag === 'button') {
      out += ' type="button"';
    } else if (name === 'role') {
      if (/^[a-z]+$/.test(raw)) out += ` role="${raw}"`;
    } else {
      out += ` ${ATTR_CANONICAL[name] ?? name}="${escapeValue(raw)}"`;
    }
  }
  if (tag === 'a' && target) {
    out += ' target="_blank" rel="noopener noreferrer"';
  }
  if (tag === 'iframe' && !seen.has('src')) return {attrs: '', drop: true};
  return {attrs: out, drop: false};
}

const ATTR_RE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const OPEN_TAG_RE =
  /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const CLOSE_TAG_RE = /<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/y;

function isAllowedTag(tag: string): boolean {
  return HTML_TAGS.has(tag) || SVG_TAGS.has(tag) || MATH_TAGS.has(tag);
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let out = '';
  const open: string[] = [];
  let index = 0;

  const skipElement = (tag: string) => {
    const closing = new RegExp(`</${tag}\\s*>`, 'ig');
    closing.lastIndex = index;
    const found = closing.exec(html);
    index = found ? found.index + found[0].length : html.length;
  };

  while (index < html.length) {
    const lt = html.indexOf('<', index);
    if (lt === -1) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, lt);
    index = lt;

    if (html.startsWith('<!--', index)) {
      const end = html.indexOf('-->', index + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[index + 1] === '!' || html[index + 1] === '?') {
      const end = html.indexOf('>', index);
      index = end === -1 ? html.length : end + 1;
      continue;
    }

    CLOSE_TAG_RE.lastIndex = index;
    const closeMatch = CLOSE_TAG_RE.exec(html);
    if (closeMatch) {
      index += closeMatch[0].length;
      const tag = closeMatch[1].toLowerCase();
      const position = open.lastIndexOf(tag);
      if (position !== -1) {
        while (open.length > position) out += `</${open.pop()}>`;
      }
      continue;
    }

    OPEN_TAG_RE.lastIndex = index;
    const openMatch = OPEN_TAG_RE.exec(html);
    if (!openMatch) {
      out += '&lt;';
      index += 1;
      continue;
    }

    index += openMatch[0].length;
    const tag = openMatch[1].toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      if (tag === 'plaintext') index = html.length;
      else if (!openMatch[3]) skipElement(tag);
      continue;
    }
    if (!isAllowedTag(tag)) continue;

    const {attrs, drop} = cleanAttrs(tag, openMatch[2]);
    if (drop) {
      if (!openMatch[3]) skipElement(tag);
      continue;
    }

    if (SVG_SHAPES.has(tag)) {
      out += `<${tag}${attrs}/>`;
    } else if (HTML_VOID.has(tag)) {
      out += `<${tag}${attrs}>`;
    } else if (openMatch[3]) {
      out += `<${tag}${attrs}></${tag}>`;
    } else {
      out += `<${tag}${attrs}>`;
      open.push(tag);
    }
  }

  while (open.length) out += `</${open.pop()}>`;
  return out;
}
