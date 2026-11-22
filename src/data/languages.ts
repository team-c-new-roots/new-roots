import type { CommunityLanguage } from '@/types'

export type AppLanguageCode =
  | 'en-AU'
  | 'fa-AF'
  | 'fa-IR'
  | 'ar'
  | 'ps'
  | 'din'
  | 'zh-CN'
  | 'my'
  | 'ti'
  | 'am'
  | 'so'
  | 'sw'
  | 'ta'
  | 'nus'
  | 'vi'
  | 'om'

export interface AppLanguage {
  code: AppLanguageCode
  // the name in its own script, shown to people before they read any English
  nativeName: string
  dir: 'ltr' | 'rtl'
  // i18n key for the English name, so a helper can tell which is which
  nameKey: string
  // the community language this most likely means, used to skip a question later
  community: CommunityLanguage | null
  // main is the six on the language screen, more sits behind More languages
  group: 'main' | 'more'
}

// the main six are the most common languages for refugees settling in Victoria
// (Hazaragi speakers mostly read Dari). the rest are other common refugee
// languages. Dari uses fa-AF rather than prs because screen readers have a
// Persian voice for fa but usually nothing for prs
export const APP_LANGUAGES: AppLanguage[] = [
  {
    code: 'en-AU',
    nativeName: 'English',
    dir: 'ltr',
    nameKey: 'languages.english',
    community: null,
    group: 'main',
  },
  {
    code: 'fa-AF',
    nativeName: 'دری',
    dir: 'rtl',
    nameKey: 'languages.dari',
    community: 'dari',
    group: 'main',
  },
  {
    code: 'fa-IR',
    nativeName: 'فارسی',
    dir: 'rtl',
    nameKey: 'languages.farsi',
    community: 'persian',
    group: 'main',
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    dir: 'rtl',
    nameKey: 'languages.arabic',
    community: 'arabic',
    group: 'main',
  },
  {
    code: 'ps',
    nativeName: 'پښتو',
    dir: 'rtl',
    nameKey: 'languages.pashto',
    community: 'pashto',
    group: 'main',
  },
  {
    code: 'din',
    nativeName: 'Thuɔŋjäŋ',
    dir: 'ltr',
    nameKey: 'languages.dinka',
    community: 'dinka',
    group: 'main',
  },
  {
    code: 'zh-CN',
    nativeName: '简体中文',
    dir: 'ltr',
    nameKey: 'languages.chinese',
    community: null,
    group: 'more',
  },
  {
    code: 'my',
    nativeName: 'မြန်မာ',
    dir: 'ltr',
    nameKey: 'languages.burmese',
    community: null,
    group: 'more',
  },
  {
    code: 'ti',
    nativeName: 'ትግርኛ',
    dir: 'ltr',
    nameKey: 'languages.tigrinya',
    community: null,
    group: 'more',
  },
  {
    code: 'am',
    nativeName: 'አማርኛ',
    dir: 'ltr',
    nameKey: 'languages.amharic',
    community: null,
    group: 'more',
  },
  {
    code: 'so',
    nativeName: 'Soomaali',
    dir: 'ltr',
    nameKey: 'languages.somali',
    community: null,
    group: 'more',
  },
  {
    code: 'sw',
    nativeName: 'Kiswahili',
    dir: 'ltr',
    nameKey: 'languages.swahili',
    community: null,
    group: 'more',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    dir: 'ltr',
    nameKey: 'languages.tamil',
    community: null,
    group: 'more',
  },
  {
    code: 'nus',
    nativeName: 'Thok Naath',
    dir: 'ltr',
    nameKey: 'languages.nuer',
    community: null,
    group: 'more',
  },
  {
    code: 'vi',
    nativeName: 'Tiếng Việt',
    dir: 'ltr',
    nameKey: 'languages.vietnamese',
    community: null,
    group: 'more',
  },
  {
    code: 'om',
    nativeName: 'Afaan Oromoo',
    dir: 'ltr',
    nameKey: 'languages.oromo',
    community: null,
    group: 'more',
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

// the quick picks on the language step, spelt the way the census spells them,
// which the language files are keyed on
export const CENSUS_NAMES: Record<CommunityLanguage, string> = {
  dari: 'Dari',
  hazaraghi: 'Hazaraghi',
  persian: 'Persian (excluding Dari)',
  arabic: 'Arabic',
  pashto: 'Pashto',
  dinka: 'Dinka',
}

// the census spelling. it's left out of the language files because almost
// everyone speaks it, but people can still pick it on the language step
export const ENGLISH = 'English'

// the other way round, so a chosen census name finds its translated name
export const QUICK_PICK_BY_CENSUS: Record<string, CommunityLanguage> = Object.fromEntries(
  Object.entries(CENSUS_NAMES).map(([key, name]) => [name, key as CommunityLanguage]),
)

// shown under the English name on the language community step, so people can
// find their language without reading English
export const COMMUNITY_NATIVE: Record<
  CommunityLanguage,
  { text: string; lang: string; dir: 'ltr' | 'rtl' }
> = {
  dari: { text: 'دری', lang: 'fa-AF', dir: 'rtl' },
  hazaraghi: { text: 'هزارگی', lang: 'haz', dir: 'rtl' },
  persian: { text: 'فارسی', lang: 'fa-IR', dir: 'rtl' },
  arabic: { text: 'العربية', lang: 'ar', dir: 'rtl' },
  pashto: { text: 'پښتو', lang: 'ps', dir: 'rtl' },
  dinka: { text: 'Thuɔŋjäŋ', lang: 'din', dir: 'ltr' },
}

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
