export type FilterToolbarControlSize = 'sm' | 'md';

export type FilterToolbarContext = {
  get controlSize(): FilterToolbarControlSize;
};

export const FILTER_TOOLBAR_CONTROL_SIZE = Symbol('filterToolbarControlSize');
