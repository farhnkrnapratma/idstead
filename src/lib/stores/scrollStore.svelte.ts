import {browser} from '$app/environment';

function createScrollStore() {
  let progress = $state(0);
  let pastThreshold = $state(false);

  function handleScroll() {
    pastThreshold = window.scrollY > 300;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
  }

  function init() {
    if (!browser) return;
    handleScroll();
    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => window.removeEventListener('scroll', handleScroll);
  }

  return {
    get progress() {
      return progress;
    },
    get pastThreshold() {
      return pastThreshold;
    },
    init
  };
}

export const scrollStore = createScrollStore();
