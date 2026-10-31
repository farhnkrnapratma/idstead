import { apiUrl } from '../apiConfig';

export function discoveryLinks(apiBase: string | undefined): string[] {
    return [
        '</.well-known/api-catalog>; rel="api-catalog"',
        `<${apiUrl('/openapi.json', apiBase)}>; rel="service-desc"; type="application/json"`,
        `<${apiUrl('', apiBase)}>; rel="service-doc"; type="text/markdown"`,
        '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
        '</.well-known/ard.json>; rel="ard"; type="application/json"',
        '</llms.txt>; rel="describedby"; type="text/markdown"',
        '</sitemap.xml>; rel="sitemap"; type="application/xml"'
    ];
}
