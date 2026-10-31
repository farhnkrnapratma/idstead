// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ActivityLogRow {
    created_at: string;
    actor: string | null;
    action: string;
    category: string;
    summary: string;
    ip: string | null;
    user_agent: string | null;
}

function sanitizeText(str?: string | null): string {
    if (!str) return '';
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

function formatTimestamp(iso: string): string {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatActivityLogText(rows: ActivityLogRow[]): string {
    if (!rows.length) return 'No activity in the selected range.\n';
    return (
        rows
            .map(row =>
                [
                    `time: ${formatTimestamp(row.created_at)}`,
                    `category: ${row.category}`,
                    `action: ${row.action}`,
                    `actor: ${row.actor ?? 'unknown'}`,
                    `summary: ${sanitizeText(row.summary)}`,
                    `ip: ${row.ip ?? 'n/a'}`,
                    `user_agent: ${sanitizeText(row.user_agent) || 'n/a'}`
                ].join('\n')
            )
            .join('\n\n') + '\n'
    );
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;

export async function generateActivityLogPdf(rows: ActivityLogRow[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const drawTitle = () => {
        page.drawText('Activity Log', { x: MARGIN, y, size: 16, font: bold, color: rgb(0, 0, 0) });
        y -= 24;
    };
    drawTitle();

    const ensureSpace = (needed: number) => {
        if (y - needed < MARGIN) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            y = PAGE_HEIGHT - MARGIN;
        }
    };

    if (!rows.length) {
        page.drawText('No activity in the selected range.', { x: MARGIN, y, size: 10, font });
    }

    for (const row of rows) {
        ensureSpace(48);
        page.drawText(
            sanitizeText(
                `${formatTimestamp(row.created_at)}  [${row.category}] ${row.action}`
            ).slice(0, 100),
            { x: MARGIN, y, size: 9, font: bold, color: rgb(0, 0, 0) }
        );
        y -= 12;
        page.drawText(sanitizeText(row.summary).slice(0, 110), { x: MARGIN, y, size: 9, font });
        y -= 12;
        page.drawText(
            `actor: ${sanitizeText(row.actor) || 'unknown'}  ip: ${row.ip ?? 'n/a'}  ua: ${sanitizeText(row.user_agent).slice(0, 40)}`.slice(
                0,
                130
            ),
            { x: MARGIN, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
        );
        y -= 18;
    }

    return pdfDoc.save();
}
