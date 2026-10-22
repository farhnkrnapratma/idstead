export interface MaintenanceStore {
    pruneStaleSubscriptions(): Promise<number>;
    pruneActivityLog(): Promise<number>;
    pruneLoginFailures(): Promise<number>;
}
