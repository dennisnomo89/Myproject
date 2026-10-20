import { useApi } from '../services/useApi'
import { dateTime, label } from '../services/format'
import { Alert, Card, Empty, Loading, PageHeader } from '../components/ui'

// Turns the stored JSON details into a short readable string.
function details(raw) {
  try {
    const obj = JSON.parse(raw)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
  } catch {
    return raw
  }
}

export default function AuditLog() {
  const { data, error, loading } = useApi('/audit-log?limit=200')
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Who did what, and when" />
      <Card>
        <Alert>{error}</Alert>
        {loading && <Loading />}
        {data && (data.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{dateTime(a.createdAt)}</td>
                    <td>{a.User ? `${a.User.fullName} (${label(a.User.role)})` : 'System'}</td>
                    <td>{label(a.action)}</td>
                    <td className="muted small">{details(a.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No activity recorded yet.</Empty>)}
      </Card>
    </>
  )
}
