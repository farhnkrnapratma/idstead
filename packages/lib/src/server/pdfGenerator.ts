import {
    PDFDocument,
    PDFHexString,
    appendBezierCurve,
    clip,
    closePath,
    endPath,
    moveTo,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    type PDFFont,
    type PDFImage,
    type PDFPage
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface CvFontBytes {
    sans: Uint8Array;
    sansBold: Uint8Array;
    sansItalic: Uint8Array;
    mono: Uint8Array;
}

export interface AuthorProfileData {
    name: string;
    title?: string | null;
    bio?: string | null;
    email?: string | null;
    website?: string | null;
    location?: string | null;
    avatarBytes?: Uint8Array | null;
}

export interface LinkData {
    url: string;
}

export interface ExperienceData {
    title: string;
    company: string;
    type?: string | null;
    location?: string | null;
    loc_type?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    currently_in?: boolean | null;
    description?: string | null;
}

export interface EducationData {
    institution: string;
    degree?: string | null;
    field?: string | null;
    grade?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    currently_in?: boolean | null;
    description?: string | null;
}

export interface ProjectData {
    name: string;
    url: string;
    desc?: string | null;
    lang?: string | null;
}

export interface SkillCategoryData {
    category: string;
    items: string[];
}

export interface AuthorCvData {
    profile: AuthorProfileData;
    links: LinkData[];
    experiences: ExperienceData[];
    projects: ProjectData[];
    educations: EducationData[];
    skills: SkillCategoryData[];
}

interface Face {
    font: PDFFont;
    chars: Set<number>;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const AVATAR_SIZE = 64;
const AVATAR_GAP = 18;
const GPA_THRESHOLD = 3.5;
const PLACEHOLDER_DESCRIPTION = 'No description provided.';

const INK = rgb(0.07, 0.09, 0.14);
const BODY = rgb(0.17, 0.2, 0.26);
const MUTED = rgb(0.4, 0.44, 0.51);
const ACCENT = rgb(0.1, 0.2, 0.45);
const RULE = rgb(0.83, 0.86, 0.91);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const charClass = (...codes: number[]) => new RegExp(`[${String.fromCharCode(...codes)}]`, 'g');
const DASHES = charClass(0x2013, 0x2014);
const SINGLE_QUOTES = charClass(0x2018, 0x2019);
const DOUBLE_QUOTES = charClass(0x201c, 0x201d);

const NAMED_ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

function decodeEntity(match: string, body: string): string {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    const code =
        body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
}

export function sanitizePdfText(str?: string | null): string {
    if (!str) return '';
    return str
        .replace(/&(#x[0-9a-f]+|#\d+|quot|amp|lt|gt|apos);/gi, decodeEntity)
        .replace(DASHES, '-')
        .replace(SINGLE_QUOTES, "'")
        .replace(DOUBLE_QUOTES, '"');
}

function formatMonthYear(value?: string | null): string {
    const match = value?.match(/^(\d{4})-(\d{2})/);
    if (!match) return '';
    return `${MONTHS[Number(match[2]) - 1] ?? ''} ${match[1]}`.trim();
}

export function formatDateRange(
    start?: string | null,
    end?: string | null,
    current?: boolean | null
): string {
    const from = formatMonthYear(start);
    const to = current ? 'Present' : formatMonthYear(end);
    if (from && to) return `${from} - ${to}`;
    if (from) return `${from} - Present`;
    return to;
}

export function gpaDisplay(grade?: string | null): string | null {
    const text = sanitizePdfText(grade).trim();
    if (!text) return null;
    const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:\/\s*(\d+(?:[.,]\d+)?))?$/);
    if (!match) return text;
    const score = parseFloat(match[1].replace(',', '.'));
    const scale = match[2] ? parseFloat(match[2].replace(',', '.')) : 4;
    if (!(scale > 0)) return null;
    return (score / scale) * 4 >= GPA_THRESHOLD - 1e-9 ? text : null;
}

function displayUrl(url: string): string {
    return url
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/^mailto:/i, '')
        .replace(/\/+$/, '');
}

function isSafeLink(url: string): boolean {
    return (
        /^(https?:\/\/|mailto:)[^\s()<>\\]+$/i.test(url)
        && ![...url].some(char => {
            const code = char.charCodeAt(0);
            return code < 32 || code === 127;
        })
    );
}

function fit(face: Face, value?: string | null): string {
    let out = '';
    for (const char of sanitizePdfText(value)) {
        if (/\s/.test(char)) out += ' ';
        else if (face.chars.has(char.codePointAt(0) as number)) out += char;
    }
    return out.replace(/ {2,}/g, ' ').trim();
}

function wrap(
    face: Face,
    value: string | null | undefined,
    size: number,
    maxWidth: number
): string[] {
    const words = fit(face, value).split(' ').filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (face.font.widthOfTextAtSize(test, size) <= maxWidth || !current) {
            current = test;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

function bulletItems(description?: string | null): string[] {
    return (description ?? '')
        .split(/\r?\n/)
        .map(item => item.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean);
}

function clipCircle(page: PDFPage, cx: number, cy: number, r: number) {
    const k = 0.5523 * r;
    page.pushOperators(
        pushGraphicsState(),
        moveTo(cx + r, cy),
        appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
        appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
        appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
        appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
        closePath(),
        clip(),
        endPath()
    );
}

async function embedAvatar(
    pdfDoc: PDFDocument,
    bytes?: Uint8Array | null
): Promise<PDFImage | null> {
    if (!bytes?.length) return null;
    try {
        return bytes[0] === 0xff ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    } catch (error) {
        console.warn('CV avatar could not be embedded:', error);
        return null;
    }
}

export async function generateCvPdfBuffer(
    data: AuthorCvData,
    fonts: CvFontBytes
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const face = async (bytes: Uint8Array): Promise<Face> => {
        const font = await pdfDoc.embedFont(bytes, { subset: true });
        return { font, chars: new Set(font.getCharacterSet()) };
    };
    const [sans, sansBold, sansItalic, mono] = await Promise.all([
        face(fonts.sans),
        face(fonts.sansBold),
        face(fonts.sansItalic),
        face(fonts.mono)
    ]);
    const avatar = await embedAvatar(pdfDoc, data.profile.avatarBytes);

    const name = fit(sansBold, data.profile.name) || 'Curriculum Vitae';
    pdfDoc.setTitle(`${name} - Curriculum Vitae`);
    pdfDoc.setAuthor(name);
    pdfDoc.setSubject('Curriculum Vitae');
    pdfDoc.setLanguage('en-US');

    const pages: PDFPage[] = [];
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    let y = PAGE_HEIGHT - MARGIN_TOP;

    const ensure = (height: number) => {
        if (y - height >= MARGIN_BOTTOM) return;
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        y = PAGE_HEIGHT - MARGIN_TOP;
    };

    const put = (target: Face, text: string, x: number, size: number, color = BODY) => {
        if (!text) return;
        page.drawText(text, { x, y: y - size, size, font: target.font, color });
    };

    const putRight = (target: Face, text: string, size: number, color = MUTED) => {
        const clean = fit(target, text);
        if (!clean) return 0;
        const width = target.font.widthOfTextAtSize(clean, size);
        put(target, clean, PAGE_WIDTH - MARGIN_X - width, size, color);
        return width;
    };

    const link = (x: number, width: number, height: number, url: string) => {
        if (!isSafeLink(url)) return;
        const annotation = pdfDoc.context.register(
            pdfDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Link',
                Rect: [x, y - height, x + width, y + 2],
                Border: [0, 0, 0],
                A: { Type: 'Action', S: 'URI', URI: PDFHexString.fromText(url) }
            })
        );
        page.node.addAnnot(annotation);
    };

    const paragraph = (
        target: Face,
        text: string | null | undefined,
        size: number,
        leading: number,
        color = BODY,
        x = MARGIN_X,
        width = CONTENT_WIDTH
    ) => {
        for (const line of wrap(target, text, size, width)) {
            ensure(leading);
            put(target, line, x, size, color);
            y -= leading;
        }
    };

    const sectionHeader = (title: string) => {
        ensure(48);
        y -= 6;
        put(sansBold, title.toUpperCase(), MARGIN_X, 9.5, ACCENT);
        y -= 15;
        page.drawLine({
            start: { x: MARGIN_X, y },
            end: { x: PAGE_WIDTH - MARGIN_X, y },
            thickness: 0.75,
            color: RULE
        });
        y -= 9;
    };

    const entryHeader = (title: string, right: string) => {
        const rightText = fit(mono, right);
        const rightWidth = rightText ? mono.font.widthOfTextAtSize(rightText, 8.5) + 14 : 0;
        const lines = wrap(sansBold, title, 10.5, CONTENT_WIDTH - rightWidth);
        ensure(lines.length * 14 + 28);
        lines.forEach((line, index) => {
            if (index === 0) putRight(mono, rightText, 8.5);
            put(sansBold, line, MARGIN_X, 10.5, INK);
            y -= 14;
        });
    };

    const bullets = (items: string[]) => {
        for (const item of items) {
            const lines = wrap(sans, item, 9, CONTENT_WIDTH - 14);
            lines.forEach((line, index) => {
                ensure(12.5);
                if (index === 0) put(sans, fit(sans, '•'), MARGIN_X + 3, 9, MUTED);
                put(sans, line, MARGIN_X + 14, 9);
                y -= 12.5;
            });
        }
    };

    const headerWidth = avatar ? CONTENT_WIDTH - AVATAR_SIZE - AVATAR_GAP : CONTENT_WIDTH;
    const headerTop = y;

    for (const line of wrap(sansBold, name, 24, headerWidth)) {
        put(sansBold, line, MARGIN_X, 24, INK);
        y -= 29;
    }

    const title = data.profile.title;
    for (const line of wrap(sans, title, 11.5, headerWidth)) {
        put(sans, line, MARGIN_X, 11.5, ACCENT);
        y -= 16;
    }
    y -= 2;

    const segments: { text: string; url?: string }[] = [];
    const email = data.profile.email?.trim();
    if (email) segments.push({ text: email, url: `mailto:${email}` });
    if (data.profile.location) segments.push({ text: fit(mono, data.profile.location) });
    const website = data.profile.website?.trim();
    if (website) segments.push({ text: displayUrl(website), url: website });
    for (const item of data.links) segments.push({ text: displayUrl(item.url), url: item.url });

    const separator = fit(mono, ' · ');
    const separatorWidth = mono.font.widthOfTextAtSize(`${separator}`, 8) + 6;
    let x = MARGIN_X;
    let firstOnLine = true;
    for (const segment of segments) {
        const text = fit(mono, segment.text);
        if (!text) continue;
        const width = mono.font.widthOfTextAtSize(text, 8);
        if (!firstOnLine && x + separatorWidth + width > MARGIN_X + headerWidth) {
            y -= 13;
            x = MARGIN_X;
            firstOnLine = true;
        }
        if (!firstOnLine) {
            put(mono, '·', x + 3, 8, MUTED);
            x += separatorWidth;
        }
        put(mono, text, x, 8, MUTED);
        if (segment.url) link(x, width, 10, segment.url);
        x += width;
        firstOnLine = false;
    }
    y -= 13;

    if (avatar) {
        const cx = PAGE_WIDTH - MARGIN_X - AVATAR_SIZE / 2;
        const cy = headerTop - AVATAR_SIZE / 2;
        clipCircle(page, cx, cy, AVATAR_SIZE / 2);
        page.drawImage(avatar, {
            x: cx - AVATAR_SIZE / 2,
            y: cy - AVATAR_SIZE / 2,
            width: AVATAR_SIZE,
            height: AVATAR_SIZE
        });
        page.pushOperators(popGraphicsState());
        page.drawCircle({ x: cx, y: cy, size: AVATAR_SIZE / 2, borderColor: RULE, borderWidth: 1 });
        y = Math.min(y, headerTop - AVATAR_SIZE - 6);
    }

    page.drawLine({
        start: { x: MARGIN_X, y: y - 4 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: y - 4 },
        thickness: 1,
        color: INK
    });
    y -= 14;

    if (data.profile.bio?.trim()) {
        sectionHeader('Summary');
        paragraph(sans, data.profile.bio, 9.5, 13.5);
        y -= 4;
    }

    if (data.experiences.length > 0) {
        sectionHeader('Experience');
        for (const exp of data.experiences) {
            entryHeader(exp.title, formatDateRange(exp.start_date, exp.end_date, exp.currently_in));
            const meta = [exp.company, exp.type, exp.location, exp.loc_type]
                .map(part => fit(sansItalic, part))
                .filter(Boolean)
                .join(' · ');
            paragraph(sansItalic, meta, 9.5, 13.5, MUTED);
            y -= 2;
            const items = bulletItems(exp.description);
            if (items.length > 1) bullets(items);
            else paragraph(sans, items[0], 9, 12.5);
            y -= 8;
        }
    }

    if (data.projects.length > 0) {
        sectionHeader('Projects');
        for (const project of data.projects) {
            entryHeader(project.name, project.lang ?? '');
            const address = fit(mono, displayUrl(project.url));
            if (address) {
                ensure(12);
                put(mono, address, MARGIN_X, 8, MUTED);
                link(MARGIN_X, mono.font.widthOfTextAtSize(address, 8), 10, project.url);
                y -= 12;
            }
            if (project.desc && project.desc !== PLACEHOLDER_DESCRIPTION)
                paragraph(sans, project.desc, 9, 12.5);
            y -= 7;
        }
    }

    if (data.educations.length > 0) {
        sectionHeader('Education');
        for (const edu of data.educations) {
            entryHeader(
                edu.institution,
                formatDateRange(edu.start_date, edu.end_date, edu.currently_in)
            );
            const gpa = gpaDisplay(edu.grade);
            const fieldRedundant =
                !!edu.field
                && !!edu.degree
                && edu.degree.toLowerCase().includes(edu.field.toLowerCase());
            const meta = [edu.degree, fieldRedundant ? '' : edu.field, gpa ? `GPA ${gpa}` : '']
                .map(part => fit(sansItalic, part))
                .filter(Boolean)
                .join(' · ');
            paragraph(sansItalic, meta, 9.5, 13.5, MUTED);
            y -= 2;
            paragraph(sans, edu.description, 9, 12.5);
            y -= 8;
        }
    }

    const skills = data.skills.filter(category => category.items.length > 0);
    if (skills.length > 0) {
        sectionHeader('Skills');
        const labelWidth = Math.min(
            Math.max(
                ...skills.map(category =>
                    sansBold.font.widthOfTextAtSize(`${fit(sansBold, category.category)}`, 9)
                )
            ) + 14,
            CONTENT_WIDTH * 0.35
        );
        for (const category of skills) {
            const labels = wrap(sansBold, category.category, 9, labelWidth - 10);
            const items = wrap(sans, category.items.join(', '), 9, CONTENT_WIDTH - labelWidth);
            const rows = Math.max(labels.length, items.length);
            ensure(rows * 13);
            for (let row = 0; row < rows; row++) {
                if (labels[row]) put(sansBold, labels[row], MARGIN_X, 9, INK);
                if (items[row]) put(sans, items[row], MARGIN_X + labelWidth, 9);
                y -= 13;
                if (row < rows - 1) ensure(13);
            }
            y -= 3;
        }
    }

    pages.forEach((target, index) => {
        const footer = fit(
            sans,
            `${name} · Curriculum Vitae · Page ${index + 1} of ${pages.length}`
        );
        const width = sans.font.widthOfTextAtSize(footer, 7.5);
        target.drawText(footer, {
            x: (PAGE_WIDTH - width) / 2,
            y: MARGIN_BOTTOM - 26,
            size: 7.5,
            font: sans.font,
            color: MUTED
        });
    });

    return await pdfDoc.save();
}
