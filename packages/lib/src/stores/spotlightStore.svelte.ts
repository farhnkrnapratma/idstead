import type { Component } from 'svelte';
import type { Project } from '@fkp/domain/types.ts';
import { COMMAND_SHORTCUTS } from '@fkp/ui/shortcuts.ts';
import { shortcutStore } from '@fkp/ui/stores/shortcutStore.svelte.ts';

export interface SpotlightDialogApi {
    open(initialQuery?: string): void;
    toggle(): void;
    focusOrOpen(initialQuery: string): void;
    runCommand(title: string): void;
}

const OPEN_COMMAND = '/open';

let dialogComponent = $state<Component | null>(null);
let projects = $state<Project[]>([]);
let hosts = $state<symbol[]>([]);
let api: SpotlightDialogApi | null = null;
let pending: ((dialog: SpotlightDialogApi) => void)[] = [];
let loading: Promise<void> | null = null;
let commandDisposers: (() => void)[] = [];

function load(): Promise<void> {
    if (!loading) {
        loading = import('../components/SpotlightDialog.svelte').then(
            module => {
                dialogComponent = module.default as Component;
            },
            error => {
                loading = null;
                pending = [];
                console.error('Could not load the search dialog:', error);
            }
        );
    }
    return loading;
}

function withDialog(run: (dialog: SpotlightDialogApi) => void) {
    if (api) {
        run(api);
        return;
    }
    pending.push(run);
    void load();
}

function registerCommands() {
    commandDisposers = Object.entries(COMMAND_SHORTCUTS).map(([title, key]) =>
        shortcutStore.registerCommand(key, title, () =>
            title === OPEN_COMMAND ?
                withDialog(dialog => dialog.open())
            :   withDialog(dialog => dialog.runCommand(title))
        )
    );
}

export const spotlightStore = {
    get dialog() {
        return dialogComponent;
    },
    get projects() {
        return projects;
    },
    isHost(id: symbol) {
        return hosts[0] === id;
    },
    join(id: symbol, initialProjects: Project[]) {
        if (initialProjects.length > 0) projects = initialProjects;
        if (hosts.length === 0) registerCommands();
        hosts = [...hosts, id];
        return () => {
            hosts = hosts.filter(host => host !== id);
            if (hosts.length > 0) return;
            commandDisposers.forEach(dispose => dispose());
            commandDisposers = [];
        };
    },
    setProjects(next: Project[]) {
        if (next.length > 0) projects = next;
    },
    prefetch() {
        void load();
    },
    attach(dialog: SpotlightDialogApi) {
        api = dialog;
        const queued = pending;
        pending = [];
        queued.forEach(run => run(dialog));
        return () => {
            if (api === dialog) api = null;
        };
    },
    open(initialQuery = '') {
        withDialog(dialog => dialog.open(initialQuery));
    },
    toggle() {
        withDialog(dialog => dialog.toggle());
    },
    focusOrOpen(initialQuery: string) {
        withDialog(dialog => dialog.focusOrOpen(initialQuery));
    }
};
