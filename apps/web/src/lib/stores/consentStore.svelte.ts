import { readStorage } from '@idstead/ui/utils/storageKeys.ts';

export type ConsentStatus = 'granted' | 'denied';

export interface ConsentSignals {
    analytics_storage: ConsentStatus;
    ad_storage: ConsentStatus;
    ad_user_data: ConsentStatus;
    ad_personalization: ConsentStatus;
}

const STORAGE_KEY = 'idstead_cookie_consent_v2';

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

function consentStatus(value: unknown): ConsentStatus {
    return value === 'granted' ? 'granted' : 'denied';
}

function createConsentStore() {
    let isBannerOpen = $state(false);
    let isCustomizeModalOpen = $state(false);

    const signals = $state<ConsentSignals>({
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    });

    function init() {
        if (typeof window === 'undefined') return;

        try {
            const stored = readStorage(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                signals.analytics_storage = consentStatus(parsed?.analytics_storage);
                signals.ad_storage = consentStatus(parsed?.ad_storage);
                signals.ad_user_data = consentStatus(parsed?.ad_user_data);
                signals.ad_personalization = consentStatus(parsed?.ad_personalization);
            } else {
                isBannerOpen = true;
            }
        } catch {
            isBannerOpen = true;
        }
    }

    function pushGtagConsent(newSignals: ConsentSignals) {
        if (typeof window === 'undefined') return;
        const update = {
            analytics_storage: newSignals.analytics_storage,
            ad_storage: newSignals.ad_storage,
            ad_user_data: newSignals.ad_user_data,
            ad_personalization: newSignals.ad_personalization
        };
        window.dataLayer = window.dataLayer || [];
        if (typeof window.gtag === 'function') window.gtag('consent', 'update', update);
        else window.dataLayer.push(['consent', 'update', update]);
    }

    function applyGtagUpdate(newSignals: ConsentSignals) {
        pushGtagConsent(newSignals);
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSignals));
        } catch (err) {
            void err;
        }
    }

    function updateConsent(newSignals: Partial<ConsentSignals>) {
        signals.analytics_storage = newSignals.analytics_storage ?? signals.analytics_storage;
        signals.ad_storage = newSignals.ad_storage ?? signals.ad_storage;
        signals.ad_user_data = newSignals.ad_user_data ?? signals.ad_user_data;
        signals.ad_personalization = newSignals.ad_personalization ?? signals.ad_personalization;

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
        pushGtagConsent(signals);
        isCustomizeModalOpen = false;
        isBannerOpen = true;
    }

    function closeBanner() {
        isBannerOpen = false;
    }

    return {
        get signals() {
            return signals;
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
        init,
        resetVisitorConsent,
        updateConsent,
        acceptAll,
        acceptAnalyticsOnly,
        rejectAll,
        closeBanner
    };
}

export const consentStore = createConsentStore();
