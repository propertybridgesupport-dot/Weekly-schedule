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

  const [pmName, setPmName] = useState('')
  const [editingPmId, setEditingPmId] = useState(null)

  const [superintendentName, setSuperintendentName] = useState('')
  const [editingSuperintendentId, setEditingSuperintendentId] = useState(null)

  const [surveyorName, setSurveyorName] = useState('')
  const [editingSurveyorId, setEditingSurveyorId] = useState(null)

  const [foremanName, setForemanName] = useState('')
  const [editingForemanId, setEditingForemanId] = useState(null)

  const [newEmailGroupName, setNewEmailGroupName] = useState('')
  const [recipientGroupId, setRecipientGroupId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
const [printLayout, setPrintLayout] = useState('')
  const [editingScheduleItemId, setEditingScheduleItemId] = useState(null)
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [scheduleForm, setScheduleForm] = useState({
    from_date: '',
    to_date: '',
    job_id: '',
    project_manager_id: '',
    project_manager_ids: [],
    superintendent_id: '',
    superintendent_assignments: [emptySuperintendentAssignment()],
    surveyor_id: '',
    equipment_moves: emptyEquipmentMoves(),
    notes: '',
  })

  const [foremanAssignments, setForemanAssignments] = useState([
    emptyForemanAssignment(),
  ])

  const [surveyorAssignments, setSurveyorAssignments] = useState([
    emptySurveyorAssignment(),
  ])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      loadAllData()
    }
  }, [session])

  useEffect(() => {
    if (!publicShareToken) return

    let isCancelled = false

    async function loadPublicShare() {
      setPublicShareLoading(true)

      const { data, error } = await supabase
        .from('public_schedule_shares')
        .select('share_token, week_from, week_to, snapshot')
        .eq('share_token', publicShareToken)
        .maybeSingle()

      if (isCancelled) return

      if (error || !data) {
        console.error('Could not load public share.', error)
        setPublicShareData({ error: true })
      } else {
        setPublicShareData(data)
      }

      setPublicShareLoading(false)
    }

    loadPublicShare()

    return () => {
      isCancelled = true
    }
  }, [publicShareToken])

  useEffect(() => {
    try {
      window.localStorage.setItem('weeklyScheduleSelectedWeekFrom', selectedWeekFrom)
      window.localStorage.setItem('weeklyScheduleSelectedWeekTo', selectedWeekTo)
    } catch (error) {
      console.error('Could not save selected week range.', error)
    }
  }, [selectedWeekFrom, selectedWeekTo])

  useEffect(() => {
    if (!isViewerMode) return
    if (viewerWeekFromParam && viewerWeekToParam) {
      setSelectedWeekFrom(viewerWeekFromParam)
      setSelectedWeekTo(viewerWeekToParam)
    }
  }, [isViewerMode, viewerWeekFromParam, viewerWeekToParam])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), banner.type === 'success' ? 2600 : 4200)
    return () => clearTimeout(timer)
  }, [banner])

  useEffect(() => {
    if (activeTab !== 'weekly' || !restoreWeeklyPosition) return
    const timer = window.setTimeout(() => {
      const targetId = returnToItemId ? `schedule-item-${returnToItemId}` : ''
      const el = targetId ? document.getElementById(targetId) : null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (typeof returnToScrollY === 'number') {
        window.scrollTo({ top: returnToScrollY, behavior: 'smooth' })
      }
      setRestoreWeeklyPosition(false)
    }, 180)

    return () => clearTimeout(timer)
  }, [activeTab, restoreWeeklyPosition, scheduleItems, selectedWeekFrom, selectedWeekTo, returnToItemId, returnToScrollY])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  function confirmDiscardUnsavedChanges() {
    if (!hasUnsavedChanges) return true
    return window.confirm('You have unsaved changes. Leave without saving?')
  }

  function handleTabChange(nextTab) {
    if (nextTab === activeTab) return
    if (!confirmDiscardUnsavedChanges()) return
    setActiveTab(nextTab)
  }

  function goToCurrentWeek() {
    if (!confirmDiscardUnsavedChanges()) return
    const currentWeek = getMondaySundayRange()
    setSelectedWeekFrom(currentWeek.from)
    setSelectedWeekTo(currentWeek.to)
    setJumpToScheduleItemId('')
  }

  function applyWeekFromAnyDate(value) {
    if (!value) return
    if (!confirmDiscardUnsavedChanges()) return
    const nextRange = getMondaySundayRange(new Date(`${value}T00:00:00`))
    setSelectedWeekFrom(nextRange.from)
    setSelectedWeekTo(nextRange.to)
    setJumpToScheduleItemId('')
  }

  function shiftIsoDate(value, days = 7) {
    if (!value) return null
    const date = new Date(`${value}T00:00:00`)
    date.setDate(date.getDate() + days)
    return toIsoDate(date)
  }

  function getNextWeekRangeFromSelectedWeek() {
    return {
      from: shiftIsoDate(selectedWeekFrom, 7),
      to: shiftIsoDate(selectedWeekTo, 7),
    }
  }

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aNum = extractJobNumberValue(a.job_number)
      const bNum = extractJobNumberValue(b.job_number)
      return aNum - bNum
    })
  }, [jobs])


  function getProjectManagerNamesForItem(item) {
    const ids = Array.isArray(item?.project_manager_ids)
      ? item.project_manager_ids.filter(Boolean)
      : item?.project_manager_id ? [item.project_manager_id] : []
    const names = ids
      .map((id) => projectManagers.find((person) => person.id === id)?.name)
      .filter(Boolean)
    if (names.length) return names.join(', ')
    return item?.project_manager_labels || item?.project_managers?.name || ''
  }

  function getSuperintendentLabelsForItem(item) {
    const assignments = Array.isArray(item?.superintendent_assignments)
      ? item.superintendent_assignments.filter((assignment) => assignment?.superintendent_id)
      : item?.superintendent_id ? [{ superintendent_id: item.superintendent_id, shift: '' }] : []
    const showShift = assignments.length > 1
    const labels = assignments.map((assignment) => {
      const name = superintendents.find((person) => person.id === assignment.superintendent_id)?.name || ''
      if (!name) return ''
      const shift = showShift && assignment.shift ? ` (${assignment.shift})` : ''
      return `${name}${shift}`
    }).filter(Boolean)
    if (labels.length) return labels.join(', ')
    return item?.superintendent_labels || item?.superintendents?.name || ''
  }

  function getEquipmentMoveEntriesForItem(item) {
    const moves = item?.equipment_moves || {}
    return EQUIPMENT_DAY_KEYS
      .map((dayKey) => ({ dayKey, label: EQUIPMENT_DAY_LABELS[dayKey], text: String(moves?.[dayKey] || '').trim() }))
      .filter((entry) => entry.text)
  }

  const filteredScheduleItems = useMemo(() => {
    return scheduleItems
  }, [scheduleItems])

  const weekScheduleItems = useMemo(() => {
    if (!selectedWeekTo) return scheduleItems

    const eligibleItems = scheduleItems.filter((item) => {
      return !item.from_date || item.from_date <= selectedWeekTo
    })

    const latestByJob = {}

    eligibleItems.forEach((item) => {
      const jobId = item.job_id || item.jobs?.id || item.id

      if (!latestByJob[jobId]) {
        latestByJob[jobId] = item
        return
      }

      const currentLatest = latestByJob[jobId]
      const itemFrom = item.from_date || ''
      const latestFrom = currentLatest.from_date || ''

      if (itemFrom > latestFrom) {
        latestByJob[jobId] = item
        return
      }

      if (itemFrom === latestFrom) {
        const itemTo = item.to_date || ''
        const latestTo = currentLatest.to_date || ''
        if (itemTo > latestTo) {
          latestByJob[jobId] = item
        }
      }
    })

    const sortedWeekItems = Object.values(latestByJob).sort((a, b) => {
      const aNum = extractJobNumberValue(a.jobs?.job_number)
      const bNum = extractJobNumberValue(b.jobs?.job_number)
      return aNum - bNum
    })

    return sortedWeekItems.map((item) => ({
      ...item,
      project_manager_labels: getProjectManagerNamesForItem(item),
      superintendent_labels: getSuperintendentLabelsForItem(item),
    }))
  }, [scheduleItems, selectedWeekTo, projectManagers, superintendents])

  useEffect(() => {
    if (!session || !selectedWeekFrom || !selectedWeekTo) return
    if (isPublicShareMode || isMobileShareMode || isViewerMode) return

    const timer = window.setTimeout(() => {
      refreshPublicSharesForSelectedWeek()
    }, 600)

    return () => window.clearTimeout(timer)
  }, [session, selectedWeekFrom, selectedWeekTo, weekScheduleItems, isPublicShareMode, isMobileShareMode, isViewerMode])

  const activeWeekScheduleItems = useMemo(() => {
    return weekScheduleItems.filter((item) => {
      const hasJobNote = Boolean((item.notes || '').trim())
      const hasForemanAssignments = Boolean(item.schedule_item_foremen?.length)
      const hasSurveyorAssignments = Boolean(item.schedule_item_surveyors?.length)

      return hasJobNote || hasForemanAssignments || hasSurveyorAssignments
    })
  }, [weekScheduleItems])

  const displayedWeekScheduleItems = useMemo(() => {
    const baseItems = showActiveOnly ? activeWeekScheduleItems : weekScheduleItems
    const search = weeklySearchText.trim().toLowerCase()

    if (!search) return baseItems

    return baseItems.filter((item) => getScheduleItemSearchText(item).includes(search))
  }, [showActiveOnly, activeWeekScheduleItems, weekScheduleItems, weeklySearchText])

  const printScheduleItems = useMemo(() => {
    return showPrintActiveOnly ? activeWeekScheduleItems : weekScheduleItems
  }, [showPrintActiveOnly, activeWeekScheduleItems, weekScheduleItems])

  const gridScheduleItems = useMemo(() => {
    return activeWeekScheduleItems
  }, [activeWeekScheduleItems])

  const printGridScheduleItems = useMemo(() => {
    return showPrintActiveOnly ? activeWeekScheduleItems : weekScheduleItems
  }, [showPrintActiveOnly, activeWeekScheduleItems, weekScheduleItems])
  const nextWeekRange = useMemo(() => getNextWeekRangeFromSelectedWeek(), [selectedWeekFrom, selectedWeekTo])

  const nextWeekHasItems = useMemo(() => {
    if (!nextWeekRange.from || !nextWeekRange.to) return false
    return scheduleItems.some(
      (item) => item.from_date === nextWeekRange.from && item.to_date === nextWeekRange.to
    )
  }, [scheduleItems, nextWeekRange])

  const selectedWeekDuplicateItemIds = useMemo(() => {
    const seenJobIds = new Set()
    const duplicateIds = []

    for (const item of weekScheduleItems) {
      const key = item.job_id || item.jobs?.id || item.id
      if (seenJobIds.has(key)) {
        duplicateIds.push(item.id)
      } else {
        seenJobIds.add(key)
      }
    }

    return duplicateIds
  }, [weekScheduleItems])

  const selectedWeekDuplicateCount = selectedWeekDuplicateItemIds.length

  const selectedEmailGroup =
    emailGroups.find((g) => g.id === selectedEmailGroupId) || null

  const todayDayKey = useMemo(() => {
    return getTodayDayKeyForWeek(selectedWeekFrom, selectedWeekTo)
  }, [selectedWeekFrom, selectedWeekTo])

  function openAddScheduleEditor() {
    if (!confirmDiscardUnsavedChanges()) return
    resetScheduleForm()
    setShowScheduleEditor(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function isScheduleCardCollapsed(id) {
    return collapsedScheduleItemIds.has(id)
  }

  function toggleScheduleCardCollapsed(id) {
    setCollapsedScheduleItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function collapseAllScheduleCards() {
    setCollapsedScheduleItemIds(new Set(displayedWeekScheduleItems.map((item) => item.id)))
  }

  function expandAllScheduleCards() {
    setCollapsedScheduleItemIds(new Set())
  }

  function jumpToScheduleItem(id) {
    setJumpToScheduleItemId(id)
    if (!id) return
    const el = document.getElementById(`schedule-item-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function renderCollapsedQuickPills(item) {
    const pills = []
    const foremanNames = (item.schedule_item_foremen || [])
      .map((assignment) => getForemanDisplayNameFromAssignment(assignment))
      .filter(Boolean)
    const surveyorNames = (item.schedule_item_surveyors || [])
      .map((assignment) => assignment.surveyors?.name)
      .filter(Boolean)

    if (getProjectManagerNamesForItem(item)) pills.push(`PM: ${getProjectManagerNamesForItem(item)}`)
    if (getSuperintendentLabelsForItem(item)) pills.push(`Super: ${getSuperintendentLabelsForItem(item)}`)
    if (item.surveyors?.name) pills.push(`Surveyor: ${item.surveyors.name}`)
    if (foremanNames.length) pills.push(`Foremen: ${foremanNames.join(', ')}`)
    if (surveyorNames.length) pills.push(`Surveyor Days: ${surveyorNames.join(', ')}`)
    if (item.notes) pills.push('Has Job Notes')

    if (!pills.length) {
      pills.push('No assignments or notes yet')
    }

    return (
      <div style={styles.collapsedPillRow}>
        {pills.map((pill) => (
          <span key={pill} style={styles.collapsedPill}>{pill}</span>
        ))}
      </div>
    )
  }

  function showBanner(type, text) {
    setBanner({ type, text, id: Date.now() })
  }

  function showSuccess(text) {
    showBanner('success', text)
  }

  function showError(text) {
    showBanner('error', text)
  }

  function isActionBusy(name) {
    return loading || actionLoading === name
  }

  async function addContact() {
    setActionLoading('saveContact')
    const name = newContactName.trim()
    const phone = newContactPhone.trim()
    const email = newContactEmail.trim()

    if (!name) {
      showError('Enter a contact name.')
      setActionLoading('')
      return
    }

    if (!phone && !email) {
      showError('Enter at least a phone number or an email address.')
      setActionLoading('')
      return
    }

    let error

    if (editingContactId) {
      const result = await supabase
        .from('contacts')
        .update({
          name,
          phone: phone || null,
          email: email || null,
        })
        .eq('id', editingContactId)
      error = result.error
    } else {
      const result = await supabase.from('contacts').insert({
        name,
        phone: phone || null,
        email: email || null,
        active: true,
      })
      error = result.error
    }

    if (error) {
      showError(error.message)
      setActionLoading('')
      return
    }

    setNewContactName('')
    setNewContactPhone('')
    setNewContactEmail('')
    setEditingContactId(null)
    await loadAllData()
    showSuccess(editingContactId ? 'Contact updated successfully.' : 'Contact added successfully.')
    setActionLoading('')
  }

  function editContact(contact) {
    setEditingContactId(contact.id)
    setNewContactName(contact.name || '')
    setNewContactPhone(contact.phone || '')
    setNewContactEmail(contact.email || '')
  }

  function cancelEditContact() {
    setEditingContactId(null)
    setNewContactName('')
    setNewContactPhone('')
    setNewContactEmail('')
  }

  async function deleteContact(contactId) {
    setActionLoading('deleteContact')
    const confirmed = window.confirm('Delete this contact?')
    if (!confirmed) {
      setActionLoading('')
      return
    }

    const { error } = await supabase.from('contacts').delete().eq('id', contactId)
    if (error) {
      showError(error.message)
      return
    }
    if (editingContactId === contactId) {
      cancelEditContact()
    }
    await loadAllData()
    showSuccess('Contact deleted.')
    setActionLoading('')
  }

  async function addContactGroup() {
    setActionLoading('saveTextGroup')
    const name = newContactGroupName.trim()
    if (!name) {
      showError('Enter a group name.')
      setActionLoading('')
      return
    }

    const { error } = await supabase.from('contact_groups').insert({
      name,
      active: true,
    })
    if (error) {
      showError(error.message)
      setActionLoading('')
      return
    }
    setNewContactGroupName('')
    await loadAllData()
    showSuccess('Text group added.')
    setActionLoading('')
  }

  async function deleteContactGroup(groupId) {
    setActionLoading('deleteTextGroup')
    const confirmed = window.confirm('Delete this contact group?')
    if (!confirmed) {
      setActionLoading('')
      return
    }
    const { error } = await supabase.from('contact_groups').delete().eq('id', groupId)
    if (error) {
      showError(error.message)
      setActionLoading('')
      return
    }
    if (selectedContactGroupId === groupId) setSelectedContactGroupId('')
    await loadAllData()
    showSuccess('Text group deleted.')
    setActionLoading('')
  }

  async function renameContactGroup(group) {
    const nextName = window.prompt('Edit text group name', group.name || '')
    if (!nextName || nextName.trim() === group.name) return
    const { error } = await supabase
      .from('contact_groups')
      .update({ name: nextName.trim() })
      .eq('id', group.id)
    if (error) {
      showError(error.message)
      return
    }
    await loadAllData()
  }

  async function toggleContactInGroup(groupId, contactId) {
    const group = contactGroups.find((g) => g.id === groupId)
    const exists = (group?.contact_group_memberships || []).some((m) => m.contact_id === contactId)

    if (exists) {
      const { error } = await supabase
        .from('contact_group_memberships')
        .delete()
        .eq('group_id', groupId)
        .eq('contact_id', contactId)
      if (error) {
        showError(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('contact_group_memberships').insert({
        group_id: groupId,
        contact_id: contactId,
      })
      if (error) {
        showError(error.message)
        return
      }
    }
    await loadAllData()
  }

  function contactIsInEmailGroup(group, contact) {
    return (group.email_group_recipients || []).some(
      (recipient) => (recipient.email || '').toLowerCase() === (contact.email || '').toLowerCase()
    )
  }

  async function renameEmailGroup(group) {
    const nextName = window.prompt('Edit email group name', group.name || '')
    if (!nextName || nextName.trim() === group.name) return
    const { error } = await supabase
      .from('email_groups')
      .update({ name: nextName.trim() })
      .eq('id', group.id)
    if (error) {
      showError(error.message)
      return
    }
    await loadAllData()
  }

  async function toggleContactInEmailGroup(groupId, contact) {
    if (!contact.email) return

    const group = emailGroups.find((g) => g.id === groupId)
    const existing = (group?.email_group_recipients || []).find(
      (recipient) => (recipient.email || '').toLowerCase() === (contact.email || '').toLowerCase()
    )

    if (existing) {
      const { error } = await supabase
        .from('email_group_recipients')
        .delete()
        .eq('id', existing.id)
      if (error) {
        showError(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('email_group_recipients')
        .insert({
          email_group_id: groupId,
          name: contact.name || null,
          email: contact.email,
          active: true,
        })
      if (error) {
        showError(error.message)
        return
      }
    }

    await loadAllData()
  }

  async function createMobileShareUrl() {
    if (typeof window === 'undefined') return ''
    if (!selectedWeekFrom || !selectedWeekTo) return ''

    const snapshot = buildMobileShareSnapshot(gridScheduleItems, selectedWeekFrom, selectedWeekTo)
    if (!snapshot) return ''

    const decodedSnapshot = decodeMobileShareSnapshot(snapshot)
    if (!decodedSnapshot) return ''

    const token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}${Math.random().toString(36).slice(2, 12)}`

    const { error } = await supabase.from('public_schedule_shares').insert({
      share_token: token,
      week_from: selectedWeekFrom,
      week_to: selectedWeekTo,
      snapshot: decodedSnapshot,
    })

    if (error) {
      console.error('Could not create public share link.', error)
      throw error
    }

    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}?publicShare=${token}&mobileLayout=${mobileLayout}`
  }

  function createAuthenticatedViewerUrl() {
    if (typeof window === 'undefined') return ''
    if (!selectedWeekFrom || !selectedWeekTo) return ''
    const base = `${window.location.origin}${window.location.pathname}`
    const params = new URLSearchParams({
      viewer: '1',
      weekFrom: selectedWeekFrom,
      weekTo: selectedWeekTo,
      mobileLayout,
    })
    return `${base}?${params.toString()}`
  }

  function createSnapshotShareUrl() {
    if (typeof window === 'undefined') return ''
    const snapshot = buildMobileShareSnapshot(gridScheduleItems, selectedWeekFrom, selectedWeekTo)
    if (!snapshot) return ''
    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}?mobileShare=1&mobileLayout=${mobileLayout}&snapshot=${snapshot}`
  }

  async function refreshPublicSharesForSelectedWeek() {
    if (!selectedWeekFrom || !selectedWeekTo) return

    const encodedSnapshot = buildMobileShareSnapshot(weekScheduleItems, selectedWeekFrom, selectedWeekTo)
    if (!encodedSnapshot) return

    const updatedSnapshot = decodeMobileShareSnapshot(encodedSnapshot)
    if (!updatedSnapshot) return

    const { error } = await supabase
      .from('public_schedule_shares')
      .update({ snapshot: updatedSnapshot })
      .eq('week_from', selectedWeekFrom)
      .eq('week_to', selectedWeekTo)

    if (error) {
      console.error('Could not refresh public mobile share snapshots.', error)
    }
  }

  async function copyMobileShareLink() {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    if (!url) {
      showError('Could not create mobile share link.')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      showSuccess('Public mobile view link copied.')
    } catch (error) {
      showError(url)
    }
  }

  async function openMobileShareView() {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    if (!url) {
      showError('Could not create mobile share link.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function copyMobileSmsMessage() {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    if (!url) {
      showError('Could not create mobile share link.')
      return
    }
    const message = `Weekly schedule for ${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}: ${url}`
    try {
      await navigator.clipboard.writeText(message)
      showSuccess('Public mobile text message copied. Paste it into your text app.')
    } catch (error) {
      showError(message)
    }
  }

  
async function copyContactList() {
    if (!contacts.length) {
      showError('No contacts saved yet.')
      return
    }
    const contactList = contacts
      .map((contact) => {
        const parts = [contact.name]
        if (contact.phone) parts.push(contact.phone)
        if (contact.email) parts.push(contact.email)
        return parts.join(' — ')
      })
      .join('\n')
    try {
      await navigator.clipboard.writeText(contactList)
      showSuccess('Contact list copied.')
    } catch (error) {
      showError(contactList)
    }
  }

  async function signIn() {
    setActionLoading('signIn')
    setMessage('Signing in...')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      showError(error.message)
    } else {
      setMessage('Signed in successfully.')
      showSuccess('Signed in successfully.')
    }
    setActionLoading('')
  }

  async function signOut() {
    await supabase.auth.signOut()
    setJobs([])
    setProjectManagers([])
    setSuperintendents([])
    setSurveyors([])
    setForemen([])
    setScheduleItems([])
    setEmailGroups([])
    setContacts([])
    setContactGroups([])
    setFieldNotes([])
    setSelectedFieldNoteIds(new Set())
    setMessage('Signed out.')
    showSuccess('Signed out.')
  }

  async function loadMasterData() {
    const [
      jobsResult,
      pmResult,
      superintendentResult,
      surveyorResult,
      foremanResult,
      emailGroupsResult,
      contactsResult,
      contactGroupsResult,
    ] = await Promise.all([
      supabase.from('jobs').select('*'),
      supabase
        .from('project_managers')
        .select('*')
        .order('name', { ascending: true }),
      supabase
        .from('superintendents')
        .select('*')
        .order('name', { ascending: true }),
      supabase.from('surveyors').select('*').order('name', { ascending: true }),
      supabase.from('foremen').select('*').order('name', { ascending: true }),
      supabase
        .from('email_groups')
        .select(`
          *,
          email_group_recipients (
            id,
            name,
            email,
            active
          )
        `)
        .order('name', { ascending: true }),
      supabase.from('contacts').select('*').eq('active', true).order('name', { ascending: true }),
      supabase
        .from('contact_groups')
        .select(`
          *,
          contact_group_memberships (
            id,
            contact_id
          )
        `)
        .eq('active', true)
        .order('name', { ascending: true }),
    ])

    if (
      jobsResult.error ||
      pmResult.error ||
      superintendentResult.error ||
      surveyorResult.error ||
      foremanResult.error ||
      emailGroupsResult.error ||
      contactsResult.error ||
      contactGroupsResult.error
    ) {
      console.error(
        jobsResult.error ||
          pmResult.error ||
          superintendentResult.error ||
          surveyorResult.error ||
          foremanResult.error ||
          emailGroupsResult.error ||
          contactsResult.error ||
          contactGroupsResult.error
      )
      throw new Error('There was an error loading master data.')
    }

    setJobs(jobsResult.data || [])
    setProjectManagers(pmResult.data || [])
    setSuperintendents(superintendentResult.data || [])
    setSurveyors(surveyorResult.data || [])
    setForemen(foremanResult.data || [])
    setEmailGroups(emailGroupsResult.data || [])
    setContacts(contactsResult.data || [])
    setContactGroups(contactGroupsResult.data || [])

    if (!selectedEmailGroupId && (emailGroupsResult.data || []).length) {
      setSelectedEmailGroupId(emailGroupsResult.data[0].id)
    }

    if (!selectedTextGroupViewId && (contactGroupsResult.data || []).length) {
      setSelectedTextGroupViewId(contactGroupsResult.data[0].id)
    }

    if (!recipientGroupId && (emailGroupsResult.data || []).length) {
      setRecipientGroupId(emailGroupsResult.data[0].id)
    }
  }

  async function loadScheduleItems() {
    const { data, error } = await supabase
      .from('schedule_items')
      .select(`
        *,
        jobs (
          id,
          job_number,
          job_name,
          start_date,
          stop_date
        ),
        project_managers (
          id,
          name
        ),
        superintendents (
          id,
          name
        ),
        surveyors (
          id,
          name
        ),
        schedule_item_foremen (
          id,
          foreman_id,
          assignment_from_date,
          assignment_to_date,
          work_description,
          split_note,
          foremen (
            id,
            name
          )
        ),
        schedule_item_surveyors (
          id,
          surveyor_id,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          note,
          surveyors (
            id,
            name
          )
        )
      `)
      .order('from_date', { ascending: true })

    if (error) {
      console.error(error)
      throw new Error(error.message)
    }

    const sorted = (data || []).sort((a, b) => {
      const aNum = extractJobNumberValue(a.jobs?.job_number)
      const bNum = extractJobNumberValue(b.jobs?.job_number)
      return aNum - bNum
    })

    setScheduleItems(sorted)
  }


  async function loadFieldNotes() {
    const { data, error } = await supabase
      .from('field_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load field notes.', error)
      return
    }

    setFieldNotes(data || [])
  }

  function getFieldNoteText(note) {
    return String(note?.note || note?.text || note?.content || '').trim()
  }

  function getFieldNoteCreatedAt(note) {
    return note?.created_at || note?.createdAt || note?.inserted_at || ''
  }

  function getFieldNoteDateKey(note) {
    const createdAt = getFieldNoteCreatedAt(note)
    if (!createdAt) return 'No Date'
    return toIsoDate(new Date(createdAt))
  }

  function getFieldNoteDateLabel(dateKey) {
    if (!dateKey || dateKey === 'No Date') return 'No Date'
    const todayKey = toIsoDate(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toIsoDate(yesterday)

    if (dateKey === todayKey) return 'Today'
    if (dateKey === yesterdayKey) return 'Yesterday'

    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function fieldNoteMatchesDateFilter(note) {
    if (fieldNotesDateFilter === 'all') return true

    const createdAt = getFieldNoteCreatedAt(note)
    if (!createdAt) return true

    const noteDate = new Date(createdAt)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const noteDay = new Date(noteDate)
    noteDay.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const selectedWeek = getMondaySundayRange(today)

    if (fieldNotesDateFilter === 'today') return noteDay.getTime() === today.getTime()
    if (fieldNotesDateFilter === 'yesterday') return noteDay.getTime() === yesterday.getTime()
    if (fieldNotesDateFilter === 'thisWeek') {
      const noteKey = toIsoDate(noteDay)
      return noteKey >= selectedWeek.from && noteKey <= selectedWeek.to
    }
    if (fieldNotesDateFilter === 'last30') {
      const cutoff = new Date(today)
      cutoff.setDate(today.getDate() - 30)
      return noteDay >= cutoff
    }

    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 7)
    return noteDay >= cutoff
  }

  function noteIsDone(note) {
    return note?.is_done === true || note?.is_done === 'true'
  }

  function noteIsPinned(note) {
    return note?.pinned === true || note?.pinned === 'true'
  }

  function matchTextFromList(text, list, fields = ['name']) {
    const lowered = String(text || '').toLowerCase()
    return (list || []).find((item) =>
      fields.some((field) => {
        const value = String(item?.[field] || '').trim().toLowerCase()
        return value && lowered.includes(value)
      })
    ) || null
  }

  function normalizeTextForMatch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getBestJobMatch(text) {
    const normalizedText = normalizeTextForMatch(text)
    if (!normalizedText) return null

    const rankedMatches = (jobs || [])
      .map((job) => {
        const jobName = normalizeTextForMatch(job.job_name)
        const jobNumber = normalizeTextForMatch(job.job_number)
        let score = 0

        if (jobName && normalizedText === jobName) score += 100
        if (jobName && normalizedText.includes(jobName)) score += 80 + jobName.length
        if (jobNumber && normalizedText.includes(jobNumber)) score += 70 + jobNumber.length

        const nameWords = jobName.split(' ').filter((word) => word.length >= 4)
        nameWords.forEach((word) => {
          if (normalizedText.includes(word)) score += 12
        })

        return { job, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)

    return rankedMatches[0]?.job || null
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function matchTextFromList(text, list, fields = ['name']) {
    const lowered = String(text || '').toLowerCase()
    return (list || []).find((item) =>
      fields.some((field) => {
        const value = String(item?.[field] || '').trim().toLowerCase()
        return value && lowered.includes(value)
      })
    ) || null
  }


  function cleanFieldNoteText(value) {
    let cleaned = String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/\bneat inspector\b/gi, 'meet inspector')
      .replace(/\bmeat inspector\b/gi, 'meet inspector')
      .replace(/\bmeet inspections\b/gi, 'meet inspector')
      .replace(/\bcause way\b/gi, 'Causeway')
      .replace(/\bwestbank\b/gi, 'West Bank')
      .replace(/\bbaton rouge\b/gi, 'Baton Rouge')
      .trim()

    ;(jobs || []).forEach((job) => {
      const jobName = String(job.job_name || '').trim()
      if (!jobName || jobName.length < 3) return
      cleaned = cleaned.replace(new RegExp('\\b' + escapeRegExp(jobName) + '\\b', 'gi'), jobName)
    })

    ;(foremen || []).forEach((person) => {
      const name = String(person.name || '').trim()
      if (!name || name.length < 3) return
      cleaned = cleaned.replace(new RegExp('\\b' + escapeRegExp(name) + '\\b', 'gi'), name)
    })

    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : ''
  }

  function cleanQuickNoteDraft() {
    setQuickNote((prev) => cleanFieldNoteText(prev))
  }

  function classifyFieldNote(noteText) {
    const text = String(noteText || '')
    const lowered = text.toLowerCase()
    const matchedJob = getBestJobMatch(text)
    const matchedForeman = matchTextFromList(text, foremen, ['name'])
    const matchedSuperintendent = matchTextFromList(text, superintendents, ['name'])

    let type = 'General Note'
    if (isEquipmentMoveNoteText(text)) type = 'Equipment Move'
    if (/\b(call|text|email|follow up|remind|check with|meeting|meet with)\b/i.test(text)) type = 'Reminder'
    if (/\b(need|order|move|schedule|send|get|pickup|pick up|deliver|line up|pour|finish|finished|dress|dressing)\b/i.test(text)) type = 'Task'
    if (/\b(problem|issue|late|behind|missing|conflict|failed|hold up|hold-up|stuck|overran|overrun)\b/i.test(text)) type = 'Issue'
    if (/\b(manpower|crew|guys|men|foreman|labor|operator|superintendent)\b/i.test(text)) type = 'Manpower'
    if (isEquipmentMoveNoteText(text)) type = 'Equipment Move'

    return {
      type,
      jobLabel: matchedJob ? `${matchedJob.job_number || ''}${matchedJob.job_number && matchedJob.job_name ? ' — ' : ''}${matchedJob.job_name || ''}` : 'Unsorted Job',
      personLabel: matchedForeman?.name || matchedSuperintendent?.name || '',
      isToday: /\b(today|this morning|this afternoon|tonight)\b/i.test(lowered),
    }
  }

  function splitQuickNoteText(noteText) {
    const rawText = String(noteText || '')
      .replace(/\r/g, '\n')
      .replace(/\s+then\s+/gi, '. ')
      .replace(/\s+and then\s+/gi, '. ')
      .replace(/\s+also\s+/gi, '. ')
      .trim()

    if (!rawText) return []

    let pieces = rawText
      .split(/(?:\n+|[.;•]+|\s+-\s+)/g)
      .map((piece) => piece.trim())
      .filter(Boolean)

    const allJobTerms = (jobs || [])
      .flatMap((job) => [job.job_number, job.job_name])
      .map((value) => String(value || '').trim())
      .filter((value) => value.length >= 3)
      .sort((a, b) => b.length - a.length)

    const splitOnKnownJobs = []
    pieces.forEach((piece) => {
      let nextPieces = [piece]

      allJobTerms.forEach((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const jobPattern = new RegExp(`\\b(job\\s+)?${escaped}\\b`, 'ig')
        nextPieces = nextPieces.flatMap((candidate) => {
          const matches = [...candidate.matchAll(jobPattern)]
          if (matches.length <= 1) return [candidate]

          const chunks = []
          matches.forEach((match, index) => {
            const start = match.index || 0
            const end = matches[index + 1]?.index ?? candidate.length
            const chunk = candidate.slice(start, end).trim()
            if (chunk) chunks.push(chunk)
          })

          const beforeFirst = candidate.slice(0, matches[0].index || 0).trim()
          return beforeFirst ? [beforeFirst, ...chunks] : chunks
        })
      })

      splitOnKnownJobs.push(...nextPieces)
    })

    pieces = splitOnKnownJobs
      .flatMap((piece) => piece.split(/\s{2,}/g))
      .map((piece) => piece.trim().replace(/^,\s*/, ''))
      .filter((piece) => piece.length > 2)

    if (pieces.length <= 1) return [rawText]

    return pieces.map((piece) => piece.replace(/^[, ]+|[, ]+$/g, '')).filter(Boolean)
  }

  function isEquipmentMoveNoteText(noteText) {
    return /\b(equipment|move|moves|moved|moving|haul|hauling|trailer|trailering|transfer|transport|relocate|relocated|machine|machines|dozer|excavator|skid steer|skidsteer|loader|backhoe|roller|lift|boom lift|forklift|water truck|dump truck|lowboy|low boy)\b/i.test(String(noteText || ''))
  }

  const organizedFieldNotes = useMemo(() => {
    const search = fieldNotesSearch.trim().toLowerCase()
    const visibleNotes = (fieldNotes || []).filter((note) => {
      const text = getFieldNoteText(note)
      const done = noteIsDone(note)

      if (!fieldNotesShowDone && done) return false
      if (!fieldNoteMatchesDateFilter(note)) return false
      if (!search) return true
      return text.toLowerCase().includes(search)
    })

    const groups = {
      today: [],
      issues: [],
      byJob: {},
      unsorted: [],
      daily: {},
      pinned: [],
      equipmentMoves: [],
      all: [],
    }

    visibleNotes.forEach((note) => {
      const text = getFieldNoteText(note)
      const info = classifyFieldNote(text)
      const entry = { note, text, info }
      const dateKey = getFieldNoteDateKey(note)

      groups.all.push(entry)

      if (!groups.daily[dateKey]) groups.daily[dateKey] = []
      groups.daily[dateKey].push(entry)

      if (noteIsPinned(note)) groups.pinned.push(entry)
      if (isEquipmentMoveNoteText(text)) groups.equipmentMoves.push(entry)
      if (info.isToday) groups.today.push(entry)
      if (info.type === 'Issue') groups.issues.push(entry)

      if (info.jobLabel && info.jobLabel !== 'Unsorted Job') {
        if (!groups.byJob[info.jobLabel]) groups.byJob[info.jobLabel] = []
        groups.byJob[info.jobLabel].push(entry)
      } else {
        groups.unsorted.push(entry)
      }
    })

    return groups
  }, [fieldNotes, fieldNotesSearch, fieldNotesDateFilter, fieldNotesShowDone, jobs, foremen, superintendents])

  async function saveQuickNote() {
    const noteText = quickNote.trim()
    if (!noteText) {
      showError('Type or dictate a note first.')
      return
    }

    setActionLoading('saveQuickNote')

    const splitNotes = splitQuickNoteText(noteText)
    const createdAt = new Date().toISOString()
    const rowsToInsert = splitNotes.map((note) => ({
      note: cleanFieldNoteText(note),
      created_at: createdAt,
    }))

    const { error } = await supabase.from('field_notes').insert(rowsToInsert)

    if (error) {
      showError(error.message)
      setActionLoading('')
      return
    }

    setQuickNote('')
    await loadFieldNotes()
    showSuccess(splitNotes.length > 1 ? `${splitNotes.length} field notes saved and separated.` : 'Field note saved.')
    setActionLoading('')
  }

  async function deleteFieldNote(noteId) {
    const confirmed = window.confirm('Delete this field note?')
    if (!confirmed) return

    const { error } = await supabase.from('field_notes').delete().eq('id', noteId)
    if (error) {
      showError(error.message)
      return
    }

    await loadFieldNotes()
    showSuccess('Field note deleted.')
  }


  function toggleSelectedFieldNote(noteId) {
    setSelectedFieldNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  function clearSelectedFieldNotes() {
    setSelectedFieldNoteIds(new Set())
  }

  function selectVisibleFieldNotes() {
    setSelectedFieldNoteIds(new Set(organizedFieldNotes.all.map((entry) => entry.note.id).filter(Boolean)))
  }

  async function updateFieldNoteStatus(noteId, updates, successText = 'Field note updated.') {
    const { error } = await supabase
      .from('field_notes')
      .update(updates)
      .eq('id', noteId)

    if (error) {
      showError(error.message)
      return
    }

    await loadFieldNotes()
    showSuccess(successText)
  }

  async function toggleFieldNoteDone(note) {
    const done = noteIsDone(note)
    await updateFieldNoteStatus(
      note.id,
      { is_done: !done, completed_at: !done ? new Date().toISOString() : null },
      !done ? 'Field note marked done.' : 'Field note reopened.'
    )
  }

  async function toggleFieldNotePinned(note) {
    const pinned = noteIsPinned(note)
    await updateFieldNoteStatus(note.id, { pinned: !pinned }, !pinned ? 'Field note pinned.' : 'Field note unpinned.')
  }

  async function bulkUpdateSelectedFieldNotes(mode) {
    const ids = Array.from(selectedFieldNoteIds).filter(Boolean)
    if (!ids.length) {
      showError('Select at least one field note first.')
      return
    }

    let updates = {}
    let successText = 'Selected notes updated.'

    if (mode === 'done') {
      updates = { is_done: true, completed_at: new Date().toISOString() }
      successText = `${ids.length} selected note${ids.length === 1 ? '' : 's'} marked done.`
    } else if (mode === 'reopen') {
      updates = { is_done: false, completed_at: null }
      successText = `${ids.length} selected note${ids.length === 1 ? '' : 's'} reopened.`
    }

    const { error } = await supabase
      .from('field_notes')
      .update(updates)
      .in('id', ids)

    if (error) {
      showError(error.message)
      return
    }

    clearSelectedFieldNotes()
    await loadFieldNotes()
    showSuccess(successText)
  }

  async function deleteSelectedFieldNotes() {
    const ids = Array.from(selectedFieldNoteIds).filter(Boolean)
    if (!ids.length) {
      showError('Select at least one field note first.')
      return
    }

    const confirmed = window.confirm(`Delete ${ids.length} selected field note${ids.length === 1 ? '' : 's'}?`)
    if (!confirmed) return

    const { error } = await supabase.from('field_notes').delete().in('id', ids)
    if (error) {
      showError(error.message)
      return
    }

    clearSelectedFieldNotes()
    await loadFieldNotes()
    showSuccess(`${ids.length} selected note${ids.length === 1 ? '' : 's'} deleted.`)
  }

  function startEditFieldNote(note) {
    setEditingFieldNoteId(note.id)
    setEditingFieldNoteText(getFieldNoteText(note))
  }

  function cancelEditFieldNote() {
    setEditingFieldNoteId(null)
    setEditingFieldNoteText('')
  }

  async function saveEditedFieldNote(noteId) {
    const cleanedText = cleanFieldNoteText(editingFieldNoteText)
    if (!cleanedText) {
      showError('Note cannot be blank.')
      return
    }

    setActionLoading('editFieldNote-' + noteId)
    const { error } = await supabase
      .from('field_notes')
      .update({ note: cleanedText })
      .eq('id', noteId)

    if (error) {
      showError(error.message)
      setActionLoading('')
      return
    }

    cancelEditFieldNote()
    await loadFieldNotes()
    showSuccess('Field note updated.')
    setActionLoading('')
  }

  function cleanEditingFieldNote() {
    setEditingFieldNoteText((prev) => cleanFieldNoteText(prev))
  }

  function renderFieldNoteCard(entry, options = {}) {
    const note = entry.note
    const text = entry.text
    const info = entry.info
    const createdAt = getFieldNoteCreatedAt(note)
    const isEditing = note.id && editingFieldNoteId === note.id
    const isDone = noteIsDone(note)
    const isPinned = noteIsPinned(note)
    const isSelected = note.id && selectedFieldNoteIds.has(note.id)

    return (
      <div key={note.id || `${text}-${createdAt}`} style={isDone ? styles.fieldNoteCardDone : styles.fieldNoteCard}>
        {isEditing ? (
          <>
            <textarea
              value={editingFieldNoteText}
              onChange={(e) => setEditingFieldNoteText(e.target.value)}
              spellCheck={true}
              style={styles.fieldNoteEditArea}
            />
            <div style={styles.fieldNotesActionRow}>
              <button
                onClick={() => saveEditedFieldNote(note.id)}
                disabled={isActionBusy('editFieldNote-' + note.id)}
                style={isActionBusy('editFieldNote-' + note.id) ? styles.buttonDisabled : styles.smallButton}
              >
                {isActionBusy('editFieldNote-' + note.id) ? 'Saving...' : 'Save'}
              </button>
              <button onClick={cleanEditingFieldNote} style={styles.smallButton}>Clean Text</button>
              <button onClick={cancelEditFieldNote} style={styles.smallButton}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div style={styles.fieldNoteTopLine}>
              {!options.hideSelect && note.id ? (
                <input
                  type="checkbox"
                  checked={Boolean(isSelected)}
                  onChange={() => toggleSelectedFieldNote(note.id)}
                  style={styles.fieldNoteCheckbox}
                  aria-label="Select field note"
                />
              ) : null}
              <div style={isDone ? styles.fieldNoteTextDone : styles.fieldNoteText}>
                {isPinned ? <span style={styles.fieldNoteStar}>★ </span> : null}{text}
              </div>
            </div>
            <div style={styles.fieldNoteMetaRow}>
              <span style={styles.fieldNotePill}>{info.type}</span>
              {isDone ? <span style={styles.fieldNoteDonePill}>Done</span> : null}
              {isPinned ? <span style={styles.fieldNotePinPill}>Pinned</span> : null}
              {info.personLabel ? <span style={styles.fieldNotePill}>Person: {info.personLabel}</span> : null}
              {createdAt ? <span style={styles.fieldNoteDate}>{new Date(createdAt).toLocaleString()}</span> : null}
            </div>
            {!options.hideDelete && note.id ? (
              <div style={styles.fieldNotesActionRow}>
                <button onClick={() => toggleFieldNotePinned(note)} style={styles.smallButton}>{isPinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={() => toggleFieldNoteDone(note)} style={styles.smallButton}>{isDone ? 'Reopen' : 'Done'}</button>
                <button onClick={() => startEditFieldNote(note)} style={styles.smallButton}>Edit</button>
                <button onClick={() => deleteFieldNote(note.id)} style={styles.smallDangerButton}>Delete</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    )
  }

  function renderFieldNoteList(entries, emptyText = 'No notes found.') {
    if (!entries.length) return <p style={styles.text}>{emptyText}</p>
    return entries.map((entry) => renderFieldNoteCard(entry))
  }

  function renderFieldNotesPanel({ quickMode = false } = {}) {
    const jobEntries = Object.entries(organizedFieldNotes.byJob)
    const dailyEntries = Object.entries(organizedFieldNotes.daily).sort(([a], [b]) => b.localeCompare(a))
    const selectedCount = selectedFieldNoteIds.size

    return (
      <div style={quickMode ? styles.quickDumpPage : styles.fieldNotesPage}>
        <div style={quickMode ? styles.quickDumpCard : styles.card}>
          <div style={styles.fieldNotesHeaderRow}>
            <div>
              <h1 style={quickMode ? styles.quickDumpTitle : styles.sectionTitle}>Field Dump</h1>
              <p style={styles.fieldNotesHelper}>
                Tap the box, use the keyboard microphone, talk, and save. For best sorting, speak one thought at a time and pause between jobs. The app will separate notes and sort by job, issue, and reminder words.
              </p>
            </div>
            {quickMode ? null : (
              <button onClick={() => setActiveTab('weekly')} style={styles.buttonSecondary}>Back to Schedule</button>
            )}
          </div>

          <textarea
            autoFocus={quickMode}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Tap here, then tap the keyboard mic and talk..."
            spellCheck={true}
            style={quickMode ? styles.quickDumpTextArea : styles.fieldNotesTextArea}
          />

          <div style={styles.fieldNotesActionRow}>
            <button onClick={saveQuickNote} disabled={isActionBusy('saveQuickNote')} style={isActionBusy('saveQuickNote') ? styles.buttonDisabled : styles.button}>
              {isActionBusy('saveQuickNote') ? 'Saving...' : 'Save Field Note'}
            </button>
            <button onClick={cleanQuickNoteDraft} style={styles.buttonSecondary}>Clean Text</button>
            <button onClick={() => setQuickNote('')} style={styles.buttonSecondary}>Clear</button>
          </div>
        </div>

        {quickMode ? (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Recent Notes</h2>
            {(fieldNotes || []).slice(0, 6).length ? (
              (fieldNotes || []).slice(0, 6).map((note) =>
                renderFieldNoteCard({ note, text: getFieldNoteText(note), info: classifyFieldNote(getFieldNoteText(note)) }, { hideDelete: true, hideSelect: true })
              )
            ) : (
              <p style={styles.text}>No notes yet.</p>
            )}
          </div>
        ) : (
          <div style={styles.card}>
            <div style={styles.fieldNotesHeaderRow}>
              <h2 style={styles.sectionTitle}>Field Notes Notebook</h2>
              <input
                value={fieldNotesSearch}
                onChange={(e) => setFieldNotesSearch(e.target.value)}
                placeholder="Search notes..."
                style={styles.input}
              />
            </div>

            <div style={styles.fieldNotesToolbar}>
              <select value={fieldNotesDateFilter} onChange={(e) => setFieldNotesDateFilter(e.target.value)} style={styles.compactSelect}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="all">All Notes</option>
              </select>
              <label style={styles.inlineCheckLabel}>
                <input type="checkbox" checked={fieldNotesShowDone} onChange={(e) => setFieldNotesShowDone(e.target.checked)} />
                Show done
              </label>
              <button onClick={selectVisibleFieldNotes} style={styles.smallButton}>Select Visible</button>
              <button onClick={clearSelectedFieldNotes} style={styles.smallButton}>Clear Selection</button>
              <button onClick={() => bulkUpdateSelectedFieldNotes('done')} style={styles.smallButton}>Mark Done</button>
              <button onClick={() => bulkUpdateSelectedFieldNotes('reopen')} style={styles.smallButton}>Reopen</button>
              <button onClick={deleteSelectedFieldNotes} style={styles.smallDangerButton}>Delete Selected</button>
            </div>
            <div style={styles.fieldNoteCountLine}>Showing {organizedFieldNotes.all.length} note{organizedFieldNotes.all.length === 1 ? '' : 's'} · {selectedCount} selected</div>

            <div style={styles.fieldNotesSubTabs}>
              {[
                ['daily', 'Daily Notebook'],
                ['jobs', 'By Job'],
                ['issues', 'Issues'],
                ['equipment', 'Equipment Moves'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFieldNotesView(value)}
                  style={fieldNotesView === value ? styles.fieldNotesSubTabActive : styles.fieldNotesSubTab}
                >
                  {label}
                </button>
              ))}
            </div>

            {fieldNotesView === 'daily' ? (
              <div style={styles.fieldNotesTwoColumnGrid}>
                <div>
                  <h3 style={styles.fieldNoteGroupTitle}>Daily Notebook</h3>
                  {dailyEntries.length ? dailyEntries.map(([dateKey, entries]) => (
                    <div key={dateKey} style={styles.fieldNoteDateBlock}>
                      <div style={styles.fieldNoteDateTitle}>{getFieldNoteDateLabel(dateKey)}</div>
                      {entries.map((entry) => renderFieldNoteCard(entry))}
                    </div>
                  )) : <p style={styles.text}>No notes found for this date range.</p>}
                </div>
                <div>
                  <h3 style={styles.fieldNoteGroupTitle}>Pinned / Important</h3>
                  {renderFieldNoteList(organizedFieldNotes.pinned, 'No pinned notes right now.')}
                </div>
              </div>
            ) : null}

            {fieldNotesView === 'jobs' ? (
              <div>
                <h3 style={styles.fieldNoteGroupTitle}>By Job</h3>
                {jobEntries.length ? (
                  <div style={styles.fieldNotesJobGrid}>
                    {jobEntries.map(([jobLabel, entries]) => (
                      <div key={jobLabel} style={styles.fieldNoteJobBlock}>
                        <div style={styles.fieldNoteJobTitle}>{jobLabel}</div>
                        {entries.map((entry) => renderFieldNoteCard(entry))}
                      </div>
                    ))}
                  </div>
                ) : <p style={styles.text}>No job-matched notes found.</p>}
              </div>
            ) : null}

            {fieldNotesView === 'issues' ? (
              <div>
                <h3 style={styles.fieldNoteGroupTitle}>Issues</h3>
                {renderFieldNoteList(organizedFieldNotes.issues, 'No issues found.')}
              </div>
            ) : null}

            {fieldNotesView === 'equipment' ? (
              <div>
                <h3 style={styles.fieldNoteGroupTitle}>Equipment Moves</h3>
                <p style={styles.fieldNotesHelper}>Notes with equipment, move, haul, trailer, transfer, dozer, excavator, skid steer, loader, or similar wording will show here automatically.</p>
                {renderFieldNoteList(organizedFieldNotes.equipmentMoves, 'No equipment moves found for this date range.')}
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  async function loadAllData() {
    setLoading(true)
    setMessage('Loading data from Supabase...')

    try {
      await Promise.all([loadMasterData(), loadScheduleItems(), loadFieldNotes()])
      setLastUpdatedAt(new Date().toISOString())
      setMessage('Data loaded successfully.')
    } catch (err) {
      console.error(err)
      const nextMessage = err.message || 'There was an error loading your data.'
      setMessage(nextMessage)
      showError(nextMessage)
    }

    setLoading(false)
  }

  function buildJobNumber() {
    const prefix = jobPrefix.trim().toUpperCase()
    const part2 = jobNumberPart2.trim()
    if (!prefix || !part2) return ''
    return `${prefix} - ${part2}`
  }

  function parseJobNumber(jobNumber) {
    if (!jobNumber) return { prefix: 'CC', number: '' }
    const parts = jobNumber.split('-').map((x) => x.trim())
    return {
      prefix: parts[0] || 'CC',
      number: parts[1] || '',
    }
  }

  function resetJobForm() {
    setJobPrefix('CC')
    setJobNumberPart2('')
    setJobName('')
    setJobStartDate('')
    setJobStopDate('')
    setEditingJobId(null)
  }

  async function saveJob() {
    const finalJobNumber = buildJobNumber()

    if (!finalJobNumber || !jobName) {
      showError('Enter job prefix, job number, and job name')
      return
    }

    if (!/^\d+$/.test(jobNumberPart2.trim())) {
      showError('The second part of the job number must be numbers only')
      return
    }

    const payload = {
      job_number: finalJobNumber,
      job_name: jobName,
      start_date: jobStartDate || null,
      stop_date: jobStopDate || null,
      active: true,
    }

    let error

    if (editingJobId) {
      const result = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editingJobId)
      error = result.error
    } else {
      const result = await supabase.from('jobs').insert(payload)
      error = result.error
    }

    if (error) {
      showError(error.message)
    } else {
      resetJobForm()
      loadAllData()
    }
  }

  function editJob(job) {
    const parsed = parseJobNumber(job.job_number)
    setJobPrefix(parsed.prefix)
    setJobNumberPart2(parsed.number)
    setJobName(job.job_name || '')
    setJobStartDate(job.start_date || '')
    setJobStopDate(job.stop_date || '')
    setEditingJobId(job.id)
    setActiveTab('master')
  }

  async function deleteJob(id) {
    const confirmed = window.confirm('Delete this job?')
    if (!confirmed) return

    const { error } = await supabase.from('jobs').delete().eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingJobId === id) resetJobForm()
      loadAllData()
    }
  }

  function resetPmForm() {
    setPmName('')
    setEditingPmId(null)
  }

  async function saveProjectManager() {
    if (!pmName) {
      showError('Enter a project manager name')
      return
    }

    let error

    if (editingPmId) {
      const result = await supabase
        .from('project_managers')
        .update({ name: pmName, active: true })
        .eq('id', editingPmId)
      error = result.error
    } else {
      const result = await supabase
        .from('project_managers')
        .insert({ name: pmName, active: true })
      error = result.error
    }

    if (error) {
      showError(error.message)
    } else {
      resetPmForm()
      loadAllData()
    }
  }

  function editProjectManager(person) {
    setPmName(person.name || '')
    setEditingPmId(person.id)
  }

  async function deleteProjectManager(id) {
    const confirmed = window.confirm('Delete this project manager?')
    if (!confirmed) return

    const { error } = await supabase
      .from('project_managers')
      .delete()
      .eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingPmId === id) resetPmForm()
      loadAllData()
    }
  }

  function resetSuperintendentForm() {
    setSuperintendentName('')
    setEditingSuperintendentId(null)
  }

  async function saveSuperintendent() {
    if (!superintendentName) {
      showError('Enter a superintendent name')
      return
    }

    let error

    if (editingSuperintendentId) {
      const result = await supabase
        .from('superintendents')
        .update({ name: superintendentName, active: true })
        .eq('id', editingSuperintendentId)
      error = result.error
    } else {
      const result = await supabase
        .from('superintendents')
        .insert({ name: superintendentName, active: true })
      error = result.error
    }

    if (error) {
      showError(error.message)
    } else {
      resetSuperintendentForm()
      loadAllData()
    }
  }

  function editSuperintendent(person) {
    setSuperintendentName(person.name || '')
    setEditingSuperintendentId(person.id)
  }

  async function deleteSuperintendent(id) {
    const confirmed = window.confirm('Delete this superintendent?')
    if (!confirmed) return

    const { error } = await supabase
      .from('superintendents')
      .delete()
      .eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingSuperintendentId === id) resetSuperintendentForm()
      loadAllData()
    }
  }

  function resetSurveyorForm() {
    setSurveyorName('')
    setEditingSurveyorId(null)
  }

  async function saveSurveyor() {
    if (!surveyorName) {
      showError('Enter a surveyor name')
      return
    }

    let error

    if (editingSurveyorId) {
      const result = await supabase
        .from('surveyors')
        .update({ name: surveyorName, active: true })
        .eq('id', editingSurveyorId)
      error = result.error
    } else {
      const result = await supabase
        .from('surveyors')
        .insert({ name: surveyorName, active: true })
      error = result.error
    }

    if (error) {
      showError(error.message)
    } else {
      resetSurveyorForm()
      loadAllData()
    }
  }

  function editSurveyor(person) {
    setSurveyorName(person.name || '')
    setEditingSurveyorId(person.id)
  }

  async function deleteSurveyor(id) {
    const confirmed = window.confirm('Delete this surveyor?')
    if (!confirmed) return

    const { error } = await supabase.from('surveyors').delete().eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingSurveyorId === id) resetSurveyorForm()
      loadAllData()
    }
  }

  function resetForemanForm() {
    setForemanName('')
    setEditingForemanId(null)
  }

  async function saveForeman() {
    if (!foremanName) {
      showError('Enter a foreman name')
      return
    }

    let error

    if (editingForemanId) {
      const result = await supabase
        .from('foremen')
        .update({ name: foremanName, active: true })
        .eq('id', editingForemanId)
      error = result.error
    } else {
      const result = await supabase
        .from('foremen')
        .insert({ name: foremanName, active: true })
      error = result.error
    }

    if (error) {
      showError(error.message)
    } else {
      resetForemanForm()
      loadAllData()
    }
  }

  function editForeman(person) {
    setForemanName(person.name || '')
    setEditingForemanId(person.id)
  }

  async function deleteForeman(id) {
    const confirmed = window.confirm('Delete this foreman?')
    if (!confirmed) return

    const { error } = await supabase.from('foremen').delete().eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingForemanId === id) resetForemanForm()
      loadAllData()
    }
  }

  async function addEmailGroup() {
    setActionLoading('saveEmailGroup')
    if (!newEmailGroupName.trim()) {
      showError('Enter an email group name')
      setActionLoading('')
      return
    }

    const { error } = await supabase.from('email_groups').insert({
      name: newEmailGroupName.trim(),
      active: true,
    })

    if (error) {
      showError(error.message)
    } else {
      setNewEmailGroupName('')
      loadAllData()
      showSuccess('Email group added.')
      setActionLoading('')
    }
  }

  async function addRecipient() {
    if (!recipientGroupId || !recipientEmail.trim()) {
      showError('Choose a group and enter an email')
      setActionLoading('')
      return
    }

    const { error } = await supabase.from('email_group_recipients').insert({
      email_group_id: recipientGroupId,
      name: recipientName.trim() || null,
      email: recipientEmail.trim(),
      active: true,
    })

    if (error) {
      showError(error.message)
    } else {
      setRecipientName('')
      setRecipientEmail('')
      loadAllData()
    }
  }

  async function deleteEmailGroup(id) {
    setActionLoading('deleteEmailGroup')
    const confirmed = window.confirm('Delete this email group?')
    if (!confirmed) {
      setActionLoading('')
      return
    }

    const { error } = await supabase.from('email_groups').delete().eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (selectedEmailGroupId === id) setSelectedEmailGroupId('')
      if (recipientGroupId === id) setRecipientGroupId('')
      loadAllData()
      showSuccess('Email group deleted.')
      setActionLoading('')
    }
  }

  async function deleteRecipient(id) {
    const confirmed = window.confirm('Delete this email recipient?')
    if (!confirmed) return

    const { error } = await supabase
      .from('email_group_recipients')
      .delete()
      .eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      loadAllData()
    }
  }

  function updateScheduleForm(field, value) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }


  function updateScheduleProjectManagers(selectedOptions) {
    const values = Array.from(selectedOptions || []).map((option) => option.value).filter(Boolean)
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      project_manager_ids: values,
      project_manager_id: values[0] || '',
    }))
  }

  function updateProjectManagerAssignment(index, value) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => {
      const current = Array.isArray(prev.project_manager_ids) && prev.project_manager_ids.length
        ? [...prev.project_manager_ids]
        : ['']
      current[index] = value
      const cleaned = current.filter((id, i) => id || i === 0)
      return {
        ...prev,
        project_manager_ids: cleaned,
        project_manager_id: cleaned.find(Boolean) || '',
      }
    })
  }

  function addProjectManagerAssignmentRow() {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      project_manager_ids: [...(Array.isArray(prev.project_manager_ids) && prev.project_manager_ids.length ? prev.project_manager_ids : ['']), ''],
    }))
  }

  function removeProjectManagerAssignmentRow(index) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => {
      const current = Array.isArray(prev.project_manager_ids) && prev.project_manager_ids.length
        ? [...prev.project_manager_ids]
        : ['']
      const updated = current.filter((_, i) => i !== index)
      const next = updated.length ? updated : ['']
      return {
        ...prev,
        project_manager_ids: next,
        project_manager_id: next.find(Boolean) || '',
      }
    })
  }

  function updateSuperintendentAssignment(localId, field, value) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      superintendent_assignments: (prev.superintendent_assignments || [emptySuperintendentAssignment()]).map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      ),
    }))
  }

  function addSuperintendentAssignmentRow() {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      superintendent_assignments: [...(prev.superintendent_assignments || []), emptySuperintendentAssignment()],
    }))
  }

  function removeSuperintendentAssignmentRow(localId) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => {
      const updated = (prev.superintendent_assignments || []).filter((item) => item.localId !== localId)
      return {
        ...prev,
        superintendent_assignments: updated.length ? updated : [emptySuperintendentAssignment()],
      }
    })
  }

  function updateEquipmentMove(dayKey, value) {
    setHasUnsavedChanges(true)
    setScheduleForm((prev) => ({
      ...prev,
      equipment_moves: {
        ...emptyEquipmentMoves(),
        ...(prev.equipment_moves || {}),
        [dayKey]: value,
      },
    }))
  }

  function updateForemanAssignment(localId, field, value) {
    setHasUnsavedChanges(true)
    setForemanAssignments((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    )
  }

  function addForemanAssignmentRow() {
    setHasUnsavedChanges(true)
    setForemanAssignments((prev) => [...prev, emptyForemanAssignment()])
  }

  function removeForemanAssignmentRow(localId) {
    setHasUnsavedChanges(true)
    setForemanAssignments((prev) => {
      const updated = prev.filter((item) => item.localId !== localId)
      return updated.length ? updated : [emptyForemanAssignment()]
    })
  }

  function updateSurveyorAssignment(localId, field, value) {
    setHasUnsavedChanges(true)
    setSurveyorAssignments((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    )
  }

  function addSurveyorAssignmentRow() {
    setHasUnsavedChanges(true)
    setSurveyorAssignments((prev) => [...prev, emptySurveyorAssignment()])
  }

  function removeSurveyorAssignmentRow(localId) {
    setHasUnsavedChanges(true)
    setSurveyorAssignments((prev) => {
      const updated = prev.filter((item) => item.localId !== localId)
      return updated.length ? updated : [emptySurveyorAssignment()]
    })
  }

  function resetScheduleForm() {
    setHasUnsavedChanges(false)
    setEditingScheduleItemId(null)
    setShowScheduleEditor(false)
    setScheduleForm({
      from_date: '',
      to_date: '',
      job_id: '',
      project_manager_id: '',
      project_manager_ids: [],
      superintendent_id: '',
      superintendent_assignments: [emptySuperintendentAssignment()],
      surveyor_id: '',
      equipment_moves: emptyEquipmentMoves(),
      notes: '',
    })
    setForemanAssignments([emptyForemanAssignment()])
    setSurveyorAssignments([emptySurveyorAssignment()])
  }

  function editScheduleItem(item) {
    if (!confirmDiscardUnsavedChanges()) return
    setHasUnsavedChanges(false)
    setReturnToScrollY(window.scrollY)
    setReturnToItemId(item.id)
    setEditingScheduleItemId(item.id)
    setSelectedWeekFrom(item.from_date || '')
    setSelectedWeekTo(item.to_date || '')
    const savedPmIdsFromMulti = Array.isArray(item.project_manager_ids)
      ? item.project_manager_ids.filter(Boolean)
      : []
    const savedPmIds = savedPmIdsFromMulti.length
      ? savedPmIdsFromMulti
      : item.project_manager_id ? [item.project_manager_id] : []
    const savedSuperAssignments = Array.isArray(item.superintendent_assignments) && item.superintendent_assignments.length
      ? item.superintendent_assignments.map((assignment) => ({
          localId: crypto.randomUUID(),
          superintendent_id: assignment.superintendent_id || assignment.id || '',
          shift: assignment.shift || '',
        }))
      : item.superintendent_id ? [{ localId: crypto.randomUUID(), superintendent_id: item.superintendent_id, shift: '' }] : [emptySuperintendentAssignment()]

    setScheduleForm({
      from_date: item.from_date || '',
      to_date: item.to_date || '',
      job_id: item.job_id || '',
      project_manager_id: savedPmIds[0] || '',
      project_manager_ids: savedPmIds,
      superintendent_id: savedSuperAssignments.find((assignment) => assignment.superintendent_id)?.superintendent_id || '',
      superintendent_assignments: savedSuperAssignments,
      surveyor_id: item.surveyor_id || '',
      equipment_moves: { ...emptyEquipmentMoves(), ...(item.equipment_moves || {}) },
      notes: item.notes || '',
    })

    if (item.schedule_item_foremen?.length) {
      setForemanAssignments(
        item.schedule_item_foremen.map((assignment) => {
          const subcontractorName = getForemanSubcontractorName(assignment.split_note)
          const night = getForemanNightFlag(assignment.split_note)
          return {
            localId: crypto.randomUUID(),
            id: assignment.id,
            foreman_id: assignment.foreman_id || (subcontractorName ? '__subcontractor__' : ''),
            assignment_from_date: assignment.assignment_from_date || '',
            assignment_to_date: assignment.assignment_to_date || '',
            work_description: assignment.work_description || '',
            split_note: '',
            subcontractor_name: subcontractorName,
            night,
          }
        })
      )
    } else {
      setForemanAssignments([emptyForemanAssignment()])
    }

    if (item.schedule_item_surveyors?.length) {
      setSurveyorAssignments(
        item.schedule_item_surveyors.map((assignment) => ({
          localId: crypto.randomUUID(),
          id: assignment.id,
          surveyor_id: assignment.surveyor_id || '',
          monday: !!assignment.monday,
          tuesday: !!assignment.tuesday,
          wednesday: !!assignment.wednesday,
          thursday: !!assignment.thursday,
          friday: !!assignment.friday,
          note: assignment.note || '',
        }))
      )
    } else {
      setSurveyorAssignments([emptySurveyorAssignment()])
    }

    setShowScheduleEditor(true)
    setActiveTab('weekly')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteScheduleItem(id) {
    const confirmed = window.confirm('Delete this schedule item?')
    if (!confirmed) return

    const { error } = await supabase.from('schedule_items').delete().eq('id', id)

    if (error) {
      showError(error.message)
    } else {
      if (editingScheduleItemId === id) resetScheduleForm()
      loadAllData()
    }
  }

  async function saveScheduleItem() {
    setActionLoading('saveSchedule')
    if (!scheduleForm.job_id) {
      showError('Please select a job')
      setActionLoading('')
      return
    }

    if (!selectedWeekFrom || !selectedWeekTo) {
      showError('Please choose the week first on the Weekly Schedule tab')
      setActionLoading('')
      return
    }

    setMessage(
      editingScheduleItemId ? 'Updating schedule item...' : 'Saving schedule item...'
    )

    const projectManagerIds = Array.isArray(scheduleForm.project_manager_ids)
      ? scheduleForm.project_manager_ids.filter(Boolean)
      : scheduleForm.project_manager_id ? [scheduleForm.project_manager_id] : []
    const superintendentAssignmentsToSave = (scheduleForm.superintendent_assignments || [])
      .filter((assignment) => assignment.superintendent_id)
      .map((assignment) => ({
        superintendent_id: assignment.superintendent_id,
        shift: assignment.shift || '',
      }))
    const equipmentMovesToSave = EQUIPMENT_DAY_KEYS.reduce((acc, dayKey) => {
      const value = String(scheduleForm.equipment_moves?.[dayKey] || '').trim()
      if (value) acc[dayKey] = value
      return acc
    }, {})

    const payload = {
      from_date: selectedWeekFrom,
      to_date: selectedWeekTo,
      job_id: scheduleForm.job_id,
      project_manager_id: projectManagerIds[0] || null,
      project_manager_ids: projectManagerIds,
      superintendent_id: superintendentAssignmentsToSave[0]?.superintendent_id || null,
      superintendent_assignments: superintendentAssignmentsToSave,
      surveyor_id: scheduleForm.surveyor_id || null,
      equipment_moves: equipmentMovesToSave,
      notes: scheduleForm.notes || null,
    }

    let scheduleItem
    let scheduleError

    if (editingScheduleItemId) {
      const result = await supabase
        .from('schedule_items')
        .update(payload)
        .eq('id', editingScheduleItemId)
        .select()
        .single()
      scheduleItem = result.data
      scheduleError = result.error
    } else {
      const result = await supabase
        .from('schedule_items')
        .insert(payload)
        .select()
        .single()
      scheduleItem = result.data
      scheduleError = result.error
    }

    if (scheduleError) {
      console.error(scheduleError)
      showError(scheduleError.message)
      setMessage('Error saving schedule item.')
      setActionLoading('')
      return
    }

    if (editingScheduleItemId) {
      const { error: deleteAssignmentsError } = await supabase
        .from('schedule_item_foremen')
        .delete()
        .eq('schedule_item_id', editingScheduleItemId)

      if (deleteAssignmentsError) {
        showError(deleteAssignmentsError.message)
        setActionLoading('')
      return
      }

      const { error: deleteSurveyorAssignmentsError } = await supabase
        .from('schedule_item_surveyors')
        .delete()
        .eq('schedule_item_id', editingScheduleItemId)

      if (deleteSurveyorAssignmentsError) {
        showError(deleteSurveyorAssignmentsError.message)
        setActionLoading('')
      return
      }
    }

    const cleanedForemanAssignments = foremanAssignments.filter((item) => {
      return (
        item.foreman_id ||
        item.assignment_from_date ||
        item.assignment_to_date ||
        item.work_description ||
        item.subcontractor_name ||
        item.night
      )
    })

    if (cleanedForemanAssignments.length > 0) {
      const rowsToInsert = cleanedForemanAssignments.map((item) => ({
        schedule_item_id: scheduleItem.id,
        foreman_id: item.foreman_id === '__subcontractor__' ? null : item.foreman_id || null,
        assignment_from_date: item.assignment_from_date || null,
        assignment_to_date: item.assignment_to_date || null,
        work_description: item.work_description || null,
        split_note: buildForemanSplitNote(item.subcontractor_name, item.night) || null,
      }))

      const { error: foremanError } = await supabase
        .from('schedule_item_foremen')
        .insert(rowsToInsert)

      if (foremanError) {
        console.error(foremanError)
        showError(foremanError.message)
        setMessage('Schedule saved, but foreman assignments had an error.')
        setActionLoading('')
      return
      }
    }

    const cleanedSurveyorAssignments = surveyorAssignments.filter((item) => {
      return (
        item.surveyor_id ||
        item.monday ||
        item.tuesday ||
        item.wednesday ||
        item.thursday ||
        item.friday ||
        item.note
      )
    })

    if (cleanedSurveyorAssignments.length > 0) {
      const rowsToInsert = cleanedSurveyorAssignments.map((item) => ({
        schedule_item_id: scheduleItem.id,
        surveyor_id: item.surveyor_id || null,
        monday: !!item.monday,
        tuesday: !!item.tuesday,
        wednesday: !!item.wednesday,
        thursday: !!item.thursday,
        friday: !!item.friday,
        note: item.note || null,
      }))

      const { error: surveyorError } = await supabase
        .from('schedule_item_surveyors')
        .insert(rowsToInsert)

      if (surveyorError) {
        console.error(surveyorError)
        showError(surveyorError.message)
        setMessage('Schedule saved, but surveyor assignments had an error.')
        setActionLoading('')
      return
      }
    }

    setMessage(
      editingScheduleItemId
        ? 'Schedule item updated successfully.'
        : 'Schedule item saved successfully.'
    )
    showSuccess(editingScheduleItemId ? 'Schedule item updated successfully.' : 'Schedule item saved successfully.')
    resetScheduleForm()
    await loadAllData()
    setActiveTab('weekly')
    setRestoreWeeklyPosition(true)
    setActionLoading('')
  }

  async function duplicateCurrentWeek() {
    setActionLoading('duplicateWeek')
    if (!selectedWeekFrom || !selectedWeekTo) {
      showError('Choose a week first.')
      setActionLoading('')
      return
    }

    const sourceItems = weekScheduleItems

    if (!sourceItems.length) {
      showError('There are no schedule items in the selected week to duplicate.')
      setActionLoading('')
      return
    }

    const nextWeek = getNextWeekRangeFromSelectedWeek()
    const duplicatedItemIds = []

    if (!nextWeek.from || !nextWeek.to) {
      showError('Could not calculate the next week.')
      setActionLoading('')
      return
    }

    const existingNextWeekItems = scheduleItems.filter(
      (item) => item.from_date === nextWeek.from && item.to_date === nextWeek.to
    )

    if (existingNextWeekItems.length) {
      showError(
        `Next week already has ${existingNextWeekItems.length} job${existingNextWeekItems.length === 1 ? '' : 's'}. Duplicate to Next Week is blocked so jobs cannot be copied twice.`
      )
      setActionLoading('')
      return
    }

    setLoading(true)
    setMessage('Duplicating selected week...')

    try {
      for (const item of sourceItems) {
        const { data: newItem, error: newItemError } = await supabase
          .from('schedule_items')
          .insert({
            from_date: nextWeek.from,
            to_date: nextWeek.to,
            job_id: item.job_id,
            project_manager_id: item.project_manager_id || null,
            project_manager_ids: item.project_manager_ids || (item.project_manager_id ? [item.project_manager_id] : []),
            superintendent_id: item.superintendent_id || null,
            superintendent_assignments: item.superintendent_assignments || (item.superintendent_id ? [{ superintendent_id: item.superintendent_id, shift: '' }] : []),
            surveyor_id: item.surveyor_id || null,
            equipment_moves: item.equipment_moves || {},
            notes: item.notes || null,
          })
          .select()
          .single()

        if (newItemError) throw newItemError
        duplicatedItemIds.push(newItem.id)

        const foremanRows = (item.schedule_item_foremen || []).map((assignment) => ({
          schedule_item_id: newItem.id,
          foreman_id: assignment.foreman_id || null,
          assignment_from_date: shiftIsoDate(assignment.assignment_from_date, 7),
          assignment_to_date: shiftIsoDate(assignment.assignment_to_date, 7),
          work_description: assignment.work_description || null,
          split_note: assignment.split_note || null,
        }))

        if (foremanRows.length) {
          const { error } = await supabase.from('schedule_item_foremen').insert(foremanRows)
          if (error) throw error
        }

        const surveyorRows = (item.schedule_item_surveyors || []).map((assignment) => ({
          schedule_item_id: newItem.id,
          surveyor_id: assignment.surveyor_id || null,
          monday: !!assignment.monday,
          tuesday: !!assignment.tuesday,
          wednesday: !!assignment.wednesday,
          thursday: !!assignment.thursday,
          friday: !!assignment.friday,
          note: assignment.note || null,
        }))

        if (surveyorRows.length) {
          const { error } = await supabase.from('schedule_item_surveyors').insert(surveyorRows)
          if (error) throw error
        }
      }

      await loadAllData()
      setSelectedWeekFrom(nextWeek.from)
      setSelectedWeekTo(nextWeek.to)
      setCollapsedScheduleItemIds(new Set(duplicatedItemIds))
      setMessage('Week duplicated successfully.')
      showSuccess('Selected week duplicated to next week.')
    } catch (error) {
      console.error(error)
      showError(error.message || 'There was an error duplicating the week.')
      setMessage('Error duplicating week.')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function cleanupSelectedWeekDuplicates() {
    setActionLoading('cleanupDuplicates')

    if (!selectedWeekFrom || !selectedWeekTo) {
      showError('Choose a week first.')
      setActionLoading('')
      return
    }

    if (!selectedWeekDuplicateItemIds.length) {
      showSuccess('No duplicate jobs found in the selected week.')
      setActionLoading('')
      return
    }

    const confirmed = window.confirm(
      `Clean up ${selectedWeekDuplicateItemIds.length} duplicate job${selectedWeekDuplicateItemIds.length === 1 ? '' : 's'} from the selected week? This keeps the first copy of each job and removes the extras.`
    )
    if (!confirmed) {
      setActionLoading('')
      return
    }

    setLoading(true)
    setMessage('Cleaning up duplicate jobs...')

    try {
      const { error: foremanDeleteError } = await supabase
        .from('schedule_item_foremen')
        .delete()
        .in('schedule_item_id', selectedWeekDuplicateItemIds)

      if (foremanDeleteError) throw foremanDeleteError

      const { error: surveyorDeleteError } = await supabase
        .from('schedule_item_surveyors')
        .delete()
        .in('schedule_item_id', selectedWeekDuplicateItemIds)

      if (surveyorDeleteError) throw surveyorDeleteError

      const { error: scheduleDeleteError } = await supabase
        .from('schedule_items')
        .delete()
        .in('id', selectedWeekDuplicateItemIds)

      if (scheduleDeleteError) throw scheduleDeleteError

      await loadAllData()
      setMessage('Duplicate jobs cleaned up successfully.')
      showSuccess(
        `Removed ${selectedWeekDuplicateItemIds.length} duplicate job${selectedWeekDuplicateItemIds.length === 1 ? '' : 's'} from the selected week.`
      )
    } catch (error) {
      console.error(error)
      showError(error.message || 'There was an error cleaning up duplicate jobs.')
      setMessage('Error cleaning up duplicate jobs.')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  function getSelectedEmailRecipients() {
    if (selectedEmailContactId) {
      const contact = contacts.find((person) => person.id === selectedEmailContactId)
      return contact?.email ? [contact.email] : []
    }

    if (selectedEmailGroupId) {
      const group = emailGroups.find((item) => item.id === selectedEmailGroupId)
      return (group?.email_group_recipients || [])
        .filter((recipient) => recipient.active !== false && recipient.email)
        .map((recipient) => recipient.email)
    }

    return []
  }

  function emailSelectedReport() {
    const recipients = getSelectedEmailRecipients()

    if (!recipients.length) {
      showError('Select a group or contact with an email address first.')
      return
    }

    const weekLabel = buildEmailWeekLabel(selectedWeekFrom, selectedWeekTo)
    const reportName = printLayout === 'equipment' ? 'Equipment Schedule' : 'Weekly Schedule'
    const subject = encodeURIComponent(weekLabel ? `${reportName} - ${weekLabel}` : reportName)

    if (printLayout === 'equipment') {
      const equipmentItems = printScheduleItems.filter((item) => getEquipmentMoveEntriesForItem(item).length)
      const equipmentBody = equipmentItems.length
        ? equipmentItems.map((item) => {
            const jobTitle = `${item.jobs?.job_number || '—'} — ${item.jobs?.job_name || 'No Job Name'}`
            const moves = getEquipmentMoveEntriesForItem(item)
              .map((move) => `  ${move.label}: ${move.text}`)
              .join('\n')
            return `${jobTitle}\n${moves}`
          }).join('\n\n')
        : 'No equipment moves entered for this week.'

      const body = encodeURIComponent(`${weekLabel ? `${reportName} - ${weekLabel}` : reportName}\n\n${equipmentBody}`)
      window.location.href = `mailto:${recipients.join(',')}?subject=${subject}&body=${body}`
      return
    }

    window.location.href = `mailto:${recipients.join(',')}?subject=${subject}`
    showSuccess('Email opened. Attach the saved PDF before sending.')
  }

  function renderDayContents(item, dayKey) {
    const surveyorMatches =
      item.schedule_item_surveyors?.filter((assignment) => assignment[dayKey]) || []

    const foremanMatches =
      item.schedule_item_foremen?.filter((assignment) =>
        assignmentCoversDay(assignment, dayKey, item.from_date)
      ) || []

    const hasAnything = foremanMatches.length || surveyorMatches.length

    if (!hasAnything) {
      return <div style={styles.gridEmptyText}>—</div>
    }

    return (
      <div style={styles.gridChipStack}>
        {foremanMatches.map((assignment) => (
          <div key={`f-${assignment.id}`} style={styles.gridForemanChip}>
            <div style={styles.gridChipTitle}>
              {assignment.foremen?.name || 'Foreman'}
            </div>
            <div style={styles.gridChipText}>
              {assignment.work_description || 'No work note'}
            </div>
            {assignment.split_note ? (
              <div style={styles.gridChipSubText}>{assignment.split_note}</div>
            ) : null}
          </div>
        ))}

        {surveyorMatches.map((assignment) => (
          <div key={`s-${assignment.id}`} style={styles.gridSurveyorChip}>
            <div style={styles.gridChipTitle}>
              {assignment.surveyors?.name || 'Surveyor'}
            </div>
            {assignment.note ? (
              <div style={styles.gridChipText}>{assignment.note}</div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  function buildSmsMessageText(url = '') {
    return `${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)} ${url}`.trim()
  }

  function openSmsApp(phoneNumbers = [], messageText = '') {
    const cleanedNumbers = phoneNumbers
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    if (!cleanedNumbers.length) {
      showError('Add at least one mobile contact first.')
      return
    }

    if (!messageText) {
      showError('Could not create mobile share link.')
      return
    }

    const body = encodeURIComponent(messageText)
    const recipients = cleanedNumbers.join(',')
    window.location.href = `sms:${recipients}?&body=${body}`
  }

  
  function getPhonesForGroup(groupId) {
    const group = contactGroups.find((g) => g.id === groupId)
    if (!group) return []
    const memberIds = (group.contact_group_memberships || []).map((m) => m.contact_id)
    return contacts
      .filter((contact) => memberIds.includes(contact.id))
      .map((contact) => contact.phone)
      .filter(Boolean)
  }

  async function sendMobileTextToAll() {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    openSmsApp(contacts.map((contact) => contact.phone).filter(Boolean), buildSmsMessageText(url))
  }

  async function sendTextToGroup(groupId) {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    openSmsApp(getPhonesForGroup(groupId), buildSmsMessageText(url))
  }

  async function sendMobileTextToContact(contact) {
    let url = ''
    try {
      url = await createMobileShareUrl()
    } catch (error) {
      showError('Could not create public share link. Make sure the public share table is set up in Supabase.')
      return
    }
    openSmsApp([contact.phone], buildSmsMessageText(url))
  }

  function renderReadonlyScheduleCards(items, options = {}) {
    const compact = options.compact === true

    return (
      <div style={compact ? styles.mobileReadonlyListCompact : styles.mobileReadonlyList}>
        {items.length === 0 ? (
          <div style={styles.mobileEmptyCard}>No jobs found for this week.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={styles.mobileReadonlyCard}>
              <div style={styles.mobileReadonlyJobTitle}>
                {(item.jobNumber ?? item.jobs?.job_number) || '—'} — {(item.jobName ?? item.jobs?.job_name) || 'No Job Name'}
              </div>

              <div style={styles.mobileReadonlyBody}>
                <div style={styles.mobileReadonlyMetaRow}>
                  <div style={styles.mobileReadonlyMetaItem}>
                    <span style={styles.mobileReadonlyMetaLabel}>PM:</span>
                    <span>{item.projectManager ?? item.project_manager_labels ?? getProjectManagerNamesForItem(item) ?? '—'}</span>
                  </div>
                  <div style={styles.mobileReadonlyMetaItem}>
                    <span style={styles.mobileReadonlyMetaLabel}>Super:</span>
                    <span>{item.superintendent ?? item.superintendent_labels ?? getSuperintendentLabelsForItem(item) ?? '—'}</span>
                  </div>
                  <div style={styles.mobileReadonlyMetaItem}>
                    <span style={styles.mobileReadonlyMetaLabel}>Surveyor:</span>
                    <span>{item.surveyor ?? item.surveyors?.name ?? '—'}</span>
                  </div>
                </div>

                {(item.notes || item.notes === '') && item.notes ? (
                  <div style={styles.mobileReadonlyNotes}>
                    <span style={styles.mobileReadonlyNotesLabel}>Job Notes:</span> {item.notes}
                  </div>
                ) : null}

                {(item.foremen || item.schedule_item_foremen)?.length ? (
                  <div style={styles.mobileReadonlySection}>
                    <div style={styles.mobileReadonlySectionTitle}>Foreman Assignments</div>
                    {(item.foremen || item.schedule_item_foremen).map((assignment) => (
                      <div key={assignment.id} style={styles.mobileReadonlyAssignmentCard}>
                        <div style={styles.mobileReadonlyAssignmentName}>
                          {getForemanDisplayNameFromAssignment(assignment)}
                        </div>
                        <div style={styles.mobileReadonlyAssignmentLine}>
                          {formatDate(assignment.fromDate ?? assignment.assignment_from_date)} to {formatDate(assignment.toDate ?? assignment.assignment_to_date)}{getForemanNightFromAssignment(assignment) ? ' • NIGHTS' : ''}
                        </div>
                        <div style={styles.mobileReadonlyAssignmentSubtle}>
                          {formatAssignmentWeekdays(
                            assignment.fromDate ?? assignment.assignment_from_date,
                            assignment.toDate ?? assignment.assignment_to_date
                          )}
                        </div>
                        <div style={styles.mobileReadonlyAssignmentLine}>
                          <strong>Work:</strong> {(assignment.work ?? assignment.work_description) || '—'}
                        </div>
                        {getForemanSubcontractorName(assignment.splitNote ?? assignment.split_note) ? (
                          <div style={styles.mobileReadonlyAssignmentLine}>
                            <strong>Subcontractor:</strong> {getForemanSubcontractorName(assignment.splitNote ?? assignment.split_note)}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {(item.surveyorAssignments || item.schedule_item_surveyors)?.length ? (
                  <div style={styles.mobileReadonlySection}>
                    <div style={styles.mobileReadonlySectionTitle}>Surveyor Assignments</div>
                    {(item.surveyorAssignments || item.schedule_item_surveyors).map((assignment) => (
                      <div key={assignment.id} style={styles.mobileReadonlyAssignmentCard}>
                        <div style={styles.mobileReadonlyAssignmentName}>
                          {(assignment.name ?? assignment.surveyors?.name) || '—'}
                        </div>
                        <div style={styles.mobileReadonlyAssignmentLine}>
                          <strong>Days:</strong> {formatSurveyorDays(assignment)}
                        </div>
                        {(assignment.note || assignment.note === '') && assignment.note ? (
                          <div style={styles.mobileReadonlyAssignmentLine}>
                            <strong>Note:</strong> {assignment.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  function renderReadonlyForemanGroups(items) {
    const groups = buildForemanGroups(items)

    return (
      <div style={styles.mobileReadonlyListCompact}>
        {groups.length === 0 ? (
          <div style={styles.mobileEmptyCard}>No foreman assignments found for this week.</div>
        ) : (
          groups.map((group) => (
            <div key={group.name} style={styles.mobileReadonlyCard}>
              <div style={styles.mobileReadonlyJobTitle}>{group.name}</div>
              <div style={styles.mobileReadonlyBody}>
                {group.assignments.map((assignment) => (
                  <div key={assignment.key} style={styles.mobileReadonlyAssignmentCard}>
                    <div style={styles.mobileReadonlyAssignmentName}>
                      {assignment.jobNumber} — {assignment.jobName}
                    </div>
                    <div style={styles.mobileReadonlyAssignmentLine}>
                      {formatDate(assignment.fromDate)} to {formatDate(assignment.toDate)}
                    </div>
                    <div style={styles.mobileReadonlyAssignmentSubtle}>
                      {formatAssignmentWeekdays(assignment.fromDate, assignment.toDate)}
                    </div>
                    <div style={styles.mobileReadonlyAssignmentLine}>
                      <strong>Work:</strong> {assignment.work || '—'}
                    </div>
                    {assignment.splitNote ? (
                      <div style={styles.mobileReadonlyAssignmentLine}>
                        <strong>Note:</strong> {assignment.splitNote}
                      </div>
                    ) : null}
                    {assignment.jobNotes ? (
                      <div style={styles.mobileReadonlyAssignmentLine}>
                        <strong>Job Notes:</strong> {assignment.jobNotes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }


  function getMobileRoleGroups(items, role) {
    if (role === 'foremen') return buildForemanGroups(items)
    if (role === 'superintendents') return buildSuperintendentGroups(items)
    if (role === 'surveyors') return buildSurveyorGroups(items)
    return []
  }

  function renderMobileRoleGroups(items, role) {
    const groups = getMobileRoleGroups(items, role)
    const filteredGroups = mobilePersonFilter
      ? groups.filter((group) => group.name === mobilePersonFilter)
      : groups

    const emptyLabel = role === 'superintendents'
      ? 'No superintendent assignments found for this week.'
      : role === 'surveyors'
        ? 'No surveyor assignments found for this week.'
        : 'No foreman assignments found for this week.'

    return (
      <div style={styles.mobileReadonlyListCompact}>
        {filteredGroups.length === 0 ? (
          <div style={styles.mobileEmptyCard}>{emptyLabel}</div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.name} style={styles.mobileReadonlyCard}>
              <div style={styles.mobileReadonlyJobTitle}>{group.name}</div>
              <div style={styles.mobileReadonlyBody}>
                {group.assignments.map((assignment) => (
                  <div key={assignment.key} style={styles.mobileReadonlyAssignmentCard}>
                    <div style={styles.mobileReadonlyAssignmentName}>
                      {assignment.jobNumber} — {assignment.jobName}
                    </div>
                    {assignment.dateLine ? (
                      <div style={styles.mobileReadonlyAssignmentLine}>{assignment.dateLine}</div>
                    ) : null}
                    {assignment.dayLine ? (
                      <div style={styles.mobileReadonlyAssignmentSubtle}>{assignment.dayLine}</div>
                    ) : null}
                    {assignment.pm ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>PM:</strong> {assignment.pm}</div>
                    ) : null}
                    {assignment.superintendent && role !== 'superintendents' ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Super:</strong> {assignment.superintendent}</div>
                    ) : null}
                    {assignment.surveyor && role !== 'surveyors' ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Surveyor:</strong> {assignment.surveyor}</div>
                    ) : null}
                    {assignment.foremen ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Foremen:</strong> {assignment.foremen}</div>
                    ) : null}
                    {assignment.work ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Work:</strong> {assignment.work}</div>
                    ) : null}
                    {assignment.note ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Note:</strong> {assignment.note}</div>
                    ) : null}
                    {assignment.jobNotes ? (
                      <div style={styles.mobileReadonlyAssignmentLine}><strong>Job Notes:</strong> {assignment.jobNotes}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  function renderMobileReadonlyLayoutToggle(items = []) {
    const roleGroups = getMobileRoleGroups(items, mobileShareLayout)

    function chooseMobileLayout(nextLayout) {
      setMobileShareLayout(nextLayout)
      setMobilePersonFilter('')
    }

    return (
      <div style={styles.mobileReadonlyToggleWrap}>
        <div style={styles.mobileReadonlyToggleLabel}>View schedule by:</div>
        <div style={styles.mobileReadonlyToggleGroup}>
          {[
            ['jobs', 'Job'],
            ['foremen', 'Foreman'],
            ['superintendents', 'Superintendent'],
            ['surveyors', 'Surveyor'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseMobileLayout(value)}
              style={mobileShareLayout === value ? styles.mobileReadonlyToggleButtonActive : styles.mobileReadonlyToggleButton}
            >
              {label}
            </button>
          ))}
        </div>

        {mobileShareLayout !== 'jobs' ? (
          <select
            value={mobilePersonFilter}
            onChange={(e) => setMobilePersonFilter(e.target.value)}
            style={styles.mobileReadonlyPersonSelect || styles.select}
          >
            <option value="">All {mobileShareLayout === 'foremen' ? 'Foremen' : mobileShareLayout === 'superintendents' ? 'Superintendents' : 'Surveyors'}</option>
            {roleGroups.map((group) => (
              <option key={group.name} value={group.name}>{group.name}</option>
            ))}
          </select>
        ) : null}
      </div>
    )
  }


  if (isViewerMode && session) {
    return (
      <div style={styles.mobileSharePage}>
        <div style={styles.mobileShareShell}>
          <div style={styles.mobileReadonlyHeader}>
            <div style={styles.mobileReadonlyPublicBadge}>Public View • No Login Required</div>
            <div style={styles.mobileReadonlyHeaderTop}>
              <div>
                <div style={styles.mobileReadonlyCompany}>Command Construction Industries</div>
                <div style={styles.mobileReadonlyTitle}>Weekly Schedule</div>
                <div style={styles.mobileReadonlyDate}>
                  {selectedWeekFrom && selectedWeekTo
                    ? `Week of ${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}`
                    : ''}
                </div>
              </div>

              <div style={styles.mobileReadonlyBrandBlock}>
                <img
                  src="/command-logo.png"
                  alt="Command Construction Industries Logo"
                  style={styles.mobileReadonlyLogo}
                />
                <div style={styles.mobileReadonlyQuote}>
                  “The road to success is always under construction.”
                </div>
              </div>
            </div>

            <div style={styles.mobileReadonlyDivider} />
          </div>

          {renderMobileReadonlyLayoutToggle(weekScheduleItems)}

          {mobileShareLayout === 'jobs' ? renderReadonlyScheduleCards(weekScheduleItems, { compact: true }) : renderMobileRoleGroups(weekScheduleItems, mobileShareLayout)}
        </div>
      </div>
    )
  }

  if (isMobileShareMode && mobileShareSnapshot) {
    return (
      <div style={styles.mobileSharePage}>
        <div style={styles.mobileShareShell}>
          <div style={styles.mobileReadonlyHeader}>
            <div style={styles.mobileReadonlyPublicBadge}>Public View • No Login Required</div>
            <div style={styles.mobileReadonlyHeaderTop}>
              <div>
                <div style={styles.mobileReadonlyCompany}>Command Construction Industries</div>
                <div style={styles.mobileReadonlyTitle}>Weekly Schedule</div>
                <div style={styles.mobileReadonlyDate}>
                  {mobileShareSnapshot.weekFrom && mobileShareSnapshot.weekTo
                    ? `Week of ${formatLongDate(mobileShareSnapshot.weekFrom)} – ${formatLongDate(mobileShareSnapshot.weekTo)}`
                    : ''}
                </div>
              </div>

              <div style={styles.mobileReadonlyBrandBlock}>
                <img
                  src="/command-logo.png"
                  alt="Command Construction Industries Logo"
                  style={styles.mobileReadonlyLogo}
                />
                <div style={styles.mobileReadonlyQuote}>
                  “The road to success is always under construction.”
                </div>
              </div>
            </div>

            <div style={styles.mobileReadonlyDivider} />
          </div>

          {renderMobileReadonlyLayoutToggle(weekScheduleItems)}

          {mobileShareLayout === 'jobs' ? renderReadonlyScheduleCards(mobileShareSnapshot.items || [], { compact: true }) : renderMobileRoleGroups(mobileShareSnapshot.items || [], mobileShareLayout)}
        </div>
      </div>
    )
  }

  if (isPublicShareMode && publicShareLoading) {
    return (
      <div style={styles.mobileSharePage}>
        <div style={styles.mobileShareShell}>
          <div style={styles.mobileEmptyCard}>Loading public mobile view...</div>
        </div>
      </div>
    )
  }

  if (isPublicShareMode) {
    if (!publicShareData || publicShareData.error) {
      return (
        <div style={styles.mobileSharePage}>
          <div style={styles.mobileShareShell}>
            <div style={styles.mobileEmptyCard}>
              This public mobile link could not be opened. It may have expired or the public share table may not be set up yet.
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={styles.mobileSharePage}>
        <div style={styles.mobileShareShell}>
          <div style={styles.mobileReadonlyHeader}>
            <div style={styles.mobileReadonlyPublicBadge}>Public View • No Login Required</div>
            <div style={styles.mobileReadonlyHeaderTop}>
              <div>
                <div style={styles.mobileReadonlyCompany}>Command Construction Industries</div>
                <div style={styles.mobileReadonlyTitle}>Weekly Schedule</div>
                <div style={styles.mobileReadonlyDate}>
                  {publicShareData.week_from && publicShareData.week_to
                    ? `Week of ${formatLongDate(publicShareData.week_from)} – ${formatLongDate(publicShareData.week_to)}`
                    : ''}
                </div>
              </div>

              <div style={styles.mobileReadonlyBrandBlock}>
                <img
                  src="/command-logo.png"
                  alt="Command Construction Industries Logo"
                  style={styles.mobileReadonlyLogo}
                />
                <div style={styles.mobileReadonlyQuote}>
                  “The road to success is always under construction.”
                </div>
              </div>
            </div>

            <div style={styles.mobileReadonlyDivider} />
          </div>

          {renderMobileReadonlyLayoutToggle(weekScheduleItems)}

          {mobileShareLayout === 'jobs' ? renderReadonlyScheduleCards(publicShareData.snapshot?.items || [], { compact: true }) : renderMobileRoleGroups(publicShareData.snapshot?.items || [], mobileShareLayout)}
        </div>
      </div>
    )
  }

  if (loading && !session) {
    return (
      <div style={styles.page} className="print-root">
        <div style={styles.card}>
          <h1 style={styles.title}>Weekly Schedule</h1>
          <p style={styles.text}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={styles.title}>Weekly Schedule Login</h1>
          <p style={styles.text}>{message}</p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          <button onClick={signIn} disabled={isActionBusy('signIn')} style={isActionBusy('signIn') ? styles.buttonDisabled : styles.button}>
            {isActionBusy('signIn') ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </div>
    )
  }

  if (isQuickDump) {
    return (
      <div style={styles.page}>
        {banner ? (
          <div style={banner.type === 'success' ? styles.bannerSuccess : styles.bannerError} className="no-print">
            <div>{banner.text}</div>
            <button onClick={() => setBanner(null)} style={styles.bannerCloseButton}>Dismiss</button>
          </div>
        ) : null}
        {renderFieldNotesPanel({ quickMode: true })}
      </div>
    )
  }

  return (
    <div style={styles.page}>
<style>{`
  @page {
    size: ${false ? 'landscape' : 'portrait'};
    margin: ${false ? '0.12in' : '0.18in'};
  }

  button {
    transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease, border-color 0.14s ease;
  }

  button:hover:not(:disabled) {
    filter: brightness(0.98);
    transform: translateY(-1px);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  .nav-button {
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .nav-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 14px rgba(15, 23, 42, 0.14);
    border-color: #c96f00 !important;
  }

  @media print {
    html, body {
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      display: none !important;
    }

    .print-root {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .print-page-wrap {
      max-width: none !important;
    }

    .print-preview-stage {
      padding: 0 !important;
      background: #ffffff !important;
      border: none !important;
      box-shadow: none !important;
    }

    .print-paper {
      width: 100% !important;
      max-width: none !important;
      min-height: auto !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      transform-origin: top center;
      padding: ${false ? '0.14in 0.16in 0.12in' : '0.14in 0.18in 0.12in'} !important;
    }

    .print-report-list {
      display: block !important;
      padding-top: 2px !important;
    }

    .print-report-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .print-report-card:first-child {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .report-header-print-fix {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 8px !important;
    }

    .print-job-divider {
      margin-top: 8px !important;
      margin-bottom: 8px !important;
    }

    .print-grid-mode .print-preview-stage,
    .print-grid-mode .print-paper {
      background: #ffffff !important;
    }

    .print-grid-mode .print-paper {
      width: 100% !important;
      padding: 0.1in 0.12in 0.08in !important;
    }

    .print-grid-mode .print-grid-board {
      transform: scale(0.88);
      transform-origin: top left;
      width: 113.5%;
    }
  }
`}</style>
      <div style={styles.headerCard} className="no-print">
        <div style={styles.topBar}>
          <div style={styles.headerTopRow}>
            <div style={styles.headerTextBlock}>
              <h1 style={styles.title}>Weekly Schedule</h1>
              <p style={styles.headerSubtitle}>Command Construction Industries Scheduling System</p>
            </div>

            <div style={styles.headerBrandRight}>
              <img
                src="/command-logo.png"
                alt="Command Construction Industries Logo"
                style={styles.headerLogo}
              />
              <div style={styles.headerQuote}>
                “The road to success is always under construction.”
              </div>
            </div>
          </div>

          <div style={styles.headerDivider} />

          <div style={styles.headerNavRow}>
            <div style={styles.headerNavLeft}>
              <button
                className="nav-button"
                onClick={() => handleTabChange('weekly')}
                style={activeTab === 'weekly' ? styles.button : styles.buttonSecondary}
              >
                Weekly Schedule
              </button>
              <button
                className="nav-button"
                onClick={() => handleTabChange('mobile')}
                style={activeTab === 'mobile' ? styles.button : styles.buttonSecondary}
              >
                Mobile View
              </button>
              <button
                className="nav-button"
                onClick={() => handleTabChange('print')}
                style={activeTab === 'print' ? styles.button : styles.buttonSecondary}
              >
                Print / PDF
              </button>
              <button
                className="nav-button"
                onClick={() => handleTabChange('master')}
                style={activeTab === 'master' ? styles.button : styles.buttonSecondary}
              >
                Master Data
              </button>
              <button className="nav-button" onClick={signOut} style={styles.buttonSecondary}>
                Sign Out
              </button>
            </div>
            <div style={styles.headerNavRight}>
              <button
                className="nav-button"
                onClick={() => handleTabChange('fieldNotes')}
                style={activeTab === 'fieldNotes' ? styles.button : styles.buttonSecondary}
              >
                Field Dump
              </button>
            </div>
          </div>
        </div>
      </div>

      {banner ? (
        <div style={banner.type === 'success' ? styles.bannerSuccess : styles.bannerError} className="no-print">
          <div>{banner.text}</div>
          <button onClick={() => setBanner(null)} style={styles.bannerCloseButton}>Dismiss</button>
        </div>
      ) : null}

      {activeTab === 'fieldNotes' && renderFieldNotesPanel()}

      {activeTab === 'master' && (
        <div style={styles.masterGrid}>
          <div style={styles.masterRow}>
            <SectionCard title="Jobs" style={styles.masterCardJobs}>
            <label style={styles.label}>Job Number</label>
            <div style={styles.jobNumberRow}>
              <select
                value={jobPrefix}
                onChange={(e) => setJobPrefix(e.target.value)}
                style={styles.jobPrefixSelect}
              >
                <option value="CC">CC</option>
                <option value="CCI">CCI</option>
                <option value="CCIS">CCIS</option>
              </select>

              <div style={styles.jobDash}>-</div>

              <input
                placeholder="123"
                value={jobNumberPart2}
                onChange={(e) =>
                  setJobNumberPart2(e.target.value.replace(/\D/g, ''))
                }
                style={styles.jobNumberInput}
              />
            </div>

            <div style={styles.smallText}>
              Full Job Number: {buildJobNumber() || '—'}
            </div>

            <label style={styles.label}>Job Name</label>
            <input
              placeholder="Job Name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Start Date</label>
            <input
              type="date"
              value={jobStartDate}
              onChange={(e) => setJobStartDate(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Stop Date</label>
            <input
              type="date"
              value={jobStopDate}
              onChange={(e) => setJobStopDate(e.target.value)}
              style={styles.input}
            />

            <div style={styles.formButtonRow}>
              <button onClick={saveJob} style={styles.button}>
                {editingJobId ? 'Update Job' : 'Add Job'}
              </button>
              {editingJobId && (
                <button onClick={resetJobForm} style={styles.buttonSecondary}>
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={styles.listWrap}>
              {sortedJobs.map((job) => (
                <div key={job.id} style={styles.listItem}>
                  <div>
                    <strong>{job.job_number}</strong> — {job.job_name}
                    <div style={styles.smallText}>
                      Start: {formatDate(job.start_date)} | Stop:{' '}
                      {formatDate(job.stop_date)}
                    </div>
                  </div>
                  <div style={styles.itemButtonRow}>
                    <button
                      onClick={() => editJob(job)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
            <SectionCard title="Project Managers" style={styles.masterCardProjectManagers}>
            <input
              placeholder="Project Manager Name"
              value={pmName}
              onChange={(e) => setPmName(e.target.value)}
              style={styles.input}
            />
            <div style={styles.formButtonRow}>
              <button onClick={saveProjectManager} style={styles.button}>
                {editingPmId ? 'Update Project Manager' : 'Add Project Manager'}
              </button>
              {editingPmId && (
                <button onClick={resetPmForm} style={styles.buttonSecondary}>
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={styles.listWrap}>
              {projectManagers.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button
                      onClick={() => editProjectManager(person)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProjectManager(person.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          </div>

          <div style={styles.masterRow}>
            <SectionCard title="Superintendents" style={styles.masterCardSuperintendents}>
            <input
              placeholder="Superintendent Name"
              value={superintendentName}
              onChange={(e) => setSuperintendentName(e.target.value)}
              style={styles.input}
            />
            <div style={styles.formButtonRow}>
              <button onClick={saveSuperintendent} style={styles.button}>
                {editingSuperintendentId
                  ? 'Update Superintendent'
                  : 'Add Superintendent'}
              </button>
              {editingSuperintendentId && (
                <button
                  onClick={resetSuperintendentForm}
                  style={styles.buttonSecondary}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={styles.listWrap}>
              {superintendents.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button
                      onClick={() => editSuperintendent(person)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSuperintendent(person.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
            <SectionCard title="Foremen" style={styles.masterCardForemen}>
            <input
              placeholder="Foreman Name"
              value={foremanName}
              onChange={(e) => setForemanName(e.target.value)}
              style={styles.input}
            />
            <div style={styles.formButtonRow}>
              <button onClick={saveForeman} style={styles.button}>
                {editingForemanId ? 'Update Foreman' : 'Add Foreman'}
              </button>
              {editingForemanId && (
                <button onClick={resetForemanForm} style={styles.buttonSecondary}>
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={styles.listWrap}>
              {foremen.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button
                      onClick={() => editForeman(person)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteForeman(person.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
            <SectionCard title="Surveyors" style={styles.masterCardSurveyors}>
            <input
              placeholder="Surveyor Name"
              value={surveyorName}
              onChange={(e) => setSurveyorName(e.target.value)}
              style={styles.input}
            />
            <div style={styles.formButtonRow}>
              <button onClick={saveSurveyor} style={styles.button}>
                {editingSurveyorId ? 'Update Surveyor' : 'Add Surveyor'}
              </button>
              {editingSurveyorId && (
                <button
                  onClick={resetSurveyorForm}
                  style={styles.buttonSecondary}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={styles.listWrap}>
              {surveyors.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button
                      onClick={() => editSurveyor(person)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSurveyor(person.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          </div>

          <div style={styles.masterRow}>
            <SectionCard title="Contacts" style={styles.masterCardContacts}>
            <div style={styles.smallText}>
              Add each person once here. Text and email groups both pull from this master contact list.
            </div>

            <div style={styles.formGrid}>
              <input
                placeholder="Contact name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                style={styles.input}
              />
              <input
                placeholder="Cell number"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                style={styles.input}
              />
              <input
                placeholder="Email address"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.formButtonRow}>
              <button onClick={addContact} disabled={isActionBusy('saveContact')} style={isActionBusy('saveContact') ? styles.buttonDisabled : styles.button}>
                {isActionBusy('saveContact') ? (editingContactId ? 'Updating...' : 'Adding...') : (editingContactId ? 'Update Contact' : 'Add Contact')}
              </button>
              {editingContactId ? (
                <button onClick={cancelEditContact} style={styles.buttonSecondary}>
                  Cancel Edit
                </button>
              ) : null}
              <button onClick={copyContactList} style={styles.buttonSecondary}>
                Copy Contact List
              </button>
            </div>

            <div style={styles.listWrap}>
              {contacts.length === 0 ? (
                <div style={styles.smallText}>No contacts saved yet.</div>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} style={styles.listItem}>
                    <div>
                      <strong>{contact.name}</strong>
                      <div style={styles.smallText}>
                        {contact.phone || 'No phone'}{contact.email ? ` | ${contact.email}` : ''}
                      </div>
                    </div>
                    <div style={styles.itemButtonRow}>
                      {contact.phone ? (
                        <button onClick={() => sendMobileTextToContact(contact)} style={styles.smallButton}>
                          Text
                        </button>
                      ) : null}
                      <button onClick={() => editContact(contact)} style={styles.smallButton}>
                        Edit
                      </button>
                      <button onClick={() => deleteContact(contact.id)} style={styles.smallDangerButton}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
            <SectionCard title="Text Groups" style={styles.masterCardTextGroups}>
            <div style={styles.smallText}>
              Create texting groups and check the contacts you want included. Only contacts with phone numbers are shown here.
            </div>

            <div style={styles.formGrid}>
              <input
                placeholder="New text group name"
                value={newContactGroupName}
                onChange={(e) => setNewContactGroupName(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.formButtonRow}>
              <button onClick={addContactGroup} disabled={isActionBusy('saveTextGroup')} style={isActionBusy('saveTextGroup') ? styles.buttonDisabled : styles.button}>
                {isActionBusy('saveTextGroup') ? 'Adding...' : 'Add Text Group'}
              </button>
            </div>

            <select
              value={selectedTextGroupViewId}
              onChange={(e) => setSelectedTextGroupViewId(e.target.value)}
              style={styles.select}
            >
              <option value="">Select Text Group</option>
              {contactGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <div style={styles.listWrap}>
              {contactGroups.length === 0 ? (
                <div style={styles.smallText}>No text groups saved yet.</div>
              ) : !selectedTextGroupViewId ? (
                <div style={styles.smallText}>Select a text group to view and manage it.</div>
              ) : (() => {
                const selectedGroup = contactGroups.find((group) => group.id === selectedTextGroupViewId)
                return !selectedGroup ? (
                  <div style={styles.smallText}>That text group could not be found.</div>
                ) : (
                  <div style={styles.emailGroupBlock}>
                    <div style={styles.emailGroupHeader}>
                      <strong>{selectedGroup.name}</strong>
                      <div style={styles.itemButtonRow}>
                        <button onClick={() => sendTextToGroup(selectedGroup.id)} style={styles.smallButton}>
                          Text Group
                        </button>
                        <button onClick={() => renameContactGroup(selectedGroup)} style={styles.smallButton}>
                          Edit
                        </button>
                        <button onClick={() => deleteContactGroup(selectedGroup.id)} style={styles.smallDangerButton}>
                          Delete
                        </button>
                      </div>
                    </div>

                    {(contacts.filter((contact) => contact.phone)).length === 0 ? (
                      <div style={styles.smallText}>No contacts with phone numbers yet.</div>
                    ) : (
                      contacts
                        .filter((contact) => contact.phone)
                        .map((contact) => {
                          const checked = (selectedGroup.contact_group_memberships || []).some(
                            (membership) => membership.contact_id === contact.id
                          )
                          return (
                            <label key={`${selectedGroup.id}-${contact.id}`} style={styles.contactCheckboxRow}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleContactInGroup(selectedGroup.id, contact.id)}
                              />
                              <span>
                                {contact.name} — {contact.phone}
                                {contact.email ? ` — ${contact.email}` : ''}
                              </span>
                            </label>
                          )
                        })
                    )}
                  </div>
                )
              })()}
            </div>
          </SectionCard>
            <SectionCard title="Email Groups" style={styles.masterCardEmailGroups}>
            <div style={styles.smallText}>
              Create email groups and select contacts with email addresses from the master contact list.
            </div>

            <div style={styles.formGrid}>
              <input
                placeholder="New email group name"
                value={newEmailGroupName}
                onChange={(e) => setNewEmailGroupName(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.formButtonRow}>
              <button onClick={addEmailGroup} disabled={isActionBusy('saveEmailGroup')} style={isActionBusy('saveEmailGroup') ? styles.buttonDisabled : styles.button}>
                {isActionBusy('saveEmailGroup') ? 'Adding...' : 'Add Email Group'}
              </button>
            </div>

            <select
              value={selectedEmailGroupId}
              onChange={(e) => setSelectedEmailGroupId(e.target.value)}
              style={styles.select}
            >
              <option value="">Select Email Group</option>
              {emailGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <div style={styles.listWrap}>
              {emailGroups.length === 0 ? (
                <div style={styles.smallText}>No email groups saved yet.</div>
              ) : !selectedEmailGroup ? (
                <div style={styles.smallText}>Select an email group to view and manage it.</div>
              ) : (
                <div style={styles.emailGroupBlock}>
                  <div style={styles.emailGroupHeader}>
                    <strong>{selectedEmailGroup.name}</strong>
                    <div style={styles.itemButtonRow}>
                      <button onClick={() => emailSchedule(selectedEmailGroup)} style={styles.smallButton}>
                        Email Group
                      </button>
                      <button onClick={() => renameEmailGroup(selectedEmailGroup)} style={styles.smallButton}>
                        Edit
                      </button>
                      <button onClick={() => deleteEmailGroup(selectedEmailGroup.id)} style={styles.smallDangerButton}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {(contacts.filter((contact) => contact.email)).length === 0 ? (
                    <div style={styles.smallText}>No contacts with email addresses yet.</div>
                  ) : (
                    contacts
                      .filter((contact) => contact.email)
                      .map((contact) => {
                        const checked = contactIsInEmailGroup(selectedEmailGroup, contact)
                        return (
                          <label key={`${selectedEmailGroup.id}-${contact.id}`} style={styles.contactCheckboxRow}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleContactInEmailGroup(selectedEmailGroup.id, contact)}
                            />
                            <span>
                              {contact.name} — {contact.email}
                              {contact.phone ? ` — ${contact.phone}` : ''}
                            </span>
                          </label>
                        )
                      })
                  )}
                </div>
              )}
            </div>
          </SectionCard>
          </div>
        </div>
      )}

      {showScheduleEditor && activeTab === 'weekly' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.stickySaveBar} className="no-print">
            <div>
              <div style={styles.stickySaveTitle}>
                {editingScheduleItemId ? 'Editing Scheduled Job' : 'Adding Schedule Item'}
              </div>
              <div style={hasUnsavedChanges ? styles.unsavedStatusPill : styles.savedStatusPill}>
                <span style={hasUnsavedChanges ? styles.unsavedStatusDot : styles.savedStatusDot}></span>
                {hasUnsavedChanges ? 'Unsaved changes' : 'No unsaved changes'}
              </div>
            </div>

            <div style={styles.stickySaveActions}>
              <button
                onClick={resetScheduleForm}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
              <button
                onClick={saveScheduleItem}
                disabled={isActionBusy('saveSchedule')}
                style={isActionBusy('saveSchedule') ? styles.buttonDisabled : styles.button}
              >
                {isActionBusy('saveSchedule') ? (editingScheduleItemId ? 'Updating...' : 'Saving...') : (editingScheduleItemId ? 'Update Schedule Item' : 'Save Schedule Item')}
              </button>
            </div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.editorTitleRow}>
              <h2 style={styles.sectionTitle}>
                {editingScheduleItemId ? 'Edit Scheduled Job' : 'Add Job to Weekly Schedule'}
              </h2>
              <div style={hasUnsavedChanges ? styles.unsavedStatusPill : styles.savedStatusPill}>
                <span style={hasUnsavedChanges ? styles.unsavedStatusDot : styles.savedStatusDot}></span>
                {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
              </div>
            </div>

            {hasUnsavedChanges ? (
              <div style={styles.unsavedChangesNotice}>
                You have unsaved changes. Save before switching weeks or leaving this screen.
              </div>
            ) : null}

            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Job</label>
                <select
                  value={scheduleForm.job_id}
                  onChange={(e) => updateScheduleForm('job_id', e.target.value)}
                  style={styles.select}
                >
                  <option value="">Select Job</option>
                  {sortedJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} — {job.job_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={styles.assignmentHeader}>
                  <label style={styles.label}>Project Manager(s) (optional)</label>
                  <button type="button" onClick={addProjectManagerAssignmentRow} style={styles.smallButton}>Add PM</button>
                </div>
                {(Array.isArray(scheduleForm.project_manager_ids) && scheduleForm.project_manager_ids.length ? scheduleForm.project_manager_ids : ['']).map((projectManagerId, index) => (
                  <div key={`pm-row-${index}`} style={styles.inlineAssignmentRow}>
                    <select
                      value={projectManagerId || ''}
                      onChange={(e) => updateProjectManagerAssignment(index, e.target.value)}
                      style={styles.select}
                    >
                      <option value="">None</option>
                      {projectManagers.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    {(Array.isArray(scheduleForm.project_manager_ids) && scheduleForm.project_manager_ids.length > 1) ? (
                      <button type="button" onClick={() => removeProjectManagerAssignmentRow(index)} style={styles.smallDangerButton}>Remove</button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div>
                <div style={styles.assignmentHeader}>
                  <label style={styles.label}>Superintendent(s) (optional)</label>
                  <button type="button" onClick={addSuperintendentAssignmentRow} style={styles.smallButton}>Add Super</button>
                </div>
                {(scheduleForm.superintendent_assignments || []).map((assignment, index) => (
                  <div key={assignment.localId} style={styles.inlineAssignmentRow}>
                    <select
                      value={assignment.superintendent_id}
                      onChange={(e) => updateSuperintendentAssignment(assignment.localId, 'superintendent_id', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">None</option>
                      {superintendents.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <label style={styles.inlineCheckLabel}>
                      <input
                        type="radio"
                        name={`super-shift-${assignment.localId}`}
                        checked={assignment.shift === 'AM'}
                        onChange={() => updateSuperintendentAssignment(assignment.localId, 'shift', 'AM')}
                      /> AM
                    </label>
                    <label style={styles.inlineCheckLabel}>
                      <input
                        type="radio"
                        name={`super-shift-${assignment.localId}`}
                        checked={assignment.shift === 'PM'}
                        onChange={() => updateSuperintendentAssignment(assignment.localId, 'shift', 'PM')}
                      /> PM
                    </label>
                    {index === 0 ? (
                      <span style={styles.inlineTinyHelp}>AM/PM prints only when 2+ supers are listed.</span>
                    ) : null}
                    {(scheduleForm.superintendent_assignments || []).length > 1 ? (
                      <button type="button" onClick={() => removeSuperintendentAssignmentRow(assignment.localId)} style={styles.smallDangerButton}>Remove</button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div>
                <label style={styles.label}>Surveyor (optional)</label>
                <select
                  value={scheduleForm.surveyor_id}
                  onChange={(e) =>
                    updateScheduleForm('surveyor_id', e.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">None</option>
                  {surveyors.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={styles.label}>Overall Job Notes</label>
              <textarea
                value={scheduleForm.notes}
                onChange={(e) => updateScheduleForm('notes', e.target.value)}
                onInput={autoGrowTextarea}
                rows={1}
                style={styles.compactTextarea}
                placeholder="Overall notes for this job or week..."
              />
            </div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Foreman Assignments</h2>
              <button onClick={addForemanAssignmentRow} style={styles.button}>
                Add Foreman Row
              </button>
            </div>

            {foremanAssignments.map((assignment, index) => (
              <div key={assignment.localId} style={styles.assignmentCard}>
                <div style={styles.assignmentTopRow}>
                  <div style={styles.foremanAssignmentTitleWrap}>
                    <strong>Foreman Assignment {index + 1}</strong>
                    <label style={styles.nightWorkLabel}>
                      <input
                        type="checkbox"
                        checked={!!assignment.night}
                        onChange={(e) => updateForemanAssignment(assignment.localId, 'night', e.target.checked)}
                      />
                      Nights
                    </label>
                  </div>
                  <button
                    onClick={() => removeForemanAssignmentRow(assignment.localId)}
                    style={styles.buttonDanger}
                  >
                    Remove
                  </button>
                </div>

                <div style={styles.foremanAssignmentGrid}>
                  <div style={styles.foremanPersonGrid}>
                    <div>
                      <label style={styles.label}>Foreman</label>
                      <select
                        value={assignment.foreman_id}
                        onChange={(e) => {
                          const value = e.target.value
                          updateForemanAssignment(assignment.localId, 'foreman_id', value)
                          if (value !== '__subcontractor__') {
                            updateForemanAssignment(assignment.localId, 'split_note', '')
                          }
                        }}
                        style={styles.select}
                      >
                        <option value="">Select Foreman</option>
                        <option value="__subcontractor__">Subcontractor</option>
                        {foremen.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={styles.label}>Subcontractor <span style={styles.mutedText}>(optional)</span></label>
                      <input
                        type="text"
                        value={assignment.subcontractor_name || ''}
                        onChange={(e) =>
                          updateForemanAssignment(
                            assignment.localId,
                            'subcontractor_name',
                            e.target.value
                          )
                        }
                        style={styles.input}
                        placeholder="Type subcontractor name..."
                      />
                    </div>
                  </div>

                  <div style={styles.twoColumnGrid}>
                    <div>
                      <label style={styles.label}>From Date</label>
                      <input
                        type="date"
                        value={assignment.assignment_from_date}
                        onChange={(e) =>
                          updateForemanAssignment(
                            assignment.localId,
                            'assignment_from_date',
                            e.target.value
                          )
                        }
                        style={styles.input}
                      />
                    </div>

                    <div>
                      <label style={styles.label}>To Date</label>
                      <input
                        type="date"
                        value={assignment.assignment_to_date}
                        onChange={(e) =>
                          updateForemanAssignment(
                            assignment.localId,
                            'assignment_to_date',
                            e.target.value
                          )
                        }
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={styles.label}>Work Description</label>
                  <textarea
                    value={assignment.work_description}
                    onChange={(e) =>
                      updateForemanAssignment(
                        assignment.localId,
                        'work_description',
                        e.target.value
                      )
                    }
                    onInput={autoGrowTextarea}
                    rows={1}
                    style={styles.compactTextarea}
                    placeholder="What is this foreman doing on this job?"
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Surveyor Assignment</h2>
              <button onClick={addSurveyorAssignmentRow} style={styles.button}>
                Add Surveyor Row
              </button>
            </div>

            {surveyorAssignments.map((assignment, index) => (
              <div key={assignment.localId} style={styles.assignmentCard}>
                <div style={styles.assignmentTopRow}>
                  <strong>Surveyor Assignment {index + 1}</strong>
                  <button
                    onClick={() => removeSurveyorAssignmentRow(assignment.localId)}
                    style={styles.buttonDanger}
                  >
                    Remove
                  </button>
                </div>

                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Surveyor</label>
                    <select
                      value={assignment.surveyor_id}
                      onChange={(e) =>
                        updateSurveyorAssignment(
                          assignment.localId,
                          'surveyor_id',
                          e.target.value
                        )
                      }
                      style={styles.select}
                    >
                      <option value="">Select Surveyor</option>
                      {surveyors.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.dayCheckboxRow}>
                  {WEEKDAY_KEYS.map((dayKey) => (
                    <label key={dayKey} style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={assignment[dayKey]}
                        onChange={(e) =>
                          updateSurveyorAssignment(
                            assignment.localId,
                            dayKey,
                            e.target.checked
                          )
                        }
                      />
                      {WEEKDAY_LABELS[dayKey]}
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={styles.label}>Surveyor Note</label>
                  <textarea
                    value={assignment.note}
                    onChange={(e) =>
                      updateSurveyorAssignment(
                        assignment.localId,
                        'note',
                        e.target.value
                      )
                    }
                    onInput={autoGrowTextarea}
                    rows={1}
                    style={styles.compactTextarea}
                    placeholder="What does the surveyor need to do?"
                  />
                </div>
              </div>
            ))}

            <div style={styles.equipmentMovesSection}>
              <div style={styles.assignmentHeader}>
                <div>
                  <label style={styles.label}>Equipment Moves</label>
                  <div style={styles.inlineTinyHelp}>Enter only the days needed. Blank days stay off the printed report.</div>
                </div>
              </div>
              <div style={styles.equipmentMovesGrid}>
                {EQUIPMENT_DAY_KEYS.map((dayKey) => (
                  <div key={dayKey} style={styles.equipmentMoveDayCard}>
                    <label style={styles.equipmentMoveDayLabel}>{EQUIPMENT_DAY_LABELS[dayKey]}</label>
                    <textarea
                      value={scheduleForm.equipment_moves?.[dayKey] || ''}
                      onChange={(e) => updateEquipmentMove(dayKey, e.target.value)}
                      onInput={autoGrowTextarea}
                      rows={1}
                      style={styles.equipmentMoveTextarea}
                      placeholder={dayKey === 'general' ? 'General equipment note...' : `${EQUIPMENT_DAY_LABELS[dayKey]} moves...`}
                    />
                  </div>
                ))}
              </div>
            </div>



            <div style={styles.bottomButtons}>
              <button onClick={saveScheduleItem} disabled={isActionBusy('saveSchedule')} style={isActionBusy('saveSchedule') ? styles.buttonDisabled : styles.button}>
                {isActionBusy('saveSchedule') ? (editingScheduleItemId ? 'Updating...' : 'Saving...') : (editingScheduleItemId ? 'Update Schedule Item' : 'Save Schedule Item')}
              </button>
              <button onClick={resetScheduleForm} style={styles.buttonSecondary}>
                Cancel / Clear Form
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'weekly' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Weekly Schedule View</h2>
              <div style={styles.topBarButtons}>
                <button
                  onClick={openAddScheduleEditor}
                  style={styles.button}
                >
                  Add Schedule Item
                </button>
                <button
                  onClick={duplicateCurrentWeek}
                  disabled={isActionBusy('duplicateWeek') || nextWeekHasItems}
                  style={isActionBusy('duplicateWeek') || nextWeekHasItems ? styles.buttonDisabled : styles.button}
                >
                  {isActionBusy('duplicateWeek')
                    ? 'Duplicating...'
                    : nextWeekHasItems
                      ? 'Already Copied to Next Week'
                      : 'Duplicate to Next Week'}
                </button>
                <button
                  onClick={cleanupSelectedWeekDuplicates}
                  disabled={isActionBusy('cleanupDuplicates') || !selectedWeekDuplicateCount}
                  style={isActionBusy('cleanupDuplicates') || !selectedWeekDuplicateCount ? styles.buttonDisabledSecondary : styles.buttonSecondary}
                >
                  {isActionBusy('cleanupDuplicates')
                    ? 'Cleaning Duplicates...'
                    : selectedWeekDuplicateCount
                      ? `Clean Up Duplicates (${selectedWeekDuplicateCount})`
                      : 'No Duplicates Found'}
                </button>
              </div>
            </div>

            <div style={styles.weekSelectorRowSticky}>
              <div>
                <label style={styles.label}>Week Of</label>
                <input
                  type="date"
                  value={selectedWeekFrom}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>To</label>
                <input
                  type="date"
                  value={selectedWeekTo}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.todayButtonWrap}>
                <label style={styles.label}>&nbsp;</label>
                <button onClick={goToCurrentWeek} style={styles.buttonSecondary}>
                  Today
                </button>
              </div>

              <div style={styles.lastUpdatedText}>
                Last updated: {formatDateTime(lastUpdatedAt)}
              </div>
            </div>

            <div style={styles.weeklyFilterBar}>
              <div style={styles.weeklyFilterTopRow}>
                <label style={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                  <span>Show active only</span>
                </label>

                <div style={styles.weeklyFilterActions}>
                  <button onClick={expandAllScheduleCards} style={styles.smallButton}>
                    Expand All
                  </button>
                  <button onClick={collapseAllScheduleCards} style={styles.smallButton}>
                    Collapse All
                  </button>
                </div>
              </div>

              <div style={styles.weeklyQuickToolsRow}>
                <div style={styles.weeklySearchWrap}>
                  <label style={styles.label}>Search schedule</label>
                  <input
                    type="text"
                    value={weeklySearchText}
                    onChange={(e) => setWeeklySearchText(e.target.value)}
                    placeholder="Search job, foreman, super, surveyor, notes..."
                    style={styles.input}
                  />
                </div>

                <div style={styles.weeklyJumpWrap}>
                  <label style={styles.label}>Jump to job</label>
                  <select
                    value={jumpToScheduleItemId}
                    onChange={(e) => jumpToScheduleItem(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Select job...</option>
                    {displayedWeekScheduleItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.smallText}>
                Showing {displayedWeekScheduleItems.length} job{displayedWeekScheduleItems.length === 1 ? '' : 's'}
                {showActiveOnly ? ' with notes or assignments' : ' rolling forward until deleted'}
                {weeklySearchText.trim() ? ' matching your search' : ''}.
              </div>
            </div>

            {displayedWeekScheduleItems.length === 0 ? (
              <p style={styles.text}>
                {showActiveOnly
                  ? 'No active jobs with notes or assignments for this week.'
                  : 'No jobs found for this week yet.'}
              </p>
            ) : (
              <div style={styles.scheduleList}>
                {displayedWeekScheduleItems.map((item) => {
                  const isCollapsed = isScheduleCardCollapsed(item.id)

                  return (
                    <div key={item.id} id={`schedule-item-${item.id}`} style={styles.scheduleCard}>
                      <div style={styles.scheduleHeader}>
                        <div>
                          <div style={styles.scheduleJobTitle}>
                            {item.jobs?.job_number || '—'} —{' '}
                            {item.jobs?.job_name || 'No Job Name'}
                          </div>
                          <div style={styles.smallText}>
                            Job Start: {formatDate(item.jobs?.start_date)} | Job Stop:{' '}
                            {formatDate(item.jobs?.stop_date)}
                          </div>
                          {isCollapsed ? (
                            <>
                              <div style={styles.collapsedSummaryText}>
                                Collapsed • {item.schedule_item_foremen?.length || 0} foreman assignment{(item.schedule_item_foremen?.length || 0) === 1 ? '' : 's'} • {item.schedule_item_surveyors?.length || 0} surveyor assignment{(item.schedule_item_surveyors?.length || 0) === 1 ? '' : 's'}
                              </div>
                              {renderCollapsedQuickPills(item)}
                            </>
                          ) : null}
                        </div>

                        <div style={styles.itemButtonRow}>
                          <button
                            onClick={() => toggleScheduleCardCollapsed(item.id)}
                            style={styles.smallButton}
                          >
                            {isCollapsed ? 'Expand' : 'Collapse'}
                          </button>
                          <button
                            onClick={() => editScheduleItem(item)}
                            style={styles.smallButton}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteScheduleItem(item.id)}
                            style={styles.smallDangerButton}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {!isCollapsed ? (
                        <>
                          <div style={styles.metaGrid}>
                            <div>
                              <strong>PM:</strong> {getProjectManagerNamesForItem(item) || '—'}
                            </div>
                            <div>
                              <strong>Superintendent:</strong>{' '}
                              {getSuperintendentLabelsForItem(item) || '—'}
                            </div>
                            <div>
                              <strong>Surveyor:</strong> {item.surveyors?.name || '—'}
                            </div>
                          </div>
                          {getEquipmentMoveEntriesForItem(item).length ? (
                            <div style={styles.noteBox}>
                              <strong>Equipment Moves:</strong>
                              {getEquipmentMoveEntriesForItem(item).map((move) => (
                                <div key={move.dayKey}><strong>{move.label}:</strong> {move.text}</div>
                              ))}
                            </div>
                          ) : null}

                          {item.notes && (
                            <div style={styles.notesBox}>
                              <strong>Job Notes:</strong> {item.notes}
                            </div>
                          )}

                          <div style={{ marginTop: '14px' }}>
                            <strong>Foreman Assignments</strong>
                          </div>

                          {item.schedule_item_foremen?.length ? (
                            <div style={{ marginTop: '10px' }}>
                              {item.schedule_item_foremen.map((assignment) => (
                                <div key={assignment.id} style={styles.foremanViewCard}>
                                  <div>
                                    <strong>Foreman:</strong>{' '}
                                    {getForemanDisplayNameFromAssignment(assignment)}
                                  </div>
                                  <div>
                                    <strong>Dates:</strong>{' '}
                                    {formatDate(assignment.assignment_from_date)} to{' '}
                                    {formatDate(assignment.assignment_to_date)} {getForemanNightFromAssignment(assignment) ? <strong>NIGHTS</strong> : null}
                                  </div>
                                  <div style={styles.assignmentDaysText}>
                                    {formatAssignmentWeekdays(
                                      assignment.assignment_from_date,
                                      assignment.assignment_to_date
                                    )}
                                  </div>
                                  <div>
                                    <strong>Work:</strong>{' '}
                                    {assignment.work_description || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div style={{ marginTop: '14px' }}>
                            <strong>Surveyor Assignments</strong>
                          </div>

                          {item.schedule_item_surveyors?.length ? (
                            <div style={{ marginTop: '10px' }}>
                              {item.schedule_item_surveyors.map((assignment) => (
                                <div key={assignment.id} style={styles.foremanViewCard}>
                                  <div>
                                    <strong>Surveyor:</strong>{' '}
                                    {assignment.surveyors?.name || '—'}
                                  </div>
                                  <div>
                                    <strong>Days:</strong>{' '}
                                    {formatSurveyorDays(assignment)}
                                  </div>
                                  <div>
                                    <strong>Note:</strong> {assignment.note || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={styles.weeklyBottomActionBar}>
              <button onClick={openAddScheduleEditor} style={styles.button}>
                Add Schedule Item
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'grid' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Weekly Grid View</h2>
              <button onClick={loadAllData} disabled={loading} style={loading ? styles.buttonDisabledSecondary : styles.buttonSecondary}>
                {loading ? 'Refreshing...' : 'Refresh Grid'}
              </button>
            </div>

            <div style={styles.roleLegend}>
              <span style={styles.roleLegendLabel}>Legend:</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchForeman}></span>Foreman</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchSurveyor}></span>Surveyor</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchNotes}></span>Job Notes</span>
            </div>

{gridScheduleItems.length === 0 ? (
  <p style={styles.text}>
    {selectedWeekFrom && selectedWeekTo
      ? 'No jobs found for this week.'
      : 'Choose a week to view the weekly grid.'}
  </p>
) : (
              <div style={styles.gridBoard}>
                <div style={styles.gridHeaderCell}>Job</div>
                {WEEKDAY_KEYS.map((dayKey) => (
                  <div
                    key={dayKey}
                    style={todayDayKey === dayKey ? { ...styles.gridHeaderCell, ...styles.gridHeaderCellToday } : styles.gridHeaderCell}
                  >
                    {WEEKDAY_LABELS[dayKey]}{todayDayKey === dayKey ? ' • Today' : ''}
                  </div>
                ))}

                {gridScheduleItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <div style={styles.gridJobCell}>
                      <div style={styles.gridJobTitle}>
                        {item.jobs?.job_number || '—'}
                      </div>
                      <div style={styles.gridJobSubTitle}>
                        {item.jobs?.job_name || 'No Job Name'}
                      </div>
                      {item.notes ? (
                        <div style={styles.gridJobNote}>
                          <span style={styles.gridJobNoteLabel}>Note:</span> {item.notes}
                        </div>
                      ) : null}
                    </div>

                    {WEEKDAY_KEYS.map((dayKey) => (
                      <div
                        key={`${item.id}-${dayKey}`}
                        style={todayDayKey === dayKey ? { ...styles.gridDayCell, ...styles.gridDayCellToday } : styles.gridDayCell}
                      >
                        {renderDayContents(item, dayKey)}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'mobile' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Mobile View</h2>
              <div style={styles.topBarButtons}>
                <button onClick={openMobileShareView} style={styles.button}>
                  Open Mobile View
                </button>
                <button onClick={copyMobileShareLink} style={styles.buttonSecondary}>
                  Copy Mobile Link
                </button>
                <button onClick={copyMobileSmsMessage} style={styles.buttonSecondary}>
                  Copy SMS Message
                </button>
                <button onClick={sendMobileTextToAll} style={styles.buttonSecondary}>
                  Send via Text
                </button>
              </div>
            </div>

            <div style={styles.weekSelectorRowSticky}>
              <div>
                <label style={styles.label}>Week Of</label>
                <input
                  type="date"
                  value={selectedWeekFrom}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>To</label>
                <input
                  type="date"
                  value={selectedWeekTo}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.mobileLayoutRow}>
              <div>
                <label style={styles.label}>Mobile layout</label>
                <select
                  value={mobileLayout}
                  onChange={(e) => setMobileLayout(e.target.value)}
                  style={styles.select}
                >
                  <option value="jobs">Group by Job</option>
                  <option value="foremen">Group by Foreman</option>
                  <option value="superintendents">Group by Superintendent</option>
                  <option value="surveyors">Group by Surveyor</option>
                </select>
              </div>
            </div>

            <div style={styles.roleLegend}>
              <span style={styles.roleLegendLabel}>Legend:</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchForeman}></span>Foreman</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchSurveyor}></span>Surveyor</span>
              <span style={styles.roleLegendItem}><span style={styles.legendSwatchNotes}></span>Job Notes</span>
            </div>

            <div style={styles.mobileNoticeBox}>
              <strong>Sharing note:</strong> this opens the same branded schedule in a read-only view with no edit tabs. It is designed for employees to view from their phones without editing the schedule.
            </div>

            <div style={styles.mobileShareTools}>
              <div style={styles.mobileShareLinkBox}>
                Use <strong>Copy Mobile Link</strong> or <strong>Copy SMS Message</strong> to generate a short public link. Existing public links for this week will refresh when the schedule is updated, so employees can keep using the same link.
              </div>
            </div>

            <div style={styles.mobilePreviewStage}>
              <div style={styles.mobileShareShell}>
                <div style={styles.mobileReadonlyHeader}>
                  <div style={styles.mobileReadonlyHeaderTop}>
                    <div>
                      <div style={styles.mobileReadonlyCompany}>Command Construction Industries</div>
                      <div style={styles.mobileReadonlyTitle}>Weekly Schedule</div>
                      <div style={styles.mobileReadonlyDate}>
                        {selectedWeekFrom && selectedWeekTo
                          ? `Week of ${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}`
                          : ''}
                      </div>
                    </div>

                    <div style={styles.mobileReadonlyBrandBlock}>
                      <img
                        src="/command-logo.png"
                        alt="Command Construction Industries Logo"
                        style={styles.mobileReadonlyLogo}
                      />
                      <div style={styles.mobileReadonlyQuote}>
                        “The road to success is always under construction.”
                      </div>
                    </div>
                  </div>

                  <div style={styles.mobileReadonlyDivider} />
                </div>

                {mobileLayout === 'jobs' ? renderReadonlyScheduleCards(weekScheduleItems, { compact: true }) : renderMobileRoleGroups(weekScheduleItems, mobileLayout)}
              </div>
            </div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader}>
              <h2 style={styles.sectionTitle}>Mobile Share Groups</h2>
              <div style={styles.topBarButtons}>
                <button onClick={copyContactList} style={styles.buttonSecondary}>
                  Copy Contact List
                </button>
                <button onClick={sendMobileTextToAll} style={styles.buttonSecondary}>
                  Text All Contacts
                </button>
              </div>
            </div>

            <div style={styles.formGrid}>
              <select
                value={selectedContactGroupId}
                onChange={(e) => setSelectedContactGroupId(e.target.value)}
                style={styles.select}
              >
                <option value="">Select Group</option>
                {contactGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <div style={styles.formButtonRow}>
                <button
                  onClick={() => sendTextToGroup(selectedContactGroupId)}
                  style={styles.button}
                >
                  Text Selected Group
                </button>
              </div>
            </div>

            <div style={styles.listWrap}>
              {contactGroups.length === 0 ? (
                <div style={styles.smallText}>No contact groups saved yet.</div>
              ) : (
                contactGroups.map((group) => {
                  const groupContacts = contacts.filter((contact) =>
                    (group.contact_group_memberships || []).some(
                      (membership) => membership.contact_id === contact.id
                    )
                  )
                  return (
                    <div key={group.id} style={styles.emailGroupBlock}>
                      <div style={styles.emailGroupHeader}>
                        <strong>{group.name}</strong>
                        <button onClick={() => sendTextToGroup(group.id)} style={styles.smallButton}>
                          Text Group
                        </button>
                      </div>
                      {groupContacts.length === 0 ? (
                        <div style={styles.smallText}>No contacts in this group yet.</div>
                      ) : (
                        groupContacts.map((contact) => (
                          <div key={contact.id} style={styles.listItem}>
                            <div>
                              {contact.name}
                              {contact.phone ? ` — ${contact.phone}` : ''}
                              {contact.email ? ` — ${contact.email}` : ''}
                            </div>
                            <div style={styles.itemButtonRow}>
                              {contact.phone ? (
                                <button onClick={() => sendMobileTextToContact(contact)} style={styles.smallButton}>
                                  Text
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div style={styles.mobileNoticeBox}>
              <strong>Important:</strong> “Send via Text” opens your device text app with the read-only weekly link already filled in. It does not send messages silently in the background.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.printPageWrap} className={`print-page-wrap ${false ? 'print-grid-mode' : 'print-report-mode'}`}>
<div style={styles.assignmentHeader} className="no-print">
  <div style={styles.topBarButtons}>
    <button onClick={() => window.print()} style={styles.button}>
      Print / Save PDF
    </button>

    <select
      value={printLayout}
      onChange={(e) => setPrintLayout(e.target.value)}
      style={styles.jobPrefixSelect}
    >
      <option value="" disabled>Select Report</option>
      <option value="weekly">Weekly Schedule</option>
      <option value="equipment">Equipment Schedule</option>
    </select>

    <select
      value={selectedEmailGroupId}
      onChange={(e) => {
        setSelectedEmailGroupId(e.target.value)
        if (e.target.value) setSelectedEmailContactId('')
      }}
      style={styles.jobPrefixSelect}
    >
      <option value="">Select Group</option>
      {emailGroups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>

    <select
      value={selectedEmailContactId}
      onChange={(e) => {
        setSelectedEmailContactId(e.target.value)
        if (e.target.value) setSelectedEmailGroupId('')
      }}
      style={styles.jobPrefixSelect}
    >
      <option value="">Select Contact</option>
      {contacts.filter((contact) => contact.email).map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.name}
        </option>
      ))}
    </select>

    <button
      onClick={emailSelectedReport}
      style={styles.button}
    >
      Email Selected
    </button>
  </div>
</div>

<div style={styles.weekSelectorRowSticky} className="no-print">
  <div>
    <label style={styles.label}>Week Of</label>
    <input
      type="date"
      value={selectedWeekFrom}
      onChange={(e) => applyWeekFromAnyDate(e.target.value)}
      style={styles.input}
    />
  </div>

  <div>
    <label style={styles.label}>To</label>
    <input
      type="date"
      value={selectedWeekTo}
      onChange={(e) => applyWeekFromAnyDate(e.target.value)}
      style={styles.input}
    />
  </div>
</div>

<div style={styles.printOptionBar} className="no-print">
  <label style={styles.toggleLabel}>
    <input
      type="checkbox"
      checked={showPrintActiveOnly}
      onChange={(e) => setShowPrintActiveOnly(e.target.checked)}
    />
    <span>Print active jobs only</span>
  </label>
  <div style={styles.smallText}>
    {showPrintActiveOnly
      ? 'Printing only jobs with notes or assignments.'
      : 'Printing all jobs that roll forward into this week.'}
  </div>
</div>

<div style={styles.printNotesInputWrap} className="no-print">
  <label style={styles.label}>Report Notes (optional)</label>
  <textarea
    value={reportNotes}
    onChange={(e) => setReportNotes(e.target.value)}
    placeholder="Add any overall notes for this report..."
    style={styles.printNotesTextarea}
  />
</div>

<div style={styles.emailNoteBox} className="no-print">
  <strong>Email note:</strong>{' '}
  Browser security does not allow this app to silently attach a PDF to Outlook. Click <em>Print / Save PDF</em>, save the PDF, then use <em>Email Selected</em> to open Outlook with the selected recipient(s).
</div>
            <div style={styles.printPreviewStage} className="print-preview-stage">
              <div style={false ? styles.reportPaperGrid : styles.reportPaper} className="print-paper">
              <div style={styles.reportHeader} className="report-header-print-fix">
                <div style={styles.reportHeaderTopBorder} />
                <div style={styles.reportHeaderTop}>
                  <div style={styles.reportTitleBlock}>
                    <div style={styles.reportCompanyName}>
                      Command Construction Industries
                    </div>
                    <div style={styles.reportTitle}>WEEKLY SCHEDULE</div>
                    <div style={styles.reportDate}>
                      {selectedWeekFrom && selectedWeekTo
                        ? `Week of ${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}`
                        : ''}
                    </div>
                  </div>
                  <div style={styles.reportBrandRight}>
                    <img
                      src="/command-logo.png"
                      alt="Command Industries Logo"
                      style={styles.reportLogo}
                    />
                    <div style={styles.reportHeaderQuote}>
                      “The road to success is always under construction.”
                    </div>
                  </div>
                </div>
                <div style={styles.reportDivider} />
              </div>
{printLayout === 'equipment' ? (
  <>
    <div style={styles.printCompactSectionLabel}>Equipment Moves by Job</div>
    {printScheduleItems.filter((item) => getEquipmentMoveEntriesForItem(item).length).length ? (
      <div style={styles.printReportList} className="print-report-list">
        {printScheduleItems.filter((item) => getEquipmentMoveEntriesForItem(item).length).map((item, index, list) => (
          <React.Fragment key={item.id}>
            <div style={styles.printReportCard} className="print-report-card">
              <div style={styles.printCompactJobTitle}>
                {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
              </div>
              <div style={styles.printCompactAssignmentTable}>
                {getEquipmentMoveEntriesForItem(item).map((move) => (
                  <div key={`${item.id}-${move.dayKey}`} style={styles.printCompactAssignmentRow}>
                    <div style={styles.printCompactNameCol}><strong>{move.label}</strong></div>
                    <div style={styles.printCompactNoteCol}>{move.text}</div>
                  </div>
                ))}
              </div>
            </div>
            {index !== list.length - 1 ? <div style={styles.jobDivider} className="print-job-divider" /> : null}
          </React.Fragment>
        ))}
      </div>
    ) : (
      <p style={styles.text}>No equipment moves entered for this week.</p>
    )}
  </>
) : (printLayout === 'weekly' || !printLayout) ? (
  <>
    {printScheduleItems.length === 0 ? (
      <p style={styles.text}>No schedule items found for this print view.</p>
    ) : (
      <div style={styles.printReportList} className="print-report-list">
        {printScheduleItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <div style={styles.printReportCard} className="print-report-card">
                        <div style={styles.printCompactJobTitle}>
                          {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
                        </div>

                        {(item.jobs?.start_date || item.jobs?.stop_date) ? (
                          <div style={styles.printCompactDates}>
                            {item.jobs?.start_date ? (
                              <span><strong>Job Start:</strong> {formatDate(item.jobs.start_date)}</span>
                            ) : null}
                            {item.jobs?.start_date && item.jobs?.stop_date ? (
                              <span style={{ margin: '0 8px' }}>|</span>
                            ) : null}
                            {item.jobs?.stop_date ? (
                              <span><strong>Job Stop:</strong> {formatDate(item.jobs.stop_date)}</span>
                            ) : null}
                          </div>
                        ) : null}

                        <div style={styles.printIndentedBlock}>
                          <div style={styles.printCompactMetaRow}>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>PM:</span>
                              <span>{getProjectManagerNamesForItem(item) || '—'}</span>
                            </div>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>Super:</span>
                              <span>{getSuperintendentLabelsForItem(item) || '—'}</span>
                            </div>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>Surveyor:</span>
                              <span>{item.surveyors?.name || '—'}</span>
                            </div>
                          </div>

                        {item.notes ? (
                          <div
                            style={styles.printNotesAccent}
                          >
                            <span style={{ fontWeight: '600' }}>Job Notes: </span>
                            <span>{item.notes}</span>
                          </div>
                        ) : null}

                        {item.schedule_item_foremen?.length ? (
                          <>
                            <div style={styles.printCompactSectionLabel}>Foreman Assignments</div>
                            <div style={styles.printCompactAssignmentTable}>
                              {item.schedule_item_foremen.map((assignment) => (
                                <div key={assignment.id} style={styles.printCompactAssignmentRow}>
                                  <div style={styles.printCompactNameCol}>
                                    <strong>{getForemanDisplayNameFromAssignment(assignment)}</strong>
                                  </div>
                                  <div style={styles.printCompactInfoCol}>
                                    <div>
                                      <strong>Dates:</strong> {formatDate(assignment.assignment_from_date)} to {formatDate(assignment.assignment_to_date)} {getForemanNightFromAssignment(assignment) ? <strong>NIGHTS</strong> : null}
                                    </div>
                                    <div style={styles.printCompactDaysLine}>
                                      {formatAssignmentWeekdays(
                                        assignment.assignment_from_date,
                                        assignment.assignment_to_date
                                      )}
                                    </div>
                                  </div>
                                  <div style={styles.printCompactNoteCol}>
                                    <strong>Work:</strong> {assignment.work_description || '—'}
                                  </div>
                                </div>
                              ))}
  
                            </div>
                          </>
                        ) : null}

                        {item.schedule_item_surveyors?.length ? (
                          <>
                            <div style={styles.printCompactSectionLabel}>Surveyor Assignments</div>
                            <div style={styles.printCompactAssignmentTable}>
                              {item.schedule_item_surveyors.map((assignment) => (
                                <div key={assignment.id} style={styles.printCompactAssignmentRow}>
                                  <div style={styles.printCompactNameCol}>
                                    <strong>{assignment.surveyors?.name || '—'}</strong>
                                  </div>
                                  <div style={styles.printCompactInfoCol}>
                                    <div>
                                      <strong>Days:</strong> {formatSurveyorDays(assignment)}
                                    </div>
                                  </div>
                                  <div style={styles.printCompactNoteCol}>
                                    <strong>Note:</strong> {assignment.note || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}


                        {getEquipmentMoveEntriesForItem(item).length ? (
                          <>
                            <div style={styles.printCompactSectionLabel}>Equipment Moves</div>
                            <div style={styles.printCompactAssignmentTable}>
                              {getEquipmentMoveEntriesForItem(item).map((move) => (
                                <div key={`${item.id}-${move.dayKey}`} style={styles.printCompactAssignmentRow}>
                                  <div style={styles.printCompactNameCol}><strong>{move.label}</strong></div>
                                  <div style={styles.printCompactNoteCol}>{move.text}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                        </div>
                      </div>
                      {index !== printScheduleItems.length - 1 ? (
                        <div style={styles.jobDivider} className="print-job-divider" />
                      ) : null}
                    </React.Fragment>
                                 ))}
              </div>
            )}

            <div style={styles.printFieldNotesArea}>
              <div style={styles.printSectionHeader}>Print Notes</div>

              <div
                style={styles.printNotesAccent}
              >
                {reportNotes ? <div style={styles.printFieldNotesText}>{reportNotes}</div> : null}
                <div style={styles.reportNotesLine} />
                <div style={styles.reportNotesLine} />
                <div style={styles.reportNotesLine} />
                <div style={styles.reportNotesLine} />
                <div style={styles.reportNotesLine} />
              </div>
            </div>
            </>
          ) : (
            <>
              <div style={styles.weekSelectorRowSticky}>
              <div>
                <label style={styles.label}>Week Of</label>
                <input
                  type="date"
                  value={selectedWeekFrom}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>To</label>
                <input
                  type="date"
                  value={selectedWeekTo}
                  onChange={(e) => applyWeekFromAnyDate(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            {printGridScheduleItems.length === 0 ? (
                <p style={styles.text}>
                  {selectedWeekFrom && selectedWeekTo
                    ? 'No jobs found for this week.'
                    : 'Choose a week to view the weekly grid.'}
                </p>
              ) : (
                <div style={styles.printGridWrap}>
                  <div style={styles.printGridBoard} className="print-grid-board">
                    <div style={styles.printGridHeaderCell}>Job</div>
                    {WEEKDAY_KEYS.map((dayKey) => (
                      <div
                        key={dayKey}
                        style={todayDayKey === dayKey ? { ...styles.printGridHeaderCell, ...styles.printGridHeaderCellToday } : styles.printGridHeaderCell}
                      >
                        {WEEKDAY_LABELS[dayKey]}{todayDayKey === dayKey ? ' • Today' : ''}
                      </div>
                    ))}

                    {printGridScheduleItems.map((item) => (
                      <React.Fragment key={item.id}>
                        <div style={styles.printGridJobCell}>
                          <div style={styles.printGridJobTitle}>
                            {item.jobs?.job_number || '—'}
                          </div>
                          <div style={styles.printGridJobSubTitle}>
                            {item.jobs?.job_name || 'No Job Name'}
                          </div>
                          {item.notes ? (
                            <div style={styles.printGridJobNote}>
                              <span style={styles.printGridJobNoteLabel}>Note:</span> {item.notes}
                            </div>
                          ) : null}
                        </div>

                        {WEEKDAY_KEYS.map((dayKey) => (
                          <div
                            key={`${item.id}-${dayKey}`}
                            style={todayDayKey === dayKey ? { ...styles.printGridDayCell, ...styles.printGridDayCellToday } : styles.printGridDayCell}
                          >
                            {renderDayContents(item, dayKey)}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
              </div>
            </div>
          </div>
        </div>
      )}

</div>
  )
}

function buildForemanGroups(items) {
  const groups = new Map()

  items.forEach((item) => {
    const assignments = item.foremen || item.schedule_item_foremen || []
    assignments.forEach((assignment) => {
      const name = getForemanDisplayNameFromAssignment(assignment) || 'Unassigned Foreman'
      if (!groups.has(name)) {
        groups.set(name, [])
      }
      groups.get(name).push({
        key: String(item.id || item.jobNumber || item.jobs?.job_number || '') + '-' + String(assignment.id || Math.random()),
        jobNumber: (item.jobNumber ?? item.jobs?.job_number) || '—',
        jobName: (item.jobName ?? item.jobs?.job_name) || 'No Job Name',
        jobNotes: item.notes || '',
        fromDate: assignment.fromDate ?? assignment.assignment_from_date,
        toDate: assignment.toDate ?? assignment.assignment_to_date,
        work: assignment.work ?? assignment.work_description,
        splitNote: getForemanSubcontractorName(assignment.splitNote ?? assignment.split_note),
        night: getForemanNightFromAssignment(assignment),
      })
    })
  })

  return Array.from(groups.entries())
    .map(([name, assignments]) => ({ name, assignments }))
    .sort((a, b) => a.name.localeCompare(b.name))
}


function buildSuperintendentGroups(items) {
  const groups = new Map()

  items.forEach((item) => {
    const name = (item.superintendent ?? item.superintendent_labels ?? item.superintendents?.name) || 'Unassigned Superintendent'
    if (!groups.has(name)) groups.set(name, [])

    const foremanNames = (item.foremen || item.schedule_item_foremen || [])
      .map((assignment) => getForemanDisplayNameFromAssignment(assignment))
      .filter(Boolean)
      .join(', ')

    groups.get(name).push({
      key: String(item.id || item.jobNumber || item.jobs?.job_number || Math.random()),
      jobNumber: (item.jobNumber ?? item.jobs?.job_number) || '—',
      jobName: (item.jobName ?? item.jobs?.job_name) || 'No Job Name',
      pm: item.projectManager ?? item.project_manager_labels ?? item.project_managers?.name ?? '',
      surveyor: item.surveyor ?? item.surveyors?.name ?? '',
      foremen: foremanNames,
      jobNotes: item.notes || '',
    })
  })

  return Array.from(groups.entries())
    .map(([name, assignments]) => ({ name, assignments }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function buildSurveyorGroups(items) {
  const groups = new Map()

  function addToGroup(name, item, assignment = null) {
    const groupName = name || 'Unassigned Surveyor'
    if (!groups.has(groupName)) groups.set(groupName, [])

    groups.get(groupName).push({
      key: String(item.id || item.jobNumber || item.jobs?.job_number || '') + '-' + String(assignment?.id || groupName),
      jobNumber: (item.jobNumber ?? item.jobs?.job_number) || '—',
      jobName: (item.jobName ?? item.jobs?.job_name) || 'No Job Name',
      pm: item.projectManager ?? item.project_manager_labels ?? item.project_managers?.name ?? '',
      superintendent: item.superintendent ?? item.superintendent_labels ?? item.superintendents?.name ?? '',
      dayLine: assignment ? formatSurveyorDays(assignment) : '',
      note: assignment?.note || '',
      jobNotes: item.notes || '',
    })
  }

  items.forEach((item) => {
    const assignments = item.surveyorAssignments || item.schedule_item_surveyors || []
    if (assignments.length) {
      assignments.forEach((assignment) => {
        addToGroup((assignment.name ?? assignment.surveyors?.name) || (item.surveyor ?? item.surveyors?.name), item, assignment)
      })
    } else if (item.surveyor || item.surveyors?.name) {
      addToGroup(item.surveyor ?? item.surveyors?.name, item, null)
    }
  })

  return Array.from(groups.entries())
    .map(([name, assignments]) => ({ name, assignments }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function getScheduleItemSearchText(item) {
  const parts = [
    item.jobs?.job_number,
    item.jobs?.job_name,
    item.project_manager_labels || item.project_managers?.name,
    item.superintendent_labels || item.superintendents?.name,
    item.surveyors?.name,
    item.notes,
  ]

  ;(item.schedule_item_foremen || []).forEach((assignment) => {
    parts.push(
      assignment.foremen?.name,
      assignment.work_description,
      assignment.split_note,
      assignment.assignment_from_date,
      assignment.assignment_to_date
    )
  })

  ;(item.schedule_item_surveyors || []).forEach((assignment) => {
    parts.push(
      assignment.surveyors?.name,
      assignment.note,
      formatSurveyorDays(assignment)
    )
  })

  return parts.filter(Boolean).join(' ').toLowerCase()
}

function SectionCard({ title, children, style }) {
  return (
    <div style={{ ...styles.sectionCard, ...(style || {}) }}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionContent}>{children}</div>
    </div>
  )
}

function extractJobNumberValue(jobNumber) {
  if (!jobNumber) return 0
  const parts = jobNumber.split('-')
  if (parts.length < 2) return 0
  const num = parseInt(parts[1].trim(), 10)
  return Number.isNaN(num) ? 0 : num
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

function formatLongDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12

  return `${mm}/${dd}/${yy} ${hours}:${minutes} ${ampm}`
}

function formatAssignmentWeekdays(fromDate, toDate) {
  if (!fromDate && !toDate) return '—'
  const start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(`${toDate}T00:00:00`)
  const end = toDate ? new Date(`${toDate}T00:00:00`) : new Date(`${fromDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'

  const first = start <= end ? start : end
  const last = start <= end ? end : start
  const labels = []

  const current = new Date(first)
  while (current <= last) {
    labels.push(
      current.toLocaleDateString('en-US', {
        weekday: 'short',
      })
    )
    current.setDate(current.getDate() + 1)
  }

  return labels.length ? labels.join(', ') : '—'
}

function formatSurveyorDays(assignment) {
  const days = []
  if (assignment.monday) days.push('Mon')
  if (assignment.tuesday) days.push('Tue')
  if (assignment.wednesday) days.push('Wed')
  if (assignment.thursday) days.push('Thu')
  if (assignment.friday) days.push('Fri')
  return days.length ? days.join(', ') : '—'
}

function assignmentCoversDay(assignment, dayKey, weekFromDate) {
  if (!assignment?.assignment_from_date && !assignment?.assignment_to_date) {
    return true
  }

  const startOfWeek = new Date(`${weekFromDate}T00:00:00`)
  const offsets = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
  }

  const dayDate = new Date(startOfWeek)
  dayDate.setDate(startOfWeek.getDate() + (offsets[dayKey] ?? 0))

  const assignmentFrom = assignment.assignment_from_date
    ? new Date(`${assignment.assignment_from_date}T00:00:00`)
    : null
  const assignmentTo = assignment.assignment_to_date
    ? new Date(`${assignment.assignment_to_date}T00:00:00`)
    : null

  if (assignmentFrom && dayDate < assignmentFrom) return false
  if (assignmentTo && dayDate > assignmentTo) return false
  return true
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #fbf7f0 0%, #f2ede4 100%)',
    padding: '30px 20px',
    fontFamily: 'Arial, sans-serif',
  },
  headerCard: {
    maxWidth: '1200px',
    margin: '0 auto 20px auto',
    background: 'linear-gradient(135deg, #0f172a 0%, #162338 58%, #1d2d43 100%)',
    borderRadius: '16px',
    padding: '24px 28px',
    borderTop: '4px solid #dd7a00',
    boxShadow: '0 16px 34px rgba(15,23,42,0.24)',
  },
  card: {
    maxWidth: '900px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  loginCard: {
    maxWidth: '500px',
    margin: '60px auto',
    background: '#ffffff',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  grid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
  },
  masterGrid: {
    maxWidth: '1320px',
    margin: '0 auto',
    display: 'block',
  },
  masterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    columnGap: '20px',
    marginBottom: '20px',
    alignItems: 'stretch',
  },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: 1,
    minHeight: 0,
  },
  masterCardJobs: {
    gridColumn: 'span 2',
    minHeight: 470,
  },
  masterCardProjectManagers: {
    minHeight: 470,
  },
  masterCardSuperintendents: {
    minHeight: 340,
  },
  masterCardForemen: {
    minHeight: 340,
  },
  masterCardSurveyors: {
    minHeight: 340,
  },
  masterCardContacts: {
    minHeight: 430,
  },
  masterCardTextGroups: {
    minHeight: 430,
  },
  masterCardEmailGroups: {
    minHeight: 430,
  },









  singleColumnWrap: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gap: '20px',
  },
  printPageWrap: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
  },
  printPreviewStage: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
    background: '#eef3f7',
    border: '1px solid #d5dde6',
    borderRadius: '18px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },
  reportPaper: {
    width: '7.9in',
    minHeight: '10.3in',
    background: '#ffffff',
    border: '1px solid #d8dee6',
    borderRadius: '8px',
    padding: '22px 24px 18px',
    boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
  },
  reportPaperGrid: {
    width: '10.9in',
    minHeight: '7.8in',
    background: '#ffffff',
    border: '1px solid #d8dee6',
    borderRadius: '8px',
    padding: '16px 18px 14px',
    boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
  },
  printReportList: {
    display: 'block',
    paddingTop: '10px',
  },
  printReportCard: {
    paddingTop: '2px',
    paddingBottom: '8px',
    marginBottom: '0',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
  printPmLine: {
    marginTop: '10px',
    fontSize: '14px',
  },
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #eadfce',
    borderRadius: '14px',
    padding: '18px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  assignmentCard: {
    border: '1px solid #ead7c2',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    background: '#fffaf3',
  },
  scheduleCard: {
    border: '1px solid #ead7c2',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '16px',
    background: '#fffaf3',
    boxShadow: '0 4px 10px rgba(17,24,39,0.04)',
  },
  foremanViewCard: {
    border: '1px solid #e6dccf',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '18px',
    background: '#ffffff',
  },
  printCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '18px',
    background: '#ffffff',
    pageBreakInside: 'avoid',
  },
  topBar: {
    display: 'grid',
    gap: '16px',
  },
  topBarButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  headerNavRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
    width: '100%',
  },
  headerNavLeft: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  headerNavRight: {
    display: 'flex',
    gap: '10px',
    marginLeft: 'auto',
  },
  headerTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '18px',
    flexWrap: 'wrap',
  },
  headerTextBlock: {
    minWidth: '280px',
  },
  headerSubtitle: {
    margin: 0,
    color: '#f7dfb5',
    fontSize: '15px',
    fontWeight: '600',
  },
  headerBrandRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
    gap: '8px',
    marginLeft: 'auto',
  },
  headerLogo: {
    width: '240px',
    maxWidth: '100%',
    objectFit: 'contain',
  },
  headerQuote: {
    maxWidth: '320px',
    color: '#f8e7c7',
    fontSize: '15px',
    lineHeight: '1.35',
    fontStyle: 'italic',
    fontFamily: 'Georgia, Times New Roman, serif',
  },
  headerDivider: {
    borderTop: '1px solid rgba(247, 223, 181, 0.28)',
    marginTop: '2px',
    paddingTop: '2px',
  },
  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  inlineAssignmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '6px',
  },
  inlineTinyHelp: {
    fontSize: '10px',
    color: '#64748b',
    lineHeight: '1.2',
    marginLeft: '4px',
    whiteSpace: 'nowrap',
    alignSelf: 'center',
  },
  foremanAssignmentTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  nightWorkLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#a54600',
  },
  assignmentTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  stickySaveBar: {
    position: 'sticky',
    top: '8px',
    zIndex: 60,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    background: '#fffdf8',
    border: '1px solid #eadfce',
    borderRadius: '14px',
    padding: '12px 14px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
  },
  stickySaveTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#111827',
    marginBottom: '4px',
  },
  stickySaveActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  editorTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  unsavedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    width: 'fit-content',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
    color: '#9a3412',
    fontSize: '12px',
    fontWeight: '800',
  },
  savedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    width: 'fit-content',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    fontSize: '12px',
    fontWeight: '800',
  },
  unsavedStatusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    background: '#f97316',
    display: 'inline-block',
  },
  savedStatusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    background: '#10b981',
    display: 'inline-block',
  },
  bottomButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  foremanAssignmentGrid: {
    display: 'grid',
    gap: '10px',
  },
  foremanPersonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    alignItems: 'end',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    marginTop: '12px',
    marginBottom: '12px',
  },
  weekSelectorRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '18px',
  },
  weekSelectorRowSticky: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '18px',
    position: 'sticky',
    top: '8px',
    zIndex: 20,
    background: '#fbf7f0',
    padding: '12px',
    border: '1px solid #eadfce',
    borderRadius: '12px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
  },
  scheduleList: {
    display: 'grid',
    gap: '16px',
  },
  scheduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  notesBox: {
    marginTop: '12px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
  },
  emailNoteBox: {
    marginBottom: '16px',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    color: '#7c2d12',
  },
  bannerSuccess: {
    margin: '0 auto 16px',
    maxWidth: '1280px',
    background: '#ecfdf5',
    border: '1px solid #86efac',
    color: '#166534',
    borderRadius: '12px',
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 10px 18px rgba(22, 101, 52, 0.08)',
  },
  bannerError: {
    margin: '0 auto 16px',
    maxWidth: '1280px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
    color: '#9a3412',
    borderRadius: '12px',
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 10px 18px rgba(154, 52, 18, 0.08)',
  },
  bannerCloseButton: {
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #d7c4ab',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  contactCheckboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid #f5efe5',
    fontSize: '13px',
    lineHeight: 1.35,
  },
  emailGroupBlock: {
    display: 'grid',
    gap: '10px',
  },
  emailGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f5efe5',
  },
  printJobTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '18px',
    color: '#111827',
  },
  printForemanTitle: {
    marginTop: '14px',
    fontWeight: 'bold',
    color: '#111827',
  },
  printLine: {
    marginTop: '6px',
    fontSize: '14px',
    color: '#111827',
  },
  printNotes: {
    marginTop: '12px',
    padding: '10px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
  },
  smallText: {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.4,
  },
  jobNumberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px',
  },
  jobPrefixSelect: {
    width: '170px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d9c7b1',
    background: '#fffdfa',
    boxSizing: 'border-box',
  },
  jobDash: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#374151',
  },
  jobNumberInput: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  formButtonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '2px',
    marginBottom: '6px',
  },
  itemButtonRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    marginBottom: '8px',
    fontSize: '32px',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 14px 0',
    color: '#111827',
  },
  text: {
    fontSize: '16px',
    color: '#374151',
    margin: 0,
  },
  scheduleJobTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111827',
  },
  scheduleDates: {
    marginTop: '4px',
    color: '#4b5563',
    fontSize: '14px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151',
  },
  button: {
    marginTop: '8px',
    background: '#c96f00',
    color: '#ffffff',
    border: '1px solid #c96f00',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(201,111,0,0.16)',
  },
  buttonSecondary: {
    background: '#fffdf8',
    color: '#0f172a',
    border: '1px solid #d7c4ab',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    marginTop: '8px',
    background: '#f2c998',
    color: '#ffffff',
    border: '1px solid #f2c998',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'not-allowed',
    opacity: 0.85,
    boxShadow: 'none',
  },
  buttonDisabledSecondary: {
    background: '#f8f3eb',
    color: '#8b7355',
    border: '1px solid #e5d7c6',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'not-allowed',
    opacity: 0.85,
  },
  buttonDanger: {
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: '10px',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  smallButton: {
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #d7c4ab',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  smallDangerButton: {
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d8c8b4',
    background: '#fffdf9',
    fontSize: '14px',
    color: '#111827',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d8c8b4',
    background: '#fffdf9',
    fontSize: '14px',
    color: '#111827',
    boxSizing: 'border-box',
  },
  textarea: {
    display: 'block',
    width: '100%',
    minHeight: '90px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d9c7b1',
    background: '#fffdfa',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  compactTextarea: {
    display: 'block',
    width: '100%',
    minHeight: '38px',
    height: '38px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #d9c7b1',
    background: '#fffdfa',
    boxSizing: 'border-box',
    resize: 'vertical',
    overflow: 'hidden',
    lineHeight: '1.35',
  },
  equipmentMovesSection: {
    marginTop: '18px',
    padding: '14px',
    border: '1px solid #eadfce',
    borderRadius: '14px',
    background: '#fffaf3',
  },
  equipmentMovesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  equipmentMoveDayCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px',
    border: '1px solid #ead7c2',
    borderRadius: '12px',
    background: '#ffffff',
    minWidth: 0,
  },
  equipmentMoveDayLabel: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#18233c',
  },
  equipmentMoveTextarea: {
    display: 'block',
    width: '100%',
    minHeight: '38px',
    height: '38px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid #d9c7b1',
    background: '#fffdf9',
    boxSizing: 'border-box',
    resize: 'vertical',
    overflow: 'hidden',
    fontSize: '13px',
    lineHeight: '1.35',
  },
  listWrap: {
    flex: 1,
    minHeight: 220,
    maxHeight: 220,
    overflowY: 'auto',
    borderTop: '1px solid #f3ede3',
    paddingTop: '12px',
    paddingRight: '4px',
    marginTop: '6px',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f5efe5',
  },
  dayCheckboxRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#374151',
  },
  gridBoard: {
    display: 'grid',
    gridTemplateColumns: '260px repeat(5, minmax(180px, 1fr))',
    gap: '8px',
    alignItems: 'stretch',
    overflowX: 'auto',
  },
  gridHeaderCell: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1b2b40 100%)',
    color: '#ffffff',
    borderTop: '3px solid #dd7a00',
    borderRadius: '10px',
    padding: '12px',
    fontWeight: 'bold',
    minHeight: '48px',
  },
  gridJobCell: {
    background: '#fffaf3',
    border: '1px solid #ead7c2',
    borderRadius: '10px',
    padding: '12px',
    minHeight: '140px',
  },
  gridJobTitle: {
    fontWeight: 'bold',
    fontSize: '15px',
    color: '#111827',
  },
  gridJobSubTitle: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
  },
  gridJobNote: {
    marginTop: '8px',
    fontSize: '12px',
    lineHeight: '1.35',
    color: '#374151',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 8px',
  },
  gridJobNoteLabel: {
    fontWeight: '700',
  },
  gridDayCell: {
    background: '#ffffff',
    border: '1px solid #e9e2d7',
    borderRadius: '8px',
    padding: '8px',
    minHeight: '118px',
  },
  gridChipStack: {
    display: 'grid',
    gap: '6px',
  },
  gridForemanChip: {
    background: '#fff7ed',
    borderLeft: '4px solid #d97706',
    borderTop: '1px solid #fdba74',
    borderRight: '1px solid #fdba74',
    borderBottom: '1px solid #fdba74',
    borderRadius: '8px',
    padding: '7px 8px',
  },
  gridSurveyorChip: {
    background: '#f0fdf4',
    borderLeft: '4px solid #22c55e',
    borderTop: '1px solid #86efac',
    borderRight: '1px solid #86efac',
    borderBottom: '1px solid #86efac',
    borderRadius: '8px',
    padding: '7px 8px',
  },
  gridChipTitle: {
    fontWeight: 'bold',
    fontSize: '11px',
    color: '#111827',
    marginBottom: '2px',
    lineHeight: 1.2,
  },
  gridChipText: {
    fontSize: '11px',
    color: '#374151',
    lineHeight: 1.25,
  },
  gridChipSubText: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '3px',
    lineHeight: 1.2,
  },
  gridEmptyText: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  printCompactCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '14px',
    background: '#ffffff',
    pageBreakInside: 'avoid',
  },
  printCompactJobTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '4px',
  },
  printIndentedBlock: {
    marginLeft: '16px',
    marginRight: '4px',
  },
  printCompactDates: {
    fontSize: '13px',
    color: '#374151',
    marginBottom: '8px',
  },
  printCompactMetaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
    fontSize: '11.5px',
    color: '#111827',
    marginBottom: '6px',
    padding: '6px 8px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
  },
  printCompactJobNotes: {
    fontSize: '12px',
    color: '#111827',
    marginBottom: '8px',
    lineHeight: 1.35,
  },
  printNotesAccent: {
    borderLeft: '1.5px solid #f2a531',
    backgroundColor: '#fffefb',
    padding: '4px 8px',
    marginTop: '4px',
    marginBottom: '7px',
    marginLeft: '10px',
    marginRight: '10px',
    fontSize: '12px',
    lineHeight: 1.3,
    color: '#111827',
  },
  printNotesBox: {
    backgroundColor: '#fffefb',
    border: '1px solid #f6e7cf',
    borderRadius: '6px',
    padding: '4px 8px',
    marginTop: '4px',
    marginBottom: '7px',
    marginLeft: '10px',
    marginRight: '10px',
    fontSize: '12px',
    lineHeight: 1.3,
    color: '#111827',
  },
  printCompactSectionLabel: {
    fontWeight: 'bold',
    fontSize: '11px',
    color: '#374151',
    marginTop: '8px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.45px',
    paddingBottom: '2px',
    borderBottom: '1px solid #e5e7eb',
  },
  printCompactAssignmentTable: {
    display: 'grid',
    gap: '3px',
  },
  printCompactAssignmentRow: {
    display: 'grid',
    gridTemplateColumns: '138px minmax(0, 1.35fr) minmax(0, 1fr)',
    gap: '8px',
    alignItems: 'start',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '5px 7px',
    fontSize: '10.8px',
    color: '#111827',
    background: '#ffffff',
    lineHeight: 1.28,
  },
  printCompactNameCol: {
    fontSize: '11px',
  },
  printCompactInfoCol: {
    display: 'grid',
    gap: '1px',
  },
  printCompactDaysLine: {
    fontSize: '9px',
    color: '#6b7280',
    marginTop: '-1px',
    paddingLeft: '40px',
    letterSpacing: '0.1px',
  },
  printCompactNoteCol: {
    fontSize: '11px',
  },
  assignmentDaysText: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
    marginLeft: '48px',
  },
  printCompactEmpty: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '4px',
  },
  printMetaItem: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr)',
    gap: '4px',
    alignItems: 'start',
  },
  printMetaLabel: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  jobDivider: {
    borderTop: '1px solid #cfd6de',
    marginTop: '12px',
    marginBottom: '10px',
  },
  reportHeader: {
    marginBottom: '10px',
  },
  reportHeaderTopBorder: {
    borderTop: '1px solid #c7cdd4',
    marginBottom: '8px',
  },
  reportHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    minHeight: '50px',
  },
  reportTitleBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
    paddingTop: '1px',
  },
  reportCompanyName: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: '#b45309',
    marginBottom: '3px',
  },
  reportBrandRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
    gap: '4px',
    flexShrink: 0,
  },
  reportLogo: {
    height: '44px',
    width: '148px',
    objectFit: 'contain',
    objectPosition: 'right center',
    flexShrink: 0,
  },
  reportHeaderQuote: {
    maxWidth: '220px',
    fontSize: '10.5px',
    lineHeight: '1.25',
    fontStyle: 'italic',
    fontFamily: 'Georgia, Times New Roman, serif',
    color: '#7c2d12',
  },
  reportTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '0.7px',
    color: '#111827',
    lineHeight: 1.02,
  },
  reportDate: {
    fontSize: '11.5px',
    color: '#4b5563',
    marginTop: '4px',
  },
  reportDivider: {
    marginTop: '9px',
    borderBottom: '1px solid #c7cdd4',
  },
  printSectionHeader: {
  fontWeight: '600',
  fontSize: '13px',
  marginBottom: '6px',
  marginTop: '10px',
},
reportNotesLine: {
  borderBottom: '1px solid #e5e7eb',
  marginTop: '6px',
  height: '10px',
},
  printNotesInputWrap: {
  marginTop: '14px',
  marginBottom: '14px',
  maxWidth: '760px',
},
printNotesTextarea: {
  width: '100%',
  minHeight: '110px',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  fontSize: '15px',
  lineHeight: '1.4',
  resize: 'vertical',
  boxSizing: 'border-box',
},
    printGridWrap: {
  marginTop: '14px',
},

printGridBoard: {
  display: 'grid',
  gridTemplateColumns: '1.35fr repeat(5, minmax(0, 1fr))',
  border: '1px solid #d1d5db',
  borderBottom: 'none',
},

printGridHeaderCell: {
  borderBottom: '1px solid #d1d5db',
  borderRight: '1px solid #d1d5db',
  padding: '5px',
  fontWeight: '700',
  fontSize: '10px',
  backgroundColor: '#f7f1e7',
},

printGridJobCell: {
  borderBottom: '1px solid #d1d5db',
  borderRight: '1px solid #d1d5db',
  padding: '5px',
  fontSize: '9px',
  lineHeight: '1.18',
},

printGridJobTitle: {
  fontWeight: '700',
  fontSize: '9px',
},

printGridJobSubTitle: {
  fontSize: '8px',
  marginTop: '1px',
},

printGridJobNote: {
  marginTop: '3px',
  fontSize: '7px',
  lineHeight: '1.2',
  color: '#374151',
  background: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  padding: '2px 3px',
},

printGridJobNoteLabel: {
  fontWeight: '700',
},

printGridDayCell: {
  borderBottom: '1px solid #d1d5db',
  borderRight: '1px solid #d1d5db',
  padding: '3px',
  fontSize: '8px',
  lineHeight: '1.1',
  minHeight: '42px',
},

mobileSharePage: {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #eef2f6 0%, #dde5ee 100%)',
  padding: '18px 12px 28px',
  fontFamily: 'Arial, sans-serif',
},
mobilePreviewStage: {
  display: 'flex',
  justifyContent: 'center',
  padding: '12px',
  background: '#e9eef4',
  border: '1px solid #d6dee8',
  borderRadius: '18px',
},
mobileShareShell: {
  width: '100%',
  maxWidth: '820px',
  margin: '0 auto',
  background: '#ffffff',
  border: '1px solid #d8dee6',
  borderRadius: '18px',
  padding: '20px 18px 22px',
  boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
},
mobileReadonlyHeader: {
  marginBottom: '14px',
  background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
  borderRadius: '16px',
  padding: '18px 18px 14px',
  borderTop: '4px solid #dd7a00',
  boxShadow: '0 12px 28px rgba(15,23,42,0.18)',
},
mobileReadonlyHeaderTop: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '14px',
  flexWrap: 'wrap',
},
mobileReadonlyCompany: {
  fontSize: '15px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#f0b35d',
  marginBottom: '3px',
},
mobileReadonlyTitle: {
  fontSize: '26px',
  fontWeight: '800',
  color: '#ffffff',
  lineHeight: '1.1',
},
mobileReadonlyDate: {
  marginTop: '5px',
  fontSize: '14px',
  color: '#e5e7eb',
},
mobileReadonlyBrandBlock: {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  textAlign: 'right',
  gap: '8px',
  marginLeft: 'auto',
},
mobileReadonlyLogo: {
  width: '160px',
  maxWidth: '100%',
  objectFit: 'contain',
},
mobileReadonlyQuote: {
  maxWidth: '260px',
  color: '#f8e7c7',
  fontSize: '13px',
  lineHeight: '1.35',
  fontStyle: 'italic',
  fontFamily: 'Georgia, Times New Roman, serif',
},
mobileReadonlyDivider: {
  borderTop: '1px solid rgba(248, 231, 199, 0.24)',
  marginTop: '10px',
},
mobileReadonlyToggleWrap: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '14px',
  padding: '10px 12px',
  background: '#fffaf3',
  border: '1px solid #e6dccf',
  borderRadius: '12px',
},
mobileReadonlyToggleLabel: {
  fontSize: '13px',
  fontWeight: '700',
  color: '#374151',
},
mobileReadonlyToggleGroup: {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
},
mobileReadonlyToggleButton: {
  background: '#ffffff',
  color: '#9a3412',
  border: '1px solid #fdba74',
  borderRadius: '999px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: '700',
  cursor: 'pointer',
},
mobileReadonlyToggleButtonActive: {
  background: '#f0b35d',
  color: '#111827',
  border: '1px solid #dd7a00',
  borderRadius: '999px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: '800',
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(221,122,0,0.18)',
},
mobileReadonlyList: {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
},
mobileReadonlyListCompact: {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
},
mobileReadonlyCard: {
  border: '1px solid #e5ded1',
  borderRadius: '14px',
  background: '#fffaf3',
  boxShadow: '0 5px 12px rgba(15,23,42,0.05)',
  overflow: 'hidden',
},
mobileReadonlyJobTitle: {
  padding: '14px 16px 10px',
  fontSize: '16px',
  fontWeight: '800',
  color: '#111827',
  borderBottom: '1px solid #efe5d5',
},
mobileReadonlyBody: {
  padding: '14px 16px 16px',
},
mobileReadonlyMetaRow: {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '8px',
  fontSize: '13px',
  marginBottom: '10px',
  padding: '8px 10px',
  background: '#fffdf9',
  border: '1px solid #ece6dc',
  borderRadius: '10px',
},
mobileReadonlyMetaItem: {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
},
mobileReadonlyMetaLabel: {
  fontWeight: '700',
  color: '#111827',
},
mobileReadonlyNotes: {
  borderLeft: '3px solid #f2a531',
  backgroundColor: '#fffefb',
  padding: '7px 10px',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#1f2937',
  marginBottom: '10px',
},
mobileReadonlyNotesLabel: {
  fontWeight: '700',
},
mobileReadonlySection: {
  marginTop: '10px',
},
mobileReadonlySectionTitle: {
  fontSize: '13px',
  fontWeight: '800',
  color: '#0f172a',
  marginBottom: '8px',
},
mobileReadonlyAssignmentCard: {
  border: '1px solid #e6dccf',
  borderRadius: '10px',
  padding: '10px 11px',
  marginBottom: '8px',
  background: '#ffffff',
  fontSize: '13px',
  color: '#1f2937',
  lineHeight: '1.42',
},
mobileReadonlyAssignmentName: {
  fontWeight: '800',
  marginBottom: '2px',
},
mobileReadonlyAssignmentLine: {
  marginTop: '2px',
},
mobileReadonlyAssignmentSubtle: {
  marginTop: '2px',
  fontSize: '12px',
  color: '#6b7280',
},
mobileEmptyCard: {
  border: '1px solid #e6dccf',
  borderRadius: '14px',
  background: '#fffaf3',
  padding: '18px',
  textAlign: 'center',
  color: '#475569',
},

  mobileReadonlyPublicBadge: {
    display: 'inline-block',
    alignSelf: 'flex-start',
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '10px',
  },
  weeklyFilterActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginLeft: 'auto',
  },
  weeklyBottomActionBar: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '18px',
    paddingTop: '14px',
    borderTop: '1px solid #e5e7eb',
  },
  collapsedSummaryText: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  todayButtonWrap: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  unsavedChangesNotice: {
    marginBottom: '14px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #fdba74',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '13px',
    fontWeight: '700',
  },
  lastUpdatedText: {
    alignSelf: 'end',
    paddingBottom: '12px',
    fontSize: '12px',
    color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  roleLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    margin: '0 0 14px 0',
    padding: '9px 12px',
    background: '#fffdf8',
    border: '1px solid #e8dbc8',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#374151',
  },
  roleLegendLabel: {
    fontWeight: '700',
    color: '#111827',
  },
  roleLegendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendSwatchForeman: {
    width: '13px',
    height: '13px',
    borderRadius: '4px',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    display: 'inline-block',
  },
  legendSwatchSurveyor: {
    width: '13px',
    height: '13px',
    borderRadius: '4px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    display: 'inline-block',
  },
  legendSwatchNotes: {
    width: '13px',
    height: '13px',
    borderRadius: '4px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
    display: 'inline-block',
  },
  printFieldNotesArea: {
    marginTop: '18px',
    pageBreakInside: 'avoid',
  },
  printFieldNotesText: {
    marginBottom: '8px',
  }
,
  weeklyFilterTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  weeklyQuickToolsRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(240px, 420px)',
    gap: '12px',
    alignItems: 'end',
    marginTop: '12px',
  },
  weeklySearchWrap: {
    minWidth: 0,
  },
  weeklyJumpWrap: {
    minWidth: 0,
  },
  collapsedPillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  collapsedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid #f0c987',
    background: '#fff7ed',
    color: '#7c2d12',
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '600',
  },
  mobileLayoutRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 340px)',
    gap: '12px',
    marginTop: '12px',
    marginBottom: '12px',
  },
  printOptionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '12px',
    marginBottom: '12px',
    padding: '10px 12px',
    border: '1px solid #ead7bd',
    borderRadius: '10px',
    background: '#fffaf2',
  },
  fieldNotesPage: {
    width: '100%',
    maxWidth: '1320px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
    boxSizing: 'border-box',
  },
  quickDumpPage: {
    width: '100%',
    maxWidth: '760px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
    boxSizing: 'border-box',
  },
  quickDumpCard: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: 'clamp(16px, 4vw, 22px)',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.14)',
    borderTop: '4px solid #dd7a00',
  },
  quickDumpTitle: {
    margin: '0 0 6px 0',
    fontSize: 'clamp(23px, 7vw, 28px)',
    color: '#0f172a',
  },
  quickDumpTextArea: {
    width: '100%',
    minHeight: '170px',
    fontSize: 'clamp(17px, 5vw, 20px)',
    lineHeight: '1.35',
    padding: '16px',
    borderRadius: '14px',
    border: '1px solid #d8c7ad',
    boxSizing: 'border-box',
    outlineColor: '#dd7a00',
    background: '#fffdf8',
  },
  fieldNotesHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '14px',
    flexWrap: 'wrap',
  },
  fieldNotesHelper: {
    margin: '4px 0 14px 0',
    color: '#5b6472',
    fontSize: '14px',
    lineHeight: '1.45',
  },
  fieldNotesTextArea: {
    width: '100%',
    minHeight: '130px',
    fontSize: '17px',
    lineHeight: '1.4',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #d8c7ad',
    boxSizing: 'border-box',
    outlineColor: '#dd7a00',
    background: '#fffdf8',
  },
  fieldNotesActionRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  fieldNotesToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    margin: '12px 0 8px 0',
  },
  compactSelect: {
    border: '1px solid #d8c7ad',
    borderRadius: '8px',
    padding: '6px 8px',
    background: '#fffdf8',
    color: '#111827',
    fontSize: '12px',
  },
  inlineCheckLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    color: '#374151',
  },
  fieldNoteCountLine: {
    color: '#6b7280',
    fontSize: '12px',
    marginBottom: '12px',
  },
  fieldNotesSubTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    margin: '12px 0 16px 0',
    borderBottom: '1px solid #ead7bd',
    paddingBottom: '10px',
  },
  fieldNotesSubTab: {
    border: '1px solid #d8c7ad',
    background: '#fffdf8',
    color: '#374151',
    borderRadius: '999px',
    padding: '7px 11px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
  },
  fieldNotesSubTabActive: {
    border: '1px solid #dd7a00',
    background: '#dd7a00',
    color: '#ffffff',
    borderRadius: '999px',
    padding: '7px 11px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
  },
  fieldNotesTwoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  fieldNotesJobGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '14px',
    alignItems: 'start',
  },
  fieldNoteDateBlock: {
    marginBottom: '16px',
    padding: '10px',
    borderRadius: '12px',
    background: '#fffaf2',
    border: '1px solid #ead7bd',
  },
  fieldNoteDateTitle: {
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 8px 0',
    fontSize: '15px',
  },
  fieldNoteGroup: {
    marginTop: '18px',
  },
  fieldNoteGroupTitle: {
    margin: '0 0 10px 0',
    color: '#0f172a',
    fontSize: '17px',
    borderBottom: '1px solid #ead7bd',
    paddingBottom: '6px',
  },
  fieldNoteJobBlock: {
    marginBottom: '14px',
    padding: '10px',
    borderRadius: '12px',
    background: '#fffaf2',
    border: '1px solid #ead7bd',
  },
  fieldNoteJobTitle: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px',
  },
  fieldNoteCard: {
    padding: '12px',
    marginBottom: '10px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #ead7bd',
    boxShadow: '0 5px 12px rgba(15, 23, 42, 0.06)',
  },
  fieldNoteCardDone: {
    padding: '12px',
    marginBottom: '10px',
    borderRadius: '12px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    opacity: 0.72,
  },
  fieldNoteTopLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  fieldNoteCheckbox: {
    marginTop: '3px',
  },
  fieldNoteStar: {
    color: '#dd7a00',
    fontWeight: '900',
  },
  fieldNoteEditArea: {
    width: '100%',
    minHeight: '96px',
    border: '1px solid #d8c8b4',
    borderRadius: '10px',
    padding: '10px 12px',
    background: '#fffdf9',
    fontSize: '15px',
    lineHeight: '1.4',
    color: '#111827',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  fieldNoteText: {
    fontSize: '15px',
    lineHeight: '1.4',
    color: '#1f2937',
    whiteSpace: 'pre-wrap',
    flex: 1,
  },
  fieldNoteTextDone: {
    fontSize: '15px',
    lineHeight: '1.4',
    color: '#6b7280',
    whiteSpace: 'pre-wrap',
    textDecoration: 'line-through',
    flex: 1,
  },
  fieldNoteMetaRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: '8px',
  },
  fieldNotePill: {
    background: '#f5ead8',
    color: '#7a3d00',
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '700',
  },
  fieldNoteDonePill: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '700',
  },
  fieldNotePinPill: {
    background: '#fff7ed',
    color: '#c2410c',
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '700',
  },
  fieldNoteDate: {
    color: '#6b7280',
    fontSize: '12px',
  },
  smallDangerButton: {
    marginTop: '8px',
    border: '1px solid #efb3b3',
    background: '#fff5f5',
    color: '#9b1c1c',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
  }


}
