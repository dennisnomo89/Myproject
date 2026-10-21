import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, qs } from '../services/api'
import { useApi } from '../services/useApi'
import { label } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

const ROLES = ['admin', 'teacher', 'bursar', 'parent']

function UserForm({ initial, onSaved, onClose }) {
  const [form, setForm] = useState({
    fullName: initial?.fullName || '', email: initial?.email || '', phone: initial?.phone || '',
    role: initial?.role || 'parent', password: '',
  })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (initial) {
        const { email: _email, password, ...rest } = form
        await api.patch(`/users/${initial.id}`, { ...rest, ...(password && { password }) })
      } else {
        await api.post('/users', form)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.fullName}` : 'Add user'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label="Full name"><input value={form.fullName} onChange={set('fullName')} required /></Field>
        <div className="form-row">
          <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required disabled={Boolean(initial)} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="form-row">
          <Field label="Role">
            <select value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </select>
          </Field>
          <Field label={initial ? 'New password (optional)' : 'Password'} hint="At least 8 characters">
            <input type="password" value={form.password} onChange={set('password')} required={!initial} minLength={8} autoComplete="new-password" />
          </Field>
        </div>
        <div className="actions"><button className="btn btn-primary">Save</button></div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const { data: users, error, loading, reload } = useApi(`/users${qs({ role, q })}`)
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive })
      reload()
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Staff and parent accounts" actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add user</button>} />
      <Card>
        <div className="toolbar">
          <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select>
        </div>
        <Alert>{error || message}</Alert>
        {loading && !users && <Loading />}
        {users && (users.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.fullName}</td><td>{u.email}</td><td>{u.phone || '—'}</td><td>{label(u.role)}</td>
                    <td><Badge tone={u.isActive ? 'good' : 'neutral'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                    <td className="actions">
                      <button className="link" onClick={() => setEditing(u)}>Edit</button>
                      {u.id !== me.id && <button className="link" onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No users found.</Empty>)}
      </Card>
      {editing && (
        <UserForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </>
  )
}
