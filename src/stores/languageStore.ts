import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  translations,
  type Language,
  type TranslationKey,
} from '../i18n/translations'

type LanguageStore = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: 'ko' as Language,
      setLanguage: (lang: Language) => set({ language: lang }),
      t: (key, vars) => {
        let text = translations[get().language][key] as string
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v))
          }
        }
        return text
      },
    }),
    { name: 'greencare-language' },
  ),
)
