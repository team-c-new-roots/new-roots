import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/en'
import { flatten } from '@/i18n/checks'

/* a key that isn't in en.ts shows on screen as the key itself, like
   map.contrastTip. this reads every t('...') with a plain key in src and
   checks English has it. keys built at runtime, like `places.types.${type}`,
   are left to the views' own tests */

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path)
    return /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

describe('message keys', () => {
  it('only uses keys that are in en.ts', () => {
    const known = new Set(Object.keys(flatten(en)))
    // plural messages flatten to one key, so a key is known if it or its parent is
    const missing: string[] = []
    for (const file of files(join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\b(?:t|\$t|te)\(\s*'([a-zA-Z][\w]*(?:\.[\w]+)+)'/g)) {
        const key = match[1]!
        if (!known.has(key)) missing.push(`${file.replace(process.cwd() + '/', '')}: ${key}`)
      }
      for (const match of source.matchAll(/keypath="([a-zA-Z][\w]*(?:\.[\w]+)+)"/g)) {
        const key = match[1]!
        if (!known.has(key)) missing.push(`${file.replace(process.cwd() + '/', '')}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })
})
