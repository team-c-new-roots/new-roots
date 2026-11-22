// checks a translated file against en.ts without breaking vue-i18n syntax.
// used by the translation tests and scripts/stamp_translations.ts, so this
// file can't import anything (node runs the script without vite)

export type Messages = { [key: string]: string | Messages }

// { } @ $ | mean something to vue-i18n, so a translation can't add them
const SYNTAX = /[{}@$|]/g
const PLACEHOLDER = /\{[a-zA-Z]+\}/g

// nested messages to a flat list of dotted keys
export function flatten(messages: Messages, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') flat[path] = value
    else Object.assign(flat, flatten(value, path))
  }
  return flat
}

export function unflatten(flat: Record<string, string>): Messages {
  const messages: Messages = {}
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split('.')
    let node = messages
    for (const key of keys.slice(0, -1)) {
      if (typeof node[key] !== 'object') node[key] = {}
      node = node[key] as Messages
    }
    node[keys[keys.length - 1]!] = value
  }
  return messages
}

// plural forms are separated by |
export function pluralForms(text: string): string[] {
  return text.split('|').map((form) => form.trim())
}

// short fingerprint of an English message (FNV-1a). a stamp file keeps the
// one each translation was made from, so a changed sentence shows up
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function placeholders(text: string): string[] {
  return (text.match(PLACEHOLDER) ?? []).sort()
}

function syntaxCount(text: string): number {
  return text.replace(PLACEHOLDER, '').match(SYNTAX)?.length ?? 0
}

// everything that would break a translated file or make it say the wrong thing
export function checkTranslation(english: Messages, translated: Messages): string[] {
  const source = flatten(english)
  const target = flatten(translated)
  const problems: string[] = []
  for (const [key, text] of Object.entries(source)) {
    const out = target[key]
    if (out === undefined) continue
    if (!out.trim()) problems.push(`${key}: is empty`)
    if (pluralForms(out).length !== pluralForms(text).length) {
      problems.push(`${key}: plural forms don't match`)
    }
    if (placeholders(out).join() !== placeholders(text).join()) {
      problems.push(`${key}: placeholders don't match`)
    }
    if (syntaxCount(out) > syntaxCount(text)) problems.push(`${key}: has vue-i18n syntax in it`)
  }
  for (const key of Object.keys(target)) {
    if (!(key in source)) problems.push(`${key}: isn't in en.ts`)
  }
  return problems
}

// English that's new or changed since the translation was made. these show
// in English (missing) or say the old thing (stale) until they're redone
export function outOfDate(
  english: Messages,
  translated: Messages,
  stamps: Record<string, string>,
): { missing: string[]; stale: string[] } {
  const source = flatten(english)
  const target = flatten(translated)
  const missing: string[] = []
  const stale: string[] = []
  for (const [key, text] of Object.entries(source)) {
    if (target[key] === undefined) missing.push(key)
    else if (stamps[key] !== fingerprint(text)) stale.push(key)
  }
  return { missing, stale }
}
