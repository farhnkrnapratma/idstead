import { cvDocumentContract, type CvDocumentSeed } from './contracts/cvDocuments.contract.ts';
import { d1AuthorRows } from './support/authorTables.ts';
import {
    createD1CvDocumentStore,
    createD1OpenPgpKeyStore
} from '../packages/data/src/d1/cvDocuments.ts';
import { d1Shim, insertRows } from './support/d1.ts';

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
