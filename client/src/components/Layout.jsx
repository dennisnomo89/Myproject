import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { label } from '../services/format'

// Sidebar entries and the roles that see them.
const NAV = [
  { to: '/', text: 'Dashboard', roles: ['admin', 'teacher', 'bursar', 'parent'], end: true },
  { to: '/students', text: 'Students', roles: ['admin', 'teacher', 'bursar'] },
  { to: '/children', text: 'My Children', roles: ['parent'] },
  { to: '/messages', text: 'Messages', roles: ['admin', 'teacher', 'bursar', 'parent'], badge: 'messages' },
  { to: '/attendance', text: 'Attendance', roles: ['admin', 'teacher'] },
  { to: '/scores', text: 'Results', roles: ['admin', 'teacher'] },
  { to: '/timetable', text: 'Timetable', roles: ['admin', 'teacher', 'bursar', 'parent'] },
  { to: '/calendar', text: 'Calendar', roles: ['admin', 'teacher', 'bursar', 'parent'] },
  { to: '/fees', text: 'Fees', roles: ['admin', 'bursar'] },
  { to: '/reports', text: 'Reports', roles: ['admin', 'bursar'] },
  { to: '/classes', text: 'Classes & Subjects', roles: ['admin'] },
  { to: '/announcements', text: 'Announcements', roles: ['admin', 'teacher', 'bursar', 'parent'] },
  { to: '/users', text: 'Users', roles: ['admin'] },
  { to: '/settings', text: 'Sessions & Terms', roles: ['admin'] },
  { to: '/email-log', text: 'Email Log', roles: ['admin'] },
  { to: '/audit-log', text: 'Audit Log', roles: ['admin'] },
  { to: '/backups', text: 'Data Backup', roles: ['admin'] },
]

const UNREAD_POLL_MS = 60_000

// Unread message count, refreshed every minute, on navigation, and when the Messages page reports a change.
function useUnreadMessages() {
  const [unread, setUnread] = useState(0)
  const location = useLocation()
  useEffect(() => {
    let alive = true
    const load = () => api.get('/messages/unread-count').then((r) => alive && setUnread(r.unread)).catch(() => {})
    load()
    const timer = setInterval(load, UNREAD_POLL_MS)
    window.addEventListener('messages:changed', load)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('messages:changed', load)
    }
  }, [location.pathname])
  return unread
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const unread = useUnreadMessages()
  const items = NAV.filter((n) => n.roles.includes(user.role))

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          ☰{unread > 0 && <span className="dot" aria-hidden="true" />}
        </button>
        <div className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>Global Virgins Montessori Academy</span>
        </div>
        <div className="user-menu">
          <NavLink to="/profile" className="user-chip">
            <strong>{user.fullName}</strong>
            <small>{label(user.role)}</small>
          </NavLink>
          <button type="button" className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <nav className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.text}
            {n.badge === 'messages' && unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
