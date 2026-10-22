import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../src/vacation.jsx', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source, 'vacation.jsx', { loader: 'jsx', format: 'cjs' })
const compiled = { exports: {} }
new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), compiled, compiled.exports)
const { vacationKey, vacationsForWeek, sharedVacationsForWeek, vacationChangesToSave, validateVacations, VacationNote, VacationFields } = compiled.exports
const vacation = { selected: true, from: '2026-10-20', to: '2026-10-23' }

test('vacations remain attached to the correct role and person', () => {
  assert.notEqual(vacationKey('pm', '1'), vacationKey('super', '1'))
  assert.notEqual(vacationKey('pm', '1'), vacationKey('pm', '2'))
  assert.equal(vacationKey('pm', ''), '')
})

test('selected vacations require both dates in order; one day is allowed', () => {
  assert.equal(validateVacations({ a: { selected: true } }), false)
  assert.equal(validateVacations({ a: { ...vacation, to: '2026-10-19' } }), false)
  assert.equal(validateVacations({ a: { ...vacation, to: vacation.from } }), true)
  assert.equal(validateVacations({ a: { selected: false } }), true)
})

test('carry forward only vacations overlapping the target week without shifting dates', () => {
  const data = { a: vacation, b: { ...vacation, selected: false }, c: { ...vacation, to: '2026-10-27' } }
  assert.deepEqual(vacationsForWeek(data, '2026-10-26', '2026-11-01'), { c: data.c })
  assert.deepEqual(vacationsForWeek(data, '2026-10-23', '2026-10-23'), { a: data.a, c: data.c })
  assert.deepEqual(vacationsForWeek(undefined, '2026-10-19', '2026-10-25'), {})
})

test('unchecked vacations print nothing; selected notes support below and beside placement', () => {
  assert.equal(renderToStaticMarkup(React.createElement(VacationNote, { value: { ...vacation, selected: false } })), '')
  const inline = renderToStaticMarkup(React.createElement(VacationNote, { value: vacation }))
  const below = renderToStaticMarkup(React.createElement(VacationNote, { value: vacation, block: true }))
  assert.match(inline, /display:inline/)
  assert.match(below, /display:block/)
  assert.match(inline, /Vacation: 10\/20\/26 to 10\/23\/26/)
})

test('checkbox reveals two calendar date inputs only when selected', () => {
  const render = (value, person = 'p1') => renderToStaticMarkup(React.createElement(VacationFields, { person, value, onChange() {} }))
  assert.equal(render(vacation, ''), '')
  assert.doesNotMatch(render({ selected: false }), /type="date"/)
  const html = render(vacation)
  assert.equal((html.match(/type="date"/g) || []).length, 2)
  assert.match(html, /aria-label="Vacation from"/)
  assert.match(html, /aria-label="Vacation to"/)
})

test('lower assignment vacation dates align beside Vacation without From or To labels', () => {
  const html = renderToStaticMarkup(React.createElement(VacationNote, { value: vacation, block: true, stacked: true }))
  assert.match(html, /grid-template-columns:max-content max-content/)
  assert.match(html, /white-space:nowrap/)
  assert.match(html, /grid-row:1 \/ span 2/)
  assert.match(html, /Vacation:<\/span><span>10\/20\/26 to<\/span><span>10\/23\/26<\/span>/)
  assert.doesNotMatch(html, /From:|To:/)
  assert.equal(renderToStaticMarkup(React.createElement(VacationNote, { value: { ...vacation, selected: false }, stacked: true })), '')
})

test('one personnel vacation applies to every job and keeps its dates across week boundaries', () => {
  const rows = [{ id: 'v1', person_key: 'pm:p1', from_date: '2026-10-23', to_date: '2026-10-28', updated_at: '2026-10-21T12:00:00Z' }]
  for (const job of [{ pm: 'p1' }, { pm: 'p1' }]) {
    const note = sharedVacationsForWeek(rows, '2026-10-19', '2026-10-25')[vacationKey('pm', job.pm)]
    assert.equal(note.from, '2026-10-23')
    assert.equal(note.to, '2026-10-28')
    assert.equal(note.record_id, 'v1')
  }
  assert.equal(sharedVacationsForWeek(rows, '2026-10-26', '2026-11-01')['pm:p1'].from, '2026-10-23')
  assert.deepEqual(sharedVacationsForWeek(rows, '2026-11-02', '2026-11-08'), {})
  assert.equal(sharedVacationsForWeek(rows, '2026-10-19', '2026-10-25')['pm:p2'], undefined)
})

test('save only explicitly edited people, including unchecked records', () => {
  const keys = new Set(['pm:p1', 'super:s1'])
  assert.deepEqual(vacationChangesToSave({}, keys), [])
  const cleared = { record_id: 'v1', selected: false, updated_at: 'version' }
  assert.deepEqual(vacationChangesToSave({ 'pm:p1': cleared, 'foreman:removed': vacation }, keys), [{ ...cleared, person_key: 'pm:p1' }])
})
