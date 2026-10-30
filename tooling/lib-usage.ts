import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const libSrc = path.join(root, 'packages/lib/src');
const barrel = path.join(libSrc, 'index.ts');
const consumers = {
    web: path.join(root, 'apps/web/src'),
    admin: path.join(root, 'apps/admin/src'),
    api: path.join(root, 'apps/api/src'),
    jobs: path.join(root, 'apps/jobs/src'),
    tests: path.join(root, 'tests'),
    scripts: path.join(root, 'scripts')
};
type Consumer = keyof typeof consumers;
const appNames: Consumer[] = ['web', 'admin', 'api', 'jobs'];

const sourceFiles = new Bun.Glob('**/*.{ts,js,svelte}');
const resolveSuffixes = ['', '.ts', '.js', '.svelte', '.svelte.ts', '/index.ts'];
const specifierPattern =
    /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g;

interface ImportRef {
    spec: string;
    names: string[] | null;
}

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return [...sourceFiles.scanSync({ cwd: dir, absolute: true })].filter(
        file =>
            !file.endsWith('.d.ts')
            && !path.relative(dir, file).split(path.sep).includes('node_modules')
    );
}

function importedNames(statement: string): string[] | null {
    const braces = statement.match(/\{([^}]*)\}/);
    if (!braces) return null;
    return braces[1]
        .split(',')
        .map(part => part.trim().replace(/^type\s+/, ''))
        .filter(Boolean)
        .map(part =>
            part
                .split(/\s+as\s+/)
                .pop()!
                .trim()
        );
}

function exportedNames(statement: string): Map<string, string> {
    const names = new Map<string, string>();
    const braces = statement.match(/\{([^}]*)\}/);
    if (!braces) return names;
    for (const part of braces[1].split(',')) {
        const [, alias] = part
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/);
        const name = (alias ?? part.trim().replace(/^type\s+/, '')).trim();
        if (name) names.set(name, statement);
    }
    return names;
}

function declaredExports(file: string): string[] {
    const source = readFileSync(file, 'utf8');
    const names = [
        ...source.matchAll(
            /export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([\w$]+)/g
        )
    ].map(match => match[1]);
    for (const match of source.matchAll(/export\s*(?:type\s*)?\{[^}]*\}/g)) {
        names.push(...exportedNames(match[0]).keys());
    }
    return names;
}

function imports(file: string): ImportRef[] {
    const found: ImportRef[] = [];
    for (const match of readFileSync(file, 'utf8').matchAll(specifierPattern)) {
        const spec = match[1] ?? match[2] ?? match[3] ?? match[4];
        if (!spec) continue;
        found.push({
            spec: spec.replace(/\?.*$/, ''),
            names: match[1] ? importedNames(match[0]) : null
        });
    }
    return found;
}

function resolveFile(base: string): string | null {
    for (const suffix of resolveSuffixes) {
        const candidate = base + suffix;
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
}

function resolveLibImport(spec: string, fromFile: string): string | null {
    if (spec === '#lib' || spec === '@idstead/lib') return barrel;
    if (spec.startsWith('#lib/')) return resolveFile(path.join(libSrc, spec.slice(5)));
    if (spec.startsWith('@idstead/lib/')) return resolveFile(path.join(libSrc, spec.slice(9)));
    if (spec.startsWith('.')) return resolveFile(path.resolve(path.dirname(fromFile), spec));
    return null;
}

function isLibFile(file: string): boolean {
    return file.startsWith(libSrc + path.sep);
}

const barrelExports = new Map<string, string>();
for (const match of readFileSync(barrel, 'utf8').matchAll(specifierPattern)) {
    if (!match[1]) continue;
    const target = resolveLibImport(match[1].replace(/\?.*$/, ''), barrel);
    if (!target) continue;
    const names =
        /^export\s+\*/.test(match[0]) ?
            declaredExports(target)
        :   [...exportedNames(match[0]).keys()];
    for (const name of names) barrelExports.set(name, target);
}

function libTargets(file: string): string[] {
    const targets = new Set<string>();
    for (const { spec, names } of imports(file)) {
        const target = resolveLibImport(spec, file);
        if (!target || !isLibFile(target)) continue;
        if (target === barrel && file !== barrel && names) {
            for (const name of names) targets.add(barrelExports.get(name) ?? barrel);
            continue;
        }
        targets.add(target);
    }
    return [...targets];
}

const libFiles = walk(libSrc);
const libGraph = new Map(libFiles.map(file => [file, libTargets(file)] as const));

function reachableFrom(entries: Iterable<string>): Set<string> {
    const seen = new Set<string>();
    const queue = [...entries];
    while (queue.length > 0) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        queue.push(...(libGraph.get(file) ?? []));
    }
    return seen;
}

const reach = new Map<Consumer, Set<string>>();
const direct = new Map<Consumer, Set<string>>();
for (const [name, dir] of Object.entries(consumers) as [Consumer, string][]) {
    const entries = new Set(walk(dir).flatMap(libTargets));
    direct.set(name, entries);
    reach.set(name, reachableFrom(entries));
}

function classify(file: string): string {
    const apps = appNames.filter(name => reach.get(name)!.has(file));
    if (apps.length === 0) {
        const others = (Object.keys(consumers) as Consumer[]).filter(name =>
            reach.get(name)!.has(file)
        );
        return others.length === 0 ? 'unused' : `only ${others.join('+')}`;
    }
    if (apps.length === 1) return `${apps[0]}-only`;
    return `shared: ${apps.join('+')}`;
}

const rows = libFiles
    .map(file => ({
        file: path.relative(libSrc, file),
        group: classify(file),
        directApps: appNames.filter(name => direct.get(name)!.has(file))
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.file.localeCompare(b.file));

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 4));
} else {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
    for (const [group, items] of groups) {
        console.log(`\n${group} (${items.length})`);
        for (const item of items) {
            const note =
                item.directApps.length > 0 ? `  [direct: ${item.directApps.join(', ')}]` : '';
            console.log(`  ${item.file}${note}`);
        }
    }
    console.log(`\n${libFiles.length} files in packages/lib/src`);
}
