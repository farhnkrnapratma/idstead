export const ADMIN_CHART_AXIS_CLASSES = {
    tickLabel: 'text-xxs fill-text-muted font-mono',
    rule: 'stroke-border-subtle'
};

export const ADMIN_CHART_PADDING = { top: 16, right: 48, bottom: 48, left: 64 };

export const ADMIN_CHART_TICK_LENGTH = 6;

const tickLabelBase = { stroke: 'none', strokeWidth: 0, capHeight: '9px', lineHeight: '14px' };

export const ADMIN_CHART_X_TICK_LABEL_PROPS = { ...tickLabelBase, dy: 20 };

export const ADMIN_CHART_Y_TICK_LABEL_PROPS = { ...tickLabelBase, dx: -20 };
