import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking login...')

  const [jobs, setJobs] = useState([])
  const [projectManagers, setProjectManagers] = useState([])
  const [superintendents, setSuperintendents] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [foremen, setForemen] = useState([])

  const [jobNumber, setJobNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [pmName, setPmName] = useState('')
  const [superintendentName, setSuperintendentName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [foremanName, setForemanName] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
    setMessage('Signed out.')
  }

  async function loadAllData() {
    setLoading(true)
    setMessage('Loading master data from Supabase...')

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
      console.error(jobsResult.error || pmResult.error || superintendentResult.error || surveyorResult.error || foremanResult.error)
      setMessage('There was an error loading your data.')
    } else {
      setJobs(jobsResult.data || [])
      setProjectManagers(pmResult.data || [])
      setSuperintendents(superintendentResult.data || [])
      setSurveyors(surveyorResult.data || [])
      setForemen(foremanResult.data || [])
      setMessage('Master data loaded successfully.')
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
            <button onClick={loadAllData} style={styles.buttonSecondary}>
              Reload Data
            </button>
            <button onClick={signOut} style={styles.buttonSecondary}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

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
  sectionCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
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
  input: {
    display: 'block',
    width: '100%',
    marginBottom: '10px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
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
