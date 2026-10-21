import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, qs } from '../services/api'
import { useApi } from '../services/useApi'
import { className, date, label, today } from '../services/format'
import { Alert, Badge, Card, ClassSelect, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

const EMPTY = { admissionNo: '', firstName: '', lastName: '', gender: 'female', dateOfBirth: '', admissionDate: today(), classId: '' }

// Shared by admin (add/edit) and the student detail page.
export function StudentForm({ initial = EMPTY, classes, onSaved, onCancel }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { ...form, classId: form.classId || null, dateOfBirth: form.dateOfBirth || null }
      const saved = initial.id ? await api.patch(`/students/${initial.id}`, body) : await api.post('/students', body)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <Alert>{error}</Alert>
      <div className="form-row">
        <Field label="First name"><input value={form.firstName} onChange={set('firstName')} required /></Field>
        <Field label="Last name"><input value={form.lastName} onChange={set('lastName')} required /></Field>
      </div>
      <div className="form-row">
        <Field label="Admission number"><input value={form.admissionNo} onChange={set('admissionNo')} required placeholder="GVMA/2026/007" /></Field>
        <Field label="Gender">
          <select value={form.gender} onChange={set('gender')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Date of birth"><input type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} max={today()} /></Field>
        <Field label="Admission date"><input type="date" value={form.admissionDate || ''} onChange={set('admissionDate')} /></Field>
      </div>
      <div className="form-row">
        <Field label="Class">
          <select value={form.classId || ''} onChange={set('classId')}>
            <option value="">Not assigned</option>
            {(classes || []).map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}
          </select>
        </Field>
        {initial.id && (
          <Field label="Status">
            <select value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </Field>
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

export default function Students() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isParent = user.role === 'parent'
  const [q, setQ] = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus] = useState('active')
  const [adding, setAdding] = useState(false)
  const { data: classes } = useApi(isParent ? null : '/classes')
  const { data: students, error, loading, reload } = useApi(`/students${qs({ q, classId, status })}`)

  return (
    <>
      <PageHeader
        title={isParent ? 'My Children' : 'Students'}
        subtitle={students ? `${students.length} pupil${students.length === 1 ? '' : 's'}` : null}
        actions={user.role === 'admin' && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add student</button>}
      />
      <Card>
        {!isParent && (
          <div className="toolbar">
            <input type="search" placeholder="Search name or admission no." value={q} onChange={(e) => setQ(e.target.value)} />
            <ClassSelect classes={classes} value={classId} onChange={setClassId} allowAll />
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        )}
        <Alert>{error}</Alert>
        {loading && !students && <Loading />}
        {students && (students.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Admission no.</th><th>Name</th><th>Gender</th><th>Class</th><th>Date of birth</th><th>Status</th></tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => navigate(`/students/${s.id}`)}>
                    <td>{s.admissionNo}</td>
                    <td><Link to={`/students/${s.id}`}>{s.lastName} {s.firstName}</Link></td>
                    <td>{label(s.gender)}</td>
                    <td>{className(s.SchoolClass)}</td>
                    <td>{date(s.dateOfBirth)}</td>
                    <td><Badge tone={s.status === 'active' ? 'good' : 'neutral'}>{label(s.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No students match these filters.</Empty>)}
      </Card>
      {adding && (
        <Modal title="Add student" onClose={() => setAdding(false)}>
          <StudentForm classes={classes} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />
        </Modal>
      )}
    </>
  )
}
