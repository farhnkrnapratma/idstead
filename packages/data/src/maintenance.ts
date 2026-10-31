// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface MaintenanceStore {
    pruneStaleSubscriptions(): Promise<number>;
    pruneActivityLog(): Promise<number>;
    pruneLockoutFailures(): Promise<number>;
}
