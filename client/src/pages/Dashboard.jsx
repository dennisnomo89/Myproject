import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../services/useApi'
import { money, dateTime, label } from '../services/format'
import { Alert, Badge, Card, Empty, Loading, PageHeader, Stat } from '../components/ui'
import { EventDates } from './Calendar'

function Announcements({ items }) {
  if (!items.length) return <Empty>No announcements yet.</Empty>
  return (
    <ul className="list">
      {items.map((a) => (
        <li key={a.id}>
          <strong>{a.title}</strong>
          <p>{a.body}</p>
          <small className="muted">{dateTime(a.createdAt)}</small>
        </li>
      ))}
    </ul>
  )
}

function AdminView({ data, isAdmin }) {
  const s = data.stats
  return (
    <>
      <div className="stats">
        <Stat label="Active pupils" value={s.students} />
        <Stat label="Teachers" value={s.teachers} />
        <Stat label="Classes" value={s.classes} />
        <Stat label="Present today" value={s.markedToday ? `${s.presentToday} / ${s.markedToday}` : '—'} hint={s.markedToday ? null : 'No attendance taken yet'} />
        <Stat label="Fees collected this term" value={money(s.feesCollectedThisTerm)} />
      </div>
      {isAdmin && (
        <Card title="Recent activity" actions={<Link to="/audit-log">View all</Link>}>
          {data.recentActivity.length ? (
            <table>
              <tbody>
                {data.recentActivity.map((a) => (
                  <tr key={a.id}>
                    <td>{a.User ? a.User.fullName : 'System'}</td>
                    <td>{label(a.action)}</td>
                    <td className="muted">{dateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No activity yet.</Empty>}
        </Card>
      )}
    </>
  )
}

function UpcomingEvents({ items }) {
  if (!items.length) return <Empty>Nothing scheduled.</Empty>
  return (
    <ul className="list">
      {items.map((e) => (
        <li key={e.id}>
          <strong>{e.title}</strong>
          <div className="muted small"><EventDates e={e} /> · {label(e.category)}</div>
        </li>
      ))}
    </ul>
  )
}

function TeacherView({ data }) {
  return (
    <>
    <Card title="Today's lessons" actions={<Link to="/timetable">My week</Link>}>
      {data.todaysLessons.length ? (
        <table>
          <tbody>
            {data.todaysLessons.map((l) => (
              <tr key={l.id}><td className="nowrap">{l.startTime}–{l.endTime}</td><td><strong>{l.subject}</strong></td><td>{l.class}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>No lessons today.</Empty>}
    </Card>
    <Card title="My classes">
      {data.classes.length ? (
        <div className="tiles">
          {data.classes.map((c) => (
            <div key={c.id} className="tile">
              <h3>{c.name}</h3>
              <p className="muted">{c.students} pupils{c.isClassTeacher ? ' · Class teacher' : ''}</p>
              {c.attendanceTakenToday ? <Badge tone="good">Attendance taken</Badge> : <Badge tone="warn">Attendance not taken</Badge>}
              <div className="actions">
                <Link className="btn btn-small" to={`/attendance?classId=${c.id}`}>Take attendance</Link>
                <Link className="btn btn-small btn-ghost" to={`/scores?classId=${c.id}`}>Enter scores</Link>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>You have not been assigned to any class yet.</Empty>}
    </Card>
    </>
  )
}

function ParentView({ data }) {
  return (
    <Card title="My children">
      {data.children.length ? (
        <div className="tiles">
          {data.children.map((c) => (
            <Link key={c.id} to={`/students/${c.id}`} className="tile tile-link">
              <h3>{c.name}</h3>
              <p className="muted">{c.class || 'No class'} · {c.admissionNo}</p>
              <span>View attendance, results and fees →</span>
            </Link>
          ))}
        </div>
      ) : <Empty>No children are linked to your account. Please contact the school office.</Empty>}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useApi('/dashboard')
  const term = data && data.currentTerm

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName}`}
        subtitle={term ? `${term.name} Term in progress` : 'No current term has been set'}
      />
      <Alert>{error}</Alert>
      {loading && <Loading />}
      {data && (
        <div className="grid-2-1">
          <div>
            {['admin', 'bursar'].includes(user.role) && <AdminView data={data} isAdmin={user.role === 'admin'} />}
            {user.role === 'teacher' && <TeacherView data={data} />}
            {user.role === 'parent' && <ParentView data={data} />}
          </div>
          <div>
            <Card title="Coming up" actions={<Link to="/calendar">Calendar</Link>}>
              <UpcomingEvents items={data.upcomingEvents} />
            </Card>
            <Card title="Announcements" actions={<Link to="/announcements">All</Link>}>
              <Announcements items={data.latestAnnouncements} />
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
