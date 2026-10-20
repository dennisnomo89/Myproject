import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import Attendance from './pages/Attendance'
import Scores from './pages/Scores'
import ReportCard from './pages/ReportCard'
import Fees from './pages/Fees'
import Receipt from './pages/Receipt'
import Classes from './pages/Classes'
import Announcements from './pages/Announcements'
import Users from './pages/Users'
import Settings from './pages/Settings'
import AuditLog from './pages/AuditLog'
import EmailLog from './pages/EmailLog'
import Timetable from './pages/Timetable'
import Calendar from './pages/Calendar'
import Messages from './pages/Messages'
import Backups from './pages/Backups'
import Profile from './pages/Profile'

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to="/" replace />
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <Loading text="Starting…" />
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  const staff = ['admin', 'teacher']
  return (
    <Routes>
      {/* Printable pages render without the sidebar. */}
      <Route path="/report/:studentId/:termId" element={<ReportCard />} />
      <Route path="/receipt/:paymentId" element={<Receipt />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<RequireRole roles={['admin', 'teacher', 'bursar']}><Students /></RequireRole>} />
        <Route path="children" element={<RequireRole roles={['parent']}><Students /></RequireRole>} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="attendance" element={<RequireRole roles={staff}><Attendance /></RequireRole>} />
        <Route path="scores" element={<RequireRole roles={staff}><Scores /></RequireRole>} />
        <Route path="fees" element={<RequireRole roles={['admin', 'bursar']}><Fees /></RequireRole>} />
        <Route path="classes" element={<RequireRole roles={['admin']}><Classes /></RequireRole>} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:id" element={<Messages />} />
        <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
        <Route path="settings" element={<RequireRole roles={['admin']}><Settings /></RequireRole>} />
        <Route path="audit-log" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />
        <Route path="email-log" element={<RequireRole roles={['admin']}><EmailLog /></RequireRole>} />
        <Route path="backups" element={<RequireRole roles={['admin']}><Backups /></RequireRole>} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
