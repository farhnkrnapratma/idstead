const GITHUB_ALERT_RE = /^( {0,3})> ?\[!(note|tip|important|warning|caution)\][ \t]*$/i;

export function convertGithubAlerts(markdown: string): string {
    if (!/\[!/.test(markdown)) return markdown;
    const lines = markdown.split('\n');
    const output: string[] = [];
    let fence = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const boundary = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (
                boundary
                && boundary[1][0] === fence[0]
                && boundary[1].length >= fence.length
                && !boundary[2].trim()
            )
                fence = '';
            output.push(line);
            continue;
        }
        if (boundary) {
            fence = boundary[1];
            output.push(line);
            continue;
        }
        const alert = line.replace(/\r$/, '').match(GITHUB_ALERT_RE);
        if (!alert) {
            output.push(line);
            continue;
        }
        const indent = alert[1];
        const quote = new RegExp(`^${indent}> ?`);
        const body: string[] = [];
        while (
            i + 1 < lines.length
            && quote.test(lines[i + 1])
            && !/^\s*>\s*>/.test(lines[i + 1].slice(indent.length))
        ) {
            body.push(indent + lines[++i].replace(quote, ''));
        }
        output.push(`${indent}:::${alert[2].toLowerCase()}`, ...body, `${indent}:::`);
    }
    return output.join('\n');
}
