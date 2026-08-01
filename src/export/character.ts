import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { Character } from '../types'
import { normalize } from '../rules/character'
const notice = 'Troika! Character Generator is an independent production by Chee Leong and is not affiliated with the Melsonian Arts Council.'
export function exportable(character: Character, attribution: string) { return { '@context': 'https://cheeleong.dev/troika-system-json/systems/context.jsonld', '@type': 'Character', ...normalize(character), _generator: { name: 'Troika! Character Generator', url: 'https://cheeleong.dev/troika-generator/', dataSource: 'https://cheeleong.dev/troika-system-json/', attribution, notice } } }
export function validate(character: unknown, schema: object) { const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv); const check = ajv.compile(schema); return { valid: Boolean(check(character)), errors: check.errors?.map(x => `${x.instancePath || 'character'} ${x.message ?? ''}`) ?? [] } }
export function download(character: Character, attribution: string) { const content = JSON.stringify(exportable(character, attribution), null, 2); const blob = new Blob([content], { type: 'application/json' }); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${character.name || 'troika-character'}.json`.toLowerCase().replace(/[^a-z0-9]+/g, '-'); anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 0) }
export { notice }
