import { useState } from 'react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { date } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, PageHeader } from '../components/ui'

function TermRow({ term, onChange, onError }) {
  const [dates, setDates] = useState({ startDate: term.startDate || '', endDate: term.endDate || '' })
  const run = async (fn) => {
    try { await fn(); onChange() } catch (err) { onError(err.message) }
  }
  const dirty = dates.startDate !== (term.startDate || '') || dates.endDate !== (term.endDate || '')
  const togglePublish = () => {
    const msg = term.resultsPublished
      ? 'Unpublish results? Parents will no longer see report cards for this term.'
      : 'Publish results? Parents will be emailed that report cards are ready, and teachers can no longer edit scores.'
    if (window.confirm(msg)) run(() => api.patch(`/terms/${term.id}`, { resultsPublished: !term.resultsPublished }))
  }

  return (
    <tr>
      <td>
        {term.name} Term {term.isCurrent && <Badge tone="good">Current</Badge>}
      </td>
      <td><input type="date" value={dates.startDate} onChange={(e) => setDates({ ...dates, startDate: e.target.value })} aria-label={`${term.name} term start`} /></td>
      <td><input type="date" value={dates.endDate} onChange={(e) => setDates({ ...dates, endDate: e.target.value })} aria-label={`${term.name} term end`} /></td>
      <td>{term.resultsPublished ? <Badge tone="good">Published</Badge> : <Badge>Not published</Badge>}</td>
      <td className="actions">
        {dirty && <button className="btn btn-small" onClick={() => run(() => api.patch(`/terms/${term.id}`, { startDate: dates.startDate || null, endDate: dates.endDate || null }))}>Save dates</button>}
        {!term.isCurrent && <button className="link" onClick={() => run(() => api.post(`/terms/${term.id}/set-current`))}>Make current</button>}
        <button className="link" onClick={togglePublish}>{term.resultsPublished ? 'Unpublish results' : 'Publish results'}</button>
      </td>
    </tr>
  )
}

export default function Settings() {
  const { data: sessions, error, loading, reload } = useApi('/sessions')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const create = async (e) => {
    e.preventDefault()
    try {
      await api.post('/sessions', { name })
      setName('')
      setMessage('')
      reload()
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <>
      <PageHeader title="Sessions & Terms" subtitle="Set the current term, term dates and publish results" />
      <Alert>{error || message}</Alert>
      <Card title="New academic session">
        <form className="form-row inline-form" onSubmit={create}>
          <Field label="Session name" hint="Creates First, Second and Third terms">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="2027/2028" pattern="\d{4}/\d{4}" required />
          </Field>
          <button className="btn btn-primary">Create session</button>
        </form>
      </Card>
      {loading && !sessions && <Loading />}
      {sessions && !sessions.length && <Card><Empty>No sessions yet.</Empty></Card>}
      {sessions && sessions.map((s) => (
        <Card key={s.id} title={`${s.name} Session`} actions={s.isCurrent && <Badge tone="good">Current session</Badge>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Term</th><th>Starts</th><th>Ends</th><th>Results</th><th /></tr></thead>
              <tbody>
                {s.Terms.map((t) => <TermRow key={`${t.id}-${t.updatedAt}`} term={t} onChange={reload} onError={setMessage} />)}
              </tbody>
            </table>
          </div>
          <p className="muted small">Term dates are used to count attendance on report cards{s.Terms[0]?.startDate ? ` (first term began ${date(s.Terms[0].startDate)})` : ''}.</p>
        </Card>
      ))}
    </>
  )
}
