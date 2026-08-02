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
      <main>
        <h1>Troika! Character Generator</h1>
        <p className="warning">{status || 'Starting…'}</p>
        {status.startsWith('Unable') && <button onClick={load}>Retry</button>}
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
      <header>
        <div>
          <p className="eyebrow">LIVE SRD CHARACTER TOOL</p>
          <h1>Troika! Character Generator</h1>
          <p>Generate a table-ready character from live system data.</p>
        </div>
        <div className="actions no-print">
          <label className="roll-toggle">
            <input type="checkbox" checked={!roll} onChange={e => rollMyOwn(e.target.checked)} />
            Let me roll my own dice
          </label>
          {pc && (
            <button className="secondary" onClick={home}>
              ← Backgrounds
            </button>
          )}
          <button onClick={() => generate(d66())}>Roll d66</button>
          <button onClick={() => file.current?.click()}>Import JSON / drop file</button>
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
            <SkillEditor pc={pc} data={data} update={update} />
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
  const dice = data.manifest.rules.coreRules.attributeGeneration
  // Typing a value means the dice have been rolled after all.
  const set = (attributes: Character['attributes']) =>
    update({ ...pc, unrolled: undefined, attributes })
  return (
    <>
      <h2>Attributes</h2>
      <div className="attributes">
        <label>
          Skill <span className="limit">limit 4–6</span>
          <input
            type="number"
            value={pc.unrolled ? '' : pc.attributes.skill}
            placeholder={dice.skill}
            min="4"
            max="6"
            onChange={e => set({ ...pc.attributes, skill: Number(e.target.value) })}
          />
        </label>
        {(['stamina', 'luck'] as const).map(k => (
          <label key={k}>
            {k} <span className="limit">current / maximum</span>
            <span>
              <input
                type="number"
                value={pc.unrolled ? '' : pc.attributes[k].current}
                placeholder={dice[k]}
                min="0"
                max={pc.unrolled ? undefined : pc.attributes[k].maximum}
                onChange={e =>
                  set({
                    ...pc.attributes,
                    [k]: { ...pc.attributes[k], current: Number(e.target.value) },
                  })
                }
              />{' '}
              /{' '}
              <input
                type="number"
                value={pc.unrolled ? '' : pc.attributes[k].maximum}
                placeholder={dice[k]}
                min={k === 'stamina' ? 14 : 7}
                max={k === 'stamina' ? 24 : 12}
                onChange={e =>
                  set({
                    ...pc.attributes,
                    [k]: { ...pc.attributes[k], maximum: Number(e.target.value) },
                  })
                }
              />
            </span>
            <button
              onClick={() => {
                const n = rollExpression(data.manifest.rules.coreRules.attributeGeneration[k])
                set({ ...pc.attributes, [k]: { ...pc.attributes[k], current: n, maximum: n } })
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
    <>
      <h2>Skills & advancement</h2>
      <div className="skill-edit-header">
        <span>Skill / Spell</span>
        <span>Options</span>
        <span>Rank</span>
        <span>Skill Total</span>
        <span className="header-check">Used</span>
        <span>Actions</span>
      </div>
      {pc.advancedSkills.map((x, i) => (
        <div className="skill-edit" key={`${x.name}-${i}`}>
          <span className="skill-name-col">
            <strong>{x.name}</strong> <small className="skill-type-tag">{x.type}</small>
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
              <>
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
                  className="spell-reroll-btn"
                  onClick={() => change(i, { name: randomSpell(data) ?? x.name })}
                >
                  Roll
                </button>
              </>
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
          <span className="edit-stat">
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
            <button onClick={() => change(i, { rank: x.rank + 1, ticks: 0 })}>Rank +1</button>
          </span>
        </div>
      ))}
    </>
  )
}

function Picker({ data, choose }: { data: GameData; choose: (id: number) => void }) {
  const [q, setQ] = useState('')
  const matches = data.backgrounds.filter(x => x.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="picker">
      <div className="picker-head">
        <h2>Choose a background</h2>
        <label className="picker-filter">
          Filter
          <input value={q} placeholder="Name…" onChange={e => setQ(e.target.value)} />
        </label>
        <p className="picker-count">
          {matches.length === data.backgrounds.length
            ? `${matches.length} backgrounds`
            : `${matches.length} of ${data.backgrounds.length}`}
        </p>
      </div>
      {matches.length === 0 ? (
        <p className="picker-empty">No background matches “{q}”.</p>
      ) : (
        <div className="backgrounds">
          {matches.map(x => (
            <button className="background-card" key={x.id} onClick={() => choose(x.id)}>
              <span className="background-roll">{x.id}</span>
              <b className="background-name">{x.name}</b>
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
  // Picks the generator was told not to make: the sheet asks for them instead.
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
        <p className="header-stat head-skill">
          <span>SKILL</span>
          <b>
            {pc.unrolled ? (
              <>
                <span className="web-current">—</span>
                <span className="print-resource">
                  <span className="print-current-box" aria-label="Skill"></span>
                </span>
              </>
            ) : (
              pc.attributes.skill
            )}
          </b>
          {pc.unrolled && <small className="to-roll">{dice.skill}</small>}
        </p>
        {(['stamina', 'luck'] as const).map(key => (
          <p className="header-stat" key={key}>
            <span>{key === 'stamina' ? 'STAMINA' : 'LUCK'}</span>
            <b>
              {pc.unrolled ? (
                <>
                  <span className="web-current">—</span>
                  <span className="print-resource paired">
                    <span className="print-current-box" aria-label={`Current ${key}`}></span> /{' '}
                    <span className="print-current-box" aria-label={`Maximum ${key}`}></span>
                  </span>
                </>
              ) : (
                <>
                  <span className="web-current">{pc.attributes[key].current}</span>
                  <span className="print-current-box" aria-label={`Current ${key}`}></span> /{' '}
                  {pc.attributes[key].maximum}
                </>
              )}
            </b>
            {pc.unrolled && <small className="to-roll">{dice[key]}</small>}
          </p>
        ))}
      </div>
      {background?.description && (
        <div className="background-description">
          <h3>Background</h3>
          <p>{background.description}</p>
        </div>
      )}
      <h3>Advanced skills</h3>
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
      <div className="sheet-item-header">
        <span>Item</span>
        <span>Armour</span>
        <span>Qty</span>
        <span>Slots</span>
        <span className="no-print"></span>
      </div>
      <InventorySheet pc={pc} update={update} normalFree={free} overburdenedFree={over} />
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
  const spellRows = pc.advancedSkills
    .filter(x => x.type === 'spell')
    .map(x => ({ weapon: x.name, values: data.spells.get(x.name)?.damageTable }))
    .filter(x => x.values) as Array<{ weapon: string; values: Record<string, string> }>
  // Roll columns come from the live tables so a sheet with no known weapon
  // still prints a usable grid.
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
      <div className="damage-matrix">
        <div className="damage-header">
          <span>{spellRows.length && !rows.length ? 'Spell' : 'Weapon'}</span>
          {rolls.map(roll => (
            <span key={roll}>{roll}</span>
          ))}
        </div>
        {rows.map(row => (
          <div className="damage-row" key={row.weapon}>
            <b>{row.weapon}</b>
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
        {/* Ruled rows for weapons picked up in play. */}
        {Array.from({ length: blankRows }, (_, i) => (
          <div className="damage-row damage-blank" key={`blank-${i}`}>
            <b></b>
            {rolls.map(roll => (
              <span key={roll}></span>
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
  const total = armour(pc)
  // Armour is written in by the player: an input on screen, a box to fill on paper.
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
  // A possession with no quantity is one the player still has to roll for, so
  // both fields stay empty rather than defaulting to zero.
  const quantityCell = (possession: Item, set: (v: Partial<Item>) => void) => {
    const maximum = possession.maximumQuantity ?? possession.quantity
    const number = (value: number | undefined, key: 'quantity' | 'maximumQuantity') => (
      <input
        type="number"
        min="0"
        value={value ?? ''}
        aria-label={`${key === 'quantity' ? 'Quantity' : 'Maximum quantity'} of ${possession.name}`}
        onChange={e => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    )
    return (
      <span className="item-qty">
        <label className="no-print">
          {number(possession.quantity, 'quantity')} / {number(maximum, 'maximumQuantity')}
        </label>
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
          <span className="item-label">{x.name}</span>
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
            <input
              className="web-name no-print"
              value={x.name}
              aria-label={`Rename ${x.name}`}
              onChange={e => change(i, { name: e.target.value })}
            />
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
            <span className="slot-value">{x.slots}</span>
          </span>
          <span className="no-print inventory-actions">
            <button
              disabled={i === 0}
              aria-label={`Move ${x.name} up`}
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              disabled={i === pc.inventory.length - 1}
              aria-label={`Move ${x.name} down`}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
            <label>
              <input
                type="checkbox"
                checked={Boolean(x.used)}
                onChange={e => change(i, { used: e.target.checked })}
              />{' '}
              Used
            </label>
            <button
              className="remove"
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
          Armour
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
      <p>
        <a href="https://github.com/klrkdekira/troika-generator" target="_blank" rel="noreferrer">
          View source on GitHub
        </a>
      </p>
    </footer>
  )
}
