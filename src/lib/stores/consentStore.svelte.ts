import { SvelteDate } from 'svelte/reactivity';

export type ConsentStatus = 'granted' | 'denied';

export interface ConsentSignals {
    analytics_storage: ConsentStatus;
    ad_storage: ConsentStatus;
    ad_user_data: ConsentStatus;
    ad_personalization: ConsentStatus;
}

export type RetentionPeriod = '2_months' | '14_months';

export interface RetentionSettings {
    eventDataRetention: RetentionPeriod;
    userDataRetention: RetentionPeriod;
    lastUpdated?: string;
}

export interface StreamInfo {
    id: string;
    name: string;
    type: 'Web Stream' | 'iOS App' | 'Android App';
    measurementId: string;
    status: 'Active' | 'Warning' | 'Inactive';
}

const STORAGE_KEY = 'fkp_cookie_consent_v2';
const RETENTION_STORAGE_KEY = 'fkp_ga4_retention_settings';

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

export function createConsentStore() {
    let hasUserChosen = $state(false);
    let isBannerOpen = $state(false);
    let isCustomizeModalOpen = $state(false);
    let isSavingRetention = $state(false);
    let retentionSaveSuccess = $state(false);

    const signals = $state<ConsentSignals>({
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    });

    const retention = $state<RetentionSettings>({
        eventDataRetention: '14_months',
        userDataRetention: '14_months',
        lastUpdated: undefined
    });

    let selectedStreamId = $state<string>('stream-web-1');

    const streams: StreamInfo[] = [
        {
            id: 'stream-web-1',
            name: 'Web Analytics Stream',
            type: 'Web Stream',
            measurementId: 'G-6HR3DKWZLF',
            status: 'Active'
        }
    ];

    const isBehavioralActive = $derived(signals.analytics_storage === 'granted');
    const isAdvertisingActive = $derived(
        signals.ad_storage === 'granted'
            || signals.ad_user_data === 'granted'
            || signals.ad_personalization === 'granted'
    );

    const overallConsentStatus = $derived<'Good' | 'Setup needed' | 'Partial'>(
        !hasUserChosen ? 'Setup needed'
        : isBehavioralActive && isAdvertisingActive ? 'Good'
        : 'Partial'
    );

    function init() {
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                signals.analytics_storage = parsed.analytics_storage || 'denied';
                signals.ad_storage = parsed.ad_storage || 'denied';
                signals.ad_user_data = parsed.ad_user_data || 'denied';
                signals.ad_personalization = parsed.ad_personalization || 'denied';
                hasUserChosen = true;
            } else {
                isBannerOpen = true;
            }
        } catch {
            isBannerOpen = true;
        }

        try {
            const storedRet = localStorage.getItem(RETENTION_STORAGE_KEY);
            if (storedRet) {
                const parsedRet = JSON.parse(storedRet);
                retention.eventDataRetention = parsedRet.eventDataRetention || '14_months';
                retention.userDataRetention = parsedRet.userDataRetention || '14_months';
                retention.lastUpdated = parsedRet.lastUpdated;
            }
        } catch (err) {
            void err;
        }
    }

    function applyGtagUpdate(newSignals: ConsentSignals) {
        if (typeof window !== 'undefined') {
            window.dataLayer = window.dataLayer || [];
            if (typeof window.gtag === 'function') {
                window.gtag('consent', 'update', {
                    analytics_storage: newSignals.analytics_storage,
                    ad_storage: newSignals.ad_storage,
                    ad_user_data: newSignals.ad_user_data,
                    ad_personalization: newSignals.ad_personalization
                });
            } else {
                window.dataLayer.push([
                    'consent',
                    'update',
                    {
                        analytics_storage: newSignals.analytics_storage,
                        ad_storage: newSignals.ad_storage,
                        ad_user_data: newSignals.ad_user_data,
                        ad_personalization: newSignals.ad_personalization
                    }
                ]);
            }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newSignals));
            } catch (err) {
                void err;
            }
        }
    }

    function updateConsent(newSignals: Partial<ConsentSignals>) {
        signals.analytics_storage = newSignals.analytics_storage ?? signals.analytics_storage;
        signals.ad_storage = newSignals.ad_storage ?? signals.ad_storage;
        signals.ad_user_data = newSignals.ad_user_data ?? signals.ad_user_data;
        signals.ad_personalization = newSignals.ad_personalization ?? signals.ad_personalization;

        hasUserChosen = true;
        isBannerOpen = false;
        applyGtagUpdate(signals);
    }

    function acceptAll() {
        updateConsent({
            analytics_storage: 'granted',
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted'
        });
    }

    function acceptAnalyticsOnly() {
        updateConsent({
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
    }

    function rejectAll() {
        updateConsent({
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
    }

    function resetVisitorConsent() {
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (err) {
                void err;
            }
        }
        signals.analytics_storage = 'denied';
        signals.ad_storage = 'denied';
        signals.ad_user_data = 'denied';
        signals.ad_personalization = 'denied';
        hasUserChosen = false;
        isCustomizeModalOpen = false;
        isBannerOpen = true;
    }

    function openBanner() {
        isBannerOpen = true;
    }

    function closeBanner() {
        isBannerOpen = false;
    }

    async function saveRetentionSettings(
        eventPeriod: RetentionPeriod,
        userPeriod: RetentionPeriod
    ) {
        isSavingRetention = true;
        retentionSaveSuccess = false;

        await new Promise(res => setTimeout(res, 400));

        retention.eventDataRetention = eventPeriod;
        retention.userDataRetention = userPeriod;
        retention.lastUpdated = new SvelteDate().toISOString();

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(RETENTION_STORAGE_KEY, JSON.stringify(retention));
            } catch (err) {
                void err;
            }
        }

        isSavingRetention = false;
        retentionSaveSuccess = true;

        setTimeout(() => {
            retentionSaveSuccess = false;
        }, 3000);
    }

    function setSelectedStream(id: string) {
        selectedStreamId = id;
    }

    return {
        get signals() {
            return signals;
        },
        get retention() {
            return retention;
        },
        get hasUserChosen() {
            return hasUserChosen;
        },
        get isBannerOpen() {
            return isBannerOpen;
        },
        get isCustomizeModalOpen() {
            return isCustomizeModalOpen;
        },
        set isCustomizeModalOpen(val: boolean) {
            isCustomizeModalOpen = val;
        },
        openCustomizeModal() {
            isCustomizeModalOpen = true;
        },
        closeCustomizeModal() {
            isCustomizeModalOpen = false;
        },
        get isSavingRetention() {
            return isSavingRetention;
        },
        get retentionSaveSuccess() {
            return retentionSaveSuccess;
        },
        get isBehavioralActive() {
            return isBehavioralActive;
        },
        get isAdvertisingActive() {
            return isAdvertisingActive;
        },
        get overallConsentStatus() {
            return overallConsentStatus;
        },
        get selectedStreamId() {
            return selectedStreamId;
        },
        get streams() {
            return streams;
        },
        init,
        resetVisitorConsent,
        updateConsent,
        acceptAll,
        acceptAnalyticsOnly,
        rejectAll,
        openBanner,
        closeBanner,
        saveRetentionSettings,
        setSelectedStream
    };
}

export const consentStore = createConsentStore();
