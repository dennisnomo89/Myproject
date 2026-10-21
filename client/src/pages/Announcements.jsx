import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { dateTime, label } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, PageHeader } from '../components/ui'

const AUDIENCE_TEXT = { all: 'Everyone', staff: 'Staff', parents: 'Parents' }

export default function Announcements() {
  const { user } = useAuth()
  const canPost = ['admin', 'teacher'].includes(user.role)
  const { data, error, loading, reload } = useApi('/announcements')
  const [form, setForm] = useState({ title: '', body: '', audience: user.role === 'admin' ? 'all' : 'parents', sendEmail: true })
  const [message, setMessage] = useState({})

  const post = async (e) => {
    e.preventDefault()
    try {
      await api.post('/announcements', form)
      setForm({ ...form, title: '', body: '' })
      setMessage({ type: 'success', text: 'Announcement posted' })
      reload()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }
  const remove = async (id) => {
    if (!window.confirm('Delete this announcement?')) return
    await api.del(`/announcements/${id}`)
    reload()
  }

  return (
    <>
      <PageHeader title="Announcements" />
      <div className={canPost ? 'grid-2-1' : ''}>
        <Card>
          <Alert>{error}</Alert>
          {loading && !data && <Loading />}
          {data && (data.length ? (
            <ul className="list">
              {data.map((a) => (
                <li key={a.id}>
                  <div className="spread">
                    <strong>{a.title}</strong>
                    <Badge>{AUDIENCE_TEXT[a.audience]}</Badge>
                  </div>
                  <p className="pre">{a.body}</p>
                  <small className="muted">
                    {a.postedBy ? `${a.postedBy.fullName} (${label(a.postedBy.role)})` : 'School'} · {dateTime(a.createdAt)}
                  </small>
                  {(user.role === 'admin' || a.postedBy?.id === user.id) && (
                    <button className="link danger small" onClick={() => remove(a.id)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          ) : <Empty>No announcements yet.</Empty>)}
        </Card>
        {canPost && (
          <Card title="Post an announcement">
            <form className="form" onSubmit={post}>
              <Alert type={message.type} onClose={() => setMessage({})}>{message.text}</Alert>
              <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={150} /></Field>
              <Field label="Message"><textarea rows="5" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></Field>
              <Field label="Audience">
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  {user.role === 'admin' && <option value="all">Everyone</option>}
                  <option value="parents">Parents</option>
                  <option value="staff">Staff</option>
                </select>
              </Field>
              <label className="check">
                <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
                <span>Also send by email</span>
              </label>
              <div className="actions"><button className="btn btn-primary">Post</button></div>
            </form>
          </Card>
        )}
      </div>
    </>
  )
}
