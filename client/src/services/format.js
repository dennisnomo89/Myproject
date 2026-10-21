const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 })

export const money = (n) => naira.format(Number(n) || 0)

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

export const today = () => new Date().toISOString().slice(0, 10)

export const className = (c) => (c ? `${c.name}${c.arm ? ` ${c.arm}` : ''}` : '—')

export const studentName = (s) => (s ? `${s.lastName} ${s.firstName}` : '')

export const label = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '')
