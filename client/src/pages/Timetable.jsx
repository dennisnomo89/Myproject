import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, qs } from '../services/api'
import { useApi } from '../services/useApi'
import { className, studentName } from '../services/format'
import { Alert, Card, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Rows are the distinct time ranges used in the week, so different-length periods still line up.
function Grid({ slots, showClass, onCellClick, onEmptyClick }) {
  const rows = useMemo(() => {
    const keys = [...new Set(slots.map((s) => `${s.startTime}-${s.endTime}`))]
    return keys.sort()
  }, [slots])
  const today = new Date().getDay()

  if (!slots.length) return <Empty>No periods have been set up yet.</Empty>
  return (
    <div className="table-wrap">
      <table className="timetable">
        <thead>
          <tr>
            <th>Time</th>
            {DAYS.map((d, i) => <th key={d} className={today === i + 1 ? 'today' : ''}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((key) => {
            const [start, end] = key.split('-')
            return (
              <tr key={key}>
                <th className="time">{start}<span>–{end}</span></th>
                {DAYS.map((d, i) => {
                  const cell = slots.filter((s) => s.day === i + 1 && s.startTime === start && s.endTime === end)
                  if (!cell.length) {
                    return (
                      <td key={d} className={`slot empty ${today === i + 1 ? 'today' : ''}`}>
                        {onEmptyClick && <button className="link small" onClick={() => onEmptyClick(i + 1, start, end)} aria-label={`Add period on ${d} at ${start}`}>+</button>}
                      </td>
                    )
                  }
                  return (
                    <td key={d} className={`slot ${today === i + 1 ? 'today' : ''}`}>
                      {cell.map((s) => {
                        const content = (
                          <>
                            <strong>{s.subject || s.label}</strong>
                            {showClass && s.class && <small>{s.class}</small>}
                            {!showClass && s.teacher && <small>{s.teacher.fullName}</small>}
                          </>
                        )
                        return onCellClick
                          ? <button key={s.id} className={`slot-card ${s.subject ? '' : 'slot-label'}`} onClick={() => onCellClick(s)}>{content}</button>
                          : <div key={s.id} className={`slot-card ${s.subject ? '' : 'slot-label'}`}>{content}</div>
                      })}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SlotForm({ initial, cls, onClose, onSaved }) {
  const [form, setForm] = useState({
    day: initial.day || 1,
    startTime: initial.startTime || '08:00',
    endTime: initial.endTime || '08:40',
    subjectId: initial.subjectId || '',
    label: initial.label || '',
  })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const body = { ...form, classId: cls.id, day: Number(form.day), subjectId: form.subjectId ? Number(form.subjectId) : null, label: form.subjectId ? null : form.label }
      if (initial.id) await api.patch(`/timetable/${initial.id}`, body)
      else await api.post('/timetable', body)
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async () => {
    if (!window.confirm('Remove this period from the timetable?')) return
    await api.del(`/timetable/${initial.id}`)
    onSaved()
  }

  return (
    <Modal title={initial.id ? 'Edit period' : `Add period – ${className(cls)}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Alert>{error}</Alert>
        <div className="form-row">
          <Field label="Day">
            <select value={form.day} onChange={set('day')}>
              {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Starts"><input type="time" value={form.startTime} onChange={set('startTime')} required /></Field>
            <Field label="Ends"><input type="time" value={form.endTime} onChange={set('endTime')} required /></Field>
          </div>
        </div>
        <Field label="Subject" hint="Leave empty for a break, assembly or other activity">
          <select value={form.subjectId} onChange={set('subjectId')}>
            <option value="">No subject</option>
            {cls.ClassSubjects.map((cs) => (
              <option key={cs.SubjectId} value={cs.SubjectId}>{cs.Subject.name}{cs.teacher ? ` (${cs.teacher.fullName})` : ''}</option>
            ))}
          </select>
        </Field>
        {!form.subjectId && (
          <Field label="Label"><input value={form.label} onChange={set('label')} placeholder="Break, Assembly, Nap time…" required /></Field>
        )}
        <div className="actions spread">
          {initial.id ? <button type="button" className="btn btn-ghost danger" onClick={remove}>Remove</button> : <span />}
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Timetable() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const isTeacher = user.role === 'teacher'
  const isParent = user.role === 'parent'

  // Parents pick a child; everyone else picks a class. Teachers can also see their own week.
  const { data: classes } = useApi(isParent ? null : '/classes')
  const { data: children } = useApi(isParent ? '/students' : null)
  const options = useMemo(() => {
    if (isParent) return (children || []).filter((c) => c.SchoolClass).map((c) => ({ id: c.SchoolClass.id, label: `${studentName(c)} – ${className(c.SchoolClass)}` }))
    return (classes || []).map((c) => ({ id: c.id, label: className(c) }))
  }, [isParent, children, classes])

  const [view, setView] = useState(isTeacher ? 'mine' : 'class')
  const [classId, setClassId] = useState('')
  const [editing, setEditing] = useState(null)
  useEffect(() => { if (!classId && options.length) setClassId(options[0].id) }, [options, classId])

  const url = view === 'mine' ? '/timetable/mine' : classId ? `/timetable${qs({ classId })}` : null
  const { data: slots, error, loading, reload } = useApi(url)
  const cls = classes?.find((c) => c.id === classId)

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={view === 'mine' ? 'Your teaching week' : 'Weekly class timetable'}
        actions={isAdmin && cls && view === 'class' && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add period</button>}
      />
      <Card
        title={isTeacher ? (
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'mine'} className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}>My week</button>
            <button role="tab" aria-selected={view === 'class'} className={view === 'class' ? 'active' : ''} onClick={() => setView('class')}>Class timetable</button>
          </div>
        ) : null}
        actions={view === 'class' && options.length > 0 && (
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} aria-label={isParent ? 'Child' : 'Class'}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
      >
        <Alert>{error}</Alert>
        {loading && !slots && <Loading />}
        {view === 'class' && !options.length && (classes || children) && (
          <Empty>{isParent ? 'Your children have not been placed in a class yet.' : 'No classes available.'}</Empty>
        )}
        {slots && (
          <Grid
            slots={slots}
            showClass={view === 'mine'}
            onCellClick={isAdmin && view === 'class' ? (s) => setEditing(s) : null}
            onEmptyClick={isAdmin && view === 'class' ? (day, startTime, endTime) => setEditing({ day, startTime, endTime }) : null}
          />
        )}
        {isAdmin && view === 'class' && slots?.length > 0 && <p className="muted small">Click a period to edit it, or + to fill an empty slot.</p>}
      </Card>
      {editing && cls && (
        <SlotForm initial={editing} cls={cls} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </>
  )
}
