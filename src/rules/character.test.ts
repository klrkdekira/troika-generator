import { describe, expect, it } from 'vitest'
import { d66, encumbrance, rollExpression, skillType } from './character'

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
    const result = encumbrance({ inventory: Array.from({length: 12}, (_, position) => ({ name: 'x', position, slots: 1 })), baselinePossessions: [{ name: 'kit', position: 1, slots: 1 }] } as any, { maxSlots: 12, severelyOverburdenedThreshold: 18 })
    expect(result.state).toContain('overburdened')
  })
})
