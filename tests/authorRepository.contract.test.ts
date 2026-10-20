import { createSupabaseAuthorRepository } from '../packages/data/src/supabase/author.ts';
import {
    authorRepositoryContract,
    type AuthorSeed
} from './contracts/authorRepository.contract.ts';
import { authorFetch, authorTables } from './support/authorTables.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';

function supabaseFromSeed(seed: AuthorSeed) {
    const { db } = fakeSupabase(authorTables(seed));
    return createSupabaseAuthorRepository(db, { fetch: authorFetch(seed) });
}

authorRepositoryContract('Supabase adapter', supabaseFromSeed);
