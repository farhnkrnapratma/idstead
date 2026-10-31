// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
    resumeDocumentContract,
    type ResumeDocumentSeed
} from './contracts/resumeDocuments.contract.ts';
import { d1AuthorRows } from './support/authorTables.ts';
import {
    createD1ResumeDocumentStore,
    createD1OpenPgpKeyStore
} from '../packages/data/src/d1/resumeDocuments.ts';
import { d1Shim, insertRows } from './support/d1.ts';

function d1FromSeed(seed: ResumeDocumentSeed) {
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
    return { documents: createD1ResumeDocumentStore(db), keys: createD1OpenPgpKeyStore(db) };
}

resumeDocumentContract('D1 adapter', d1FromSeed);
