import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

function emptyForemanAssignment() {
  return {
    localId: crypto.randomUUID(),
    id: null,
    foreman_id: '',
    assignment_from_date: '',
    assignment_to_date: '',
    work_description: '',
    split_note: '',
    subcontractor_name: '',
    night: false,
  }
}

function emptySurveyorAssignment() {
  return {
    localId: crypto.randomUUID(),
    id: null,
    surveyor_id: '',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    note: '',
  }
}

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const WEEKDAY_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
}

const EQUIPMENT_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'general']
const EQUIPMENT_DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  general: 'General Note',
}

function emptyEquipmentMoves() {
  return EQUIPMENT_DAY_KEYS.reduce((acc, dayKey) => {
    acc[dayKey] = ''
    return acc
  }, {})
}


const FOREMAN_NIGHT_MARKER = '|||NIGHTS'
const QUICK_NOTE_DRAFT_KEY = 'weeklyScheduleFieldDumpDraft'

function getForemanSubcontractorName(splitNote) {
  return String(splitNote || '').replace(FOREMAN_NIGHT_MARKER, '').trim()
}

function getForemanNightFlag(splitNote) {
  return String(splitNote || '').includes(FOREMAN_NIGHT_MARKER)
}

function buildForemanSplitNote(subcontractorName, isNight) {
  const name = String(subcontractorName || '').trim()
  if (!name && !isNight) return ''
  return `${name}${isNight ? FOREMAN_NIGHT_MARKER : ''}`
}

function getForemanDisplayNameFromAssignment(assignment) {
  const subcontractorName = getForemanSubcontractorName(assignment?.split_note || assignment?.splitNote || assignment?.subcontractor || assignment?.subcontractor_name)
  return assignment?.foremen?.name || assignment?.name || (subcontractorName ? `Subcontractor: ${subcontractorName}` : '—')
}

function getForemanNightFromAssignment(assignment) {
  return Boolean(assignment?.night) || getForemanNightFlag(assignment?.split_note || assignment?.splitNote || assignment?.subcontractor || assignment?.subcontractor_name)
}

function emptySuperintendentAssignment() {
  return {
    localId: crypto.randomUUID(),
    superintendent_id: '',
    shift: '',
  }
}

function autoGrowTextarea(event) {
  const el = event?.target
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}


function toIsoDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMondaySundayRange(baseDate = new Date()) {
  const date = new Date(baseDate)
  date.setHours(0, 0, 0, 0)
  const dayOfWeek = date.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(date)
  monday.setDate(date.getDate() + mondayOffset)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    from: toIsoDate(monday),
    to: toIsoDate(sunday),
  }
}

function getTodayDayKeyForWeek(selectedWeekFrom, selectedWeekTo) {
  if (!selectedWeekFrom || !selectedWeekTo) return ''

  const todayIso = toIsoDate(new Date())
  if (todayIso < selectedWeekFrom || todayIso > selectedWeekTo) return ''

  const startOfWeek = new Date(`${selectedWeekFrom}T00:00:00`)
  const today = new Date(`${todayIso}T00:00:00`)
  const offset = Math.round((today - startOfWeek) / (1000 * 60 * 60 * 24))
  return WEEKDAY_KEYS[offset] || ''
}

function getInitialWeekRange() {
  const currentWeek = getMondaySundayRange()

  if (typeof window === 'undefined') {
    return currentWeek
  }

  try {
    const savedFrom = window.localStorage.getItem('weeklyScheduleSelectedWeekFrom')
    const savedTo = window.localStorage.getItem('weeklyScheduleSelectedWeekTo')

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(savedFrom || '') &&
      /^\d{4}-\d{2}-\d{2}$/.test(savedTo || '')
    ) {
      return { from: savedFrom, to: savedTo }
    }
  } catch (error) {
    console.error('Could not read saved week range.', error)
  }

  return currentWeek
}

function decodeMobileShareSnapshot(rawValue) {
  if (!rawValue) return null

  try {
    const normalized = decodeURIComponent(rawValue)
    const jsonText = atob(normalized)
    return JSON.parse(jsonText)
  } catch (error) {
    console.error('Could not decode mobile share snapshot.', error)
    return null
  }
}

function buildEmailWeekLabel(selectedWeekFrom, selectedWeekTo) {
  if (!selectedWeekFrom || !selectedWeekTo) return ''
  return `${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}`
}

function buildMobileShareSnapshot(items, selectedWeekFrom, selectedWeekTo) {
  const payload = {
    weekFrom: selectedWeekFrom,
    weekTo: selectedWeekTo,
    createdAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: item.id,
      jobNumber: item.jobs?.job_number || '—',
      jobName: item.jobs?.job_name || 'No Job Name',
      projectManager: item.project_manager_labels || item.project_managers?.name || '—',
      projectManagers: item.project_manager_labels || item.project_managers?.name || '—',
      superintendent: item.superintendent_labels || item.superintendents?.name || '—',
      superintendents: item.superintendent_labels || item.superintendents?.name || '—',
      surveyor: item.surveyors?.name || '—',
      notes: item.notes || '',
      equipmentMoves: item.equipment_moves || {},
      foremen: (item.schedule_item_foremen || []).map((assignment) => {
        const subcontractorName = getForemanSubcontractorName(assignment.split_note)
        const night = getForemanNightFlag(assignment.split_note)
        return {
          id: assignment.id,
          name: assignment.foremen?.name || (subcontractorName ? `Subcontractor: ${subcontractorName}` : '—'),
          fromDate: assignment.assignment_from_date || '',
          toDate: assignment.assignment_to_date || '',
          work: assignment.work_description || '',
          splitNote: '',
          subcontractor: subcontractorName,
          night,
        }
      }),
      surveyorAssignments: (item.schedule_item_surveyors || []).map((assignment) => ({
        id: assignment.id,
        name: assignment.surveyors?.name || '—',
        monday: !!assignment.monday,
        tuesday: !!assignment.tuesday,
        wednesday: !!assignment.wednesday,
        thursday: !!assignment.thursday,
        friday: !!assignment.friday,
        note: assignment.note || '',
      })),
    })),
  }

  try {
    const json = JSON.stringify(payload)
    const utf8Bytes = new TextEncoder().encode(json)
    let binary = ''
    utf8Bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return encodeURIComponent(btoa(binary))
  } catch (error) {
    console.error('Could not build mobile share snapshot.', error)
    return ''
  }
}

export default function App() {
  const initialWeekRange = getInitialWeekRange()
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const mobileShareSnapshot = useMemo(() => {
    if (!searchParams) return null
    return decodeMobileShareSnapshot(searchParams.get('snapshot'))
  }, [])
  const publicShareToken = searchParams?.get('publicShare') || ''
  const isMobileShareMode = Boolean(searchParams?.get('mobileShare') === '1' && mobileShareSnapshot)
  const isPublicShareMode = Boolean(publicShareToken)
  const isViewerMode = Boolean(searchParams?.get('viewer') === '1')
  const viewerWeekFromParam = searchParams?.get('weekFrom') || ''
  const viewerWeekToParam = searchParams?.get('weekTo') || ''
  const mobileLayoutParam = searchParams?.get('mobileLayout') || 'jobs'
  const isQuickDump = searchParams?.get('quickDump') === '1'

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking login...')
  const [activeTab, setActiveTab] = useState('weekly')
  const [quickNote, setQuickNote] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState('')
  const [fieldNotes, setFieldNotes] = useState([])
  const [fieldNotesSearch, setFieldNotesSearch] = useState('')
  const [fieldNotesView, setFieldNotesView] = useState('daily')
  const [fieldNotesDateFilter, setFieldNotesDateFilter] = useState('last7')
  const [fieldNotesShowDone, setFieldNotesShowDone] = useState(false)
  const [selectedFieldNoteIds, setSelectedFieldNoteIds] = useState(new Set())
  const [editingFieldNoteId, setEditingFieldNoteId] = useState(null)
  const [editingFieldNoteText, setEditingFieldNoteText] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactGroups, setContactGroups] = useState([])
  const [newContactName, setNewContactName] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactGroupName, setNewContactGroupName] = useState('')
  const [selectedContactGroupId, setSelectedContactGroupId] = useState('')
  const [selectedMobileTextGroupIds, setSelectedMobileTextGroupIds] = useState([])
  const [editingContactId, setEditingContactId] = useState(null)
  const [banner, setBanner] = useState(null)
  const [actionLoading, setActionLoading] = useState('')
  const [returnToScrollY, setReturnToScrollY] = useState(null)
  const [returnToItemId, setReturnToItemId] = useState('')
  const [restoreWeeklyPosition, setRestoreWeeklyPosition] = useState(false)
  const [publicShareLoading, setPublicShareLoading] = useState(Boolean(publicShareToken))
  const [publicShareData, setPublicShareData] = useState(null)

  const [jobs, setJobs] = useState([])
  const [projectManagers, setProjectManagers] = useState([])
  const [superintendents, setSuperintendents] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [foremen, setForemen] = useState([])
  const [scheduleItems, setScheduleItems] = useState([])
  const [emailGroups, setEmailGroups] = useState([])
  const [selectedEmailGroupId, setSelectedEmailGroupId] = useState('')
  const [selectedEmailContactId, setSelectedEmailContactId] = useState('')
  const [selectedTextGroupViewId, setSelectedTextGroupViewId] = useState('')
const [reportNotes, setReportNotes] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')
  const [selectedWeekFrom, setSelectedWeekFrom] = useState(initialWeekRange.from)
  const [selectedWeekTo, setSelectedWeekTo] = useState(initialWeekRange.to)
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [weeklySearchText, setWeeklySearchText] = useState('')
  const [jumpToScheduleItemId, setJumpToScheduleItemId] = useState('')
  const [mobileLayout, setMobileLayout] = useState('jobs')
  const [mobileShareLayout, setMobileShareLayout] = useState(['foremen', 'superintendents', 'surveyors'].includes(mobileLayoutParam) ? mobileLayoutParam : 'jobs')
  const [mobilePersonFilter, setMobilePersonFilter] = useState('')
  const [showPrintActiveOnly, setShowPrintActiveOnly] = useState(false)
  const [collapsedScheduleItemIds, setCollapsedScheduleItemIds] = useState(new Set())

  const [jobPrefix, setJobPrefix] = useState('CC')
  const [jobNumberPart2, setJobNumberPart2] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobStartDate, setJobStartDate] = useState('')
  const [jobStopDate, setJobStopDate] = useState('')
  const [editingJobId, setEditingJobId] = useState(null)

  // Remaining application code unchanged.

  async function deleteJob(id) {
    const job = jobs.find((item) => item.id === id)
    const jobLabel = job ? `${job.job_number} — ${job.job_name}` : 'this job'
    const confirmed = window.confirm(`Remove ${jobLabel}?`)
    if (!confirmed) return

    setActionLoading(`deleteJob-${id}`)

    try {
      const { count, error: referenceError } = await supabase
        .from('schedule_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', id)

      if (referenceError) throw referenceError

      if ((count || 0) > 0) {
        const { error: archiveError } = await supabase
          .from('jobs')
          .update({ active: false })
          .eq('id', id)

        if (archiveError) throw archiveError

        setJobs((currentJobs) => currentJobs.filter((item) => item.id !== id))
        if (editingJobId === id) resetJobForm()
        await loadAllData()
        showSuccess('Job removed from the active job list. Its prior weekly schedule history was kept.')
        return
      }

      const { data: deletedRows, error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .select('id')

      if (deleteError) throw deleteError
      if (!deletedRows?.length) {
        throw new Error('The job was not deleted. Please refresh the page and try again.')
      }

      setJobs((currentJobs) => currentJobs.filter((item) => item.id !== id))
      if (editingJobId === id) resetJobForm()
      await loadAllData()
      showSuccess('Job deleted.')
    } catch (error) {
      console.error('Could not remove job.', error)
      showError(error?.message || 'Could not remove the job.')
    } finally {
      setActionLoading('')
    }
  }

  return null
}
