import type { CommunityLanguage } from '@/types'

export type AppLanguageCode = 'en-AU' | 'fa-AF' | 'fa-IR' | 'ar' | 'ps' | 'din'

export interface AppLanguage {
  code: AppLanguageCode
  // the name in its own script, shown to people before they read any English
  nativeName: string
  dir: 'ltr' | 'rtl'
  // i18n key for the English name, so a helper can tell which is which
  nameKey: string
  // the community language this most likely means, used to skip a question later
  community: CommunityLanguage | null
}

// order follows the wireframe. Dari uses fa-AF rather than prs because screen
// readers have a Persian voice for fa but usually nothing for prs
export const APP_LANGUAGES: AppLanguage[] = [
  {
    code: 'en-AU',
    nativeName: 'English',
    dir: 'ltr',
    nameKey: 'languages.english',
    community: null,
  },
  { code: 'fa-AF', nativeName: 'دری', dir: 'rtl', nameKey: 'languages.dari', community: 'dari' },
  {
    code: 'fa-IR',
    nativeName: 'فارسی',
    dir: 'rtl',
    nameKey: 'languages.farsi',
    community: 'persian',
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    dir: 'rtl',
    nameKey: 'languages.arabic',
    community: 'arabic',
  },
  { code: 'ps', nativeName: 'پښتو', dir: 'rtl', nameKey: 'languages.pashto', community: 'pashto' },
  {
    code: 'din',
    nativeName: 'Thuɔŋjäŋ',
    dir: 'ltr',
    nameKey: 'languages.dinka',
    community: 'dinka',
  },
]

export const COMMUNITY_LANGUAGES: CommunityLanguage[] = [
  'dari',
  'hazaraghi',
  'persian',
  'arabic',
  'pashto',
  'dinka',
]

// greetings from the wireframe, two lines of two. each one is tagged with its
// language so a screen reader switches voice instead of reading Persian with
// English rules
export const GREETINGS = [
  [
    { text: 'Welcome', lang: 'en-AU', dir: 'ltr' },
    { text: 'خوش آمدید', lang: 'fa', dir: 'rtl' },
  ],
  [
    { text: 'مرحباً', lang: 'ar', dir: 'rtl' },
    { text: 'ښه راغلاست', lang: 'ps', dir: 'rtl' },
  ],
] as const

export function findAppLanguage(code: string): AppLanguage {
  return APP_LANGUAGES.find((language) => language.code === code) ?? APP_LANGUAGES[0]!
}
