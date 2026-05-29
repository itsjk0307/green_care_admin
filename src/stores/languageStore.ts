import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations, type Language, type TranslationKey } from '../i18n/translations'

type LanguageStore = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: 'ko' as Language,
      setLanguage: (lang: Language) => set({ language: lang }),
      t: (key: TranslationKey) => translations[get().language][key] as string,
    }),
    { name: 'greencare-language' },
  ),
)
