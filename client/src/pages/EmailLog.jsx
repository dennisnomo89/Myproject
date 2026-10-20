import { useState } from 'react'
import { qs } from '../services/api'
import { useApi } from '../services/useApi'
import { dateTime, label } from '../services/format'
import { Alert, Badge, Card, Empty, Loading, Modal, PageHeader } from '../components/ui'

const EVENTS = ['results_published', 'fee_reminder', 'payment_received', 'announcement']
const STATUS_TONE = { sent: 'good', logged: 'neutral', failed: 'bad' }

const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

export default function EmailLog() {
  const [event, setEvent] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const { data, error, loading } = useApi(`/email-log${qs({ event, status, limit: 200 })}`)

  return (
    <>
      <PageHeader title="Email Log" subtitle="Notification emails sent to parents and staff" />
      {data?.mode === 'log' && (
        <Alert type="info">
          Development mode: emails are recorded here but not actually sent. Add SMTP settings to server/.env to send real emails.
        </Alert>
      )}
      <Card>
        <div className="toolbar">
          <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Event">
            <option value="">All events</option>
            {EVENTS.map((e) => <option key={e} value={e}>{label(e)}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="logged">Logged only</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <Alert>{error}</Alert>
        {loading && !data && <Loading />}
        {data && (data.emails.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>To</th><th>Event</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {data.emails.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => setOpen(e)}>
                    <td className="nowrap">{dateTime(e.createdAt)}</td>
                    <td>{e.to}</td>
                    <td>{label(e.event)}</td>
                    <td><button className="link" onClick={() => setOpen(e)}>{e.subject}</button></td>
                    <td><Badge tone={STATUS_TONE[e.status]}>{e.status === 'logged' ? 'Logged only' : label(e.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No emails yet. They appear here when results are published, reminders are sent, payments are recorded or announcements are posted.</Empty>)}
      </Card>
      {open && (
        <Modal title={open.subject} onClose={() => setOpen(null)}>
          <p className="muted small">To {open.to} · {dateTime(open.createdAt)}</p>
          {open.error && <Alert>{open.error}</Alert>}
          {/* Sandboxed so the email HTML cannot run scripts or touch the app. */}
          <iframe className="email-preview" title="Email preview" sandbox="" srcDoc={open.html || `<pre>${escapeHtml(open.text)}</pre>`} />
        </Modal>
      )}
    </>
  )
}
