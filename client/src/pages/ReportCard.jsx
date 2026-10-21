import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { label } from '../services/format'
import { Alert, Loading } from '../components/ui'

const AREAS = ['practical_life', 'sensorial', 'language', 'mathematics', 'culture']
const RATINGS = ['emerging', 'developing', 'secure']

// Lets staff edit the Montessori observations and remarks shown on the card.
function StaffEditor({ report, termId, onSaved }) {
  const { user } = useAuth()
  const initial = Object.fromEntries(AREAS.map((a) => {
    const o = report.observations.find((x) => x.area === a)
    return [a, { rating: o?.rating || '', comment: o?.comment || '' }]
  }))
  const [obs, setObs] = useState(initial)
  const [teacherRemark, setTeacherRemark] = useState(report.remarks.teacher || '')
  const [headRemark, setHeadRemark] = useState(report.remarks.head || '')
  const [message, setMessage] = useState({})

  const save = async () => {
    try {
      const observations = AREAS.filter((a) => obs[a].rating).map((a) => ({ area: a, ...obs[a] }))
      await api.post(`/results/observations/${report.student.id}`, { termId, observations })
      await api.post(`/results/remarks/${report.student.id}`, {
        termId, teacherRemark, ...(user.role === 'admin' && { headRemark }),
      })
      setMessage({ type: 'success', text: 'Saved' })
      onSaved()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="card no-print">
      <h2>Edit observations and remarks</h2>
      <Alert type={message.type} onClose={() => setMessage({})}>{message.text}</Alert>
      <table>
        <tbody>
          {AREAS.map((a) => (
            <tr key={a}>
              <td>{label(a)}</td>
              <td>
                <select value={obs[a].rating} onChange={(e) => setObs({ ...obs, [a]: { ...obs[a], rating: e.target.value } })} aria-label={`${label(a)} rating`}>
                  <option value="">—</option>
                  {RATINGS.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                </select>
              </td>
              <td><input value={obs[a].comment} placeholder="Comment" onChange={(e) => setObs({ ...obs, [a]: { ...obs[a], comment: e.target.value } })} aria-label={`${label(a)} comment`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="field"><span>Class teacher's remark</span><textarea rows="2" value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} /></label>
      {user.role === 'admin' && (
        <label className="field"><span>Head of school's remark</span><textarea rows="2" value={headRemark} onChange={(e) => setHeadRemark(e.target.value)} /></label>
      )}
      <div className="actions"><button className="btn btn-primary" onClick={save}>Save</button></div>
    </section>
  )
}

export default function ReportCard() {
  const { studentId, termId } = useParams()
  const { user } = useAuth()
  const { data: r, error, reload } = useApi(`/results/report/${studentId}?termId=${termId}`)

  useEffect(() => {
    if (r) document.title = `Report card – ${r.student.name}`
  }, [r])

  if (error) return <div className="print-page"><Alert>{error}</Alert></div>
  if (!r) return <Loading />

  return (
    <div className="print-page">
      <div className="no-print actions">
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        {!r.term.published && <span className="badge badge-warn">Draft – results not yet published</span>}
      </div>
      <article className="report">
        <header className="report-head">
          <img src="/favicon.svg" alt="" width="64" height="64" />
          <div>
            <h1>Global Virgins Montessori Academy</h1>
            <p>Pupil's Termly Report · {r.term.name} Term, {r.term.session} Session</p>
          </div>
        </header>
        <dl className="report-info">
          <dt>Name</dt><dd>{r.student.name}</dd>
          <dt>Admission no.</dt><dd>{r.student.admissionNo}</dd>
          <dt>Class</dt><dd>{r.student.class || '—'}</dd>
          <dt>Class teacher</dt><dd>{r.student.classTeacher || '—'}</dd>
          <dt>Attendance</dt><dd>{r.attendance ? `${r.attendance.present} of ${r.attendance.total} days` : '—'}</dd>
          <dt>Position</dt><dd>{r.summary.position ? `${r.summary.position} out of ${r.summary.classSize}` : '—'}</dd>
        </dl>

        <h2>Academic performance</h2>
        <table className="report-table">
          <thead><tr><th>Subject</th><th>CA (40)</th><th>Exam (60)</th><th>Total (100)</th><th>Grade</th><th>Class avg.</th><th>Remark</th></tr></thead>
          <tbody>
            {r.subjects.map((s) => (
              <tr key={s.subject}>
                <td>{s.subject}</td><td>{s.caScore}</td><td>{s.examScore}</td><td><strong>{s.total}</strong></td>
                <td>{s.grade}</td><td>{s.classAverage}</td><td>{s.teacherRemark || s.gradeRemark}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td /><td /><td><strong>{r.summary.totalScore}</strong></td><td colSpan="3">Average: <strong>{r.summary.average ?? '—'}</strong> · Grade {r.summary.grade ?? '—'}</td></tr>
          </tfoot>
        </table>

        {r.observations.length > 0 && (
          <>
            <h2>Montessori development</h2>
            <table className="report-table">
              <thead><tr><th>Area</th><th>Progress</th><th>Comment</th></tr></thead>
              <tbody>
                {r.observations.map((o) => <tr key={o.area}><td>{label(o.area)}</td><td>{label(o.rating)}</td><td>{o.comment}</td></tr>)}
              </tbody>
            </table>
          </>
        )}

        <h2>Remarks</h2>
        <p><strong>Class teacher:</strong> {r.remarks.teacher || '—'}</p>
        <p><strong>Head of school:</strong> {r.remarks.head || '—'}</p>
        <p className="muted small">Grading: A 70–100 Excellent · B 60–69 Very Good · C 50–59 Good · D 45–49 Fair · E 40–44 Pass · F 0–39 Needs Improvement</p>
        <div className="signatures"><span>Class teacher's signature</span><span>Head of school's signature</span></div>
      </article>
      {['admin', 'teacher'].includes(user.role) && <StaffEditor key={JSON.stringify(r.remarks)} report={r} termId={Number(termId)} onSaved={reload} />}
    </div>
  )
}
