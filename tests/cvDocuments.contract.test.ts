import {
    createSupabaseCvDocumentStore,
    createSupabaseOpenPgpKeyStore
} from '../packages/data/src/supabase/cvDocuments.ts';
import { cvDocumentContract, type CvDocumentSeed } from './contracts/cvDocuments.contract.ts';
import { authorTables, d1AuthorRows } from './support/authorTables.ts';
import {
    createD1CvDocumentStore,
    createD1OpenPgpKeyStore
} from '../packages/data/src/d1/cvDocuments.ts';
import { d1Shim, insertRows } from './support/d1.ts';
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

function d1FromSeed(seed: CvDocumentSeed) {
    const { db, sqlite } = d1Shim();
    for (const [table, rows] of Object.entries(d1AuthorRows(seed.author)))
        insertRows(sqlite, table, rows);
    insertRows(
        sqlite,
        'db_document_snapshots',
        seed.snapshots.map(snapshot => ({
            document_id: snapshot.documentUuid,
            content: JSON.stringify(snapshot.content)
        }))
    );
    return { documents: createD1CvDocumentStore(db), keys: createD1OpenPgpKeyStore(db) };
}

cvDocumentContract('D1 adapter', d1FromSeed);
