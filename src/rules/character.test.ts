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
        { name: 'Shield', position: 2, slots: 2, armor: 1 },
        { name: 'Knife', position: 3, slots: 1 },
        { name: 'Tassels', position: 4, slots: 0, armour: 2 },
      ],
      baselinePossessions: [{ name: 'Rucksack', position: 1, slots: 1 }],
    } as any
    expect(armour(character)).toBe(6)
    expect(armour({ inventory: [], baselinePossessions: [] } as any)).toBe(0)
    // Normalisation keeps the entered value, syncs armor/armour, preserves 0 slots, and refuses negative values.
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
        { name: 'Cursed Plate', position: 5, slots: 2, armour: -2 },
      ],
    } as any)
    expect(normalised.inventory.map(x => x.armour)).toEqual([3, 1, undefined, 2, 0])
    expect(normalised.inventory.map(x => x.armor)).toEqual([3, 1, undefined, 2, 0])
    expect(normalised.inventory.map(x => x.slots)).toEqual([6, 2, 1, 0, 2])
  })
  it('parses armour and slots from background possessions data', async () => {
    const data = await loadGameData()
    const qKnight = data.backgrounds.find(b => b.name === 'Questing Knight')!
    expect(qKnight).toBeDefined()
    const knightChar = makeCharacter(qKnight, data)
    expect(armour(knightChar)).toBe(4)

    const lansquenet = data.backgrounds.find(b => b.id === 33 || b.name === 'Lansquenet')!
    expect(lansquenet).toBeDefined()
    expect(lansquenet.id).toBe(33)
    const lansChar = makeCharacter(lansquenet, data)
    const clothes = lansChar.inventory.find(i => i.name.includes('Brightly Coloured Clothing'))
    expect(clothes).toBeDefined()
    expect(clothes?.slots).toBe(0)
    expect(clothes?.armour).toBe(2)

    // Normalize must preserve slot 0
    const normalizedLans = normalize(lansChar)
    const normClothes = normalizedLans.inventory.find(i =>
      i.name.includes('Brightly Coloured Clothing')
    )
    expect(normClothes?.slots).toBe(0)

    // Encumbrance slot 0 item must not consume an encumbrance slot
    const burden = encumbrance(normalizedLans, data.manifest.rules.encumbrance)
    expect(burden.slots).toBe(8)
    const freeSlots = data.manifest.rules.encumbrance.maxSlots - burden.slots
    expect(freeSlots).toBe(4)
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
  it('preserves damageAs for innate weapon possessions', async () => {
    const data = await loadGameData()
    const rhinoLike = {
      id: 46,
      name: 'Rhino-Man',
      possessions: [
        { name: 'Horn', category: 'weapon', damageAs: 'Knife', slots: 0 },
        { name: 'Claws', category: 'weapon', damageAs: 'Sword', slots: 0 },
        { name: 'Hooves', category: 'weapon', damageAs: 'Club', slots: 0 },
      ],
      advancedSkills: [],
      spells: [],
    }
    const character = makeCharacter(rhinoLike, data)
    expect(character.inventory).toEqual([
      expect.objectContaining({ name: 'Horn', damageAs: 'Knife', slots: 0 }),
      expect.objectContaining({ name: 'Claws', damageAs: 'Sword', slots: 0 }),
      expect.objectContaining({ name: 'Hooves', damageAs: 'Club', slots: 0 }),
    ])
  })
  it('reads top-level damageAs from catalog items', async () => {
    const data = await loadGameData()
    const items = new Map(data.items)
    items.set('Catalog Staff', { name: 'Catalog Staff', slots: 1, damageAs: 'Staff' })
    const character = makeCharacter(
      {
        id: 23,
        name: 'Catalog test',
        possessions: [{ name: 'Catalog Staff' }],
        advancedSkills: [],
        spells: [],
      },
      { ...data, items }
    )
    expect(character.inventory[0]).toMatchObject({ name: 'Catalog Staff', damageAs: 'Staff' })
  })
  it('leaves every die to the player when asked, and still validates', async () => {
    const data = await loadGameData()
    const apprentice = data.backgrounds.find(b => (b.spells ?? []).some(x => x.name === 'Random'))
    expect(apprentice).toBeDefined()
    if (!apprentice) return
    const blank = makeCharacter(apprentice, data, { roll: false })

    // A dice quantity declared beside the name (Cacogen's cores) has to read
    // like one written into it (the baseline "2d6 Silver Pence").
    const cacogen = data.backgrounds.find(b => b.name === 'Cacogen')!
    const cores = makeCharacter(cacogen, data, { roll: false }).inventory.find(x =>
      x.name.endsWith('Plasmic Cores')
    )
    expect(cores?.name).toBe('2d6 Plasmic Cores')
    expect(cores?.quantity).toBeUndefined()
    expect(
      makeCharacter(cacogen, data).inventory.find(x => x.name === 'Plasmic Cores')?.quantity
    ).toBeGreaterThanOrEqual(2)

    expect(blank.unrolled).toBe(true)
    expect(blank.attributes.skill).toBe(4)
    expect(blank.attributes.stamina.maximum).toBe(14)
    expect(blank.attributes.luck.maximum).toBe(7)
    // The background's own random choices stay open.
    expect(blank.advancedSkills.some(x => x.name === 'Random')).toBe(true)
    // Only dice are left to the player: the count goes blank and the expression
    // stays visible in the name, however the source spelled it.
    const pence = blank.baselinePossessions.find(x => x.name === '2d6 Silver Pence')
    expect(pence).toBeDefined()
    expect(pence?.quantity).toBeUndefined()
    expect(pence?.maximumQuantity).toBeUndefined()
    // Fixed counts are not dice, so they survive.
    expect(blank.baselinePossessions.find(x => x.name === 'Provisions')?.quantity).toBe(6)
    expect(blank.inventory.every(x => x.name !== '')).toBe(true)
    // Normalisation must not fill the blanks back in.
    const normalised = normalize(blank)
    expect(normalised.baselinePossessions[0].quantity).toBeUndefined()
    expect(validate(normalised, data.schema).errors).toEqual([])
  }, 30000)
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
  it('assigns 1 slot by default to baseline possessions except zero-slot items like Rucksack', async () => {
    const data = await loadGameData()
    const burglar = data.backgrounds.find(b => b.name === 'Burglar')!
    const character = makeCharacter(burglar, data)
    expect(character.baselinePossessions.length).toBeGreaterThan(0)
    for (const item of character.baselinePossessions) {
      if (item.name === 'Rucksack') {
        expect(item.slots).toBe(0)
      } else {
        expect(item.slots).toBe(1)
      }
    }
  })
})
