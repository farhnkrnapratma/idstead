export type TranslationLocale = 'id' | 'ja' | 'zh' | 'ko';

export const TRANSLATION_LOCALES: TranslationLocale[] = [
  'id',
  'ja',
  'zh',
  'ko'
];

export const TRANSLATION_LOCALE_NAMES: Record<TranslationLocale, string> = {
  id: 'Indonesian',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
  ko: 'Korean'
};

export const LANGUAGE_LABELS: Record<'en' | TranslationLocale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
  ja: '日本語',
  zh: '简体中文',
  ko: '한국어'
};

export const OG_LOCALES: Record<'en' | TranslationLocale, string> = {
  en: 'en_US',
  id: 'id_ID',
  ja: 'ja_JP',
  zh: 'zh_CN',
  ko: 'ko_KR'
};

export function languageLabel(locale: string): string {
  return LANGUAGE_LABELS[locale as 'en' | TranslationLocale] ?? locale;
}

export function ogLocale(locale: string): string {
  return OG_LOCALES[locale as 'en' | TranslationLocale] ?? OG_LOCALES.en;
}
