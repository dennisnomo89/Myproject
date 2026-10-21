import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, qs } from '../services/api'
import { useApi } from '../services/useApi'
import { today } from '../services/format'
import { Alert, Card, ClassSelect, Empty, Loading, PageHeader } from '../components/ui'

const STATUSES = [
  ['present', 'Present'],
  ['late', 'Late'],
  ['absent', 'Absent'],
  ['excused', 'Excused'],
]

export default function Attendance() {
  const [params, setParams] = useSearchParams()
  const { data: classes } = useApi('/classes')
  const [classId, setClassId] = useState(Number(params.get('classId')) || '')
  const [day, setDay] = useState(today())
  const { data: register, error, loading } = useApi(classId ? `/attendance${qs({ classId, date: day })}` : null)
  const [marks, setMarks] = useState({})
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  // Default to the first class once classes load.
  useEffect(() => {
    if (!classId && classes && classes.length) setClassId(classes[0].id)
  }, [classes, classId])

  // Unmarked pupils default to present so a full class can be saved in one click.
  useEffect(() => {
    if (register) setMarks(Object.fromEntries(register.map((r) => [r.studentId, r.status || 'present'])))
  }, [register])

  const changeClass = (id) => {
    setClassId(id)
    setParams(id ? { classId: id } : {})
  }

  const save = async () => {
    setBusy(true)
    setMessage({})
    try {
      const records = Object.entries(marks).map(([studentId, status]) => ({ studentId: Number(studentId), status }))
      const res = await api.post('/attendance', { classId, date: day, records })
      setMessage({ type: 'success', text: res.message })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const alreadyTaken = register && register.some((r) => r.status)
  const counts = STATUSES.map(([k, text]) => `${Object.values(marks).filter((m) => m === k).length} ${text.toLowerCase()}`).join(' · ')

  return (
    <>
      <PageHeader title="Attendance" subtitle="Take the daily register for your class" />
      <Card>
        <div className="toolbar">
          <ClassSelect classes={classes} value={classId} onChange={changeClass} />
          <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
          {register && register.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setMarks(Object.fromEntries(register.map((r) => [r.studentId, 'present'])))}>
              Mark all present
            </button>
          )}
        </div>
        <Alert>{error}</Alert>
        <Alert type={message.type} onClose={() => setMessage({})}>{message.text}</Alert>
        {loading && <Loading />}
        {register && (register.length ? (
          <>
            {alreadyTaken && <Alert type="info">Attendance was already taken for this day. Saving will update it.</Alert>}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Admission no.</th><th>Pupil</th><th>Status</th></tr></thead>
                <tbody>
                  {register.map((r) => (
                    <tr key={r.studentId}>
                      <td>{r.admissionNo}</td>
                      <td>{r.name}</td>
                      <td>
                        <div className="segmented" role="radiogroup" aria-label={`Status for ${r.name}`}>
                          {STATUSES.map(([key, text]) => (
                            <label key={key} className={`seg seg-${key} ${marks[r.studentId] === key ? 'on' : ''}`}>
                              <input
                                type="radio"
                                name={`s-${r.studentId}`}
                                checked={marks[r.studentId] === key}
                                onChange={() => setMarks({ ...marks, [r.studentId]: key })}
                              />
                              {text}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions spread">
              <span className="muted">{counts}</span>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save attendance'}</button>
            </div>
          </>
        ) : <Empty>There are no active pupils in this class.</Empty>)}
        {!classId && classes && !classes.length && <Empty>You are not assigned to any class.</Empty>}
      </Card>
    </>
  )
}
