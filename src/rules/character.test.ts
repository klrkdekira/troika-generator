import { describe, expect, it } from 'vitest'
import {
  armour,
  d66,
  encumbrance,
  makeCharacter,
  normalize,
  rollExpression,
  skillType,
} from './character'
import { loadGameData } from '../data/load'
import { validate } from '../export/character'

describe('Troika rules helpers', () => {
  it('rolls within each dice expression range', () => {
    for (let i = 0; i < 100; i++) {
      expect(rollExpression('1d3+3')).toBeGreaterThanOrEqual(4)
      expect(rollExpression('1d3+3')).toBeLessThanOrEqual(6)
      expect(rollExpression('2d6+12')).toBeGreaterThanOrEqual(14)
      expect(rollExpression('2d6+12')).toBeLessThanOrEqual(24)
      expect(rollExpression('1d6+6')).toBeGreaterThanOrEqual(7)
      expect(rollExpression('1d6+6')).toBeLessThanOrEqual(12)
      expect(String(d66())).toMatch(/^[1-6][1-6]$/)
    }
  })
  it('recognises en-dash languages, secrets, and weapon skills', () => {
    expect(skillType('Language – Kurgan')).toBe('language')
    expect(skillType('Secret Signs – Witching Words')).toBe('secret')
    expect(skillType('Knife Fighting')).toBe('weapon')
  })
  it('uses both inventory groups for encumbrance', () => {
    const result = encumbrance(
      {
        inventory: Array.from({ length: 12 }, (_, position) => ({ name: 'x', position, slots: 1 })),
        baselinePossessions: [{ name: 'kit', position: 1, slots: 1 }],
      } as any,
      { maxSlots: 12, severelyOverburdenedThreshold: 18 }
    )
    expect(result.state).toContain('overburdened')
  })
  it('totals the armour values written against inventory and baseline kit', () => {
    const character = {
      inventory: [
        { name: 'Heavy Armour', position: 1, slots: 6, armour: 3 },
        { name: 'Shield', position: 2, slots: 2, armour: 1 },
        { name: 'Knife', position: 3, slots: 1 },
      ],
      baselinePossessions: [{ name: 'Rucksack', position: 1, slots: 1 }],
    } as any
    expect(armour(character)).toBe(4)
    expect(armour({ inventory: [], baselinePossessions: [] } as any)).toBe(0)
    // Normalisation keeps the entered value and refuses a negative one.
    const normalised = normalize({
      ...character,
      attributes: {
        skill: 5,
        stamina: { current: 18, maximum: 18 },
        luck: { current: 9, maximum: 9 },
      },
      advancedSkills: [],
      inventory: [
        ...character.inventory,
        { name: 'Cursed Plate', position: 4, slots: 2, armour: -2 },
      ],
    } as any)
    expect(normalised.inventory.map(x => x.armour)).toEqual([3, 1, undefined, 0])
  })
  it('parses and rolls item quantity expressions in background possessions', async () => {
    const data = await loadGameData()
    const exographer = data.backgrounds.find(b => b.id === 24)
    expect(exographer).toBeDefined()
    if (!exographer) return
    const character = makeCharacter(exographer, data)
    const cores = character.inventory.find(i => i.name === 'Plasmic Cores')
    expect(cores).toBeDefined()
    expect(cores?.quantity).toBeGreaterThanOrEqual(1)
    expect(cores?.quantity).toBeLessThanOrEqual(6)
    expect(cores?.maximumQuantity).toBe(cores?.quantity)
  })
  it('generates every live background as a schema-valid character', async () => {
    const data = await loadGameData()
    expect(data.backgrounds).toHaveLength(36)
    for (const background of data.backgrounds) {
      const character = makeCharacter(background, data)
      expect(character.advancedSkills.some(x => x.name === 'Random')).toBe(false)
      expect(character.advancedSkills.some(x => x.name === 'Fighting in chosen weapon')).toBe(false)
      const checked = validate(character, data.schema)
      expect(checked.valid, background.name + ': ' + checked.errors.join('; ')).toBe(true)
    }
    for (const name of ['sample-ardent-giant', 'sample-burglar']) {
      const response = await fetch(
        `https://cheeleong.dev/troika-system-json/objects/characters/${name}.json`
      )
      expect(response.ok, name).toBe(true)
      const sample = await response.json()
      const checked = validate(sample, data.schema)
      expect(checked.valid, name + ': ' + checked.errors.join('; ')).toBe(true)
      expect(() => normalize(sample)).not.toThrow()
    }
  }, 30000)
  it('recomputes totals and clamps resource values during normalization', () => {
    const character = {
      attributes: {
        skill: 6,
        stamina: { current: 99, maximum: 99 },
        luck: { current: -1, maximum: 1 },
      },
      advancedSkills: [{ name: 'Sneak', rank: 3, total: 0, type: 'skill' }],
      inventory: [],
      baselinePossessions: [],
    } as any
    const result = normalize(character)
    expect(result.attributes.stamina).toMatchObject({ maximum: 24, current: 24 })
    expect(result.attributes.luck).toMatchObject({ maximum: 7, current: 0 })
    expect(result.advancedSkills[0].total).toBe(9)
  })
})
