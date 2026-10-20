import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { useApi, useTerms } from '../services/useApi'
import { className, date, label, money } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, Modal, PageHeader, Stat, TermSelect } from '../components/ui'
import { StudentForm } from './Students'

const STATUS_TONE = { present: 'good', late: 'warn', absent: 'bad', excused: 'neutral' }

function AttendanceTab({ studentId }) {
  const { data, error, loading } = useApi(`/attendance/student/${studentId}`)
  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>
  const s = data.summary
  return (
    <>
      <div className="stats">
        <Stat label="Attendance rate" value={s.rate === null ? '—' : `${s.rate}%`} />
        <Stat label="Present" value={s.present} />
        <Stat label="Late" value={s.late} />
        <Stat label="Absent" value={s.absent} />
        <Stat label="Excused" value={s.excused} />
      </div>
      {data.records.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {data.records.map((r) => (
                <tr key={r.date}><td>{date(r.date)}</td><td><Badge tone={STATUS_TONE[r.status]}>{label(r.status)}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No attendance recorded yet.</Empty>}
    </>
  )
}

function ResultsTab({ studentId, termId }) {
  const { data, error, loading } = useApi(termId ? `/results/report/${studentId}?termId=${termId}` : null)
  if (loading) return <Loading />
  if (error) return <Alert type="info">{error}</Alert>
  if (!data) return null
  return (
    <>
      <div className="stats">
        <Stat label="Average" value={data.summary.average ?? '—'} />
        <Stat label="Grade" value={data.summary.grade ?? '—'} />
        <Stat label="Position" value={data.summary.position ? `${data.summary.position} of ${data.summary.classSize}` : '—'} />
      </div>
      {data.subjects.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Class avg.</th></tr></thead>
            <tbody>
              {data.subjects.map((s) => (
                <tr key={s.subject}>
                  <td>{s.subject}</td><td>{s.caScore}</td><td>{s.examScore}</td>
                  <td><strong>{s.total}</strong></td><td>{s.grade}</td><td>{s.classAverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No scores recorded for this term.</Empty>}
      <div className="actions">
        <Link className="btn btn-primary" to={`/report/${studentId}/${termId}`} target="_blank">Open printable report card</Link>
      </div>
    </>
  )
}

function FeesTab({ studentId, termId, canRecord }) {
  const { data, error, loading, reload } = useApi(termId ? `/fees/statement/${studentId}?termId=${termId}` : null)
  const [paying, setPaying] = useState(false)
  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>
  if (!data) return null
  return (
    <>
      <div className="stats">
        <Stat label="Billed" value={money(data.billed)} />
        <Stat label="Paid" value={money(data.paid)} />
        <Stat label="Balance" value={money(data.balance)} hint={data.balance <= 0 ? 'Fully paid' : null} />
      </div>
      <div className="grid-2">
        <div>
          <h3>Fee items</h3>
          {data.items.length ? (
            <table>
              <tbody>
                {data.items.map((i) => <tr key={i.id}><td>{i.description}</td><td className="num">{money(i.amount)}</td></tr>)}
              </tbody>
            </table>
          ) : <Empty>No fees set for this class and term.</Empty>}
        </div>
        <div>
          <h3>Payments</h3>
          {data.payments.length ? (
            <table>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.paidOn)}</td>
                    <td>{label(p.method)}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td><Link to={`/receipt/${p.id}`} target="_blank">Receipt</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No payments yet.</Empty>}
        </div>
      </div>
      {canRecord && (
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setPaying(true)}>Record payment</button>
        </div>
      )}
      {paying && (
        <PaymentModal
          studentId={studentId}
          termId={termId}
          balance={data.balance}
          onClose={() => setPaying(false)}
          onSaved={() => { setPaying(false); reload() }}
        />
      )}
    </>
  )
}

export function PaymentModal({ studentId, termId, balance, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: balance > 0 ? balance : '', method: 'cash', paidOn: new Date().toISOString().slice(0, 10) })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const p = await api.post('/fees/payments', { ...form, studentId, termId })
      window.open(`/receipt/${p.id}`, '_blank')
      onSaved(p)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label="Amount (₦)" hint={balance > 0 ? `Outstanding: ${money(balance)}` : null}>
          <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </Field>
        <div className="form-row">
          <Field label="Method">
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
              <option value="pos">POS</option>
            </select>
          </Field>
          <Field label="Date paid">
            <input type="date" value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} required />
          </Field>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save and print receipt'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ParentsCard({ student, isAdmin, onChange }) {
  const [linking, setLinking] = useState(false)
  const [parentId, setParentId] = useState('')
  const [relationship, setRelationship] = useState('')
  const [error, setError] = useState('')
  const { data: parents } = useApi(isAdmin && linking ? '/users?role=parent' : null)

  const link = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/students/${student.id}/parents`, { parentId: Number(parentId), relationship })
      setLinking(false)
      onChange()
    } catch (err) {
      setError(err.message)
    }
  }
  const unlink = async (id) => {
    if (!window.confirm('Remove this parent from the pupil?')) return
    await api.del(`/students/${student.id}/parents/${id}`)
    onChange()
  }

  return (
    <Card title="Parents / Guardians" actions={isAdmin && <button className="btn btn-small" onClick={() => setLinking(true)}>+ Link parent</button>}>
      {student.parents.length ? (
        <ul className="list">
          {student.parents.map((p) => (
            <li key={p.id}>
              <strong>{p.fullName}</strong> {p.StudentParent.relationship && <span className="muted">({p.StudentParent.relationship})</span>}
              <div className="muted small">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
              {isAdmin && <button className="link danger small" onClick={() => unlink(p.id)}>Remove</button>}
            </li>
          ))}
        </ul>
      ) : <Empty>No parent linked.</Empty>}
      {linking && (
        <Modal title="Link parent account" onClose={() => setLinking(false)}>
          <form className="form" onSubmit={link}>
            <Alert>{error}</Alert>
            <Field label="Parent account" hint="Create the parent's account on the Users page first.">
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
                <option value="">Select parent</option>
                {(parents || []).map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.email})</option>)}
              </select>
            </Field>
            <Field label="Relationship"><input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Mother, Father, Guardian…" /></Field>
            <div className="actions"><button className="btn btn-primary">Link</button></div>
          </form>
        </Modal>
      )}
    </Card>
  )
}

export default function StudentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const { data: student, error, reload } = useApi(`/students/${id}`)
  const { data: classes } = useApi(isAdmin ? '/classes' : null)
  const { terms, current } = useTerms()
  const [termId, setTermId] = useState(null)
  const [editing, setEditing] = useState(false)

  const tabs = [
    ['attendance', 'Attendance', true],
    ['results', 'Results', user.role !== 'bursar'],
    ['fees', 'Fees', user.role !== 'teacher'],
  ].filter((t) => t[2])
  const [tab, setTab] = useState(tabs[0][0])

  useEffect(() => { if (!termId && current) setTermId(current.id) }, [current, termId])

  if (error) return <Alert>{error}</Alert>
  if (!student) return <Loading />

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`${student.admissionNo} · ${className(student.SchoolClass)}`}
        actions={isAdmin && <button className="btn" onClick={() => setEditing(true)}>Edit details</button>}
      />
      <div className="grid-1-2">
        <div>
          <Card title="Profile">
            <dl className="details">
              <dt>Gender</dt><dd>{label(student.gender)}</dd>
              <dt>Date of birth</dt><dd>{date(student.dateOfBirth)}</dd>
              <dt>Admitted</dt><dd>{date(student.admissionDate)}</dd>
              <dt>Status</dt><dd><Badge tone={student.status === 'active' ? 'good' : 'neutral'}>{label(student.status)}</Badge></dd>
            </dl>
          </Card>
          <ParentsCard student={student} isAdmin={isAdmin} onChange={reload} />
        </div>
        <Card
          title={
            <div className="tabs" role="tablist">
              {tabs.map(([key, text]) => (
                <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{text}</button>
              ))}
            </div>
          }
          actions={tab !== 'attendance' && terms.length > 0 && <TermSelect terms={terms} value={termId} onChange={setTermId} />}
        >
          {tab === 'attendance' && <AttendanceTab studentId={id} />}
          {tab === 'results' && <ResultsTab studentId={id} termId={termId} />}
          {tab === 'fees' && <FeesTab studentId={id} termId={termId} canRecord={['admin', 'bursar'].includes(user.role)} />}
        </Card>
      </div>
      {editing && (
        <Modal title="Edit student" onClose={() => setEditing(false)}>
          <StudentForm
            initial={{ ...student, classId: student.SchoolClassId || '' }}
            classes={classes}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); reload() }}
          />
        </Modal>
      )}
    </>
  )
}
