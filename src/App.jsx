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

const GREG_AND_CHRISTIAN = [
  'greg@example.com',
  'christian@example.com',
]

const ALL_RECIPIENTS = [
  'greg@example.com',
  'christian@example.com',
  'pm@example.com',
  'super@example.com',
  'survey@example.com',
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking login...')
  const [activeTab, setActiveTab] = useState('master')

  const [jobs, setJobs] = useState([])
  const [projectManagers, setProjectManagers] = useState([])
  const [superintendents, setSuperintendents] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [foremen, setForemen] = useState([])
  const [scheduleItems, setScheduleItems] = useState([])

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

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aNum = extractJobNumberValue(a.job_number)
      const bNum = extractJobNumberValue(b.job_number)
      return aNum - bNum
    })
  }, [jobs])

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
    setMessage('Signed out.')
  }

  async function loadMasterData() {
    const [
      jobsResult,
      pmResult,
      superintendentResult,
      surveyorResult,
      foremanResult,
    ] = await Promise.all([
      supabase.from('jobs').select('*'),
      supabase.from('project_managers').select('*').order('name', { ascending: true }),
      supabase.from('superintendents').select('*').order('name', { ascending: true }),
      supabase.from('surveyors').select('*').order('name', { ascending: true }),
      supabase.from('foremen').select('*').order('name', { ascending: true }),
    ])

    if (
      jobsResult.error ||
      pmResult.error ||
      superintendentResult.error ||
      surveyorResult.error ||
      foremanResult.error
    ) {
      console.error(
        jobsResult.error ||
          pmResult.error ||
          superintendentResult.error ||
          surveyorResult.error ||
          foremanResult.error
      )
      throw new Error('There was an error loading master data.')
    }

    setJobs(jobsResult.data || [])
    setProjectManagers(pmResult.data || [])
    setSuperintendents(superintendentResult.data || [])
    setSurveyors(surveyorResult.data || [])
    setForemen(foremanResult.data || [])
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
      const result = await supabase.from('jobs').update(payload).eq('id', editingJobId)
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

    const { error } = await supabase.from('project_managers').delete().eq('id', id)

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

    const { error } = await supabase.from('superintendents').delete().eq('id', id)

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
  }

  function editScheduleItem(item) {
    setEditingScheduleItemId(item.id)
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

    if (!scheduleForm.from_date || !scheduleForm.to_date) {
      alert('Please enter both from date and to date')
      return
    }

    setMessage(editingScheduleItemId ? 'Updating schedule item...' : 'Saving schedule item...')

    const payload = {
      from_date: scheduleForm.from_date,
      to_date: scheduleForm.to_date,
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
    }

    const cleanedAssignments = foremanAssignments.filter((item) => {
      return (
        item.foreman_id ||
        item.assignment_from_date ||
        item.assignment_to_date ||
        item.work_description ||
        item.split_note
      )
    })

    if (cleanedAssignments.length > 0) {
      const rowsToInsert = cleanedAssignments.map((item) => ({
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

    setMessage(editingScheduleItemId ? 'Schedule item updated successfully.' : 'Schedule item saved successfully.')
    resetScheduleForm()
    await loadAllData()
    setActiveTab('weekly')
  }

  function emailSchedule(recipients) {
    const subject = encodeURIComponent('Weekly Schedule PDF')
    const body = encodeURIComponent(
      'Please find the weekly schedule attached. Use the Print / PDF button in the app first to save the PDF, then attach it to this email.'
    )
    window.location.href = `mailto:${recipients.join(',')}?subject=${subject}&body=${body}`
  }

  if (loading && !session) {
    return (
      <div style={styles.page}>
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
      <div style={styles.headerCard} className="no-print">
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Weekly Schedule App</h1>
            <p style={styles.text}>{message}</p>
          </div>

          <div style={styles.topBarButtons}>
            <button onClick={() => setActiveTab('master')} style={activeTab === 'master' ? styles.button : styles.buttonSecondary}>
              Master Data
            </button>
            <button onClick={() => setActiveTab('schedule')} style={activeTab === 'schedule' ? styles.button : styles.buttonSecondary}>
              Schedule Entry
            </button>
            <button onClick={() => setActiveTab('weekly')} style={activeTab === 'weekly' ? styles.button : styles.buttonSecondary}>
              Weekly Schedule
            </button>
            <button onClick={() => setActiveTab('print')} style={activeTab === 'print' ? styles.button : styles.buttonSecondary}>
              Print / PDF
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
             <select value={jobPrefix} onChange={(e) => setJobPrefix(e.target.value)} style={styles.jobPrefixSelect}>
  <option value="CC">CC</option>
  <option value="CCI">CCI</option>
  <option value="CCIS">CCIS</option>
</select>

              <div style={styles.jobDash}>-</div>

              <input
                placeholder="123"
                value={jobNumberPart2}
                onChange={(e) => setJobNumberPart2(e.target.value.replace(/\D/g, ''))}
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
                      Start: {formatDate(job.start_date)} | Stop: {formatDate(job.stop_date)}
                    </div>
                  </div>
                  <div style={styles.itemButtonRow}>
                    <button onClick={() => editJob(job)} style={styles.smallButton}>Edit</button>
                    <button onClick={() => deleteJob(job.id)} style={styles.smallDangerButton}>Delete</button>
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
                <button onClick={resetPmForm} style={styles.buttonSecondary}>Cancel Edit</button>
              )}
            </div>

            <div style={styles.listWrap}>
              {projectManagers.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button onClick={() => editProjectManager(person)} style={styles.smallButton}>Edit</button>
                    <button onClick={() => deleteProjectManager(person.id)} style={styles.smallDangerButton}>Delete</button>
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
                {editingSuperintendentId ? 'Update Superintendent' : 'Add Superintendent'}
              </button>
              {editingSuperintendentId && (
                <button onClick={resetSuperintendentForm} style={styles.buttonSecondary}>Cancel Edit</button>
              )}
            </div>

            <div style={styles.listWrap}>
              {superintendents.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button onClick={() => editSuperintendent(person)} style={styles.smallButton}>Edit</button>
                    <button onClick={() => deleteSuperintendent(person.id)} style={styles.smallDangerButton}>Delete</button>
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
                <button onClick={resetSurveyorForm} style={styles.buttonSecondary}>Cancel Edit</button>
              )}
            </div>

            <div style={styles.listWrap}>
              {surveyors.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button onClick={() => editSurveyor(person)} style={styles.smallButton}>Edit</button>
                    <button onClick={() => deleteSurveyor(person.id)} style={styles.smallDangerButton}>Delete</button>
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
                <button onClick={resetForemanForm} style={styles.buttonSecondary}>Cancel Edit</button>
              )}
            </div>

            <div style={styles.listWrap}>
              {foremen.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  <div>{person.name}</div>
                  <div style={styles.itemButtonRow}>
                    <button onClick={() => editForeman(person)} style={styles.smallButton}>Edit</button>
                    <button onClick={() => deleteForeman(person.id)} style={styles.smallDangerButton}>Delete</button>
                  </div>
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
                <label style={styles.label}>From Date</label>
                <input
                  type="date"
                  value={scheduleForm.from_date}
                  onChange={(e) => updateScheduleForm('from_date', e.target.value)}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>To Date</label>
                <input
                  type="date"
                  value={scheduleForm.to_date}
                  onChange={(e) => updateScheduleForm('to_date', e.target.value)}
                  style={styles.input}
                />
              </div>

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
                  onChange={(e) => updateScheduleForm('project_manager_id', e.target.value)}
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
                  onChange={(e) => updateScheduleForm('superintendent_id', e.target.value)}
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
                  onChange={(e) => updateScheduleForm('surveyor_id', e.target.value)}
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
                        updateForemanAssignment(assignment.localId, 'foreman_id', e.target.value)
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
                        updateForemanAssignment(assignment.localId, 'assignment_from_date', e.target.value)
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
                        updateForemanAssignment(assignment.localId, 'assignment_to_date', e.target.value)
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
                        updateForemanAssignment(assignment.localId, 'split_note', e.target.value)
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
                      updateForemanAssignment(assignment.localId, 'work_description', e.target.value)
                    }
                    style={styles.textarea}
                    placeholder="What is this foreman doing on this job?"
                  />
                </div>
              </div>
            ))}

            <div style={styles.bottomButtons}>
              <button onClick={saveScheduleItem} style={styles.button}>
                {editingScheduleItemId ? 'Update Schedule Item' : 'Save Schedule Item'}
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

            {scheduleItems.length === 0 ? (
              <p style={styles.text}>No schedule items saved yet.</p>
            ) : (
              <div style={styles.scheduleList}>
                {scheduleItems.map((item) => (
                  <div key={item.id} style={styles.scheduleCard}>
                    <div style={styles.scheduleHeader}>
                      <div>
                        <div style={styles.scheduleJobTitle}>
                          {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
                        </div>
                        <div style={styles.scheduleDates}>
                          {formatDate(item.from_date)} to {formatDate(item.to_date)}
                        </div>
                        <div style={styles.smallText}>
                          Job Start: {formatDate(item.jobs?.start_date)} | Job Stop: {formatDate(item.jobs?.stop_date)}
                        </div>
                      </div>

                      <div style={styles.itemButtonRow}>
                        <button onClick={() => editScheduleItem(item)} style={styles.smallButton}>
                          Edit
                        </button>
                        <button onClick={() => deleteScheduleItem(item.id)} style={styles.smallDangerButton}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div style={styles.metaGrid}>
                      <div><strong>PM:</strong> {item.project_managers?.name || '—'}</div>
                      <div><strong>Superintendent:</strong> {item.superintendents?.name || '—'}</div>
                      <div><strong>Surveyor:</strong> {item.surveyors?.name || '—'}</div>
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
                            <div><strong>Foreman:</strong> {assignment.foremen?.name || '—'}</div>
                            <div>
                              <strong>Dates:</strong> {formatDate(assignment.assignment_from_date)} to {formatDate(assignment.assignment_to_date)}
                            </div>
                            <div>
                              <strong>Work:</strong> {assignment.work_description || '—'}
                            </div>
                            <div>
                              <strong>Split Note:</strong> {assignment.split_note || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.text}>No foremen assigned yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <div style={styles.assignmentHeader} className="no-print">
              <h2 style={styles.sectionTitle}>Print / PDF View</h2>
              <div style={styles.topBarButtons}>
                <button onClick={() => window.print()} style={styles.button}>
                  Print / Save PDF
                </button>
                <button onClick={() => emailSchedule(GREG_AND_CHRISTIAN)} style={styles.buttonSecondary}>
                  Email Greg + Christian
                </button>
                <button onClick={() => emailSchedule(ALL_RECIPIENTS)} style={styles.buttonSecondary}>
                  Email All
                </button>
              </div>
            </div>

            <div style={styles.emailNoteBox} className="no-print">
              <strong>How this works right now:</strong> click <em>Print / Save PDF</em> first, save the PDF, then click one of the email buttons to open your email app and attach the PDF.
            </div>

            <div style={styles.printHeader}>
              <h1 style={styles.printTitle}>Weekly Schedule</h1>
              <p style={styles.printSubtitle}>
                Printable version of saved schedule items
              </p>
            </div>

            {scheduleItems.length === 0 ? (
              <p style={styles.text}>No schedule items saved yet.</p>
            ) : (
              <div style={styles.scheduleList}>
                {scheduleItems.map((item) => (
                  <div key={item.id} style={styles.printCard}>
                    <div style={styles.printJobTitle}>
                      {item.jobs?.job_number || '—'} — {item.jobs?.job_name || 'No Job Name'}
                    </div>

                    <div style={styles.printLine}>
                      <strong>Dates:</strong> {formatDate(item.from_date)} to {formatDate(item.to_date)}
                    </div>
                    <div style={styles.printLine}>
                      <strong>Job Start:</strong> {formatDate(item.jobs?.start_date)}
                    </div>
                    <div style={styles.printLine}>
                      <strong>Job Stop:</strong> {formatDate(item.jobs?.stop_date)}
                    </div>
                    <div style={styles.printLine}>
                      <strong>Project Manager:</strong> {item.project_managers?.name || '—'}
                    </div>
                    <div style={styles.printLine}>
                      <strong>Superintendent:</strong> {item.superintendents?.name || '—'}
                    </div>
                    <div style={styles.printLine}>
                      <strong>Surveyor:</strong> {item.surveyors?.name || '—'}
                    </div>

                    {item.notes && (
                      <div style={styles.printNotes}>
                        <strong>Job Notes:</strong> {item.notes}
                      </div>
                    )}

                    <div style={styles.printForemanTitle}>Foreman Assignments</div>

                    {item.schedule_item_foremen?.length ? (
                      item.schedule_item_foremen.map((assignment) => (
                        <div key={assignment.id} style={styles.printForemanCard}>
                          <div style={styles.printLine}>
                            <strong>Foreman:</strong> {assignment.foremen?.name || '—'}
                          </div>
                          <div style={styles.printLine}>
                            <strong>Dates:</strong> {formatDate(assignment.assignment_from_date)} to {formatDate(assignment.assignment_to_date)}
                          </div>
                          <div style={styles.printLine}>
                            <strong>Work:</strong> {assignment.work_description || '—'}
                          </div>
                          <div style={styles.printLine}>
                            <strong>Split Note:</strong> {assignment.split_note || '—'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={styles.printLine}>No foremen assigned yet.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  card: {
    maxWidth: '900px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  loginCard: {
    maxWidth: '500px',
    margin: '60px auto',
    background: '#ffffff',
    borderRadius: '16px',
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
  sectionCard: {
    background: '#ffffff',
    borderRadius: '16px',
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
    marginBottom: '10px',
    background: '#ffffff',
  },
  printCard: {
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '18px',
    background: '#ffffff',
    pageBreakInside: 'avoid',
  },
  printForemanCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '10px',
    background: '#f9fafb',
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
  printHeader: {
    borderBottom: '2px solid #111827',
    paddingBottom: '12px',
    marginBottom: '20px',
  },
  printTitle: {
    margin: 0,
    fontSize: '30px',
    color: '#111827',
  },
  printSubtitle: {
    margin: '6px 0 0 0',
    color: '#4b5563',
    fontSize: '14px',
  },
  printJobTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px',
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
    marginBottom: '10px',
  },
  jobPrefixSelect: {
    width: '120px',
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
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  buttonDanger: {
    background: '#b91c1c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  smallButton: {
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  smallDangerButton: {
    background: '#b91c1c',
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
    marginBottom: '10px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  select: {
    display: 'block',
    width: '100%',
    marginBottom: '10px',
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
    maxHeight: '260px',
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
}
