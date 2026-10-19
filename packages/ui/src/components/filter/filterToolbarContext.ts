export type FilterToolbarControlSize = 'sm' | 'md';

export type FilterToolbarContext = {
    get controlSize(): FilterToolbarControlSize;
    get stackOnMobile(): boolean;
};

export const FILTER_TOOLBAR_CONTROL_SIZE = Symbol('filterToolbarControlSize');
