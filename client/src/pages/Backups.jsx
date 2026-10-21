import { useState } from 'react'
import { api, downloadFile } from '../services/api'
import { useApi } from '../services/useApi'
import { dateTime, label } from '../services/format'
import { Alert, Badge, Card, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

const KIND_TEXT = { manual: 'Manual', auto: 'Automatic', 'pre-restore': 'Before restore' }
const KIND_TONE = { manual: 'info', auto: 'neutral', 'pre-restore': 'warn' }

const size = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`)

function RestoreDialog({ backup, onClose, onDone }) {
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const restore = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onDone(await api.post(`/backups/${backup.name}/restore`, { confirm }))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Restore backup" onClose={busy ? () => {} : onClose}>
      <form className="form" onSubmit={restore}>
        <Alert type="error">
          This replaces <strong>all</strong> current data — pupils, scores, fees, messages and user accounts — with the data from {dateTime(backup.createdAt)}.
          Anything entered since then will be lost.
        </Alert>
        <p className="small">A backup of the current data is saved first, so you can undo this by restoring that one.</p>
        <Alert>{error}</Alert>
        <Field label="Type RESTORE to confirm">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <div className="actions spread">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary danger-bg" disabled={busy || confirm !== 'RESTORE'}>{busy ? 'Restoring…' : 'Restore'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Backups() {
  const { data, error, loading, reload } = useApi('/backups')
  const [message, setMessage] = useState({})
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(null)

  const run = async (fn) => {
    setMessage({})
    try {
      await fn()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const backupNow = () => run(async () => {
    setBusy(true)
    try {
      const b = await api.post('/backups')
      const rows = Object.values(b.tables).reduce((a, n) => a + n, 0)
      setMessage({ type: 'success', text: `Backup saved (${rows.toLocaleString()} records, ${size(b.size)}).` })
      reload()
    } finally {
      setBusy(false)
    }
  })

  const remove = (b) => window.confirm(`Delete the backup from ${dateTime(b.createdAt)}? This cannot be undone.`)
    && run(async () => { await api.del(`/backups/${b.name}`); reload() })

  const restored = (result) => {
    setRestoring(null)
    setMessage({ type: 'success', text: `Restored the backup from ${dateTime(result.backupCreatedAt)}. The data from just before the restore was saved as a "Before restore" backup.` })
    reload()
  }

  return (
    <>
      <PageHeader
        title="Data Backup"
        subtitle="Copies of the whole database that can be downloaded or restored"
        actions={<button className="btn btn-primary" onClick={backupNow} disabled={busy}>{busy ? 'Backing up…' : 'Back up now'}</button>}
      />
      <Alert>{error}</Alert>
      <Alert type={message.type} onClose={() => setMessage({})}>{message.text}</Alert>
      {data && (
        <Alert type="info">
          An automatic backup runs every {data.schedule.intervalHours} hours while the server is running, and the newest {data.schedule.keep} are kept.
          Download a copy regularly and keep it somewhere safe, away from the server. Backups contain personal data and password hashes, so store them securely.
        </Alert>
      )}
      <Card>
        {loading && !data && <Loading />}
        {data && (data.backups.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Created</th><th>Type</th><th className="num">Size</th><th /></tr></thead>
              <tbody>
                {data.backups.map((b) => (
                  <tr key={b.name}>
                    <td className="nowrap">{dateTime(b.createdAt)}</td>
                    <td><Badge tone={KIND_TONE[b.kind]}>{KIND_TEXT[b.kind] || label(b.kind)}</Badge></td>
                    <td className="num">{size(b.size)}</td>
                    <td className="actions">
                      <button className="link" onClick={() => run(() => downloadFile(`/backups/${b.name}/download`, b.name))}>Download</button>
                      <button className="link" onClick={() => setRestoring(b)}>Restore</button>
                      <button className="link danger" onClick={() => remove(b)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No backups yet. Click “Back up now” to make the first one.</Empty>)}
      </Card>
      {restoring && <RestoreDialog backup={restoring} onClose={() => setRestoring(null)} onDone={restored} />}
    </>
  )
}
