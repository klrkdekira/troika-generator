import { describe, expect, it } from 'vitest'
import { exportable, notice } from './character'

describe('Character export', () => {
  it('includes required legal notice and attribution metadata in exported JSON', () => {
    const mockCharacter = {
      name: 'Test Adventurer',
      background: 'Arithmetician',
      attributes: {
        skill: 5,
        stamina: { current: 18, maximum: 18 },
        luck: { current: 10, maximum: 10 },
      },
      advancedSkills: [],
      inventory: [],
      baselinePossessions: [],
    }
    const mockAttribution = 'Data from Troika! System JSON by Chee Leong (MIT).'

    const exported = exportable(mockCharacter as any, mockAttribution)

    expect(exported._generator).toBeDefined()
    expect(exported._generator.notice).toBe(
      'Troika! Character Generator is an independent production by Chee Leong and is not affiliated with the Melsonian Arts Council.'
    )
    expect(exported._generator.notice).toBe(notice)
    expect(exported._generator.attribution).toBe(mockAttribution)
  })
})
