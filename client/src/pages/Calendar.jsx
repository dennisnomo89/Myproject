import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, qs } from '../services/api'
import { useApi } from '../services/useApi'
import { date, label } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

const CATEGORIES = ['holiday', 'exam', 'meeting', 'activity', 'other']
const CATEGORY_TONE = { holiday: 'good', exam: 'bad', meeting: 'warn', activity: 'info', other: 'neutral' }
const AUDIENCE_TEXT = { all: 'Everyone', staff: 'Staff', parents: 'Parents' }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 6 weeks of dates starting on the Monday on/before the 1st of the month.
function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function EventDates({ e }) {
  return e.startDate === e.endDate ? date(e.startDate) : `${date(e.startDate)} – ${date(e.endDate)}`
}

function EventForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: initial.title || '', description: initial.description || '', category: initial.category || 'activity',
    audience: initial.audience || 'all', startDate: initial.startDate || '', endDate: initial.endDate || initial.startDate || '',
  })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    try {
      if (initial.id) await api.patch(`/events/${initial.id}`, form)
      else await api.post('/events', form)
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async () => {
    if (!window.confirm(`Delete "${initial.title}"?`)) return
    await api.del(`/events/${initial.id}`)
    onSaved()
  }

  return (
    <Modal title={initial.id ? 'Edit event' : 'Add event'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Alert>{error}</Alert>
        <Field label="Title"><input value={form.title} onChange={set('title')} required maxLength={150} /></Field>
        <div className="form-row">
          <Field label="Starts"><input type="date" value={form.startDate} onChange={set('startDate')} required /></Field>
          <Field label="Ends" hint="Same as start for a one-day event"><input type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} /></Field>
        </div>
        <div className="form-row">
          <Field label="Category">
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </Field>
          <Field label="Visible to">
            <select value={form.audience} onChange={set('audience')}>
              <option value="all">Everyone</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
            </select>
          </Field>
        </div>
        <Field label="Details (optional)"><textarea rows="3" value={form.description} onChange={set('description')} /></Field>
        <div className="actions spread">
          {initial.id ? <button type="button" className="btn btn-ghost danger" onClick={remove}>Delete</button> : <span />}
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Calendar() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [editing, setEditing] = useState(null)

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const from = iso(days[0])
  const to = iso(days[days.length - 1])
  const { data: events, error, loading, reload } = useApi(`/events${qs({ from, to })}`)

  const move = (delta) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const todayIso = iso(now)
  const inMonth = (events || []).filter((e) => e.endDate >= iso(new Date(cursor.year, cursor.month, 1)) && e.startDate <= iso(new Date(cursor.year, cursor.month + 1, 0)))

  return (
    <>
      <PageHeader
        title="School Calendar"
        subtitle="Holidays, exams, meetings and activities"
        actions={isAdmin && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add event</button>}
      />
      <Alert>{error}</Alert>
      <div className="grid-2-1">
        <Card
          title={monthName}
          actions={
            <>
              <button className="btn btn-small btn-ghost" onClick={() => move(-1)} aria-label="Previous month">‹</button>
              <button className="btn btn-small btn-ghost" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>Today</button>
              <button className="btn btn-small btn-ghost" onClick={() => move(1)} aria-label="Next month">›</button>
            </>
          }
        >
          {loading && !events && <Loading />}
          <div className="calendar" role="grid" aria-label={monthName}>
            {WEEKDAYS.map((d) => <div key={d} className="cal-head" role="columnheader">{d}</div>)}
            {days.map((d) => {
              const key = iso(d)
              const todays = (events || []).filter((e) => e.startDate <= key && e.endDate >= key)
              const classes = ['cal-day', d.getMonth() !== cursor.month && 'outside', key === todayIso && 'today', [0, 6].includes(d.getDay()) && 'weekend'].filter(Boolean).join(' ')
              return (
                <div key={key} className={classes} role="gridcell">
                  <span className="cal-num">{d.getDate()}</span>
                  {todays.map((e) => (
                    <button
                      key={e.id}
                      className={`cal-event cat-${e.category}`}
                      title={e.title}
                      onClick={() => (isAdmin ? setEditing(e) : null)}
                      disabled={!isAdmin}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </Card>
        <Card title="This month">
          {events && (inMonth.length ? (
            <ul className="list">
              {inMonth.map((e) => (
                <li key={e.id}>
                  <div className="spread">
                    <strong>{e.title}</strong>
                    <Badge tone={CATEGORY_TONE[e.category]}>{label(e.category)}</Badge>
                  </div>
                  <div className="muted small"><EventDates e={e} />{isAdmin && ` · ${AUDIENCE_TEXT[e.audience]}`}</div>
                  {e.description && <p className="small">{e.description}</p>}
                  {isAdmin && <button className="link small" onClick={() => setEditing(e)}>Edit</button>}
                </li>
              ))}
            </ul>
          ) : <Empty>No events this month.</Empty>)}
        </Card>
      </div>
      {editing && <EventForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}
