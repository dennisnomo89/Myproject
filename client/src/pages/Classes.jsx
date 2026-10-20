import { useState } from 'react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { className } from '../services/format'
import { Alert, Card, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

function ClassForm({ initial, teachers, onSaved, onClose }) {
  const [form, setForm] = useState({ name: initial?.name || '', arm: initial?.arm || '', classTeacherId: initial?.classTeacherId || '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    try {
      const body = { ...form, classTeacherId: form.classTeacherId ? Number(form.classTeacherId) : null }
      if (initial) await api.patch(`/classes/${initial.id}`, body)
      else await api.post('/classes', body)
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Modal title={initial ? `Edit ${className(initial)}` : 'Add class'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Alert>{error}</Alert>
        <div className="form-row">
          <Field label="Class name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nursery 1" required /></Field>
          <Field label="Arm"><input value={form.arm} onChange={(e) => setForm({ ...form, arm: e.target.value })} placeholder="A" /></Field>
        </div>
        <Field label="Class teacher">
          <select value={form.classTeacherId} onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}>
            <option value="">Not assigned</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </Field>
        <div className="actions"><button className="btn btn-primary">Save</button></div>
      </form>
    </Modal>
  )
}

function ClassCard({ cls, subjects, teachers, onChange, onEdit }) {
  const [subjectId, setSubjectId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [error, setError] = useState('')
  const assigned = new Set(cls.ClassSubjects.map((cs) => cs.SubjectId))

  const run = async (fn) => {
    setError('')
    try { await fn(); onChange() } catch (err) { setError(err.message) }
  }
  const assign = (e) => {
    e.preventDefault()
    run(() => api.post(`/classes/${cls.id}/subjects`, { subjectId: Number(subjectId), teacherId: teacherId ? Number(teacherId) : null }))
    setSubjectId('')
  }
  const changeTeacher = (cs, tid) => run(() => api.post(`/classes/${cls.id}/subjects`, { subjectId: cs.SubjectId, teacherId: tid ? Number(tid) : null }))
  const removeSubject = (cs) => window.confirm(`Remove ${cs.Subject.name} from ${className(cls)}?`) && run(() => api.del(`/classes/${cls.id}/subjects/${cs.SubjectId}`))
  const removeClass = () => window.confirm(`Delete ${className(cls)}?`) && run(() => api.del(`/classes/${cls.id}`))

  return (
    <Card
      title={className(cls)}
      actions={
        <>
          <button className="btn btn-small btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn btn-small btn-ghost danger" onClick={removeClass}>Delete</button>
        </>
      }
    >
      <p className="muted">Class teacher: {cls.classTeacher?.fullName || 'Not assigned'} · {cls.studentCount} pupils</p>
      <Alert>{error}</Alert>
      {cls.ClassSubjects.length ? (
        <table>
          <thead><tr><th>Subject</th><th>Subject teacher</th><th /></tr></thead>
          <tbody>
            {cls.ClassSubjects.map((cs) => (
              <tr key={cs.id}>
                <td>{cs.Subject.name}</td>
                <td>
                  <select value={cs.teacherId || ''} onChange={(e) => changeTeacher(cs, e.target.value)} aria-label={`Teacher for ${cs.Subject.name}`}>
                    <option value="">Not assigned</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
                </td>
                <td><button className="link danger" onClick={() => removeSubject(cs)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>No subjects assigned yet.</Empty>}
      <form className="form-row inline-form" onSubmit={assign}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required aria-label="Subject to add">
          <option value="">Add subject…</option>
          {subjects.filter((s) => !assigned.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Teacher for new subject">
          <option value="">Teacher (optional)</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
        <button className="btn btn-small">Add</button>
      </form>
    </Card>
  )
}

function SubjectsCard({ subjects, onChange }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const add = async (e) => {
    e.preventDefault()
    try {
      await api.post('/subjects', { name })
      setName('')
      setError('')
      onChange()
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name}? It will be removed from every class.`)) return
    try { await api.del(`/subjects/${s.id}`); onChange() } catch (err) { setError(err.message) }
  }
  return (
    <Card title="Subjects">
      <Alert>{error}</Alert>
      <ul className="chips">
        {subjects.map((s) => (
          <li key={s.id}>{s.name} <button className="link danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}>×</button></li>
        ))}
      </ul>
      <form className="form-row inline-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New subject" required aria-label="New subject name" />
        <button className="btn btn-small">Add</button>
      </form>
    </Card>
  )
}

export default function Classes() {
  const { data: classes, error, loading, reload } = useApi('/classes')
  const { data: subjects, reload: reloadSubjects } = useApi('/subjects')
  const { data: teachers } = useApi('/users?role=teacher')
  const [editing, setEditing] = useState(null) // null | 'new' | class

  const refresh = () => { reload(); reloadSubjects() }

  return (
    <>
      <PageHeader title="Classes & Subjects" actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add class</button>} />
      <Alert>{error}</Alert>
      {loading && !classes && <Loading />}
      <div className="grid-2-1">
        <div>
          {classes && !classes.length && <Card><Empty>No classes yet. Add your first class.</Empty></Card>}
          {classes && subjects && teachers && classes.map((c) => (
            <ClassCard key={c.id} cls={c} subjects={subjects} teachers={teachers} onChange={refresh} onEdit={() => setEditing(c)} />
          ))}
        </div>
        {subjects && <SubjectsCard subjects={subjects} onChange={refresh} />}
      </div>
      {editing && (
        <ClassForm
          initial={editing === 'new' ? null : editing}
          teachers={teachers || []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </>
  )
}
