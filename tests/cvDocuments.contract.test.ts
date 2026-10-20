import {
    createSupabaseCvDocumentStore,
    createSupabaseOpenPgpKeyStore
} from '../packages/data/src/supabase/cvDocuments.ts';
import { cvDocumentContract, type CvDocumentSeed } from './contracts/cvDocuments.contract.ts';
import { authorTables } from './support/authorTables.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';

function supabaseFromSeed(seed: CvDocumentSeed) {
    const tables = authorTables(seed.author);
    tables.db_document_snapshots = seed.snapshots.map(snapshot => ({
        document_id: snapshot.documentUuid,
        content: snapshot.content
    }));
    let sequence = 0;
    const { db } = fakeSupabase(
        tables,
        {},
        {
            defaults: {
                db_documents: () => ({
                    id: `00000000-0000-4000-8000-0000000009${String(++sequence).padStart(2, '0')}`,
                    signed_at: null,
                    signer_fingerprint: null
                })
            }
        }
    );
    return {
        documents: createSupabaseCvDocumentStore(db),
        keys: createSupabaseOpenPgpKeyStore(db)
    };
}

cvDocumentContract('Supabase adapter', supabaseFromSeed);
