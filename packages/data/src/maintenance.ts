export interface MaintenanceStore {
    pruneStaleSubscriptions(): Promise<number>;
    pruneActivityLog(): Promise<number>;
    pruneLockoutFailures(): Promise<number>;
}
