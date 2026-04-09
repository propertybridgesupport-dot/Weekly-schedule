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

function buildMobileShareSnapshot(items, selectedWeekFrom, selectedWeekTo) {
  const payload = {
    weekFrom: selectedWeekFrom,
    weekTo: selectedWeekTo,
    createdAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: item.id,
      jobNumber: item.jobs?.job_number || '—',
      jobName: item.jobs?.job_name || 'No Job Name',
      projectManager: item.project_managers?.name || '—',
      superintendent: item.superintendents?.name || '—',
      surveyor: item.surveyors?.name || '—',
      notes: item.notes || '',
      foremen: (item.schedule_item_foremen || []).map((assignment) => ({
        id: assignment.id,
        name: assignment.foremen?.name || '—',
        fromDate: assignment.assignment_from_date || '',
        toDate: assignment.assignment_to_date || '',
        work: assignment.work_description || '',
        splitNote: assignment.split_note || '',
      })),
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
  const isMobileShareMode = Boolean(searchParams?.get('mobileShare') === '1' && mobileShareSnapshot)
  const isViewerMode = Boolean(searchParams?.get('viewer') === '1')
  const viewerWeekFromParam = searchParams?.get('weekFrom') || ''
  const viewerWeekToParam = searchParams?.get('weekTo') || ''

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking login...')
  const [activeTab, setActiveTab] = useState('weekly')
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

  const [jobs, setJobs] = useState([])
  const [projectManagers, setProjectManagers] = useState([])
  const [superintendents, setSuperintendents] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [foremen, setForemen] = useState([])
  const [scheduleItems, setScheduleItems] = useState([])
  const [emailGroups, setEmailGroups] = useState([])
  const [selectedEmailGroupId, setSelectedEmailGroupId] = useState('')
const [reportNotes, setReportNotes] = useState('')
  const [selectedWeekFrom, setSelectedWeekFrom] = useState(initialWeekRange.from)
  const [selectedWeekTo, setSelectedWeekTo] = useState(initialWeekRange.to)
  const [notesStyle, setNotesStyle] = useState('accent')

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
const [printLayout, setPrintLayout] = useState('report')
  const [editingScheduleItemId, setEditingScheduleItemId] = useState(null)

  const [scheduleForm, setScheduleForm] = useState({
    from_date: '',
    to_date: '',
    job_id: '',
    project_manager_id: '',
    superintendent_id: '',
    surveyor_id: '',
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

  function applyWeekFromAnyDate(value) {
    if (!value) return
    const nextRange = getMondaySundayRange(new Date(`${value}T00:00:00`))
    setSelectedWeekFrom(nextRange.from)
    setSelectedWeekTo(nextRange.to)
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

  const filteredScheduleItems = useMemo(() => {
    return scheduleItems
  }, [scheduleItems])

  const weekScheduleItems = useMemo(() => {
    return scheduleItems.filter((item) => {
      return (
        !selectedWeekFrom ||
        !selectedWeekTo ||
        (item.from_date === selectedWeekFrom && item.to_date === selectedWeekTo)
      )
    })
  }, [scheduleItems, selectedWeekFrom, selectedWeekTo])

  const gridScheduleItems = useMemo(() => {
    return weekScheduleItems.filter((item) => {
      const hasJobNote = Boolean((item.notes || '').trim())
      const hasForemanAssignments = Boolean(item.schedule_item_foremen?.length)
      const hasSurveyorAssignments = Boolean(item.schedule_item_surveyors?.length)

      return hasJobNote || hasForemanAssignments || hasSurveyorAssignments
    })
  }, [weekScheduleItems])
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

  function createMobileShareUrl() {
    return createSnapshotShareUrl()
  }

  function createAuthenticatedViewerUrl() {
    if (typeof window === 'undefined') return ''
    if (!selectedWeekFrom || !selectedWeekTo) return ''
    const base = `${window.location.origin}${window.location.pathname}`
    const params = new URLSearchParams({
      viewer: '1',
      weekFrom: selectedWeekFrom,
      weekTo: selectedWeekTo,
    })
    return `${base}?${params.toString()}`
  }

  function createSnapshotShareUrl() {
    if (typeof window === 'undefined') return ''
    const snapshot = buildMobileShareSnapshot(gridScheduleItems, selectedWeekFrom, selectedWeekTo)
    if (!snapshot) return ''
    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}?mobileShare=1&snapshot=${snapshot}`
  }

  async function copyMobileShareLink() {
    const url = createMobileShareUrl()
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

  function openMobileShareView() {
    const url = createMobileShareUrl()
    if (!url) {
      showError('Could not create mobile share link.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function copyMobileSmsMessage() {
    const url = createMobileShareUrl()
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

  async function loadAllData() {
    setLoading(true)
    setMessage('Loading data from Supabase...')

    try {
      await Promise.all([loadMasterData(), loadScheduleItems()])
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
    setScheduleForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function updateForemanAssignment(localId, field, value) {
    setForemanAssignments((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    )
  }

  function addForemanAssignmentRow() {
    setForemanAssignments((prev) => [...prev, emptyForemanAssignment()])
  }

  function removeForemanAssignmentRow(localId) {
    setForemanAssignments((prev) => {
      const updated = prev.filter((item) => item.localId !== localId)
      return updated.length ? updated : [emptyForemanAssignment()]
    })
  }

  function updateSurveyorAssignment(localId, field, value) {
    setSurveyorAssignments((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    )
  }

  function addSurveyorAssignmentRow() {
    setSurveyorAssignments((prev) => [...prev, emptySurveyorAssignment()])
  }

  function removeSurveyorAssignmentRow(localId) {
    setSurveyorAssignments((prev) => {
      const updated = prev.filter((item) => item.localId !== localId)
      return updated.length ? updated : [emptySurveyorAssignment()]
    })
  }

  function resetScheduleForm() {
    setEditingScheduleItemId(null)
    setScheduleForm({
      from_date: '',
      to_date: '',
      job_id: '',
      project_manager_id: '',
      superintendent_id: '',
      surveyor_id: '',
      notes: '',
    })
    setForemanAssignments([emptyForemanAssignment()])
    setSurveyorAssignments([emptySurveyorAssignment()])
  }

  function editScheduleItem(item) {
    setReturnToScrollY(window.scrollY)
    setReturnToItemId(item.id)
    setEditingScheduleItemId(item.id)
    setSelectedWeekFrom(item.from_date || '')
    setSelectedWeekTo(item.to_date || '')
    setScheduleForm({
      from_date: item.from_date || '',
      to_date: item.to_date || '',
      job_id: item.job_id || '',
      project_manager_id: item.project_manager_id || '',
      superintendent_id: item.superintendent_id || '',
      surveyor_id: item.surveyor_id || '',
      notes: item.notes || '',
    })

    if (item.schedule_item_foremen?.length) {
      setForemanAssignments(
        item.schedule_item_foremen.map((assignment) => ({
          localId: crypto.randomUUID(),
          id: assignment.id,
          foreman_id: assignment.foreman_id || '',
          assignment_from_date: assignment.assignment_from_date || '',
          assignment_to_date: assignment.assignment_to_date || '',
          work_description: assignment.work_description || '',
          split_note: assignment.split_note || '',
        }))
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

    setActiveTab('schedule')
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

    const payload = {
      from_date: selectedWeekFrom,
      to_date: selectedWeekTo,
      job_id: scheduleForm.job_id,
      project_manager_id: scheduleForm.project_manager_id || null,
      superintendent_id: scheduleForm.superintendent_id || null,
      surveyor_id: scheduleForm.surveyor_id || null,
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
        item.split_note
      )
    })

    if (cleanedForemanAssignments.length > 0) {
      const rowsToInsert = cleanedForemanAssignments.map((item) => ({
        schedule_item_id: scheduleItem.id,
        foreman_id: item.foreman_id || null,
        assignment_from_date: item.assignment_from_date || null,
        assignment_to_date: item.assignment_to_date || null,
        work_description: item.work_description || null,
        split_note: item.split_note || null,
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
            superintendent_id: item.superintendent_id || null,
            surveyor_id: item.surveyor_id || null,
            notes: item.notes || null,
          })
          .select()
          .single()

        if (newItemError) throw newItemError

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

  function emailSchedule(group) {
    if (!group || !group.email_group_recipients?.length) {
      showError('This email group has no recipients.')
      return
    }

    const recipients = group.email_group_recipients
      .filter((r) => r.active !== false && r.email)
      .map((r) => r.email)

    if (!recipients.length) {
      showError('This email group has no active recipients.')
      return
    }

    const subject = encodeURIComponent(`Weekly Schedule PDF - ${group.name}`)
    const body = encodeURIComponent(
      'Please find the weekly schedule attached. Use the Print / PDF button in the app first to save the PDF, then attach it to this email.'
    )

    window.location.href = `mailto:${recipients.join(',')}?subject=${subject}&body=${body}`
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

  function buildSmsMessageText() {
    return `${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)} ${createMobileShareUrl()}`
  }

  function openSmsApp(phoneNumbers = []) {
    const cleanedNumbers = phoneNumbers
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    if (!cleanedNumbers.length) {
      showError('Add at least one mobile contact first.')
      return
    }

    const url = createMobileShareUrl()
    if (!url) {
      showError('Could not create mobile share link.')
      return
    }

    const body = encodeURIComponent(buildSmsMessageText())
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

  function sendMobileTextToAll() {
    openSmsApp(contacts.map((contact) => contact.phone).filter(Boolean))
  }

  function sendTextToGroup(groupId) {
    openSmsApp(getPhonesForGroup(groupId))
  }

  function sendMobileTextToContact(contact) {
    openSmsApp([contact.phone])
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
                    <span>{item.projectManager ?? item.project_managers?.name ?? '—'}</span>
                  </div>
                  <div style={styles.mobileReadonlyMetaItem}>
                    <span style={styles.mobileReadonlyMetaLabel}>Super:</span>
                    <span>{item.superintendent ?? item.superintendents?.name ?? '—'}</span>
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
                          {(assignment.name ?? assignment.foremen?.name) || '—'}
                        </div>
                        <div style={styles.mobileReadonlyAssignmentLine}>
                          {formatDate(assignment.fromDate ?? assignment.assignment_from_date)} to {formatDate(assignment.toDate ?? assignment.assignment_to_date)}
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
                        {(assignment.splitNote ?? assignment.split_note) ? (
                          <div style={styles.mobileReadonlyAssignmentLine}>
                            <strong>Note:</strong> {assignment.splitNote ?? assignment.split_note}
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

          {renderReadonlyScheduleCards(weekScheduleItems, { compact: true })}
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

          {renderReadonlyScheduleCards(mobileShareSnapshot.items || [], { compact: true })}
        </div>
      </div>
    )
  }

  if (loading && !session) {
    return (
      <div style={styles.page} className="print-root">
        <div style={styles.card}>
          <h1 style={styles.title}>Weekly Schedule App</h1>
          <p style={styles.text}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={styles.title}>Weekly Schedule App Login</h1>
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

  return (
    <div style={styles.page}>
<style>{`
  @page {
    size: ${printLayout === 'grid' ? 'landscape' : 'portrait'};
    margin: ${printLayout === 'grid' ? '0.12in' : '0.18in'};
  }

  .nav-button {
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .nav-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.18);
    border-color: #dd7a00 !important;
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
      padding: ${printLayout === 'grid' ? '0.14in 0.16in 0.12in' : '0.14in 0.18in 0.12in'} !important;
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
              <h1 style={styles.title}>Weekly Schedule App</h1>
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

          <div style={styles.topBarButtons}>
            <button
              className="nav-button"
              onClick={() => setActiveTab('weekly')}
              style={activeTab === 'weekly' ? styles.button : styles.buttonSecondary}
            >
              Weekly Schedule
            </button>
            <button
              className="nav-button"
              onClick={() => setActiveTab('grid')}
              style={activeTab === 'grid' ? styles.button : styles.buttonSecondary}
            >
              Weekly Grid
            </button>
            <button
              className="nav-button"
              onClick={() => setActiveTab('mobile')}
              style={activeTab === 'mobile' ? styles.button : styles.buttonSecondary}
            >
              Mobile View
            </button>
            <button
              className="nav-button"
              onClick={() => setActiveTab('print')}
              style={activeTab === 'print' ? styles.button : styles.buttonSecondary}
            >
              Print / PDF
            </button>
            <button
              className="nav-button"
              onClick={() => setActiveTab('master')}
              style={activeTab === 'master' ? styles.button : styles.buttonSecondary}
            >
              Master Data
            </button>
            <button
              className="nav-button"
              onClick={() => setActiveTab('schedule')}
              style={activeTab === 'schedule' ? styles.button : styles.buttonSecondary}
            >
              Schedule Entry
            </button>
            <button className="nav-button" onClick={loadAllData} disabled={loading} style={loading ? styles.buttonDisabledSecondary : styles.buttonSecondary}>
              {loading ? 'Refreshing...' : 'Reload Data'}
            </button>
            <button className="nav-button" onClick={signOut} style={styles.buttonSecondary}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {banner ? (
        <div style={banner.type === 'success' ? styles.bannerSuccess : styles.bannerError} className="no-print">
          <div>{banner.text}</div>
          <button onClick={() => setBanner(null)} style={styles.bannerCloseButton}>Dismiss</button>
        </div>
      ) : null}

      {activeTab === 'master' && (
        <div style={styles.grid}>
          <SectionCard title="Jobs">
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

          <SectionCard title="Project Managers">
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

          <SectionCard title="Superintendents">
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

          <SectionCard title="Surveyors">
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

          <SectionCard title="Foremen">
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


          <SectionCard title="Contacts">
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

          <SectionCard title="Text Groups">
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
              <button onClick={sendMobileTextToAll} style={styles.buttonSecondary}>
                Text All Contacts
              </button>
            </div>

            <div style={styles.listWrap}>
              {contactGroups.length === 0 ? (
                <div style={styles.smallText}>No text groups saved yet.</div>
              ) : (
                contactGroups.map((group) => (
                  <div key={group.id} style={styles.emailGroupBlock}>
                    <div style={styles.emailGroupHeader}>
                      <strong>{group.name}</strong>
                      <div style={styles.itemButtonRow}>
                        <button onClick={() => sendTextToGroup(group.id)} style={styles.smallButton}>
                          Text Group
                        </button>
                        <button onClick={() => renameContactGroup(group)} style={styles.smallButton}>
                          Edit
                        </button>
                        <button onClick={() => deleteContactGroup(group.id)} style={styles.smallDangerButton}>
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
                          const checked = (group.contact_group_memberships || []).some(
                            (membership) => membership.contact_id === contact.id
                          )
                          return (
                            <label key={`${group.id}-${contact.id}`} style={styles.contactCheckboxRow}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleContactInGroup(group.id, contact.id)}
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
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Email Groups">
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

            <div style={styles.listWrap}>
              {emailGroups.length === 0 ? (
                <div style={styles.smallText}>No email groups saved yet.</div>
              ) : (
                emailGroups.map((group) => (
                  <div key={group.id} style={styles.emailGroupBlock}>
                    <div style={styles.emailGroupHeader}>
                      <strong>{group.name}</strong>
                      <div style={styles.itemButtonRow}>
                        <button onClick={() => emailSchedule(group)} style={styles.smallButton}>
                          Email Group
                        </button>
                        <button onClick={() => renameEmailGroup(group)} style={styles.smallButton}>
                          Edit
                        </button>
                        <button onClick={() => deleteEmailGroup(group.id)} style={styles.smallDangerButton}>
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
                          const checked = contactIsInEmailGroup(group, contact)
                          return (
                            <label key={`${group.id}-${contact.id}`} style={styles.contactCheckboxRow}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleContactInEmailGroup(group.id, contact)}
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
                ))
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>
              {editingScheduleItemId ? 'Edit Schedule Entry' : 'Schedule Entry'}
            </h2>

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
                <label style={styles.label}>Project Manager (optional)</label>
                <select
                  value={scheduleForm.project_manager_id}
                  onChange={(e) =>
                    updateScheduleForm('project_manager_id', e.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">None</option>
                  {projectManagers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Superintendent (optional)</label>
                <select
                  value={scheduleForm.superintendent_id}
                  onChange={(e) =>
                    updateScheduleForm('superintendent_id', e.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">None</option>
                  {superintendents.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
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
                style={styles.textarea}
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
                  <strong>Foreman Assignment {index + 1}</strong>
                  <button
                    onClick={() => removeForemanAssignmentRow(assignment.localId)}
                    style={styles.buttonDanger}
                  >
                    Remove
                  </button>
                </div>

                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Foreman</label>
                    <select
                      value={assignment.foreman_id}
                      onChange={(e) =>
                        updateForemanAssignment(
                          assignment.localId,
                          'foreman_id',
                          e.target.value
                        )
                      }
                      style={styles.select}
                    >
                      <option value="">Select Foreman</option>
                      {foremen.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>

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

                  <div>
                    <label style={styles.label}>Split / Partial-Week Note</label>
                    <input
                      type="text"
                      value={assignment.split_note}
                      onChange={(e) =>
                        updateForemanAssignment(
                          assignment.localId,
                          'split_note',
                          e.target.value
                        )
                      }
                      style={styles.input}
                      placeholder="Half week here, then another job..."
                    />
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
                    style={styles.textarea}
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
                    style={styles.textarea}
                    placeholder="What does the surveyor need to do?"
                  />
                </div>
              </div>
            ))}

            <div style={styles.bottomButtons}>
              <button onClick={saveScheduleItem} disabled={isActionBusy('saveSchedule')} style={isActionBusy('saveSchedule') ? styles.buttonDisabled : styles.button}>
                {isActionBusy('saveSchedule') ? (editingScheduleItemId ? 'Updating...' : 'Saving...') : (editingScheduleItemId ? 'Update Schedule Item' : 'Save Schedule Item')}
              </button>
              <button onClick={resetScheduleForm} style={styles.buttonSecondary}>
                Clear Form
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
                <button onClick={loadAllData} disabled={loading} style={loading ? styles.buttonDisabledSecondary : styles.buttonSecondary}>
                  {loading ? 'Refreshing...' : 'Refresh Schedule'}
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

            {filteredScheduleItems.length === 0 ? (
              <p style={styles.text}>No jobs with notes or assignments for this week.</p>
            ) : (
              <div style={styles.scheduleList}>
                {weekScheduleItems.map((item) => (
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
                      </div>

                      <div style={styles.itemButtonRow}>
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

                    <div style={styles.metaGrid}>
                      <div>
                        <strong>PM:</strong> {item.project_managers?.name || '—'}
                      </div>
                      <div>
                        <strong>Superintendent:</strong>{' '}
                        {item.superintendents?.name || '—'}
                      </div>
                      <div>
                        <strong>Surveyor:</strong> {item.surveyors?.name || '—'}
                      </div>
                    </div>

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
                              {assignment.foremen?.name || '—'}
                            </div>
                            <div>
                              <strong>Dates:</strong>{' '}
                              {formatDate(assignment.assignment_from_date)} to{' '}
                              {formatDate(assignment.assignment_to_date)}
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
                            <div>
                              <strong>Split Note:</strong>{' '}
                              {assignment.split_note || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.text}>No foremen assigned yet.</p>
                    )}

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
                    ) : (
                      <p style={styles.text}>No surveyor assignments yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                  <div key={dayKey} style={styles.gridHeaderCell}>
                    {WEEKDAY_LABELS[dayKey]}
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
                      <div key={`${item.id}-${dayKey}`} style={styles.gridDayCell}>
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

            <div style={styles.mobileNoticeBox}>
              <strong>Sharing note:</strong> this opens the same branded schedule in a read-only view with no edit tabs. It is designed for employees to view from their phones without editing the schedule.
            </div>

            <div style={styles.mobileShareTools}>
              <div style={styles.mobileShareLinkBox}>
                {createMobileShareUrl() || 'Select a week first to generate a link.'}
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

                {renderReadonlyScheduleCards(weekScheduleItems, { compact: true })}
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
          <div style={styles.printPageWrap} className={`print-page-wrap ${printLayout === 'grid' ? 'print-grid-mode' : 'print-report-mode'}`}>
<div style={styles.assignmentHeader} className="no-print">
  <h2 style={styles.sectionTitle}>Print / PDF View</h2>

  <div style={styles.topBarButtons}>
    <button onClick={() => window.print()} style={styles.button}>
      Print / Save PDF
    </button>

    <select
      value={printLayout}
      onChange={(e) => setPrintLayout(e.target.value)}
      style={styles.jobPrefixSelect}
    >
      <option value="report">Report Layout</option>
      <option value="grid">Weekly Grid Layout</option>
    </select>

    <select
      value={notesStyle}
      onChange={(e) => setNotesStyle(e.target.value)}
      style={styles.jobPrefixSelect}
    >
      <option value="accent">Accent Style</option>
      <option value="box">Box Style</option>
    </select>

    <select
      value={selectedEmailGroupId}
      onChange={(e) => setSelectedEmailGroupId(e.target.value)}
      style={styles.jobPrefixSelect}
    >
      <option value="">Select Email Group</option>
      {emailGroups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>

    <button
      onClick={() => emailSchedule(selectedEmailGroup)}
      style={styles.buttonSecondary}
    >
      Email Selected Group
    </button>

    <button onClick={openMobileShareView} style={styles.buttonSecondary}>
      Open Mobile View
    </button>

    <button onClick={copyMobileShareLink} style={styles.buttonSecondary}>
      Copy Mobile Link
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
  <strong>How this works right now:</strong> click{' '}
  <em>Print / Save PDF</em> first, save the PDF, then click the email
  button to open your email app and attach the PDF.
</div>
            <div style={styles.printPreviewStage} className="print-preview-stage">
              <div style={printLayout === 'grid' ? styles.reportPaperGrid : styles.reportPaper} className="print-paper">
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
{printLayout === 'report' ? (
  <>
    {filteredScheduleItems.length === 0 ? (
      <p style={styles.text}>No schedule items saved yet.</p>
    ) : (
      <div style={styles.printReportList} className="print-report-list">
        {weekScheduleItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <div style={styles.printReportCard} className="print-report-card">
                        <div style={styles.printCompactJobTitle}>
                          {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
                        </div>

                        <div style={styles.printIndentedBlock}>
                          <div style={styles.printCompactMetaRow}>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>PM:</span>
                              <span>{item.project_managers?.name || '—'}</span>
                            </div>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>Super:</span>
                              <span>{item.superintendents?.name || '—'}</span>
                            </div>
                            <div style={styles.printMetaItem}>
                              <span style={styles.printMetaLabel}>Surveyor:</span>
                              <span>{item.surveyors?.name || '—'}</span>
                            </div>
                          </div>

                        {item.notes ? (
                          <div
                            style={
                              notesStyle === 'accent'
                                ? styles.printNotesAccent
                                : styles.printNotesBox
                            }
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
                                    <strong>{assignment.foremen?.name || '—'}</strong>
                                  </div>
                                  <div style={styles.printCompactInfoCol}>
                                    <div>
                                      <strong>Dates:</strong> {formatDate(assignment.assignment_from_date)} to {formatDate(assignment.assignment_to_date)}
                                    </div>
                                    <div style={styles.printCompactDaysLine}>
                                      {formatAssignmentWeekdays(
                                        assignment.assignment_from_date,
                                        assignment.assignment_to_date
                                      )}
                                    </div>
                                    {assignment.split_note ? (
                                      <div>
                                        <strong>Note:</strong> {assignment.split_note}
                                      </div>
                                    ) : null}
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
                        </div>
                      </div>
                      {index !== weekScheduleItems.length - 1 ? (
                        <div style={styles.jobDivider} className="print-job-divider" />
                      ) : null}
                    </React.Fragment>
                                 ))}
              </div>
            )}

            {reportNotes && (
  <div style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
    <div style={styles.printSectionHeader}>Report Notes</div>

    <div
      style={
        notesStyle === 'accent'
          ? styles.printNotesAccent
          : styles.printNotesBox
      }
    >
      <div>{reportNotes}</div>

      <div style={styles.reportNotesLine} />
      <div style={styles.reportNotesLine} />
      <div style={styles.reportNotesLine} />
      <div style={styles.reportNotesLine} />
    </div>
  </div>
              )}
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

            {gridScheduleItems.length === 0 ? (
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
                      <div key={dayKey} style={styles.printGridHeaderCell}>
                        {WEEKDAY_LABELS[dayKey]}
                      </div>
                    ))}

                    {gridScheduleItems.map((item) => (
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
                            style={styles.printGridDayCell}
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

function SectionCard({ title, children }) {
  return (
    <div style={styles.sectionCard}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
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
    background: '#fffdf8',
    borderRadius: '14px',
    padding: '20px',
    borderTop: '4px solid #dd7a00',
    borderLeft: '1px solid #ead7c2',
    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
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
  assignmentTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  bottomButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '14px',
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
    gap: '10px',
    alignItems: 'flex-start',
    padding: '8px 0',
    borderBottom: '1px solid #efe7db',
    fontSize: '14px',
  },
  emailGroupBlock: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '10px',
    marginBottom: '12px',
  },
  emailGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
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
    marginTop: '4px',
    fontSize: '13px',
    color: '#6b7280',
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
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
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
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '22px',
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
    background: '#dd7a00',
    color: '#ffffff',
    border: '1px solid #dd7a00',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(221,122,0,0.22)',
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
    background: '#c9732f',
    color: '#ffffff',
    border: 'none',
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
    background: '#c9732f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  input: {
    display: 'block',
    width: '100%',
    marginBottom: '18px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d9c7b1',
    background: '#fffdfa',
    boxSizing: 'border-box',
  },
  select: {
    display: 'block',
    width: '100%',
    marginBottom: '18px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d9c7b1',
    boxSizing: 'border-box',
    background: '#fffdfa',
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
  listWrap: {
    marginTop: '16px',
    maxHeight: '300px',
    overflowY: 'auto',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '12px',
  },
  listItem: {
    padding: '10px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
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

}
