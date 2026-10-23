import { describe, expect, test } from 'bun:test';
import {
    ADMIN_AUTHOR_SEED,
    adminAuthorContract,
    type AdminAuthorSeed
} from './contracts/adminAuthor.contract.ts';
import { authorFetch, d1AuthorRows } from './support/authorTables.ts';
import {
    createD1AdminAuthorStore,
    createD1AuthorWriter
} from '../packages/data/src/d1/adminAuthor.ts';
import { d1Shim, insertRows } from './support/d1.ts';

const NEW_PROFILE = '00000000-0000-4000-8000-000000000777';

function d1FromSeed(seed: AdminAuthorSeed) {
    const shim = d1Shim();
    const rows = d1AuthorRows(seed.author);
    rows.db_identity_versions = rows.db_identity_versions.map(row => {
        const version = seed.identityVersions.find(item => item.uuid === row.id);
        return version ?
                {
                    ...row,
                    avatar_source: version.source,
                    avatar_fingerprint: version.source === 'generated' ? version.fingerprint : null
                }
            :   row;
    });
    for (const [table, list] of Object.entries(rows)) insertRows(shim.sqlite, table, list);
    return {
        ...shim,
        store: createD1AdminAuthorStore(shim.db, { fetch: authorFetch(seed.author) }),
        writer: createD1AuthorWriter(shim.db)
    };
}

adminAuthorContract('D1 adapter', d1FromSeed);
