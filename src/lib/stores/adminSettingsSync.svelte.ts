import {supabase} from '#lib/supabase.ts';
import {parseAdminSettings} from '#lib/adminSettings.ts';
import {adminDisplayStore} from './adminDisplayStore.svelte';
import {adminChartRangeStore} from './adminChartRangeStore.svelte';

const ENDPOINT = '/api/internal/admin/settings';
const SAVE_DELAY_MS = 600;

export function startAdminSettingsSync() {
  let stopped = false;
  let ready = $state(false);
  let synced = '';

  const snapshot = () =>
    JSON.stringify({
      display: adminDisplayStore.current,
      chartRange: adminChartRangeStore.current
    });

  async function request(init?: RequestInit) {
    const {data} = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return fetch(ENDPOINT, {
      ...init,
      headers: {...init?.headers, Authorization: `Bearer ${token}`}
    });
  }

  async function hydrate() {
    adminChartRangeStore.init();
    try {
      const res = await request();
      if (stopped || !res?.ok) return;
      const settings = parseAdminSettings(await res.json());
      const hasRemote = Boolean(settings.display || settings.chartRange);
      if (settings.display) adminDisplayStore.apply(settings.display);
      if (settings.chartRange) adminChartRangeStore.set(settings.chartRange);
      synced = hasRemote ? snapshot() : '';
      ready = true;
    } catch {}
  }

  async function save(body: string) {
    try {
      const res = await request({
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body
      });
      if (res?.ok) synced = body;
    } catch {}
  }

  const stopEffect = $effect.root(() => {
    $effect(() => {
      const body = snapshot();
      if (!ready || body === synced) return;
      const timer = setTimeout(() => void save(body), SAVE_DELAY_MS);
      return () => clearTimeout(timer);
    });
  });

  void hydrate();

  return () => {
    stopped = true;
    stopEffect();
  };
}
