import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { Alert, Field } from '../components/ui'
import { AuthCard } from './Login'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setSent((await api.post('/auth/forgot-password', { email })).message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <p className="muted">Reset your password</p>
      {sent ? (
        <Alert type="success">{sent}</Alert>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="small">Enter the email address for your account and we'll send you a link to choose a new password.</p>
          <Alert>{error}</Alert>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="small"><Link to="/">Back to sign in</Link></p>
    </AuthCard>
  )
}

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('The two passwords do not match')
    setBusy(true)
    setError('')
    try {
      setDone((await api.post('/auth/reset-password', { token, password })).message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <p className="muted">Choose a new password</p>
      {!token && <Alert>This link is incomplete. Please use the link from your email, or request a new one.</Alert>}
      {done ? (
        <>
          <Alert type="success">{done}</Alert>
          <Link className="btn btn-primary btn-block" to="/">Sign in</Link>
        </>
      ) : token && (
        <form className="form" onSubmit={submit}>
          <Alert>{error}</Alert>
          <Field label="New password" hint="At least 8 characters">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" autoFocus />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
        </form>
      )}
      {!done && <p className="small"><Link to="/forgot-password">Request a new link</Link> · <Link to="/">Back to sign in</Link></p>}
    </AuthCard>
  )
}
