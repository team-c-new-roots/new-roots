// marks translations as done for the current English, after redoing them.
// npm run test:unit lists anything new or changed in en.ts for each language.
//
//   npm run i18n:stamp -- fa-AF nav.intro steps.next   stamps those keys
//   npm run i18n:stamp -- fa-AF --all                  stamps the whole file
//
// only stamp a key once its translation in src/i18n/locales/<code>.json says
// what the English says now, otherwise the test can't catch it

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import en from '../src/i18n/en.ts'
import { fingerprint, flatten, type Messages } from '../src/i18n/checks.ts'

const [code, ...keys] = process.argv.slice(2)
if (!code || keys.length === 0) {
  console.error('usage: npm run i18n:stamp -- <language code> <key ...> | --all')
  process.exit(1)
}

const localePath = new URL(`../src/i18n/locales/${code}.json`, import.meta.url)
const stampPath = new URL(`../src/i18n/stamps/${code}.json`, import.meta.url)
if (!existsSync(localePath)) {
  console.error(`no translation file for ${code}`)
  process.exit(1)
}

const english = flatten(en as Messages)
const translated = flatten(JSON.parse(readFileSync(localePath, 'utf8')) as Messages)
const stamps: Record<string, string> = existsSync(stampPath)
  ? JSON.parse(readFileSync(stampPath, 'utf8'))
  : {}

const chosen = keys.includes('--all') ? Object.keys(translated) : keys
let failed = false
for (const key of chosen) {
  if (english[key] === undefined) {
    console.error(`${key} isn't in en.ts`)
    failed = true
  } else if (translated[key] === undefined) {
    console.error(`${key} isn't translated in ${code}.json yet`)
    failed = true
  } else {
    stamps[key] = fingerprint(english[key])
  }
}

// drop stamps for keys that left en.ts, and keep the file in en.ts order
const ordered = Object.fromEntries(
  Object.keys(english)
    .filter((key) => stamps[key] !== undefined)
    .map((key) => [key, stamps[key]]),
)
mkdirSync(new URL('.', stampPath), { recursive: true })
writeFileSync(stampPath, `${JSON.stringify(ordered, null, 2)}\n`)
console.log(`${code}: ${Object.keys(ordered).length} of ${Object.keys(english).length} stamped`)
if (failed) process.exit(1)
