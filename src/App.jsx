import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Testing Supabase connection...')

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage('Loading jobs from Supabase...')

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('job_number', { ascending: true })

    if (error) {
      console.error(error)
      setMessage(`Connection error: ${error.message}`)
      setJobs([])
    } else {
      setJobs(data || [])
      setMessage('Connected to Supabase successfully.')
    }

    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Weekly Schedule App</h1>
        <p style={styles.text}>{message}</p>

        <button onClick={loadJobs} style={styles.button}>
          Reload Jobs
        </button>

        <div style={{ marginTop: '24px' }}>
          <h2 style={styles.subtitle}>Jobs Table Test</h2>

          {loading ? (
            <p style={styles.text}>Loading...</p>
          ) : jobs.length === 0 ? (
            <p style={styles.text}>
              No jobs found yet. That is okay if you have not added any.
            </p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Job Number</th>
                  <th style={styles.th}>Job Name</th>
                  <th style={styles.th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td style={styles.td}>{job.job_number}</td>
                    <td style={styles.td}>{job.job_name}</td>
                    <td style={styles.td}>{job.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '40px 20px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    maxWidth: '900px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  title: {
    margin: 0,
    marginBottom: '10px',
    fontSize: '32px',
  },
  subtitle: {
    marginBottom: '12px',
    fontSize: '22px',
  },
  text: {
    fontSize: '16px',
    color: '#374151',
  },
  button: {
    marginTop: '12px',
    background: '#111827',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #d1d5db',
    padding: '10px',
    background: '#f9fafb',
  },
  td: {
    borderBottom: '1px solid #e5e7eb',
    padding: '10px',
  },
}
