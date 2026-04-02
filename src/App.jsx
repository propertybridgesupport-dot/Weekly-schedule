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

export default function App() {
  const initialWeekRange = getInitialWeekRange()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking login...')
  const [activeTab, setActiveTab] = useState('weekly')

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

  function applyWeekFromAnyDate(value) {
    if (!value) return
    const nextRange = getMondaySundayRange(new Date(`${value}T00:00:00`))
    setSelectedWeekFrom(nextRange.from)
    setSelectedWeekTo(nextRange.to)
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

  const selectedEmailGroup =
    emailGroups.find((g) => g.id === selectedEmailGroupId) || null

  async function signIn() {
    setMessage('Signing in...')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Signed in successfully.')
    }
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
    setMessage('Signed out.')
  }

  async function loadMasterData() {
    const [
      jobsResult,
      pmResult,
      superintendentResult,
      surveyorResult,
      foremanResult,
      emailGroupsResult,
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
    ])

    if (
      jobsResult.error ||
      pmResult.error ||
      superintendentResult.error ||
      surveyorResult.error ||
      foremanResult.error ||
      emailGroupsResult.error
    ) {
      console.error(
        jobsResult.error ||
          pmResult.error ||
          superintendentResult.error ||
          surveyorResult.error ||
          foremanResult.error ||
          emailGroupsResult.error
      )
      throw new Error('There was an error loading master data.')
    }

    setJobs(jobsResult.data || [])
    setProjectManagers(pmResult.data || [])
    setSuperintendents(superintendentResult.data || [])
    setSurveyors(surveyorResult.data || [])
    setForemen(foremanResult.data || [])
    setEmailGroups(emailGroupsResult.data || [])

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
      setMessage(err.message || 'There was an error loading your data.')
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
      alert('Enter job prefix, job number, and job name')
      return
    }

    if (!/^\d+$/.test(jobNumberPart2.trim())) {
      alert('The second part of the job number must be numbers only')
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
      alert(error.message)
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
      alert(error.message)
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
      alert('Enter a project manager name')
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
      alert(error.message)
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
      alert(error.message)
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
      alert('Enter a superintendent name')
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
      alert(error.message)
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
      alert(error.message)
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
      alert('Enter a surveyor name')
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
      alert(error.message)
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
      alert(error.message)
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
      alert('Enter a foreman name')
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
      alert(error.message)
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
      alert(error.message)
    } else {
      if (editingForemanId === id) resetForemanForm()
      loadAllData()
    }
  }

  async function addEmailGroup() {
    if (!newEmailGroupName.trim()) {
      alert('Enter an email group name')
      return
    }

    const { error } = await supabase.from('email_groups').insert({
      name: newEmailGroupName.trim(),
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setNewEmailGroupName('')
      loadAllData()
    }
  }

  async function addRecipient() {
    if (!recipientGroupId || !recipientEmail.trim()) {
      alert('Choose a group and enter an email')
      return
    }

    const { error } = await supabase.from('email_group_recipients').insert({
      email_group_id: recipientGroupId,
      name: recipientName.trim() || null,
      email: recipientEmail.trim(),
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setRecipientName('')
      setRecipientEmail('')
      loadAllData()
    }
  }

  async function deleteEmailGroup(id) {
    const confirmed = window.confirm('Delete this email group?')
    if (!confirmed) return

    const { error } = await supabase.from('email_groups').delete().eq('id', id)

    if (error) {
      alert(error.message)
    } else {
      if (selectedEmailGroupId === id) setSelectedEmailGroupId('')
      if (recipientGroupId === id) setRecipientGroupId('')
      loadAllData()
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
      alert(error.message)
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
      alert(error.message)
    } else {
      if (editingScheduleItemId === id) resetScheduleForm()
      loadAllData()
    }
  }

  async function saveScheduleItem() {
    if (!scheduleForm.job_id) {
      alert('Please select a job')
      return
    }

    if (!selectedWeekFrom || !selectedWeekTo) {
      alert('Please choose the week first on the Weekly Schedule tab')
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
      alert(scheduleError.message)
      setMessage('Error saving schedule item.')
      return
    }

    if (editingScheduleItemId) {
      const { error: deleteAssignmentsError } = await supabase
        .from('schedule_item_foremen')
        .delete()
        .eq('schedule_item_id', editingScheduleItemId)

      if (deleteAssignmentsError) {
        alert(deleteAssignmentsError.message)
        return
      }

      const { error: deleteSurveyorAssignmentsError } = await supabase
        .from('schedule_item_surveyors')
        .delete()
        .eq('schedule_item_id', editingScheduleItemId)

      if (deleteSurveyorAssignmentsError) {
        alert(deleteSurveyorAssignmentsError.message)
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
        alert(foremanError.message)
        setMessage('Schedule saved, but foreman assignments had an error.')
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
        alert(surveyorError.message)
        setMessage('Schedule saved, but surveyor assignments had an error.')
        return
      }
    }

    setMessage(
      editingScheduleItemId
        ? 'Schedule item updated successfully.'
        : 'Schedule item saved successfully.'
    )
    resetScheduleForm()
    await loadAllData()
    setActiveTab('weekly')
  }

  function emailSchedule(group) {
    if (!group || !group.email_group_recipients?.length) {
      alert('This email group has no recipients.')
      return
    }

    const recipients = group.email_group_recipients
      .filter((r) => r.active !== false && r.email)
      .map((r) => r.email)

    if (!recipients.length) {
      alert('This email group has no active recipients.')
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
            <div style={styles.gridChipText}>{assignment.note || 'No note'}</div>
          </div>
        ))}
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

          <button onClick={signIn} style={styles.button}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <style>{`
        @page {
          size: portrait;
          margin: 0.18in;
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
            max-width: 100% !important;
            margin: 0 !important;
          }

          .print-paper {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .print-report-list {
            gap: 0 !important;
            padding-top: 16px !important;
          }

          .print-report-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding-top: 0 !important;
            padding-bottom: 8px !important;
            margin-bottom: 0 !important;
          }

          .print-job-divider {
            border-top: 1px solid #cfd6de !important;
            margin: 12px 0 10px !important;
            break-after: auto !important;
          }
        }
      `}</style>
      <div style={styles.headerCard} className="no-print">
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Weekly Schedule App</h1>
            <p style={styles.text}>{message}</p>
          </div>

          <div style={styles.topBarButtons}>
            <button
              onClick={() => setActiveTab('weekly')}
              style={activeTab === 'weekly' ? styles.button : styles.buttonSecondary}
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => setActiveTab('grid')}
              style={activeTab === 'grid' ? styles.button : styles.buttonSecondary}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setActiveTab('print')}
              style={activeTab === 'print' ? styles.button : styles.buttonSecondary}
            >
              Print / PDF
            </button>
            <button
              onClick={() => setActiveTab('master')}
              style={activeTab === 'master' ? styles.button : styles.buttonSecondary}
            >
              Master Data
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              style={activeTab === 'schedule' ? styles.button : styles.buttonSecondary}
            >
              Schedule Entry
            </button>
            <button onClick={loadAllData} style={styles.buttonSecondary}>
              Reload Data
            </button>
            <button onClick={signOut} style={styles.buttonSecondary}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

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

          <SectionCard title="Email Groups">
            <label style={styles.label}>New Email Group</label>
            <input
              placeholder="Group Name"
              value={newEmailGroupName}
              onChange={(e) => setNewEmailGroupName(e.target.value)}
              style={styles.input}
            />
            <button onClick={addEmailGroup} style={styles.button}>
              Add Email Group
            </button>

            <label style={styles.label}>Add Recipient To</label>
            <select
              value={recipientGroupId}
              onChange={(e) => setRecipientGroupId(e.target.value)}
              style={styles.select}
            >
              <option value="">Select Group</option>
              {emailGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Recipient Name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              style={styles.input}
            />

            <input
              placeholder="Recipient Email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              style={styles.input}
            />

            <button onClick={addRecipient} style={styles.button}>
              Add Recipient
            </button>

            <div style={styles.listWrap}>
              {emailGroups.map((group) => (
                <div key={group.id} style={styles.emailGroupBlock}>
                  <div style={styles.emailGroupHeader}>
                    <strong>{group.name}</strong>
                    <button
                      onClick={() => deleteEmailGroup(group.id)}
                      style={styles.smallDangerButton}
                    >
                      Delete Group
                    </button>
                  </div>

                  {(group.email_group_recipients || []).length ? (
                    group.email_group_recipients.map((recipient) => (
                      <div key={recipient.id} style={styles.listItem}>
                        <div>
                          {recipient.name || 'No Name'} — {recipient.email}
                        </div>
                        <div style={styles.itemButtonRow}>
                          <button
                            onClick={() => deleteRecipient(recipient.id)}
                            style={styles.smallDangerButton}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={styles.smallText}>No recipients yet.</div>
                  )}
                </div>
              ))}
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
              <button onClick={saveScheduleItem} style={styles.button}>
                {editingScheduleItemId
                  ? 'Update Schedule Item'
                  : 'Save Schedule Item'}
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
              <button onClick={loadAllData} style={styles.buttonSecondary}>
                Refresh Schedule
              </button>
            </div>

            <div style={styles.weekSelectorRow}>
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

            {scheduleItems.filter(
  (item) =>
    (item.schedule_item_foremen && item.schedule_item_foremen.length > 0) ||
    (item.schedule_item_surveyors && item.schedule_item_surveyors.length > 0)
).length === 0 ? (
  <p style={styles.text}>No jobs with foreman or surveyor assignments yet.</p>
) : (
              <div style={styles.scheduleList}>
                {filteredScheduleItems.map((item) => (
                  <div key={item.id} style={styles.scheduleCard}>
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
              <button onClick={loadAllData} style={styles.buttonSecondary}>
                Refresh Grid
              </button>
            </div>

            {scheduleItems.length === 0 ? (
              <p style={styles.text}>No schedule items saved yet.</p>
            ) : (
              <div style={styles.gridBoard}>
                <div style={styles.gridHeaderCell}>Job</div>
                {WEEKDAY_KEYS.map((dayKey) => (
                  <div key={dayKey} style={styles.gridHeaderCell}>
                    {WEEKDAY_LABELS[dayKey]}
                  </div>
                ))}

          {scheduleItems
  .filter(
    (item) =>
      (item.schedule_item_foremen && item.schedule_item_foremen.length > 0) ||
      (item.schedule_item_surveyors && item.schedule_item_surveyors.length > 0)
  )
  .map((item) => (
    <React.Fragment key={item.id}>
                    <div style={styles.gridJobCell}>
                      <div style={styles.gridJobTitle}>
                        {item.jobs?.job_number || '—'}
                      </div>
                      <div style={styles.gridJobSubTitle}>
                        {item.jobs?.job_name || 'No Job Name'}
                      </div>
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

      {activeTab === 'print' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.printPageWrap} className="print-page-wrap">
<div style={styles.assignmentHeader} className="no-print">
  <h2 style={styles.sectionTitle}>Print / PDF View</h2>

  <div style={styles.topBarButtons}>
    <button onClick={() => window.print()} style={styles.button}>
      Print / Save PDF
    </button>

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
            <div style={styles.reportPaper} className="print-paper">
              <div style={styles.reportHeader}>
                <div style={styles.reportHeaderTopBorder} />
                <div style={styles.reportHeaderTop}>
                  <div style={styles.reportTitleBlock}>
                    <div style={styles.reportTitle}>WEEKLY SCHEDULE</div>
                    <div style={styles.reportDate}>
                      {selectedWeekFrom && selectedWeekTo
                        ? `Week of ${formatLongDate(selectedWeekFrom)} – ${formatLongDate(selectedWeekTo)}`
                        : ''}
                    </div>
                  </div>
                  <img
                    src="/command-logo.png"
                    alt="Command Industries Logo"
                    style={styles.reportLogo}
                  />
                </div>
                <div style={styles.reportDivider} />
              </div>

{filteredScheduleItems.length === 0 ? (
                <p style={styles.text}>No schedule items saved yet.</p>
              ) : (
                <div style={styles.printReportList} className="print-report-list">
                  {filteredScheduleItems.map((item, index) => (
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
                      {index !== filteredScheduleItems.length - 1 ? (
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
    background: '#f3f4f6',
    padding: '30px 20px',
    fontFamily: 'Arial, sans-serif',
  },
  headerCard: {
    maxWidth: '1200px',
    margin: '0 auto 20px auto',
    background: '#ffffff',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
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
    maxWidth: '1100px',
    margin: '0 auto',
  },
  reportPaper: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '18px 18px 14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.035)',
  },
  printReportList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    paddingTop: '22px',
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
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  assignmentCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    background: '#fafafa',
  },
  scheduleCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '16px',
    background: '#fafafa',
  },
  foremanViewCard: {
    border: '1px solid #e5e7eb',
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  topBarButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
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
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    color: '#374151',
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
    width: '160px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    background: '#ffffff',
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
    background: '#111827',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  buttonSecondary: {
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
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
    border: '1px solid #e5e7eb',
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
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  select: {
    display: 'block',
    width: '100%',
    marginBottom: '18px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    background: '#ffffff',
  },
  textarea: {
    display: 'block',
    width: '100%',
    minHeight: '90px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
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
    background: '#111827',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '12px',
    fontWeight: 'bold',
    minHeight: '48px',
  },
  gridJobCell: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
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
  gridDayCell: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '10px',
    minHeight: '140px',
  },
  gridChipStack: {
    display: 'grid',
    gap: '8px',
  },
  gridForemanChip: {
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '10px',
    padding: '8px',
  },
  gridSurveyorChip: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '10px',
    padding: '8px',
  },
  gridChipTitle: {
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#111827',
    marginBottom: '4px',
  },
  gridChipText: {
    fontSize: '12px',
    color: '#374151',
  },
  gridChipSubText: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px',
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
    marginBottom: '14px',
  },
  reportHeaderTopBorder: {
    borderTop: '1px solid #c7cdd4',
    marginBottom: '10px',
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
  reportLogo: {
    height: '44px',
    width: '148px',
    objectFit: 'contain',
    objectPosition: 'right center',
    flexShrink: 0,
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
}
