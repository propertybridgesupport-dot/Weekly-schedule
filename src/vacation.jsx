import React from 'react'

export function vacationKey(role, id) {
  return id ? `${role}:${id}` : ''
}

export function sharedVacationsForWeek(records = [], from, to) {
  const values = {}
  for (const record of [...records].sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))) {
    if ((!to || record.from_date <= to) && (!from || record.to_date >= from)) {
      values[record.person_key] = {
        selected: true, from: record.from_date, to: record.to_date,
        record_id: record.id, updated_at: record.updated_at,
      }
    }
  }
  return values
}

export function vacationChangesToSave(drafts = {}, personKeys = new Set()) {
  return Object.entries(drafts).filter(([key]) => personKeys.has(key))
    .map(([person_key, value]) => ({ ...value, person_key }))
}

export function vacationsForWeek(vacations = {}, from, to) {
  return Object.fromEntries(Object.entries(vacations || {}).filter(([, value]) =>
    value?.selected && value.from && value.to && value.from <= value.to &&
    (!to || value.from <= to) && (!from || value.to >= from)
  ))
}

export function validateVacations(vacations = {}) {
  return Object.values(vacations).every((value) => !value?.selected || (
    /^\d{4}-\d{2}-\d{2}$/.test(value.from || '') &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.to || '') && value.from <= value.to
  ))
}

export function VacationFields({ value = {}, onChange, person }) {
  if (!person) return null
  return <fieldset className="no-print" style={{ border: 0, padding: 0, margin: '6px 0', minWidth: 0, width: '100%' }}>
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      <input type="checkbox" checked={!!value.selected} onChange={(e) => onChange({ ...value, selected: e.target.checked })} />
      On vacation
    </label>
    <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
      Saved vacation dates apply to this person on every job.
    </span>
    {value.selected ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
      <label style={{ fontSize: '13px' }}>From
        <input aria-label="Vacation from" type="date" required value={value.from || ''} max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          style={{ display: 'block', padding: '8px', maxWidth: '100%', boxSizing: 'border-box' }} />
      </label>
      <label style={{ fontSize: '13px' }}>To
        <input aria-label="Vacation to" type="date" required value={value.to || ''} min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          style={{ display: 'block', padding: '8px', maxWidth: '100%', boxSizing: 'border-box' }} />
      </label>
    </div> : null}
  </fieldset>
}

export function VacationNote({ value, block = false, stacked = false }) {
  if (!value?.selected || !value.from || !value.to) return null
  const date = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(2, 4)}`
  if (stacked) return <span style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', columnGap: '5px', whiteSpace: 'nowrap', fontSize: '0.92em', fontWeight: 600 }}>
    <span style={{ gridRow: '1 / span 2' }}>Vacation:</span>
    <span>{date(value.from)} to</span>
    <span>{date(value.to)}</span>
  </span>
  return <span style={{ display: block ? 'block' : 'inline', fontSize: '0.92em', fontWeight: 600, marginLeft: block ? 0 : '6px' }}>
    Vacation: {date(value.from)} to {date(value.to)}
  </span>
}
