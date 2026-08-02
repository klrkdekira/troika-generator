import type { GameData, Manifest } from '../types'

const base = 'https://cheeleong.dev/troika-system-json/'
const manifestUrl = `${base}objects/troika-system-data.json`

async function json(url: string) {
  const cache = typeof caches === 'undefined' ? undefined : await caches.open('troika-live-data-v1')
  const cached = await cache?.match(url)
  const request = fetch(url).then(async response => {
    if (!response.ok) throw new Error(`${response.status} while loading ${url}`)
    cache?.put(url, response.clone())
    return response.json()
  })
  if (cached) {
    void request.catch(() => undefined)
    return cached.json()
  }
  return request
}

async function concurrent<T>(
  items: T[],
  work: (value: T) => Promise<any>,
  progress?: (done: number, total: number) => void
) {
  const results: any[] = []
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        results.push(await work(item))
      } catch {
        results.push(undefined)
      } finally {
        progress?.(++done, items.length)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(10, items.length) }, worker))
  return results.filter(Boolean)
}

const refUrl = (ref: string) => new URL(ref, `${base}objects/`).href

const asMap = (values: any[]) => new Map(values.filter(Boolean).map(value => [value.name, value]))

export async function loadGameData(
  progress?: (done: number, total: number) => void
): Promise<GameData> {
  let manifest: Manifest
  try {
    manifest = await json(`${base}objects/troika-system-data.bundled.json`)
  } catch {
    manifest = await json(manifestUrl)
  }
  const resolve = async (collection: any[] = []) =>
    concurrent(
      collection,
      value => (value.$ref ? json(refUrl(value.$ref)) : Promise.resolve(value)),
      progress
    )
  const [backgrounds, skills, spells, tables, items, schema] = await Promise.all([
    resolve(manifest.backgrounds),
    resolve(manifest.skills),
    resolve(manifest.spells),
    resolve(manifest.tables),
    resolve(manifest.items),
    json(`${base}systems/character.schema.json`),
  ])
  const warnings: string[] = []
  if (backgrounds.length !== 36)
    warnings.push(`${36 - backgrounds.length} background(s) could not be loaded.`)
  return {
    manifest,
    backgrounds,
    skills: asMap(skills),
    spells: asMap(spells),
    tables: asMap(tables),
    items: asMap(items),
    schema,
    warnings,
  }
}
