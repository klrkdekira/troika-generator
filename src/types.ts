// Hand-written mirror of the live character schema. Keep this intentionally small.
export type SkillType = 'skill' | 'spell' | 'language' | 'secret' | 'weapon'

export interface Item { used?: boolean; maximumQuantity?: number; name: string; position: number; slots: number; quantity?: number; description?: string; properties?: string[]; readyForUse?: boolean; condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'broken' }
export interface AdvancedSkill { name: string; rank: number; total: number; type: SkillType; specialization?: string; ticks?: number }
export interface Character { name: string; background: string; attributes: { skill: number; stamina: { current: number; maximum: number; temporary: number }; luck: { current: number; maximum: number; timesTestedThisSession: number } }; advancedSkills: AdvancedSkill[]; inventory: Item[]; baselinePossessions: Item[]; initiativeTokens: number; specialAbilities?: string[]; languages?: string[]; secretSigns?: string[]; notes?: string; '@context'?: string; '@type'?: string }

export interface Background { id: number; name: string; description?: string; advancedSkills?: Array<{ name: string; rank: number }>; spells?: Array<{ name: string; rank: number }>; possessions?: Array<{ name: string; description?: string; properties?: string[]; category?: string }>; special?: string[]; overrideBaselinePossessions?: boolean }
export interface Manifest { metadata: { attribution?: string; title?: string }; rules: Record<string, any>; backgrounds: Array<Background | { $ref: string }>; skills?: Array<any>; spells?: Array<any>; tables?: Array<any> }
export interface GameData { manifest: Manifest; backgrounds: Background[]; skills: Map<string, any>; spells: Map<string, any>; tables: Map<string, any>; schema: object; warnings: string[] }
