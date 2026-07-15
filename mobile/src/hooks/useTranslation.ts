import { useAppStore } from '@/store/useAppStore';
import { TRANSLATIONS } from '@/utils/translations';
import { CUSTOM_TRANSLATIONS } from '@/utils/customTranslations';

export function useTranslation() {
  const profile = useAppStore((state) => state.profile);
  const lang = (profile?.language || 'en') as LanguageCode;
  
  const baseT = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const customT = CUSTOM_TRANSLATIONS[lang] || CUSTOM_TRANSLATIONS.en;
  
  const t = { ...baseT, ...customT };
  return { t, lang };
}

export type TranslationDict = typeof TRANSLATIONS['en'] & typeof CUSTOM_TRANSLATIONS['en'];
export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'hi';
