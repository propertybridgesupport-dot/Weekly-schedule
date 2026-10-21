import React from 'react'

export function vacationKey(role, id) {
  return id ? `${role}:${id}` : ''
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
  if (stacked) return <span style={{ display: 'block', fontSize: '0.92em', fontWeight: 600 }}>
    Vacation:
    <span style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', columnGap: '5px', whiteSpace: 'nowrap' }}>
      <span>From:</span><span>{date(value.from)}</span>
      <span>To:</span><span>{date(value.to)}</span>
    </span>
  </span>
  return <span style={{ display: block ? 'block' : 'inline', fontSize: '0.92em', fontWeight: 600, marginLeft: block ? 0 : '6px' }}>
    Vacation: {date(value.from)} to {date(value.to)}
  </span>
}
