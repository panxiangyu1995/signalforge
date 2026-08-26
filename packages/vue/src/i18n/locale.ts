import { browser, localeFrom } from '@nanostores/i18n'
import { atom } from 'nanostores'

export const AVAILABLE_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh-CN'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]
export type TranslatedLocale = Exclude<Locale, 'en'>

export const TRANSLATED_LOCALES = [
  'de',
  'es',
  'fr',
  'it',
  'ja',
  'pl',
  'ru',
  'zh-CN'
] as const satisfies ReadonlyArray<TranslatedLocale>

export const LOCALE_DIR_NAMES = {
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  pl: 'pl',
  ru: 'ru',
  'zh-CN': 'zh-cn'
} as const satisfies Record<TranslatedLocale, string>

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pl: 'Polski',
  ru: 'Русский',
  'zh-CN': '中文（简体）'
}

const LEGACY_LOCALE_STORAGE_KEY = 'open-pencil-locale'
const LOCALE_STORAGE_KEY = 'signalforge-locale'

export const localeSetting = atom<Locale | undefined>(undefined)

export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))

function getLocalStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  if (typeof localStorage.getItem !== 'function') return null
  if (typeof localStorage.setItem !== 'function') return null
  return localStorage
}

export function setLocale(code: Locale) {
  localeSetting.set(code)
  getLocalStorage()?.setItem(LOCALE_STORAGE_KEY, code)
}

const storage = getLocalStorage()
let saved = storage?.getItem(LOCALE_STORAGE_KEY) as Locale | null | undefined
if (!saved && storage) {
  const legacySaved = storage.getItem(LEGACY_LOCALE_STORAGE_KEY) as Locale | null
  if (legacySaved) {
    saved = legacySaved
    storage.setItem(LOCALE_STORAGE_KEY, legacySaved)
    storage.removeItem(LEGACY_LOCALE_STORAGE_KEY)
  }
}
if (saved && AVAILABLE_LOCALES.includes(saved)) {
  localeSetting.set(saved)
}
