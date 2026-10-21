import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { dateTime, label } from '../services/format'
import { Alert, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

// Tells the sidebar badge to refresh after reading or sending.
const notifyUnreadChanged = () => window.dispatchEvent(new Event('messages:changed'))

function NewConversation({ onClose, onCreated }) {
  const { data: contacts, error: loadError } = useApi('/messages/contacts')
  const [form, setForm] = useState({ recipientId: '', studentId: '', subject: '', body: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const contact = contacts?.find((c) => c.user.id === Number(form.recipientId))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const conv = await api.post('/messages', {
        recipientId: Number(form.recipientId),
        studentId: form.studentId ? Number(form.studentId) : undefined,
        subject: form.subject,
        body: form.body,
      })
      onCreated(conv)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="New message" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Alert>{error || loadError}</Alert>
        {contacts && !contacts.length && <Empty>There is no one you can message yet.</Empty>}
        <Field label="To">
          <select value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value, studentId: '' })} required>
            <option value="">Select…</option>
            {(contacts || []).map((c) => (
              <option key={c.user.id} value={c.user.id}>{c.user.fullName} — {c.reason}</option>
            ))}
          </select>
        </Field>
        {contact && contact.students.length > 0 && (
          <Field label="About (optional)">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">General</option>
              {contact.students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.class ? ` (${s.class})` : ''}</option>)}
            </select>
          </Field>
        )}
        <Field label="Subject"><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={150} /></Field>
        <Field label="Message"><textarea rows="5" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={5000} /></Field>
        <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
    </Modal>
  )
}

function Thread({ id, onChanged }) {
  const { data, error, loading, reload } = useApi(`/messages/${id}`)
  const [body, setBody] = useState('')
  const [sendError, setSendError] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => {
    if (data) {
      notifyUnreadChanged()
      onChanged()
      end.current?.scrollIntoView({ block: 'end' })
    }
    // onChanged is stable enough for this purpose; re-run only when the thread data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setSendError('')
    try {
      await api.post(`/messages/${id}`, { body })
      setBody('')
      reload()
    } catch (err) {
      setSendError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Loading />
  if (error) return <Alert>{error}</Alert>
  if (!data) return null
  return (
    <div className="thread">
      <header className="thread-head">
        <div>
          <h2>{data.subject}</h2>
          <p className="muted small">
            With {data.with.fullName} ({label(data.with.role)}){data.student ? ` · About ${data.student.name}${data.student.class ? `, ${data.student.class}` : ''}` : ''}
          </p>
        </div>
        <Link className="btn btn-small btn-ghost mobile-only" to="/messages">Back</Link>
      </header>
      <div className="thread-messages">
        {data.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.fromMe ? 'mine' : 'theirs'}`}>
            <p className="pre">{m.body}</p>
            <small>{m.fromMe ? 'You' : m.sender.fullName} · {dateTime(m.createdAt)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="thread-reply" onSubmit={send}>
        <Alert>{sendError}</Alert>
        <textarea
          rows="3"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) send(e) }}
          placeholder="Write a reply…  (Ctrl+Enter to send)"
          aria-label="Reply"
          maxLength={5000}
          required
        />
        <div className="actions"><button className="btn btn-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
    </div>
  )
}

export default function Messages() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: conversations, error, loading, reload } = useApi('/messages')
  const [composing, setComposing] = useState(false)

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Private conversations between parents and school staff"
        actions={<button className="btn btn-primary" onClick={() => setComposing(true)}>+ New message</button>}
      />
      <Alert>{error}</Alert>
      <div className={`messages-layout card ${id ? 'has-thread' : ''}`}>
        <aside className="conversation-list">
          {loading && !conversations && <Loading />}
          {conversations && !conversations.length && <Empty>No messages yet.</Empty>}
          {conversations?.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className={`conversation ${String(c.id) === id ? 'active' : ''} ${c.unread ? 'unread' : ''}`}>
              <div className="spread">
                <strong>{c.with.fullName}</strong>
                {c.unread > 0 && <span className="count" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </div>
              <span className="conv-subject">{c.subject}</span>
              {c.lastMessage && <span className="muted small conv-preview">{c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}</span>}
              <span className="muted small">{dateTime(c.lastMessageAt)}</span>
            </Link>
          ))}
        </aside>
        <section className="thread-pane">
          {id ? <Thread key={id} id={id} onChanged={reload} /> : <Empty>Select a conversation, or start a new one.</Empty>}
        </section>
      </div>
      {composing && (
        <NewConversation
          onClose={() => setComposing(false)}
          onCreated={(conv) => { setComposing(false); reload(); navigate(`/messages/${conv.id}`) }}
        />
      )}
    </>
  )
}
