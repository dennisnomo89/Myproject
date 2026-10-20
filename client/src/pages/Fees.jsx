import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, qs } from '../services/api'
import { useApi, useTerms } from '../services/useApi'
import { money } from '../services/format'
import { Alert, Card, ClassSelect, Empty, Field, Loading, PageHeader, Stat, TermSelect } from '../components/ui'
import { PaymentModal } from './StudentDetail'

function Collection({ termId }) {
  const { data, error, loading } = useApi(`/fees/reports/collection${qs({ termId })}`)
  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>
  const totals = data.reduce((a, r) => ({ billed: a.billed + r.billed, paid: a.paid + r.paid }), { billed: 0, paid: 0 })
  return (
    <>
      <div className="stats">
        <Stat label="Total billed" value={money(totals.billed)} />
        <Stat label="Total collected" value={money(totals.paid)} hint={totals.billed ? `${Math.round((totals.paid / totals.billed) * 100)}% collected` : null} />
        <Stat label="Outstanding" value={money(totals.billed - totals.paid)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Class</th><th className="num">Pupils</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Outstanding</th><th className="num">Owing</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.classId}>
                <td>{r.class}</td><td className="num">{r.students}</td><td className="num">{money(r.billed)}</td>
                <td className="num">{money(r.paid)}</td><td className="num">{money(r.outstanding)}</td><td className="num">{r.studentsOwing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Debtors({ termId, classes }) {
  const [classId, setClassId] = useState('')
  const { data, error, loading, reload } = useApi(`/fees/reports/debtors${qs({ termId, classId })}`)
  const [paying, setPaying] = useState(null)
  const [reminder, setReminder] = useState({})
  const [sending, setSending] = useState(false)

  const sendReminders = async () => {
    const scope = classId ? 'this class' : 'the whole school'
    if (!window.confirm(`Email a fee reminder to the parents of every pupil in ${scope} who still owes fees?`)) return
    setSending(true)
    try {
      const res = await api.post('/fees/reminders', { termId, classId: classId || undefined })
      setReminder({ type: res.emails ? 'success' : 'info', text: res.message })
    } catch (err) {
      setReminder({ type: 'error', text: err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <ClassSelect classes={classes} value={classId} onChange={setClassId} allowAll />
        {data?.length > 0 && (
          <button className="btn" onClick={sendReminders} disabled={sending}>{sending ? 'Sending…' : 'Email reminders to parents'}</button>
        )}
      </div>
      <Alert type={reminder.type} onClose={() => setReminder({})}>{reminder.text}</Alert>
      {loading && <Loading />}
      <Alert>{error}</Alert>
      {data && (data.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pupil</th><th>Class</th><th className="num">Billed</th><th className="num">Paid</th><th className="num">Balance</th><th /></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.studentId}>
                  <td><Link to={`/students/${r.studentId}`}>{r.name}</Link><div className="muted small">{r.admissionNo}</div></td>
                  <td>{r.class}</td><td className="num">{money(r.billed)}</td><td className="num">{money(r.paid)}</td>
                  <td className="num"><strong>{money(r.balance)}</strong></td>
                  <td><button className="btn btn-small" onClick={() => setPaying(r)}>Record payment</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No outstanding balances. 🎉</Empty>)}
      {paying && (
        <PaymentModal
          studentId={paying.studentId}
          termId={termId}
          balance={paying.balance}
          onClose={() => setPaying(null)}
          onSaved={() => { setPaying(null); reload() }}
        />
      )}
    </>
  )
}

function Structure({ termId, classes }) {
  const [classId, setClassId] = useState('')
  const { data: items, error, reload } = useApi(classId ? `/fees/items${qs({ termId, classId })}` : null)
  const [form, setForm] = useState({ description: '', amount: '' })
  const [message, setMessage] = useState('')

  useEffect(() => { if (!classId && classes?.length) setClassId(classes[0].id) }, [classes, classId])

  const add = async (e) => {
    e.preventDefault()
    try {
      await api.post('/fees/items', { ...form, classId, termId })
      setForm({ description: '', amount: '' })
      setMessage('')
      reload()
    } catch (err) {
      setMessage(err.message)
    }
  }
  const remove = async (id) => {
    if (!window.confirm('Remove this fee item?')) return
    await api.del(`/fees/items/${id}`)
    reload()
  }

  const total = (items || []).reduce((a, i) => a + Number(i.amount), 0)
  return (
    <>
      <div className="toolbar"><ClassSelect classes={classes} value={classId} onChange={setClassId} /></div>
      <Alert>{error || message}</Alert>
      {items && (
        <table>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.description}</td><td className="num">{money(i.amount)}</td>
                <td><button className="link danger" onClick={() => remove(i.id)}>Remove</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="3"><Empty>No fees set for this class yet.</Empty></td></tr>}
          </tbody>
          <tfoot><tr><td>Total per pupil</td><td className="num"><strong>{money(total)}</strong></td><td /></tr></tfoot>
        </table>
      )}
      <form className="form-row inline-form" onSubmit={add}>
        <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tuition" required /></Field>
        <Field label="Amount (₦)"><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
        <button className="btn btn-primary">Add item</button>
      </form>
    </>
  )
}

export default function Fees() {
  const { terms, current } = useTerms()
  const { data: classes } = useApi('/classes')
  const [termId, setTermId] = useState(null)
  const [view, setView] = useState('collection')
  useEffect(() => { if (!termId && current) setTermId(current.id) }, [current, termId])

  const tabs = [['collection', 'Collection summary'], ['debtors', 'Outstanding balances'], ['structure', 'Fee structure']]
  return (
    <>
      <PageHeader title="Fees" subtitle="Fee structure, payments and outstanding balances" />
      <Card
        title={
          <div className="tabs" role="tablist">
            {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>{t}</button>)}
          </div>
        }
        actions={terms.length > 0 && <TermSelect terms={terms} value={termId} onChange={setTermId} />}
      >
        {!termId && <Empty>Create an academic session on the Sessions &amp; Terms page first.</Empty>}
        {termId && view === 'collection' && <Collection termId={termId} />}
        {termId && view === 'debtors' && <Debtors termId={termId} classes={classes} />}
        {termId && view === 'structure' && <Structure termId={termId} classes={classes} />}
      </Card>
    </>
  )
}
