import { useEffect } from 'react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          {title && (typeof title === 'string' ? <h2>{title}</h2> : title)}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Alert({ type = 'error', children, onClose }) {
  if (!children) return null
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button type="button" className="link" onClick={onClose} aria-label="Dismiss">×</button>}
    </div>
  )
}

export function Loading({ text = 'Loading…' }) {
  return <p className="muted loading">{text}</p>
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-header">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  )
}

export function TermSelect({ terms, value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(Number(e.target.value))} aria-label="Term">
      {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
    </select>
  )
}

export function ClassSelect({ classes, value, onChange, allowAll = false }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} aria-label="Class">
      {allowAll ? <option value="">All classes</option> : <option value="" disabled>Select class</option>}
      {(classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.arm ? ` ${c.arm}` : ''}</option>)}
    </select>
  )
}
