import {PDFDocument, StandardFonts, rgb, PDFFont} from 'pdf-lib';

export interface AuthorProfileData {
  name: string;
  title?: string;
  bio?: string;
  avatar?: string;
  email?: string;
  website?: string;
  location?: string;
}

export interface ExperienceData {
  role: string;
  company: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
}

export interface EducationData {
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface SkillCategoryData {
  category: string;
  items: string[];
}

export interface AuthorCvData {
  profile: AuthorProfileData;
  experiences: ExperienceData[];
  educations: EducationData[];
  skills: SkillCategoryData[];
}

export function sanitizePdfText(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&#x2F;/gi, '/')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');
}

function formatDateRange(
  start?: string,
  end?: string,
  isCurrent?: boolean
): string {
  const formatMonthYear = (val?: string) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const sStr = formatMonthYear(start);
  const eStr = isCurrent ? 'Present' : formatMonthYear(end);

  if (sStr && eStr) return `${sStr} - ${eStr}`;
  if (sStr) return `${sStr} - Present`;
  if (eStr) return eStr;
  return '';
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const cleanText = sanitizePdfText(text);
  const words = cleanText.replace(/\r\n/g, '\n').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateCvPdfBuffer(
  data: AuthorCvData,
  cdnBaseUrl?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let avatarImage: any = null;
  if (data.profile.avatar) {
    try {
      const avatar = data.profile.avatar.trim();
      const isAbsolute =
        avatar.startsWith('http://') || avatar.startsWith('https://');
      const resolvedCdn = (
        cdnBaseUrl
        || process.env.PUBLIC_CDN_BASE_URL
        || ''
      ).replace(/\/+$/, '');

      const avatarUrl =
        isAbsolute ? avatar
        : resolvedCdn ?
          `${resolvedCdn}${avatar.startsWith('/') ? '' : '/'}${avatar}`
        : '';

      if (avatarUrl) {
        const resp = await fetch(avatarUrl);
        if (resp.ok) {
          const imageBytes = await resp.arrayBuffer();
          const uint8 = new Uint8Array(imageBytes);
          if (uint8[0] === 0x89 && uint8[1] === 0x50) {
            avatarImage = await pdfDoc.embedPng(imageBytes);
          } else if (uint8[0] === 0xff && uint8[1] === 0xd8) {
            avatarImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            try {
              avatarImage = await pdfDoc.embedPng(imageBytes);
            } catch {
              avatarImage = await pdfDoc.embedJpg(imageBytes);
            }
          }
        }
      }
    } catch {
      avatarImage = null;
    }
  }

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 45;
  const MARGIN_RIGHT = 45;
  const MARGIN_TOP = 45;
  const MARGIN_BOTTOM = 45;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const pages: any[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const checkPageOverflow = (neededHeight: number) => {
    if (y - neededHeight < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  const AVATAR_SIZE = 54;
  const headerLeftWidth =
    avatarImage ? CONTENT_WIDTH - AVATAR_SIZE - 18 : CONTENT_WIDTH;

  if (avatarImage) {
    const avatarY = y - AVATAR_SIZE;
    page.drawImage(avatarImage, {
      x: PAGE_WIDTH - MARGIN_RIGHT - AVATAR_SIZE,
      y: avatarY,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE
    });
    page.drawRectangle({
      x: PAGE_WIDTH - MARGIN_RIGHT - AVATAR_SIZE,
      y: avatarY,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderColor: rgb(0.82, 0.85, 0.9),
      borderWidth: 0.75
    });
  }

  const nameText = sanitizePdfText(data.profile.name || 'Curriculum Vitae');
  page.drawText(nameText, {
    x: MARGIN_LEFT,
    y: y - 20,
    size: 20,
    font: fontBold,
    color: rgb(0.09, 0.13, 0.22)
  });
  y -= 26;

  if (data.profile.title) {
    const titleLines = wrapText(
      data.profile.title,
      fontRegular,
      11,
      headerLeftWidth
    );
    for (const tl of titleLines) {
      page.drawText(tl, {
        x: MARGIN_LEFT,
        y: y - 10,
        size: 11,
        font: fontRegular,
        color: rgb(0.25, 0.32, 0.44)
      });
      y -= 14;
    }
  }

  const contactParts: string[] = [];
  if (data.profile.email)
    contactParts.push(sanitizePdfText(data.profile.email));
  if (data.profile.location)
    contactParts.push(sanitizePdfText(data.profile.location));
  if (data.profile.website)
    contactParts.push(
      sanitizePdfText(data.profile.website.replace(/^https?:\/\//, ''))
    );

  if (contactParts.length > 0) {
    const contactLine = contactParts.join('  ·  ');
    const contactLines = wrapText(contactLine, fontRegular, 9, headerLeftWidth);
    for (const cl of contactLines) {
      page.drawText(cl, {
        x: MARGIN_LEFT,
        y: y - 9,
        size: 9,
        font: fontRegular,
        color: rgb(0.42, 0.48, 0.56)
      });
      y -= 13;
    }
  }

  if (avatarImage && y > PAGE_HEIGHT - MARGIN_TOP - AVATAR_SIZE - 6) {
    y = PAGE_HEIGHT - MARGIN_TOP - AVATAR_SIZE - 6;
  }

  y -= 6;
  page.drawLine({
    start: {x: MARGIN_LEFT, y},
    end: {x: PAGE_WIDTH - MARGIN_RIGHT, y},
    thickness: 1,
    color: rgb(0.85, 0.88, 0.93)
  });
  y -= 16;

  const drawSectionHeader = (title: string) => {
    checkPageOverflow(32);
    page.drawText(title.toUpperCase(), {
      x: MARGIN_LEFT,
      y: y - 11,
      size: 10.5,
      font: fontBold,
      color: rgb(0.09, 0.13, 0.22)
    });
    y -= 15;
    page.drawLine({
      start: {x: MARGIN_LEFT, y},
      end: {x: PAGE_WIDTH - MARGIN_RIGHT, y},
      thickness: 0.75,
      color: rgb(0.88, 0.9, 0.94)
    });
    y -= 12;
  };

  if (data.profile.bio && data.profile.bio.trim()) {
    drawSectionHeader('Summary');
    const bioLines = wrapText(
      data.profile.bio.trim(),
      fontRegular,
      9.5,
      CONTENT_WIDTH
    );
    for (const line of bioLines) {
      checkPageOverflow(14);
      page.drawText(line, {
        x: MARGIN_LEFT,
        y: y - 10,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.2, 0.24, 0.3)
      });
      y -= 13.5;
    }
    y -= 8;
  }

  if (data.experiences && data.experiences.length > 0) {
    drawSectionHeader('Work Experience');

    for (const exp of data.experiences) {
      const dateStr = formatDateRange(
        exp.start_date,
        exp.end_date,
        exp.is_current
      );
      checkPageOverflow(34);

      page.drawText(sanitizePdfText(exp.role), {
        x: MARGIN_LEFT,
        y: y - 11,
        size: 10.5,
        font: fontBold,
        color: rgb(0.1, 0.14, 0.22)
      });

      if (dateStr) {
        const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 9);
        page.drawText(dateStr, {
          x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
          y: y - 11,
          size: 9,
          font: fontRegular,
          color: rgb(0.45, 0.5, 0.58)
        });
      }
      y -= 15;

      const compLoc = [
        sanitizePdfText(exp.company),
        sanitizePdfText(exp.location)
      ]
        .filter(Boolean)
        .join('  ·  ');
      page.drawText(compLoc, {
        x: MARGIN_LEFT,
        y: y - 10,
        size: 9.5,
        font: fontOblique,
        color: rgb(0.3, 0.38, 0.48)
      });
      y -= 13;

      if (exp.description && exp.description.trim()) {
        const descParagraphs = exp.description
          .trim()
          .split('\n')
          .filter(Boolean);
        for (const para of descParagraphs) {
          const cleanPara = para.replace(/^[-•*]\s*/, '').trim();
          const pLines = wrapText(
            cleanPara,
            fontRegular,
            9,
            CONTENT_WIDTH - 12
          );
          for (let i = 0; i < pLines.length; i++) {
            checkPageOverflow(13);
            const prefix = i === 0 ? '· ' : '  ';
            page.drawText(`${prefix}${pLines[i]}`, {
              x: MARGIN_LEFT + 4,
              y: y - 9,
              size: 9,
              font: fontRegular,
              color: rgb(0.22, 0.26, 0.32)
            });
            y -= 12.5;
          }
        }
      }
      y -= 8;
    }
    y -= 4;
  }

  if (data.educations && data.educations.length > 0) {
    drawSectionHeader('Education');

    for (const edu of data.educations) {
      const dateStr = formatDateRange(edu.start_date, edu.end_date);
      checkPageOverflow(30);

      const headerText = [
        sanitizePdfText(edu.institution),
        sanitizePdfText(edu.degree)
      ]
        .filter(Boolean)
        .join('  ·  ');
      page.drawText(headerText, {
        x: MARGIN_LEFT,
        y: y - 11,
        size: 10.5,
        font: fontBold,
        color: rgb(0.1, 0.14, 0.22)
      });

      if (dateStr) {
        const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 9);
        page.drawText(dateStr, {
          x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
          y: y - 11,
          size: 9,
          font: fontRegular,
          color: rgb(0.45, 0.5, 0.58)
        });
      }
      y -= 15;

      if (edu.field_of_study) {
        page.drawText(sanitizePdfText(edu.field_of_study), {
          x: MARGIN_LEFT,
          y: y - 10,
          size: 9.5,
          font: fontOblique,
          color: rgb(0.3, 0.38, 0.48)
        });
        y -= 13;
      }

      if (edu.description && edu.description.trim()) {
        const eLines = wrapText(
          edu.description.trim(),
          fontRegular,
          9,
          CONTENT_WIDTH
        );
        for (const line of eLines) {
          checkPageOverflow(13);
          page.drawText(line, {
            x: MARGIN_LEFT,
            y: y - 9,
            size: 9,
            font: fontRegular,
            color: rgb(0.24, 0.28, 0.34)
          });
          y -= 12.5;
        }
      }
      y -= 8;
    }
    y -= 4;
  }

  if (data.skills && data.skills.length > 0) {
    drawSectionHeader('Skills & Expertise');

    for (const cat of data.skills) {
      if (!cat.items || cat.items.length === 0) continue;
      checkPageOverflow(18);

      const categoryLabel = `${sanitizePdfText(cat.category)}: `;
      const catWidth = fontBold.widthOfTextAtSize(categoryLabel, 9.5);

      page.drawText(categoryLabel, {
        x: MARGIN_LEFT,
        y: y - 10,
        size: 9.5,
        font: fontBold,
        color: rgb(0.12, 0.18, 0.28)
      });

      const itemsStr = cat.items.map(sanitizePdfText).join(', ');
      const itemLines = wrapText(
        itemsStr,
        fontRegular,
        9.5,
        CONTENT_WIDTH - catWidth
      );

      if (itemLines.length > 0) {
        page.drawText(itemLines[0], {
          x: MARGIN_LEFT + catWidth,
          y: y - 10,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.22, 0.26, 0.32)
        });
        y -= 13.5;

        for (let i = 1; i < itemLines.length; i++) {
          checkPageOverflow(14);
          page.drawText(itemLines[i], {
            x: MARGIN_LEFT + catWidth,
            y: y - 10,
            size: 9.5,
            font: fontRegular,
            color: rgb(0.22, 0.26, 0.32)
          });
          y -= 13.5;
        }
      } else {
        y -= 13.5;
      }
      y -= 3;
    }
  }

  const totalPages = pages.length;
  for (let idx = 0; idx < totalPages; idx++) {
    const p = pages[idx];
    const footerText = `${nameText}  ·  Curriculum Vitae  ·  Page ${idx + 1} of ${totalPages}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8);
    p.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: MARGIN_BOTTOM - 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.55, 0.6, 0.68)
    });
  }

  return await pdfDoc.save();
}
