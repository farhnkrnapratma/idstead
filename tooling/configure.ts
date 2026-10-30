import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import {
    InstanceConfigError,
    instanceVariables,
    resolveInstanceConfig,
    type InstanceConfig
} from '../packages/domain/src/instance.ts';

const ROOT = path.resolve(import.meta.dir, '..');
const APPS = ['web', 'admin', 'api', 'jobs'] as const;
const PLACEHOLDER = /^\{\{([\w.]+)\}\}$/;

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

function routes(config: InstanceConfig): Record<string, Value> {
    const route = (pattern: string) => ({ pattern, custom_domain: true });
    return {
        'routes.web': [
            route(config.domains.site),
            ...(config.domains.redirectWww ? [route(`www.${config.domains.site}`)] : [])
        ],
        'routes.admin': [route(config.domains.admin)],
        'routes.api': [route(config.domains.api)]
    };
}

function substitute(value: Value, variables: Record<string, Value>, file: string): Value {
    if (typeof value === 'string') {
        const match = value.match(PLACEHOLDER);
        if (!match) return value;
        if (!(match[1] in variables))
            throw new Error(`${file}: unknown placeholder {{${match[1]}}}.`);
        return variables[match[1]];
    }
    if (Array.isArray(value)) return value.map(item => substitute(item, variables, file));
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, substitute(item, variables, file)])
        );
    return value;
}

function databases(config: InstanceConfig): Record<string, Value> {
    const { name, id } = config.cloudflare.database;
    return {
        d1Databases:
            id ?
                [
                    {
                        binding: 'DB',
                        database_name: name,
                        database_id: id,
                        migrations_dir: '../../packages/data/d1/migrations'
                    }
                ]
            :   []
    };
}

export async function readInstanceConfig(file = path.join(ROOT, 'idstead.jsonc')) {
    return resolveInstanceConfig(Bun.JSONC.parse(await Bun.file(file).text()));
}

export async function renderWranglerConfigs(config: InstanceConfig) {
    const variables: Record<string, Value> = {
        ...instanceVariables(config),
        ...routes(config),
        ...databases(config)
    };
    const rendered: Record<string, string> = {};
    for (const app of APPS) {
        const template = path.join(ROOT, 'apps', app, 'wrangler.template.jsonc');
        const target = path.join(ROOT, 'apps', app, 'wrangler.jsonc');
        const parsed = Bun.JSONC.parse(await Bun.file(template).text()) as Value;
        const output = JSON.stringify(substitute(parsed, variables, template));
        const options = await resolveConfig(target);
        rendered[target] = await format(output, { ...options, filepath: target });
    }
    return rendered;
}

async function main() {
    const check = process.argv.includes('--check');
    let config: InstanceConfig;
    try {
        config = await readInstanceConfig();
    } catch (error) {
        if (error instanceof InstanceConfigError) {
            console.error(`idstead.jsonc: ${error.message}`);
            process.exit(1);
        }
        throw error;
    }
    const rendered = await renderWranglerConfigs(config);
    const stale: string[] = [];
    for (const [file, content] of Object.entries(rendered)) {
        const current = await Bun.file(file)
            .text()
            .catch(() => '');
        if (current === content) continue;
        if (check) stale.push(path.relative(ROOT, file));
        else await Bun.write(file, content);
    }
    if (check && stale.length) {
        console.error(
            `Out of date with idstead.jsonc: ${stale.join(', ')}. Run bun run configure.`
        );
        process.exit(1);
    }
    if (!check) console.log(`Rendered ${Object.keys(rendered).length} Wrangler configs.`);
}

if (import.meta.main) await main();
