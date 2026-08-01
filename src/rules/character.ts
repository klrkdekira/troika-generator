import type { AdvancedSkill, Background, Character, GameData, Item, SkillType } from '../types'

export const roll = (sides: number) => Math.floor(Math.random() * sides) + 1

export const d66 = () => roll(6) * 10 + roll(6)

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
  if (name.startsWith('Language – ')) return 'language'
  if (name.startsWith('Secret Signs – ')) return 'secret'
  return name.endsWith(' Fighting') || name === 'Jousting' || name === 'Wrestling'
    ? 'weapon'
    : 'skill'
}

const item = (source: any, position: number): Item => ({
  name: source.name,
  position,
  slots: source.slots ?? 1,
  quantity: source.quantity ?? 1,
  maximumQuantity: source.quantity ?? 1,
  description: source.description,
  properties: source.properties,
  readyForUse: false,
  condition: 'good',
})

const baseline = (names: string[]) =>
  names.map((raw, position) => {
    const dice = raw.match(/^(\d+d\d+) (.+)$/)
    const count = raw.match(/^(\d+) (.+)$/)
    return item(
      {
        name: dice?.[2] ?? count?.[2] ?? raw,
        quantity: dice ? rollExpression(dice[1]) : count ? Number(count[1]) : 1,
      },
      position + 1
    )
  })

export function makeCharacter(background: Background, data: GameData): Character {
  const rules = data.manifest.rules.coreRules
  const skill = rollExpression(rules.attributeGeneration.skill)
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
    ...(background.advancedSkills ?? []).map(x => convert(x)),
    ...(background.spells ?? []).map(x => convert(x, true)),
  ]
  const zoanthrop = background.id === 66
  return {
    name: '',
    background: background.name,
    attributes: {
      skill,
      stamina: (() => {
        const maximum = rollExpression(rules.attributeGeneration.stamina)
        return { maximum, current: maximum, temporary: 0 }
      })(),
      luck: (() => {
        const maximum = rollExpression(rules.attributeGeneration.luck)
        return { maximum, current: maximum, timesTestedThisSession: 0 }
      })(),
    },
    advancedSkills,
    inventory: (background.possessions ?? []).slice(0, 18).map(item),
    baselinePossessions:
      background.overrideBaselinePossessions || zoanthrop
        ? []
        : baseline(rules.baselinePossessions),
    initiativeTokens: data.manifest.rules.initiative.playerTokens,
    specialAbilities: background.special ?? [],
    languages: advancedSkills.filter(x => x.type === 'language').map(x => x.specialization!),
    secretSigns: advancedSkills.filter(x => x.type === 'secret').map(x => x.specialization!),
    notes: '',
  }
}

export function normalize(character: Character): Character {
  const stamina = Math.max(14, Math.min(24, character.attributes.stamina.maximum))
  const luck = Math.max(7, Math.min(12, character.attributes.luck.maximum))
  const skill = Math.max(4, Math.min(6, character.attributes.skill))
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
    inventory: character.inventory.slice(0, 18).map((x, i) => ({
      ...x,
      position: i + 1,
      slots: Math.max(1, x.slots || 1),
      maximumQuantity: Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
      quantity: Math.min(
        Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
        Math.max(0, x.quantity ?? x.maximumQuantity ?? 1)
      ),
    })),
    baselinePossessions: (character.baselinePossessions ?? []).map((x, i) => ({
      ...x,
      position: i + 1,
      slots: Math.max(1, x.slots || 1),
      maximumQuantity: Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
      quantity: Math.min(
        Math.max(0, x.maximumQuantity ?? x.quantity ?? 1),
        Math.max(0, x.quantity ?? x.maximumQuantity ?? 1)
      ),
    })),
  }
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
