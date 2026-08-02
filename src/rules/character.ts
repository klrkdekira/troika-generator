import type { AdvancedSkill, Background, Character, GameData, Item, SkillType } from '../types'

export const roll = (sides: number) => Math.floor(Math.random() * sides) + 1

export const d66 = () => roll(6) * 10 + roll(6)

export const randomSpell = (data: GameData) => {
  const table = data.tables.get('Random Spell Table')
  const result = table?.entries?.find((entry: any) => Number(entry.roll) === d66())?.result
  if (typeof result === 'string') return result
  const spells = [...data.spells.keys()]
  return spells.length ? spells[Math.floor(Math.random() * spells.length)] : undefined
}

export const weaponNames = (data: GameData) =>
  [...data.tables.values()]
    .flatMap(table => table.damageMatrix?.weapons ?? [])
    .filter((name, index, names) => names.indexOf(name) === index)

export const rollExpression = (expression: string) => {
  const match = expression.match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!match) return 0
  return (
    Array.from({ length: Number(match[1] || 1) }, () => roll(Number(match[2]))).reduce(
      (a, b) => a + b,
      0
    ) + Number(match[3] || 0)
  )
}

export const skillType = (name: string, isSpell = false, data?: GameData): SkillType => {
  if (isSpell) return 'spell'
  const declared = data?.skills.get(name)?.type
  if (declared && ['skill', 'spell', 'language', 'secret', 'weapon'].includes(declared))
    return declared
  if (name === 'Fighting in chosen weapon') return 'weapon'
  if (name.startsWith('Language – ')) return 'language'
  if (name.startsWith('Secret Signs – ')) return 'secret'
  return name.endsWith(' Fighting') || name === 'Jousting' || name === 'Wrestling'
    ? 'weapon'
    : 'skill'
}

const parseQuantity = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  if (/^\d*d\d+([+-]\d+)?$/i.test(value)) return rollExpression(value)
  if (/^\d+$/.test(value)) return Number(value)
  return undefined
}

const parseArmor = (source: any): number | undefined => {
  const val = source.armor ?? source.armour
  if (typeof val === 'number') return val
  if (typeof val === 'object' && val !== null && typeof val.protection === 'number') {
    return val.protection
  }
  return undefined
}

const dice = /^\d*d\d+([+-]\d+)?$/i

const item = (source: any, position: number, roll = true, data?: GameData): Item => {
  let name = String(source.name || '')
  const declared = typeof source.quantity === 'string' ? source.quantity.trim() : source.quantity
  const declaredDice = typeof declared === 'string' && dice.test(declared)
  const diceInName = name.match(/^(\d*d\d+([+-]\d+)?) (.+)$/i)
  const countMatch = name.match(/^(\d+) (.+)$/)
  const cleanName = diceInName ? diceInName[3] : countMatch ? countMatch[2] : name
  const matchedItem = data?.items?.get(cleanName) || data?.items?.get(name)

  const armorVal = parseArmor(source) ?? parseArmor(matchedItem ?? {})
  const defaultSlots = matchedItem?.slots ?? 1
  const damageAs = source.damageAs ?? matchedItem?.weapon?.damageAs
  const common = {
    position,
    slots: Math.max(0, source.slots ?? defaultSlots),
    ...(armorVal !== undefined ? { armour: armorVal, armor: armorVal } : {}),
    ...(typeof damageAs === 'string' ? { damageAs } : {}),
    description: source.description ?? matchedItem?.description,
    properties: source.properties ?? matchedItem?.properties,
    readyForUse: false,
    condition: 'good' as const,
  }

  // Nothing to roll here, or the player asked to roll it: either way only a die
  // is left blank. "2d6" against Plasmic Cores reads as "2d6 Plasmic Cores",
  // the same shape the SRD uses for "2d6 Silver Pence".
  if (!roll && (declaredDice || diceInName)) {
    return { ...common, name: declaredDice ? `${declared} ${name}` : name }
  }

  let quantity = parseQuantity(declared)
  if (quantity === undefined) {
    if (diceInName) {
      quantity = rollExpression(diceInName[1])
      name = diceInName[3]
    } else if (countMatch) {
      quantity = Number(countMatch[1])
      name = countMatch[2]
    } else {
      quantity = 1
    }
  }
  const maximumQuantity = Math.max(quantity, parseQuantity(source.maximumQuantity) ?? quantity)

  return { ...common, name, quantity, maximumQuantity }
}

const baseline = (names: string[], roll = true, data?: GameData) =>
  names.map((raw, position) => item({ name: raw }, position + 1, roll, data))

/**
 * `roll: false` leaves every die for the player: attributes sit at their lowest
 * legal value behind an `unrolled` flag, dice quantities and the background's
 * random spell and weapon choice stay as written.
 */
export function makeCharacter(
  background: Background,
  data: GameData,
  { roll = true }: { roll?: boolean } = {}
): Character {
  const rules = data.manifest.rules.coreRules
  const skill = roll ? rollExpression(rules.attributeGeneration.skill) : 4
  const convert = (entry: { name: string; rank: number }, spell = false): AdvancedSkill => {
    const type = skillType(entry.name, spell, data)
    const specialization =
      type === 'language'
        ? entry.name.slice('Language – '.length)
        : type === 'secret'
          ? entry.name.slice('Secret Signs – '.length)
          : undefined
    return {
      ...entry,
      type,
      total: skill + entry.rank,
      ...(specialization ? { specialization } : {}),
    }
  }
  const advancedSkills = [
    ...(background.advancedSkills ?? []).map(x => {
      if (x.name !== 'Fighting in chosen weapon' || !roll) return convert(x)
      const weapons = weaponNames(data)
      const name = weapons.length ? weapons[Math.floor(Math.random() * weapons.length)] : undefined
      return convert(name ? { ...x, name: name + ' Fighting' } : x)
    }),
    ...(background.spells ?? []).map(x =>
      convert(x.name === 'Random' && roll ? { ...x, name: randomSpell(data) ?? x.name } : x, true)
    ),
  ]
  const zoanthrop = background.id === 66
  return {
    name: '',
    background: background.name,
    attributes: {
      skill,
      stamina: (() => {
        const maximum = roll ? rollExpression(rules.attributeGeneration.stamina) : 14
        return { maximum, current: maximum, temporary: 0 }
      })(),
      luck: (() => {
        const maximum = roll ? rollExpression(rules.attributeGeneration.luck) : 7
        return { maximum, current: maximum, timesTestedThisSession: 0 }
      })(),
    },
    advancedSkills,
    ...(roll ? {} : { unrolled: true }),
    inventory: (background.possessions ?? [])
      .slice(0, 18)
      .map((entry, position) => item(entry, position + 1, roll, data)),
    baselinePossessions:
      background.overrideBaselinePossessions || zoanthrop
        ? []
        : baseline(rules.baselinePossessions, roll, data),
    initiativeTokens: data.manifest.rules.initiative.playerTokens,
    specialAbilities: background.special ?? [],
    languages: advancedSkills.filter(x => x.type === 'language').map(x => x.specialization!),
    secretSigns: advancedSkills.filter(x => x.type === 'secret').map(x => x.specialization!),
    notes: '',
  }
}

// A possession with no quantity at all is left alone: that is the player's box
// to fill in on a sheet they wanted to roll themselves.
const quantities = (x: Item) =>
  x.quantity === undefined && x.maximumQuantity === undefined
    ? {}
    : {
        maximumQuantity: Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
        quantity: Math.min(
          Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
          Math.max(0, x.quantity ?? x.maximumQuantity ?? 1)
        ),
      }

export function normalize(character: Character): Character {
  const stamina = Math.max(14, Math.min(24, character.attributes.stamina.maximum))
  const luck = Math.max(7, Math.min(12, character.attributes.luck.maximum))
  const skill = Math.max(4, Math.min(6, character.attributes.skill))
  const normalizeItem = (x: Item, i: number): Item => {
    const armorVal = x.armour ?? x.armor
    const cleanArmor =
      armorVal === undefined ? {} : { armour: Math.max(0, armorVal), armor: Math.max(0, armorVal) }
    return {
      ...x,
      ...cleanArmor,
      position: i + 1,
      slots: Math.max(0, x.slots ?? 1),
      ...quantities(x),
    }
  }
  return {
    ...character,
    attributes: {
      skill,
      stamina: {
        ...character.attributes.stamina,
        maximum: stamina,
        current: Math.min(Math.max(0, character.attributes.stamina.current || stamina), stamina),
        temporary: character.attributes.stamina.temporary ?? 0,
      },
      luck: {
        ...character.attributes.luck,
        maximum: luck,
        current: Math.min(Math.max(0, character.attributes.luck.current || luck), luck),
        timesTestedThisSession: character.attributes.luck.timesTestedThisSession ?? 0,
      },
    },
    advancedSkills: character.advancedSkills.map(x => ({
      ...x,
      total: skill + Math.max(1, x.rank),
    })),
    inventory: character.inventory.slice(0, 18).map(normalizeItem),
    baselinePossessions: (character.baselinePossessions ?? []).map(normalizeItem),
  }
}

/** Damage reduction provided by gear (SRD §9). */
export function armour(character: Character) {
  return [...character.inventory, ...(character.baselinePossessions ?? [])].reduce(
    (sum, possession) => sum + Math.max(0, possession.armour ?? possession.armor ?? 0),
    0
  )
}

export function encumbrance(character: Character, rules: any) {
  const slots = [...character.inventory, ...character.baselinePossessions].reduce(
    (sum, x) => sum + x.slots,
    0
  )
  return {
    slots,
    state:
      slots > rules.severelyOverburdenedThreshold
        ? 'severely overburdened'
        : slots > rules.maxSlots
          ? 'overburdened (−4)'
          : 'unencumbered',
  }
}
