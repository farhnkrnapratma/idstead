export function sanitizePublicApiData(obj: any): any {
    if (Array.isArray(obj)) {
        const cleanedArr = obj
            .map(item => sanitizePublicApiData(item))
            .filter(item => item !== null && item !== undefined);
        return cleanedArr;
    }

    if (obj !== null && typeof obj === 'object') {
        const cleaned: Record<string, any> = {};

        const hasEndDate =
            obj.endMonth !== null
            && obj.endMonth !== undefined
            && obj.endYear !== null
            && obj.endYear !== undefined;

        for (const [key, value] of Object.entries(obj)) {
            if (
                key === 'updatedAt'
                || key === 'createdAt'
                || key === 'revision'
                || key === 'avatarVersion'
                || key === 'bannerVersion'
                || key === 'manifestSettings'
                || key === 'id'
                || key === 'authorId'
                || key === 'author_id'
                || key === 'icon'
                || key === 'sortOrder'
                || key === 'sort_order'
                || key === 'firstName'
                || key === 'lastName'
                || key === 'email'
            ) {
                continue;
            }

            if (hasEndDate && key === 'currentlyIn') {
                continue;
            }

            if (key === 'description' && (!value || String(value).trim() === '')) {
                continue;
            }

            const valCleaned = sanitizePublicApiData(value);

            if (
                valCleaned === null
                || valCleaned === undefined
                || (Array.isArray(valCleaned) && valCleaned.length === 0)
                || (typeof valCleaned === 'object'
                    && !Array.isArray(valCleaned)
                    && Object.keys(valCleaned).length === 0)
            ) {
                continue;
            }

            cleaned[key] = valCleaned;
        }

        return cleaned;
    }

    return obj;
}

export function generateAuthorMarkdown(data: Record<string, any>): string {
    const lines: string[] = [];

    if (data.profile) {
        const p = data.profile;
        const pronunciation = p.pronunciation || '';
        lines.push(`# ${p.name || 'Profile'}${pronunciation ? ` (${pronunciation})` : ''}`);
        lines.push('');
        if (p.headline) lines.push(`**Headline**: ${p.headline}`);
        if (p.bio) {
            lines.push('');
            lines.push(`> ${p.bio}`);
        }
        lines.push('');
        if (p.city) lines.push(`- **City**: ${p.city}`);
        if (p.postalCode) lines.push(`- **Postal Code**: ${p.postalCode}`);
        if (p.country) lines.push(`- **Country**: ${p.country}`);
        if (p.siteUrl) lines.push(`- **Website**: ${p.siteUrl}`);
        lines.push('');
    }

    if (data.resume && (data.resume.experience?.length || data.resume.education?.length)) {
        if (data.resume.experience && data.resume.experience.length > 0) {
            lines.push('## Work Experience');
            lines.push('');
            data.resume.experience.forEach((exp: any) => {
                const start = `${exp.startMonth || ''} ${exp.startYear || ''}`.trim();
                const end =
                    exp.currentlyIn ? 'Present' : (
                        `${exp.endMonth || ''} ${exp.endYear || ''}`.trim()
                    );
                const locParts = [exp.location, exp.locType ? `(${exp.locType})` : '']
                    .filter(Boolean)
                    .join(' ');
                const locStr = locParts ? ` | ${locParts}` : '';
                lines.push(`### ${exp.title} — ${exp.company}`);
                lines.push(`*${start} – ${end}${locStr}*`);
                if (exp.description) {
                    lines.push('');
                    lines.push(exp.description);
                }
                lines.push('');
            });
        }

        if (data.resume.education && data.resume.education.length > 0) {
            lines.push('## Education');
            lines.push('');
            data.resume.education.forEach((edu: any) => {
                const start = `${edu.startMonth || ''} ${edu.startYear || ''}`.trim();
                const end =
                    edu.currentlyIn ? 'Present' : (
                        `${edu.endMonth || ''} ${edu.endYear || ''}`.trim()
                    );
                lines.push(`### ${edu.degree} in ${edu.field} — ${edu.institution}`);
                lines.push(`*${start} – ${end}${edu.grade ? ` | GPA: ${edu.grade}` : ''}*`);
                if (edu.description) {
                    lines.push('');
                    lines.push(edu.description);
                }
                lines.push('');
            });
        }
    }

    if (data.skills && data.skills.length > 0) {
        lines.push('## Technical Skills');
        lines.push('');
        data.skills.forEach((cat: any) => {
            const itemsList =
                Array.isArray(cat.items) ? cat.items.join(', ')
                : Array.isArray(cat.skills) ? cat.skills.join(', ')
                : '';
            lines.push(`- **${cat.category}**: ${itemsList}`);
        });
        lines.push('');
    }

    if (data.funding && data.funding.length > 0) {
        lines.push('## Open Source Funding');
        lines.push('');
        data.funding.forEach((f: any) => {
            const title = f.platform || 'Funding';
            const label = f.displayValue || f.platform || f.url;
            lines.push(`- **${title}**: [${label}](${f.url})`);
        });
        lines.push('');
    }

    if (data.contact && data.contact.length > 0) {
        lines.push('## Contact');
        lines.push('');
        data.contact.forEach((c: any) => {
            const label = c.platform || c.label || 'Contact';
            const value = c.displayValue || c.value || c.href;
            const href = c.href || c.url || '#';
            lines.push(`- **${label}**: [${value}](${href})`);
        });
        lines.push('');
    }

    if (data.socials && data.socials.length > 0) {
        lines.push('## Social Media Profiles');
        lines.push('');
        data.socials.forEach((s: any) => {
            lines.push(`- **${s.platform}**: ${s.url}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}
