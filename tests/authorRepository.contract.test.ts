import { createSupabaseAuthorRepository } from '../packages/data/src/supabase/author.ts';
import {
    authorRepositoryContract,
    type AuthorSeed
} from './contracts/authorRepository.contract.ts';
import { authorFetch, authorTables, d1AuthorRows } from './support/authorTables.ts';
import { createD1AuthorRepository } from '../packages/data/src/d1/author.ts';
import { d1Shim, insertRows } from './support/d1.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';

function supabaseFromSeed(seed: AuthorSeed) {
    const { db } = fakeSupabase(authorTables(seed));
    return createSupabaseAuthorRepository(db, { fetch: authorFetch(seed) });
}

authorRepositoryContract('Supabase adapter', supabaseFromSeed);

function d1FromSeed(seed: AuthorSeed) {
    const { db, sqlite } = d1Shim();
    for (const [table, rows] of Object.entries(d1AuthorRows(seed))) insertRows(sqlite, table, rows);
    return createD1AuthorRepository(db, { fetch: authorFetch(seed) });
}

authorRepositoryContract('D1 adapter', d1FromSeed);
