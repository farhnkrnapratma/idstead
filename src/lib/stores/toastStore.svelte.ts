export type ToastType = 'success' | 'error';

let message = $state('');
let type = $state<ToastType>('success');
let visible = $state(false);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function formatToastMessage(val: unknown): string {
  if (typeof val === 'string') return val;
  if (!val) return '';
  if (val instanceof Error && typeof val.message === 'string')
    return val.message;
  if (typeof val === 'object') {
    const obj = val as Record<string, any>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (
      obj.error
      && typeof obj.error === 'object'
      && typeof obj.error.message === 'string'
    ) {
      return obj.error.message;
    }
    if (typeof obj.msg === 'string') return obj.msg;
    try {
      const str = JSON.stringify(val);
      if (str && str !== '{}') return str;
    } catch {}
  }
  return String(val);
}

function show(
  text: unknown,
  toastType: ToastType = 'success',
  duration = 2500
) {
  message = formatToastMessage(text);
  type = toastType;
  visible = true;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    visible = false;
  }, duration);
}

function success(text: unknown, duration?: number) {
  show(text, 'success', duration);
}

function error(text: unknown, duration?: number) {
  show(text, 'error', duration);
}

export const toastStore = {
  get message() {
    return message;
  },
  get type() {
    return type;
  },
  get visible() {
    return visible;
  },
  show,
  success,
  error
};
