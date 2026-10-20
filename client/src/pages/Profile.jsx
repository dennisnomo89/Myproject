import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { label } from '../services/format'
import { Alert, Card, Field, PageHeader } from '../components/ui'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ fullName: user.fullName, phone: user.phone || '', emailNotifications: user.emailNotifications !== false })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [msg, setMsg] = useState({ profile: {}, password: {} })

  const saveProfile = async (e) => {
    e.preventDefault()
    try {
      setUser(await api.patch('/auth/me', profile))
      setMsg({ ...msg, profile: { type: 'success', text: 'Profile updated' } })
    } catch (err) {
      setMsg({ ...msg, profile: { type: 'error', text: err.message } })
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.newPassword !== pw.confirm) {
      return setMsg({ ...msg, password: { type: 'error', text: 'The new passwords do not match' } })
    }
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
      setMsg({ ...msg, password: { type: 'success', text: 'Password changed' } })
    } catch (err) {
      setMsg({ ...msg, password: { type: 'error', text: err.message } })
    }
  }

  return (
    <>
      <PageHeader title="My Profile" subtitle={`${user.email} · ${label(user.role)}`} />
      <div className="grid-2">
        <Card title="Details">
          <form className="form" onSubmit={saveProfile}>
            <Alert type={msg.profile.type}>{msg.profile.text}</Alert>
            <Field label="Full name"><input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} required /></Field>
            <Field label="Phone"><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <label className="check">
              <input type="checkbox" checked={profile.emailNotifications} onChange={(e) => setProfile({ ...profile, emailNotifications: e.target.checked })} />
              <span>
                Email me school notifications
                <small className="muted" style={{ display: 'block' }}>
                  {user.role === 'parent' ? 'Report cards, fee reminders, payment receipts and announcements' : 'Announcements for staff'}
                </small>
              </span>
            </label>
            <div className="actions"><button className="btn btn-primary">Save</button></div>
          </form>
        </Card>
        <Card title="Change password">
          <form className="form" onSubmit={changePassword}>
            <Alert type={msg.password.type}>{msg.password.text}</Alert>
            <Field label="Current password"><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters"><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" /></Field>
            <div className="actions"><button className="btn btn-primary">Change password</button></div>
          </form>
        </Card>
      </div>
    </>
  )
}
