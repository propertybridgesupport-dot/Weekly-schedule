import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function emptyForemanAssignment() {
  return {
    localId: crypto.randomUUID(),
    foreman_id: '',
    assignment_from_date: '',
    assignment_to_date: '',
    work_description: '',
    split_note: '',
  }
}

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

  const [jobNumber, setJobNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [pmName, setPmName] = useState('')
  const [superintendentName, setSuperintendentName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [foremanName, setForemanName] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
      supabase.from('jobs').select('*').order('job_number', { ascending: true }),
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
          job_name
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

    setScheduleItems(data || [])
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

  async function addJob() {
    if (!jobNumber || !jobName) {
      alert('Enter both job number and job name')
      return
    }

    const { error } = await supabase.from('jobs').insert({
      job_number: jobNumber,
      job_name: jobName,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setJobNumber('')
      setJobName('')
      loadAllData()
    }
  }

  async function addProjectManager() {
    if (!pmName) {
      alert('Enter a project manager name')
      return
    }

    const { error } = await supabase.from('project_managers').insert({
      name: pmName,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setPmName('')
      loadAllData()
    }
  }

  async function addSuperintendent() {
    if (!superintendentName) {
      alert('Enter a superintendent name')
      return
    }

    const { error } = await supabase.from('superintendents').insert({
      name: superintendentName,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuperintendentName('')
      loadAllData()
    }
  }

  async function addSurveyor() {
    if (!surveyorName) {
      alert('Enter a surveyor name')
      return
    }

    const { error } = await supabase.from('surveyors').insert({
      name: surveyorName,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setSurveyorName('')
      loadAllData()
    }
  }

  async function addForeman() {
    if (!foremanName) {
      alert('Enter a foreman name')
      return
    }

    const { error } = await supabase.from('foremen').insert({
      name: foremanName,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setForemanName('')
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

  async function saveScheduleItem() {
    if (!scheduleForm.job_id) {
      alert('Please select a job')
      return
    }

    if (!scheduleForm.from_date || !scheduleForm.to_date) {
      alert('Please enter both from date and to date')
      return
    }

    setMessage('Saving schedule item...')

    const { data: scheduleItem, error: scheduleError } = await supabase
      .from('schedule_items')
      .insert({
        from_date: scheduleForm.from_date,
        to_date: scheduleForm.to_date,
        job_id: scheduleForm.job_id,
        project_manager_id: scheduleForm.project_manager_id || null,
        superintendent_id: scheduleForm.superintendent_id || null,
        surveyor_id: scheduleForm.surveyor_id || null,
        notes: scheduleForm.notes || null,
      })
      .select()
      .single()

    if (scheduleError) {
      console.error(scheduleError)
      alert(scheduleError.message)
      setMessage('Error saving schedule item.')
      return
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

    setMessage('Schedule item saved successfully.')
    resetScheduleForm()
    await loadAllData()
    setActiveTab('weekly')
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
      <div style={styles.headerCard}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Weekly Schedule App</h1>
            <p style={styles.text}>{message}</p>
          </div>

          <div style={styles.topBarButtons}>
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
            <button
              onClick={() => setActiveTab('weekly')}
              style={activeTab === 'weekly' ? styles.button : styles.buttonSecondary}
            >
              Weekly Schedule
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
            <input
              placeholder="Job Number"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              style={styles.input}
            />
            <input
              placeholder="Job Name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              style={styles.input}
            />
            <button onClick={addJob} style={styles.button}>
              Add Job
            </button>

            <div style={styles.listWrap}>
              {jobs.map((job) => (
                <div key={job.id} style={styles.listItem}>
                  <strong>{job.job_number}</strong> — {job.job_name}
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
            <button onClick={addProjectManager} style={styles.button}>
              Add Project Manager
            </button>

            <div style={styles.listWrap}>
              {projectManagers.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  {person.name}
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
            <button onClick={addSuperintendent} style={styles.button}>
              Add Superintendent
            </button>

            <div style={styles.listWrap}>
              {superintendents.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  {person.name}
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
            <button onClick={addSurveyor} style={styles.button}>
              Add Surveyor
            </button>

            <div style={styles.listWrap}>
              {surveyors.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  {person.name}
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
            <button onClick={addForeman} style={styles.button}>
              Add Foreman
            </button>

            <div style={styles.listWrap}>
              {foremen.map((person) => (
                <div key={person.id} style={styles.listItem}>
                  {person.name}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div style={styles.singleColumnWrap}>
          <div style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>Schedule Entry</h2>

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
                  {jobs.map((job) => (
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

            <div style={styles.bottomButtons}>
              <button onClick={saveScheduleItem} style={styles.button}>
                Save Schedule Item
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
  },
}
