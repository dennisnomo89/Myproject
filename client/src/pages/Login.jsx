import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert, Field } from '../components/ui'

const REASONS = {
  inactive: 'You were signed out because you were inactive for 30 minutes. Please sign in again.',
  expired: 'Your session has ended. Please sign in again.',
}

export function AuthCard({ children }) {
  return (
    <div className="login-page">
      <div className="card login-card">
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>Global Virgins Montessori Academy</h1>
        {children}
      </div>
    </div>
  )
}

export default function Login() {
  const { login, logoutReason } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <p className="muted">School Management Portal</p>
      <form className="form" onSubmit={submit}>
        {!error && logoutReason && <Alert type="info">{REASONS[logoutReason]}</Alert>}
        <Alert>{error}</Alert>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="small"><Link to="/forgot-password">Forgot your password?</Link></p>
    </AuthCard>
  )
}
