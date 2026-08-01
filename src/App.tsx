import { useEffect, useRef, useState } from 'react'
import './App.css'
import { loadGameData } from './data/load'
import { d66, encumbrance, makeCharacter, normalize, rollExpression } from './rules/character'
import { download, exportable, notice, validate } from './export/character'
import type { AdvancedSkill, Character, GameData, Item } from './types'

const fallback = 'Data from Troika! System JSON by Chee Leong (MIT).'
export default function App() {
  const [data, setData] = useState<GameData>()
  const [pc, setPc] = useState<Character>()
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<string[]>([])
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
    if (data && bg) setPc(makeCharacter(bg, data))
  }
  const importFile = async (f?: File) => {
    if (!f || !data) return
    try {
      const raw = JSON.parse(await f.text())
      delete raw._generator
      const checked = validate(raw, data.schema)
      if (checked.valid) {
        update(raw)
        setErrors([])
      } else setErrors(checked.errors)
    } catch {
      setErrors(['The selected file is not valid JSON.'])
    }
  }
  if (!data)
    return (
      <main>
        <h1>Troika! Character Generator</h1>
        <p className="warning">{status || 'Starting…'}</p>
        {status.startsWith('Unable') && <button onClick={load}>Retry</button>}
        <Footer attribution={fallback} />
      </main>
    )
  const burden = pc && encumbrance(pc, data.manifest.rules.encumbrance)
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">LIVE SRD CHARACTER TOOL</p>
          <h1>Troika! Character Generator</h1>
          <p>Generate a table-ready character from live system data.</p>
        </div>
        <div className="actions no-print">
          <button onClick={() => generate()}>Random background</button>
          <button onClick={() => generate(d66())}>Roll d66</button>
          <button onClick={() => file.current?.click()}>Import JSON</button>
          <input
            ref={file}
            hidden
            type="file"
            accept="application/json"
            onChange={e => importFile(e.target.files?.[0])}
          />
        </div>
      </header>
      {!pc ? (
        <Picker data={data} choose={generate} />
      ) : (
        <>
          <section className="editor no-print">
            <label>
              Name
              <input
                value={pc.name}
                placeholder="Character name"
                onChange={e => update({ ...pc, name: e.target.value })}
              />
            </label>
            <button
              onClick={() => generate(data.backgrounds.find(x => x.name === pc.background)?.id)}
            >
              New {pc.background}
            </button>
            <AttributeEditor pc={pc} data={data} update={update} />
            <SkillEditor pc={pc} update={update} />
            <label>
              Notes
              <textarea
                value={pc.notes ?? ''}
                onChange={e => update({ ...pc, notes: e.target.value })}
              />
            </label>
          </section>
          <Sheet pc={pc} data={data} burden={burden!} update={update} />
          <div className="export-bar no-print">
            <button
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
            <button onClick={() => window.print()}>Print sheet / Save PDF</button>
            {errors.length > 0 && (
              <ul className="error">
                {errors.map(x => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
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
  return (
    <>
      <h2>Attributes</h2>
      <div className="attributes">
        <label>
          Skill <span className="limit">limit 4–6</span>
          <input
            type="number"
            value={pc.attributes.skill}
            min="4"
            max="6"
            onChange={e =>
              update({ ...pc, attributes: { ...pc.attributes, skill: Number(e.target.value) } })
            }
          />
        </label>
        {(['stamina', 'luck'] as const).map(k => (
          <label key={k}>
            {k} <span className="limit">current / maximum</span>
            <span>
              <input
                type="number"
                value={pc.attributes[k].current}
                min="0"
                max={pc.attributes[k].maximum}
                onChange={e =>
                  update({
                    ...pc,
                    attributes: {
                      ...pc.attributes,
                      [k]: { ...pc.attributes[k], current: Number(e.target.value) },
                    },
                  })
                }
              />{' '}
              /{' '}
              <input
                type="number"
                value={pc.attributes[k].maximum}
                min={k === 'stamina' ? 14 : 7}
                max={k === 'stamina' ? 24 : 12}
                onChange={e =>
                  update({
                    ...pc,
                    attributes: {
                      ...pc.attributes,
                      [k]: { ...pc.attributes[k], maximum: Number(e.target.value) },
                    },
                  })
                }
              />
            </span>
            <button
              onClick={() => {
                const n = rollExpression(data.manifest.rules.coreRules.attributeGeneration[k])
                update({
                  ...pc,
                  attributes: {
                    ...pc.attributes,
                    [k]: { ...pc.attributes[k], current: n, maximum: n },
                  },
                })
              }}
            >
              Re-roll max
            </button>
          </label>
        ))}
      </div>
    </>
  )
}

function SkillEditor({ pc, update }: { pc: Character; update: (p: Character) => void }) {
  const change = (i: number, v: Partial<AdvancedSkill>) =>
    update({
      ...pc,
      advancedSkills: pc.advancedSkills.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })
  return (
    <>
      <h2>Skills & advancement</h2>
      <div className="skill-edit-header">
        <span>Skill / Spell</span>
        <span>Rank</span>
        <span>Skill Total</span>
        <span>Used</span>
        <span>Actions</span>
      </div>
      {pc.advancedSkills.map((x, i) => (
        <div className="skill-edit" key={`${x.name}-${i}`}>
          <span>
            {x.name} <small>{x.type}</small>
          </span>
          <span className="edit-stat">
            <input
              type="number"
              min="1"
              value={x.rank}
              onChange={e => change(i, { rank: Number(e.target.value) })}
            />
          </span>
          <span className="edit-stat">
            <strong>{x.total}</strong>
          </span>
          <label className="edit-check">
            <input
              type="checkbox"
              checked={Boolean(x.ticks)}
              onChange={e => change(i, { ticks: e.target.checked ? 1 : 0 })}
            />
          </label>
          <button onClick={() => change(i, { rank: x.rank + 1, ticks: 0 })}>Rank +1</button>
        </div>
      ))}
    </>
  )
}

function Picker({ data, choose }: { data: GameData; choose: (id: number) => void }) {
  const [q, setQ] = useState('')
  return (
    <section className="picker">
      <h2>Choose a background</h2>
      <label>
        Filter <input value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <div className="backgrounds">
        {data.backgrounds
          .filter(x => x.name.toLowerCase().includes(q.toLowerCase()))
          .map(x => (
            <button key={x.id} onClick={() => choose(x.id)}>
              <b>
                {x.id} · {x.name}
              </b>
              <span>{x.description || 'Generate this character.'}</span>
            </button>
          ))}
      </div>
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
  const baseline = (i: number, v: Partial<Item>) =>
    update({
      ...pc,
      baselinePossessions: pc.baselinePossessions.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })
  const skill = (i: number, v: Partial<AdvancedSkill>) =>
    update({
      ...pc,
      advancedSkills: pc.advancedSkills.map((x, j) => (j === i ? { ...x, ...v } : x)),
    })
  const free = Math.max(0, 12 - burden.slots)
  const over = Math.max(0, 18 - Math.max(12, burden.slots))
  return (
    <section className="sheet">
      <div className="sheet-head">
        <div>
          <p>CHARACTER SHEET</p>
          <h2>{pc.name || 'Unnamed adventurer'}</h2>
          <span>{pc.background}</span>
        </div>
        <p className="header-stat">
          SKILL <b>{pc.attributes.skill}</b>
        </p>
        <p className="header-stat">
          STAMINA{' '}
          <b>
            <span className="web-current">{pc.attributes.stamina.current}</span>
            <span className="print-current-box" aria-label="Current stamina"></span> /{' '}
            {pc.attributes.stamina.maximum}
          </b>
        </p>
        <p className="header-stat">
          LUCK{' '}
          <b>
            <span className="web-current">{pc.attributes.luck.current}</span>
            <span className="print-current-box" aria-label="Current luck"></span> /{' '}
            {pc.attributes.luck.maximum}
          </b>
        </p>
      </div>
      {background?.description && (
        <>
          <h3>Background</h3>
          <p>{background.description}</p>
        </>
      )}
      <h3>Advanced skills</h3>
      <div className="sheet-skill-header">
        <span>Skill / Spell</span>
        <span>Rank</span>
        <span>Skill Total</span>
        <span className="header-check">Used</span>
      </div>
      {pc.advancedSkills.map((x, i) => (
        <div className="sheet-skill" key={i}>
          <span>
            {x.name} <small>{x.type}</small>
            {x.type === 'spell' && data.spells.get(x.name)?.cost && (
              <em> Cost {data.spells.get(x.name).cost} Stamina</em>
            )}
          </span>
          <span className="skill-stat">
            <span className="web-current">{x.rank}</span>
            <span className="print-resource">
              <span className="print-resource-box"></span> / {x.rank}
            </span>
          </span>
          <span className="skill-stat">
            <span className="web-current">{x.total}</span>
            <span className="print-resource">
              <span className="print-resource-box"></span> / {x.total}
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
      <WeaponDamage pc={pc} data={data} />
      <h3>
        Inventory ({burden.slots} used · {free} free of 12 · {burden.state})
      </h3>
      <div className="sheet-item-header">
        <span>Item</span>
        <span>Qty</span>
        <span>Slots</span>
        <span className="no-print"></span>
      </div>
      <InventorySheet pc={pc} update={update} normalFree={free} overburdenedFree={over} />
      <h3>Baseline possessions</h3>
      <div className="sheet-item-header">
        <span>Possession</span>
        <span>Qty</span>
        <span>Slots</span>
        <span className="no-print"></span>
      </div>
      {pc.baselinePossessions.map((x, i) => (
        <div className={x.used ? 'sheet-item checked' : 'sheet-item'} key={x.position}>
          <span className="item-label">{x.name}</span>
          <span className="item-qty">
            <label className="no-print">
              <input
                type="number"
                min="0"
                value={x.quantity ?? 0}
                onChange={e => baseline(i, { quantity: Number(e.target.value) })}
              />{' '}
              /{' '}
              <input
                type="number"
                min="0"
                value={x.maximumQuantity ?? x.quantity ?? 0}
                onChange={e => baseline(i, { maximumQuantity: Number(e.target.value) })}
              />
            </label>
            <span className="print-resource">
              <span className="print-resource-box"></span> / {x.maximumQuantity ?? x.quantity ?? 0}
            </span>
          </span>
          <span className="slot-display">
            <span className="slot-value">{x.slots}</span>
          </span>
          <span className="no-print"></span>
        </div>
      ))}
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
      {pc.notes && (
        <>
          <h3>Notes</h3>
          <p>{pc.notes}</p>
        </>
      )}
      <p className="sheet-footer">{notice}</p>
    </section>
  )
}

function WeaponDamage({ pc, data }: { pc: Character; data: GameData }) {
  const tables = [...data.tables.values()]
  const rowFor = (name: string) => {
    const weapon = name.endsWith(' Fighting') ? name.slice(0, -9) : name
    for (const table of tables) {
      const matrix = table.damageMatrix?.matrix
      if (!matrix) continue
      const key = Object.keys(matrix).find(k => k.toLowerCase() === weapon.toLowerCase())
      if (key) return { weapon: key, values: matrix[key] }
    }
    return undefined
  }
  const rows = pc.advancedSkills
    .filter(x => x.type === 'weapon')
    .map(x => rowFor(x.name))
    .filter(Boolean) as Array<{ weapon: string; values: Record<string, string> }>
  if (!rows.length) return null
  return (
    <>
      <h3>Weapon damage</h3>
      <div className="damage-matrix">
        {rows.map(row => (
          <div className="damage-row" key={row.weapon}>
            <b>{row.weapon}</b>
            {Object.entries(row.values).map(([roll, damage]) => (
              <span key={roll}>
                <small>{roll}</small>
                {damage}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
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
  const change = (i: number, v: Partial<Item>) =>
    update({ ...pc, inventory: pc.inventory.map((x, j) => (j === i ? { ...x, ...v } : x)) })
  const blank = (key: string, over = false) => (
    <div className={over ? 'sheet-item blank over' : 'sheet-item blank'} key={key}>
      <span className="blank-name"></span>
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
      {pc.inventory.map((x, i) => (
        <div className={x.used ? 'sheet-item checked' : 'sheet-item'} key={x.position}>
          <span className="item-label">
            <span className="print-name">
              <span>{x.name}</span>
              {x.description && <small className="item-description">{x.description}</small>}
            </span>
            <input
              className="web-name no-print"
              value={x.name}
              aria-label={`Rename ${x.name}`}
              onChange={e => change(i, { name: e.target.value })}
            />
          </span>
          <span className="item-qty">
            <label className="no-print">
              <input
                type="number"
                min="0"
                value={x.quantity ?? 0}
                onChange={e => change(i, { quantity: Number(e.target.value) })}
              />{' '}
              /{' '}
              <input
                type="number"
                min="0"
                value={x.maximumQuantity ?? x.quantity ?? 0}
                onChange={e => change(i, { maximumQuantity: Number(e.target.value) })}
              />
            </label>
            <span className="print-resource">
              <span className="print-resource-box"></span> / {x.maximumQuantity ?? x.quantity ?? 0}
            </span>
          </span>
          <span className="slot-display">
            <span className="slot-value">{x.slots}</span>
          </span>
          <button
            className="no-print remove"
            onClick={() => update({ ...pc, inventory: pc.inventory.filter((_, j) => j !== i) })}
          >
            Remove
          </button>
        </div>
      ))}
      {Array.from({ length: normalFree }, (_, i) => blank(`free-${i}`))}
      {overburdenedFree > 0 && <div className="over-divider">Slots 13–18 carry a −4 penalty</div>}
      {Array.from({ length: overburdenedFree }, (_, i) => blank(`over-${i}`, true))}
      {pc.inventory.length < 18 && (
        <button
          className="no-print"
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
  return (
    <footer>
      <p>{notice}</p>
      <p>
        {attribution} Based on the{' '}
        <a href="https://troika-srd.netlify.app/" target="_blank" rel="noreferrer">
          Troika! SRD
        </a>
        . <i>Troika!</i> is a trademark of the Melsonian Arts Council.
      </p>
    </footer>
  )
}
