import { useEffect, useRef, useState } from 'react'
import './App.css'
import { loadGameData } from './data/load'
import {
  armour,
  d66,
  encumbrance,
  makeCharacter,
  normalize,
  randomSpell,
  rollExpression,
  weaponNames,
} from './rules/character'
import { download, exportable, notice, validate } from './export/character'
import type { AdvancedSkill, Character, GameData, Item } from './types'

const fallback = 'Data from Troika! System JSON by Chee Leong (MIT).'

export default function App() {
  const [data, setData] = useState<GameData>()
  const [pc, setPc] = useState<Character>()
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [roll, setRoll] = useState(true)
  const [viewMode, setViewMode] = useState<'both' | 'editor' | 'sheet'>('both')
  const file = useRef<HTMLInputElement>(null)

  const load = () => {
    setStatus('Loading live data…')
    loadGameData((a, b) => setStatus(`Loading live data: ${a} of ${b}`))
      .then(setData)
      .catch(e => setStatus(`Unable to load data: ${e.message}`))
  }

  useEffect(load, [])

  const update = (next: Character) => setPc(normalize(next))

  const generate = (id?: number) => {
    const bg =
      data?.backgrounds.find(x => x.id === id) ??
      data?.backgrounds[Math.floor(Math.random() * (data?.backgrounds.length ?? 1))]
    if (data && bg) setPc(makeCharacter(bg, data, { roll }))
  }

  // Flipping the switch re-issues the open sheet in the new mode; name and
  // notes survive, everything the generator produces is redone.
  const rollMyOwn = (manual: boolean) => {
    const background = data?.backgrounds.find(x => x.name === pc?.background)
    if (pc && background) {
      const redo = 'Redo this character? Rolled values and gear edits are replaced.'
      if (!window.confirm(redo)) return
      setPc({
        ...makeCharacter(background, data!, { roll: !manual }),
        name: pc.name,
        notes: pc.notes,
      })
    }
    setRoll(!manual)
  }

  // Back to the background list. The character only lives in memory, so warn
  // before dropping it.
  const home = () => {
    const unsaved = 'Leave this character? It is lost unless you have downloaded the JSON.'
    if (!window.confirm(unsaved)) return
    setPc(undefined)
    setErrors([])
    setStatus('')
  }

  // Chrome (and most browsers) suggest document.title as the "Save as PDF"
  // filename, so swap it to the background name for the duration of the print
  // dialog, then put it back once the dialog closes.
  const printSheet = () => {
    if (!pc) return
    const original = document.title
    document.title = pc.background || original
    const restore = () => {
      document.title = original
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  const importFile = async (f?: File) => {
    if (!f || !data) return
    try {
      const raw = JSON.parse(await f.text())
      delete raw._generator
      const checked = validate(raw, data.schema)
      if (checked.valid) {
        update(raw)
        setErrors(
          data.backgrounds.some(background => background.name === raw.background)
            ? []
            : [`Unknown background “${raw.background}”; background details are unavailable.`]
        )
      } else setErrors(checked.errors)
    } catch {
      setErrors(['The selected file is not valid JSON.'])
    }
  }

  if (!data)
    return (
      <main className="app-loading-state">
        <div className="loading-card">
          <div className="eyebrow">TROIKA! SYSTEM SRD</div>
          <h1>Troika! Character Generator</h1>
          <p className="status-message warning">{status || 'Starting engine…'}</p>
          {status.startsWith('Unable') && (
            <button className="btn-primary" onClick={load}>
              Retry Loading Data
            </button>
          )}
        </div>
        <Footer attribution={fallback} />
      </main>
    )

  const burden = pc && encumbrance(pc, data.manifest.rules.encumbrance)

  return (
    <main
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault()
        void importFile(event.dataTransfer.files[0])
      }}
    >
      <header className="app-header">
        <div className="header-brand">
          <div className="eyebrow-badge">
            <span className="badge-dot"></span> LIVE SRD SYSTEM
          </div>
          <h1>Troika! Character Generator</h1>
          <p className="header-subtitle">
            Generate, customize, and print table-ready characters for Troika! TRPG.
          </p>
        </div>
        <div className="actions no-print">
          <div className="actions-left">
            {pc && (
              <button className="btn-secondary" onClick={home}>
                ← Backgrounds
              </button>
            )}
          </div>
          <div className="actions-center">
            <button className="btn-primary" onClick={() => generate(d66())}>
              Roll d66
            </button>
            <label className="roll-toggle">
              <input type="checkbox" checked={!roll} onChange={e => rollMyOwn(e.target.checked)} />
              <span className="toggle-switch"></span>
              Manual dice rolling mode
            </label>
          </div>
          <div className="actions-right">
            <button className="btn-outline" onClick={() => file.current?.click()}>
              Import JSON
            </button>
            <input
              ref={file}
              hidden
              type="file"
              accept="application/json"
              onChange={e => importFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </header>

      {!pc ? (
        <Picker data={data} choose={generate} />
      ) : (
        <>
          <div className="view-mode-bar no-print">
            <div className="view-mode-tabs" role="tablist" aria-label="View layout options">
              <button
                className={`tab-btn ${viewMode === 'both' ? 'active' : ''}`}
                onClick={() => setViewMode('both')}
              >
                Split View (Editor + Sheet)
              </button>
              <button
                className={`tab-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => setViewMode('editor')}
              >
                Interactive Editor
              </button>
              <button
                className={`tab-btn ${viewMode === 'sheet' ? 'active' : ''}`}
                onClick={() => setViewMode('sheet')}
              >
                Sheet Preview
              </button>
            </div>
            <div className="pc-quick-badge">
              <span className="pc-name">{pc.name || 'Unnamed Adventurer'}</span>
              <span className="pc-bg">{pc.background}</span>
            </div>
          </div>

          <div className={`workspace workspace-mode-${viewMode}`}>
            {(viewMode === 'both' || viewMode === 'editor') && (
              <section className="editor no-print">
                <div className="editor-section-head">
                  <h2>Character Details</h2>
                  <button
                    className="btn-sm btn-outline"
                    onClick={() =>
                      generate(data.backgrounds.find(x => x.name === pc.background)?.id)
                    }
                  >
                    New {pc.background}
                  </button>
                </div>

                <div className="name-field-group">
                  <label htmlFor="character-name-input">Character Name</label>
                  <input
                    id="character-name-input"
                    className="name-input"
                    value={pc.name}
                    placeholder="Enter character name…"
                    onChange={e => update({ ...pc, name: e.target.value })}
                  />
                </div>

                <AttributeEditor pc={pc} data={data} update={update} />
                <SkillEditor pc={pc} data={data} update={update} />

                <div className="notes-field-group">
                  <label htmlFor="character-notes-input">Notes & Backstory</label>
                  <textarea
                    id="character-notes-input"
                    value={pc.notes ?? ''}
                    placeholder="Record character details, quests, connections, or inventory notes…"
                    onChange={e => update({ ...pc, notes: e.target.value })}
                  />
                </div>
              </section>
            )}

            {(viewMode === 'both' || viewMode === 'sheet') && (
              <div className="sheet-view-container">
                <Sheet pc={pc} data={data} burden={burden!} update={update} />
              </div>
            )}
          </div>

          <div className="export-bar no-print">
            <div className="export-actions">
              <div className="export-actions-left"></div>
              <div className="export-actions-center">
                <button className="btn-primary" onClick={printSheet}>
                  Print sheet / Save PDF
                </button>
              </div>
              <div className="export-actions-right">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const r = validate(
                      exportable(pc, data.manifest.metadata.attribution || fallback),
                      data.schema
                    )
                    setErrors(r.errors)
                    if (r.valid) download(pc, data.manifest.metadata.attribution || fallback)
                  }}
                >
                  Download JSON
                </button>
              </div>
            </div>
            {errors.length > 0 && (
              <div className="error-alert">
                <strong>Validation Errors:</strong>
                <ul className="error">
                  {errors.map(x => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      <Footer attribution={data.manifest.metadata.attribution || fallback} />
    </main>
  )
}

function AttributeEditor({
  pc,
  data,
  update,
}: {
  pc: Character
  data: GameData
  update: (p: Character) => void
}) {
  const dice = data.manifest.rules.coreRules.attributeGeneration
  const set = (attributes: Character['attributes']) =>
    update({ ...pc, unrolled: undefined, attributes })

  return (
    <div className="editor-card attributes-editor">
      <h3>Attributes</h3>
      <div className="attributes-grid">
        <div className="attribute-card">
          <div className="attr-header">
            <span className="attr-label">Skill</span>
            <span className="limit-tag">Range: 4–6 ({dice.skill})</span>
          </div>
          <div className="attr-input-wrap">
            <input
              type="number"
              value={pc.unrolled ? '' : pc.attributes.skill}
              placeholder={dice.skill}
              min="4"
              max="6"
              onChange={e => set({ ...pc.attributes, skill: Number(e.target.value) })}
            />
          </div>
        </div>

        {(['stamina', 'luck'] as const).map(k => (
          <div className="attribute-card" key={k}>
            <div className="attr-header">
              <span className="attr-label">{k}</span>
              <span className="limit-tag">Current / Max ({dice[k]})</span>
            </div>
            <div className="attr-dual-inputs">
              <input
                type="number"
                value={pc.unrolled ? '' : pc.attributes[k].current}
                placeholder={dice[k]}
                min="0"
                max={pc.unrolled ? undefined : pc.attributes[k].maximum}
                aria-label={`Current ${k}`}
                onChange={e =>
                  set({
                    ...pc.attributes,
                    [k]: { ...pc.attributes[k], current: Number(e.target.value) },
                  })
                }
              />
              <span className="sep">/</span>
              <input
                type="number"
                value={pc.unrolled ? '' : pc.attributes[k].maximum}
                placeholder={dice[k]}
                min={k === 'stamina' ? 14 : 7}
                max={k === 'stamina' ? 24 : 12}
                aria-label={`Maximum ${k}`}
                onChange={e =>
                  set({
                    ...pc.attributes,
                    [k]: { ...pc.attributes[k], maximum: Number(e.target.value) },
                  })
                }
              />
            </div>
            <button
              className="btn-xs btn-outline attr-reroll"
              onClick={() => {
                const n = rollExpression(data.manifest.rules.coreRules.attributeGeneration[k])
                set({ ...pc.attributes, [k]: { ...pc.attributes[k], current: n, maximum: n } })
              }}
            >
              Re-roll max
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillEditor({
  pc,
  data,
  update,
}: {
  pc: Character
  data: GameData
  update: (p: Character) => void
}) {
  const weapons = weaponNames(data)
  const change = (i: number, v: Partial<AdvancedSkill>) =>
    update({
      ...pc,
      advancedSkills: pc.advancedSkills.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })

  return (
    <div className="editor-card skills-editor">
      <h3>Skills & Advancement</h3>
      <div className="skill-edit-table">
        <div className="skill-edit-header">
          <span>Skill / Spell</span>
          <span>Options</span>
          <span>Rank</span>
          <span>Total</span>
          <span className="header-check">Used</span>
          <span>Actions</span>
        </div>
        {pc.advancedSkills.map((x, i) => (
          <div className="skill-edit" key={`${x.name}-${i}`}>
            <span className="skill-name-col">
              <strong className="skill-name">{x.name}</strong>
              <small className={`skill-type-tag tag-${x.type}`}>{x.type}</small>
            </span>
            <span className="skill-options-col">
              {x.type === 'weapon' ? (
                <select
                  className="weapon-select"
                  aria-label={`Change weapon for ${x.name}`}
                  value={weapons.find(name => x.name === `${name} Fighting`) ?? ''}
                  onChange={event => change(i, { name: `${event.target.value} Fighting` })}
                >
                  <option value="">Choose weapon…</option>
                  {weapons.map(name => (
                    <option key={name} value={name}>
                      {name} Fighting
                    </option>
                  ))}
                </select>
              ) : x.type === 'spell' ? (
                <div className="spell-select-group">
                  <select
                    className="weapon-select"
                    aria-label={`Change spell for ${x.name}`}
                    value={data.spells.has(x.name) ? x.name : ''}
                    onChange={event => change(i, { name: event.target.value })}
                  >
                    <option value="">Choose spell…</option>
                    {[...data.spells.keys()].map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="spell-reroll-btn btn-xs"
                    onClick={() => change(i, { name: randomSpell(data) ?? x.name })}
                  >
                    Roll
                  </button>
                </div>
              ) : (
                <span className="no-option">—</span>
              )}
            </span>
            <span className="edit-stat">
              <input
                type="number"
                min="1"
                value={x.rank}
                aria-label={`Rank for ${x.name}`}
                onChange={e => change(i, { rank: Number(e.target.value) })}
              />
            </span>
            <span className="edit-stat total-badge">
              <strong>{x.total}</strong>
            </span>
            <label className="edit-check">
              <input
                type="checkbox"
                checked={Boolean(x.ticks)}
                aria-label={`Skill used check for ${x.name}`}
                onChange={e => change(i, { ticks: e.target.checked ? 1 : 0 })}
              />
            </label>
            <span className="skill-actions-col">
              <button
                className="btn-xs btn-upgrade"
                onClick={() => change(i, { rank: x.rank + 1, ticks: 0 })}
              >
                +1 Rank
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Picker({ data, choose }: { data: GameData; choose: (id: number) => void }) {
  const [q, setQ] = useState('')
  const matches = data.backgrounds.filter(x => x.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <section className="picker">
      <div className="picker-hero">
        <h2>Choose or Roll Your Background</h2>
        <p>Select from 36 unique Troika! backgrounds or roll a random character.</p>
        <button className="btn-primary btn-hero-roll" onClick={() => choose(d66())}>
          Roll Random Background (d66)
        </button>
      </div>

      <div className="picker-filter-bar">
        <div className="picker-search-wrap">
          <input
            value={q}
            placeholder="Search backgrounds by name or keyword…"
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button className="clear-btn" onClick={() => setQ('')}>
              ✕
            </button>
          )}
        </div>
        <p className="picker-count">
          {matches.length === data.backgrounds.length
            ? `${matches.length} backgrounds available`
            : `${matches.length} of ${data.backgrounds.length} backgrounds`}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="picker-empty">No background matches “{q}”.</p>
      ) : (
        <div className="backgrounds">
          {matches.map(x => (
            <button className="background-card" key={x.id} onClick={() => choose(x.id)}>
              <div className="background-card-header">
                <b className="background-name">{x.name}</b>
                <span className="background-roll-dice" title={`d66 roll ${x.id}`}>
                  <span className="die-box">{String(x.id)[0]}</span>
                  <span className="die-box">{String(x.id)[1]}</span>
                </span>
              </div>
              <span className="background-blurb">
                {x.description || 'Generate this character.'}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Sheet({
  pc,
  data,
  burden,
  update,
}: {
  pc: Character
  data: GameData
  burden: { slots: number; state: string }
  update: (p: Character) => void
}) {
  const background = data.backgrounds.find(x => x.name === pc.background)
  const dice = data.manifest.rules.coreRules.attributeGeneration

  const unpicked = (x: AdvancedSkill) =>
    x.name === 'Random'
      ? 'random spell'
      : x.name === 'Fighting in chosen weapon'
        ? 'chosen weapon'
        : ''

  const skill = (i: number, v: Partial<AdvancedSkill>) =>
    update({
      ...pc,
      advancedSkills: pc.advancedSkills.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })

  const { maxSlots, severelyOverburdenedThreshold } = data.manifest.rules.encumbrance
  const free = Math.max(0, maxSlots - burden.slots)
  const over = Math.max(0, severelyOverburdenedThreshold - Math.max(maxSlots, burden.slots))

  const glossary = pc.advancedSkills.reduce<Array<{ name: string; description: string }>>(
    (acc, x) => {
      const description =
        x.type === 'spell'
          ? data.spells.get(x.name)?.description
          : data.skills.get(x.name)?.description
      if (description && !acc.some(g => g.name === x.name)) acc.push({ name: x.name, description })
      return acc
    },
    []
  )

  const encPercent = Math.min(100, Math.round((burden.slots / maxSlots) * 100))

  return (
    <section className="sheet">
      <div className="sheet-head">
        <div className="head-identity">
          <p>TROIKA! CHARACTER SHEET</p>
          <h2 className="character-name">
            {pc.name || <span className="web-current">Unnamed adventurer</span>}
          </h2>
          <span className="head-background">{pc.background}</span>
        </div>
        <div className="head-stats-group">
          {(['skill', 'stamina', 'luck'] as const).map(key => {
            const label = key.toUpperCase()
            const val = key === 'skill' ? pc.attributes.skill : pc.attributes[key].current
            const maxVal = key === 'skill' ? undefined : pc.attributes[key].maximum
            const diceFormula = dice[key]

            return (
              <p className={`header-stat head-${key}`} key={key}>
                <span>{label}</span>
                <b>
                  {pc.unrolled ? (
                    <>
                      <span className="web-current">—</span>
                      <span className={`print-resource${key !== 'skill' ? ' paired' : ''}`}>
                        <span className="print-current-box" aria-label={`Current ${key}`}></span>
                        {key !== 'skill' && (
                          <>
                            {' / '}
                            <span
                              className="print-current-box"
                              aria-label={`Maximum ${key}`}
                            ></span>
                          </>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="web-current">{val}</span>
                      {key === 'skill' ? (
                        <span className="print-only">{val}</span>
                      ) : (
                        <span className="print-resource paired">
                          <span className="print-current-box" aria-label={`Current ${key}`}></span>{' '}
                          / {maxVal}
                        </span>
                      )}
                    </>
                  )}
                </b>
                {pc.unrolled && <small className="to-roll">{diceFormula}</small>}
              </p>
            )
          })}
        </div>
      </div>

      {background?.description && (
        <div className="background-description">
          <h3>Background</h3>
          <p>{background.description}</p>
        </div>
      )}

      <h3>Advanced skills</h3>
      <div className="skills-table-container">
        <div className="sheet-skill-header">
          <span>Skill / Spell</span>
          <span>Cost</span>
          <span>Rank</span>
          <span>Skill Total</span>
          <span className="header-check">Used</span>
        </div>
        {pc.advancedSkills.map((x, i) => (
          <div className="sheet-skill" key={i}>
            <span>
              {unpicked(x) !== '' ? (
                <span className="pick-hint">{unpicked(x)}</span>
              ) : (
                <>
                  {x.name} <small>{x.type}</small>
                </>
              )}
            </span>
            <span className="skill-cost">
              {x.type === 'spell' &&
                (data.spells.get(x.name)?.cost ?? (
                  <>
                    <span className="no-print empty-resource-box"></span>
                    <span className="print-resource">
                      <span className="print-resource-box"></span>
                    </span>
                  </>
                ))}
            </span>
            <span className="skill-stat">
              <span className="web-current">{x.rank}</span>
              <span className="print-resource">
                <span className="print-resource-box"></span> / {x.rank}
              </span>
            </span>
            <span className="skill-stat">
              <span className="web-current">{pc.unrolled ? '—' : x.total}</span>
              <span className="print-resource">
                <span className="print-resource-box"></span>
                {pc.unrolled ? '' : ` / ${x.total}`}
              </span>
            </span>
            <label className="skill-check">
              <input
                className="no-print"
                type="checkbox"
                checked={Boolean(x.ticks)}
                onChange={e => skill(i, { ticks: e.target.checked ? 1 : 0 })}
              />
              <span className="print-tickbox" aria-label="Skill used tickbox"></span>
            </label>
          </div>
        ))}
      </div>

      <WeaponDamage pc={pc} data={data} />

      <div className="inventory-header-bar">
        <h3>Inventory</h3>
        <div className="encumbrance-tracker">
          <span className="encumbrance-label">Encumbrance</span>
          <span className="encumbrance-box">
            <span className="web-current">{burden.slots}</span>
            <span className="print-resource">
              <span className="print-resource-box" aria-label="Encumbrance slots"></span>
            </span>
          </span>
          <span className="encumbrance-max"> / {maxSlots}</span>
          {burden.state !== 'unencumbered' && (
            <small className="encumbrance-state"> ({burden.state})</small>
          )}
        </div>
      </div>
      <div className="encumbrance-progress-bar no-print">
        <div
          className={`progress-fill ${burden.state !== 'unencumbered' ? 'overburdened' : ''}`}
          style={{ width: `${encPercent}%` }}
        />
      </div>

      <div className="inventory-table-container">
        <div className="sheet-item-header">
          <span>Item</span>
          <span>Armour</span>
          <span>Qty</span>
          <span>Slots</span>
          <span className="no-print"></span>
        </div>
        <InventorySheet pc={pc} update={update} normalFree={free} overburdenedFree={over} />
      </div>

      {pc.specialAbilities?.length ? (
        <>
          <h3>Special abilities</h3>
          <ul>
            {pc.specialAbilities.map(x => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Notes</h3>
      {pc.notes ? (
        <p>{pc.notes}</p>
      ) : (
        <div className="notes-lines" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span className="notes-line" key={i} />
          ))}
        </div>
      )}

      {glossary.length > 0 && (
        <>
          <h3>Glossary</h3>
          <ul className="glossary">
            {glossary.map(g => (
              <li key={g.name}>
                <strong>{g.name}</strong>
                <small className="item-description">{g.description}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="sheet-footer">{notice}</p>
    </section>
  )
}

function WeaponDamage({ pc, data }: { pc: Character; data: GameData }) {
  const tables = [...data.tables.values()]
  const rowFor = (name: string, damageAs?: string) => {
    let weapon = damageAs ?? (name.endsWith(' Fighting') ? name.slice(0, -9) : name)
    if (['fist', 'fist fighting', 'wrestling'].includes(weapon.toLowerCase())) {
      weapon = 'Unarmed'
    }
    for (const table of tables) {
      const matrix = table.damageMatrix?.matrix
      if (!matrix) continue
      const key = Object.keys(matrix).find(k => k.toLowerCase() === weapon.toLowerCase())
      if (key) {
        const displayName = name.endsWith(' Fighting') ? name.slice(0, -9) : name
        return { weapon: key, alias: displayName, values: matrix[key] }
      }
    }
    return undefined
  }
  const rawRows: Array<{ weapon: string; alias?: string; values: Record<string, string> }> = []

  const addWeaponRow = (name: string, damageAs?: string) => {
    const row = rowFor(name, damageAs)
    if (row) rawRows.push(row)
  }

  addWeaponRow('Unarmed')

  for (const item of [...pc.inventory, ...pc.baselinePossessions]) {
    if (item.damageAs) addWeaponRow(item.name, item.damageAs)
  }
  for (const skill of pc.advancedSkills.filter(x => x.type === 'weapon')) {
    addWeaponRow(skill.name)
  }

  const rowsByWeaponKey = new Map<
    string,
    { weapon: string; alias?: string; values: Record<string, string> }
  >()
  const grouped = new Map<string, typeof rawRows>()
  for (const row of rawRows) {
    const key = row.weapon.toLowerCase()
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  for (const [key, group] of grouped) {
    const baseRow = group[0]
    const aliases = Array.from(
      new Set(
        group
          .map(r => r.alias)
          .filter(
            (a): a is string => Boolean(a) && a?.toLowerCase() !== baseRow.weapon.toLowerCase()
          )
      )
    )
    rowsByWeaponKey.set(key, {
      ...baseRow,
      alias: aliases.length ? aliases.join(', ') : undefined,
    })
  }

  const rows = [...rowsByWeaponKey.values()]
  const spellRows = pc.advancedSkills
    .filter(x => x.type === 'spell')
    .map(x => ({ weapon: x.name, values: data.spells.get(x.name)?.damageTable }))
    .filter(x => x.values) as Array<{ weapon: string; values: Record<string, string> }>

  const declaredRolls = tables.flatMap(table => table.damageMatrix?.rollColumns ?? [])
  const rolls = Array.from(
    new Set([
      ...[...rows, ...spellRows].flatMap(r => Object.keys(r.values)),
      ...declaredRolls,
      ...(declaredRolls.length ? [] : ['1', '2', '3', '4', '5', '6', '7+']),
    ])
  )
  const cell = (row: { values: Record<string, string> }) =>
    rolls.map(roll => <span key={roll}>{row.values[roll] ?? '—'}</span>)
  const blankRows = 3

  return (
    <>
      <h3>{spellRows.length ? 'Weapon & spell damage' : 'Weapon damage'}</h3>
      <div className="damage-matrix-container">
        <div className="damage-matrix">
          <div className="damage-header">
            <span>{spellRows.length && !rows.length ? 'Spell' : 'Weapon'}</span>
            {rolls.map(roll => (
              <span key={roll}>{roll}</span>
            ))}
          </div>
          {rows.map(row => (
            <div className="damage-row" key={row.weapon + (row.alias ?? '')}>
              <b>
                {row.weapon}
                {row.alias && row.alias.toLowerCase() !== row.weapon.toLowerCase() && (
                  <small> ({row.alias})</small>
                )}
              </b>
              {cell(row)}
            </div>
          ))}
          {spellRows.map(row => (
            <div className="damage-row spell-damage" key={row.weapon}>
              <b>
                {row.weapon} <small>spell</small>
              </b>
              {cell(row)}
            </div>
          ))}
          {Array.from({ length: blankRows }, (_, i) => (
            <div className="damage-row damage-blank" key={`blank-${i}`}>
              <b></b>
              {rolls.map(roll => (
                <span key={roll}></span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function EditableItemName({ item, onChange }: { item: Item; onChange: (name: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(item.name)

  useEffect(() => {
    setValue(item.name)
  }, [item.name])

  if (isEditing) {
    return (
      <input
        className="web-name-input no-print"
        autoFocus
        value={value}
        aria-label={`Edit name for ${item.name}`}
        onChange={e => setValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false)
          if (value.trim() !== '') onChange(value)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setIsEditing(false)
            if (value.trim() !== '') onChange(value)
          } else if (e.key === 'Escape') {
            setValue(item.name)
            setIsEditing(false)
          }
        }}
      />
    )
  }

  return (
    <span
      className="web-item-display no-print"
      title="Click to edit item name"
      onClick={() => setIsEditing(true)}
    >
      <span className="item-name-text">{item.name}</span>
      {item.description && <small className="item-description">{item.description}</small>}
    </span>
  )
}

function InventorySheet({
  pc,
  update,
  normalFree,
  overburdenedFree,
}: {
  pc: Character
  update: (p: Character) => void
  normalFree: number
  overburdenedFree: number
}) {
  const total = armour(pc)
  const protection = (possession: Item, set: (v: Partial<Item>) => void) => {
    const val = possession.armour ?? possession.armor
    return (
      <span className="armour-display">
        <input
          className="no-print"
          type="number"
          min="0"
          value={val ?? ''}
          aria-label={`Armour from ${possession.name}`}
          onChange={e => {
            const num = e.target.value === '' ? undefined : Number(e.target.value)
            set({ armour: num, armor: num })
          }}
        />
        <span className="print-resource">
          {val ?? <span className="print-resource-box"></span>}
        </span>
      </span>
    )
  }

  const quantityCell = (possession: Item, set: (v: Partial<Item>) => void) => {
    const maximum = possession.maximumQuantity ?? possession.quantity
    const isPence = possession.name.toLowerCase().includes('pence')
    const qtyInput = (
      <input
        type="number"
        min="0"
        value={possession.quantity ?? ''}
        aria-label={`Quantity of ${possession.name}`}
        onChange={e =>
          set({
            quantity: e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
      />
    )
    if (isPence) {
      return (
        <span className="item-qty">
          <label className="no-print">{qtyInput}</label>
          <span className="print-resource print-quantity">
            <span className="print-resource-box"></span>
            {!pc.unrolled && (
              <>
                {' / '}
                {maximum ?? <span className="print-resource-box"></span>}
              </>
            )}
          </span>
        </span>
      )
    }
    const maxInput = (
      <input
        type="number"
        min="0"
        value={maximum ?? ''}
        aria-label={`Maximum quantity of ${possession.name}`}
        onChange={e =>
          set({
            maximumQuantity: e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
      />
    )
    return (
      <span className="item-qty">
        <span className="no-print qty-value-group">
          <label className="qty-field">{qtyInput}</label>
          <span className="qty-slash">/</span>
          <label className="qty-field">{maxInput}</label>
        </span>
        <span className="print-resource print-quantity">
          <span className="print-resource-box"></span> /{' '}
          {maximum ?? <span className="print-resource-box"></span>}
        </span>
      </span>
    )
  }

  const change = (i: number, v: Partial<Item>) =>
    update({ ...pc, inventory: pc.inventory.map((x, j) => (j === i ? { ...x, ...v } : x)) })

  const baseline = (i: number, v: Partial<Item>) =>
    update({
      ...pc,
      baselinePossessions: pc.baselinePossessions.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pc.inventory.length) return
    const inventory = [...pc.inventory]
    const [moved] = inventory.splice(from, 1)
    inventory.splice(to, 0, moved)
    update({ ...pc, inventory })
  }

  const blank = (key: string, over = false) => (
    <div className={over ? 'sheet-item blank over' : 'sheet-item blank'} key={key}>
      <span className="blank-name"></span>
      <span className="blank-armour">
        <span className="no-print empty-resource-box"></span>
        <span className="print-resource">
          <span className="print-resource-box"></span>
        </span>
      </span>
      <span className="blank-web">
        <span className="empty-resource-box"></span> / <span className="empty-resource-box"></span>
      </span>
      <span className="blank-web">
        <span className="empty-resource-box"></span>
      </span>
      <span className="print-resource blank-resource">
        <span className="print-resource-box"></span> / <span className="print-resource-box"></span>
      </span>
      <span className="print-slots">
        <span className="print-resource-box"></span>
      </span>
    </div>
  )

  return (
    <>
      {pc.baselinePossessions.map((x, i) => (
        <div
          className={x.used ? 'sheet-item checked' : 'sheet-item'}
          key={`baseline-${x.position}`}
        >
          <span className="item-label">
            {x.name} <small className="baseline-tag">baseline</small>
          </span>
          {protection(x, v => baseline(i, v))}
          {quantityCell(x, v => baseline(i, v))}
          <span className="slot-display">
            <span className="slot-value">{x.slots}</span>
          </span>
          <span className="no-print"></span>
        </div>
      ))}
      {pc.inventory.map((x, i) => (
        <div className={x.used ? 'sheet-item checked' : 'sheet-item'} key={x.position}>
          <span className="item-label">
            <span className="print-name">
              <span>{x.name}</span>
              {x.description && <small className="item-description">{x.description}</small>}
            </span>
            <EditableItemName item={x} onChange={name => change(i, { name })} />
          </span>
          {protection(x, v => change(i, v))}
          {quantityCell(x, v => change(i, v))}
          <span className="slot-display">
            <input
              className="no-print"
              type="number"
              min="0"
              value={x.slots}
              aria-label={`Slots used by ${x.name}`}
              onChange={e => change(i, { slots: Math.max(0, Number(e.target.value)) })}
            />
            <span className="slot-value print-only">{x.slots}</span>
          </span>
          <span className="no-print inventory-actions">
            <div className="item-reorder-group" role="group" aria-label="Reorder item">
              <button
                className="btn-reorder btn-icon"
                disabled={i === 0}
                aria-label={`Move ${x.name} up`}
                onClick={() => move(i, i - 1)}
              >
                ▲
              </button>
              <button
                className="btn-reorder btn-icon"
                disabled={i === pc.inventory.length - 1}
                aria-label={`Move ${x.name} down`}
                onClick={() => move(i, i + 1)}
              >
                ▼
              </button>
            </div>
            <label className="used-label-pill">
              <input
                type="checkbox"
                checked={Boolean(x.used)}
                onChange={e => change(i, { used: e.target.checked })}
              />{' '}
              Used
            </label>
            <button
              className="remove btn-danger"
              onClick={() => update({ ...pc, inventory: pc.inventory.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </span>
        </div>
      ))}
      {Array.from({ length: normalFree }, (_, i) => blank(`free-${i}`))}
      {overburdenedFree > 0 && (
        <div className="over-divider">Additional slots carry a −4 penalty</div>
      )}
      {Array.from({ length: overburdenedFree }, (_, i) => blank(`over-${i}`, true))}
      <div className="sheet-item inventory-total">
        <span className="item-label">
          Armour Total
          <small className="item-description">
            Subtract from every Damage Roll against you; damage never drops below 1
          </small>
        </span>
        <span className="armour-display total-value">
          <span className="web-current">{total}</span>
          <span className="print-resource">
            {total ? (
              <>
                <span className="print-resource-box"></span> / {total}
              </>
            ) : (
              <span className="print-resource-box"></span>
            )}
          </span>
        </span>
        <span></span>
        <span></span>
        <span className="no-print"></span>
      </div>
      {pc.inventory.length < 18 && (
        <button
          className="no-print btn-outline add-item-btn"
          onClick={() =>
            update({
              ...pc,
              inventory: [
                ...pc.inventory,
                { name: 'New item', position: pc.inventory.length + 1, slots: 1, quantity: 1 },
              ],
            })
          }
        >
          + Add inventory item
        </button>
      )}
    </>
  )
}

function Footer({ attribution }: { attribution: string }) {
  const systemJsonUrl = 'https://cheeleong.dev/troika-system-json/'
  const renderAttribution = () => {
    if (attribution.includes('Troika! System JSON')) {
      const parts = attribution.split('Troika! System JSON')
      return (
        <>
          {parts[0]}
          <a href={systemJsonUrl} target="_blank" rel="noreferrer">
            Troika! System JSON
          </a>
          {parts[1]}
        </>
      )
    }
    return (
      <>
        {attribution}{' '}
        <a href={systemJsonUrl} target="_blank" rel="noreferrer">
          Troika! System JSON
        </a>
        .{' '}
      </>
    )
  }

  return (
    <footer className="app-footer">
      <p className="legal-notice">{notice}</p>
      <p className="attribution">
        {renderAttribution()} Based on the{' '}
        <a href="https://troika-srd.netlify.app/" target="_blank" rel="noreferrer">
          Troika! SRD
        </a>
        . <i>Troika!</i> is a trademark of the Melsonian Arts Council.
      </p>
      <p className="github-link">
        <a href="https://github.com/klrkdekira/troika-generator" target="_blank" rel="noreferrer">
          View source on GitHub
        </a>
      </p>
    </footer>
  )
}
