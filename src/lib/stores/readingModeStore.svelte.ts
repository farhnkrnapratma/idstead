let active = $state(false);

export const readingModeStore = {
  get active() {
    return active;
  },
  toggle() {
    active = !active;
  },
  enable() {
    active = true;
  },
  disable() {
    active = false;
  }
};
