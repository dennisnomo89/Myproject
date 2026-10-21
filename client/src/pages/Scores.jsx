import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, qs } from '../services/api'
import { useApi, useTerms } from '../services/useApi'
import { Alert, Card, ClassSelect, Empty, Loading, PageHeader, TermSelect } from '../components/ui'

function ScoreEntry({ cls, termId, published, isAdmin }) {
  const { user } = useAuth()
  // Teachers only see subjects they teach, unless they are the class teacher.
  const subjects = useMemo(() => {
    const all = cls.ClassSubjects || []
    if (isAdmin || cls.classTeacher?.id === user.id) return all
    return all.filter((cs) => cs.teacherId === user.id)
  }, [cls, isAdmin, user.id])
  const [subjectId, setSubjectId] = useState('')
  const { data: sheet, error, loading } = useApi(subjectId ? `/scores${qs({ classId: cls.id, subjectId, termId })}` : null)
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!subjects.some((s) => s.SubjectId === subjectId)) setSubjectId(subjects[0]?.SubjectId || '')
  }, [subjects, subjectId])
  useEffect(() => { if (sheet) setRows(sheet.rows) }, [sheet])

  const update = (i, key, value) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  const locked = published && !isAdmin

  const save = async () => {
    setBusy(true)
    setMessage({})
    try {
      const scores = rows
        .filter((r) => r.caScore !== null && r.caScore !== '' && r.examScore !== null && r.examScore !== '')
        .map((r) => ({ studentId: r.studentId, caScore: Number(r.caScore), examScore: Number(r.examScore), remark: r.remark }))
      if (!scores.length) throw new Error('Enter both CA and exam scores for at least one pupil')
      const res = await api.post('/scores', { classId: cls.id, subjectId, termId, scores })
      setMessage({ type: 'success', text: res.message })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (!subjects.length) return <Empty>No subjects are assigned to you in this class.</Empty>
  const limits = sheet?.limits || { caMax: 40, examMax: 60 }

  return (
    <>
      <div className="toolbar">
        <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} aria-label="Subject">
          {subjects.map((s) => <option key={s.SubjectId} value={s.SubjectId}>{s.Subject.name}</option>)}
        </select>
        <span className="muted">CA out of {limits.caMax} · Exam out of {limits.examMax}</span>
      </div>
      {locked && <Alert type="info">Results for this term have been published, so scores are locked.</Alert>}
      <Alert>{error}</Alert>
      <Alert type={message.type} onClose={() => setMessage({})}>{message.text}</Alert>
      {loading && <Loading />}
      {sheet && (rows.length ? (
        <>
          <div className="table-wrap">
            <table className="score-table">
              <thead><tr><th>Pupil</th><th>CA</th><th>Exam</th><th>Total</th><th>Remark</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const total = r.caScore !== null && r.caScore !== '' && r.examScore !== null && r.examScore !== ''
                    ? Number(r.caScore) + Number(r.examScore) : ''
                  return (
                    <tr key={r.studentId}>
                      <td>{r.name}<div className="muted small">{r.admissionNo}</div></td>
                      <td><input type="number" min="0" max={limits.caMax} step="0.5" value={r.caScore ?? ''} disabled={locked} onChange={(e) => update(i, 'caScore', e.target.value)} aria-label={`CA score for ${r.name}`} /></td>
                      <td><input type="number" min="0" max={limits.examMax} step="0.5" value={r.examScore ?? ''} disabled={locked} onChange={(e) => update(i, 'examScore', e.target.value)} aria-label={`Exam score for ${r.name}`} /></td>
                      <td><strong>{total}</strong></td>
                      <td><input value={r.remark || ''} disabled={locked} onChange={(e) => update(i, 'remark', e.target.value)} aria-label={`Remark for ${r.name}`} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!locked && (
            <div className="actions">
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save scores'}</button>
            </div>
          )}
        </>
      ) : <Empty>There are no active pupils in this class.</Empty>)}
    </>
  )
}

function Broadsheet({ classId, termId }) {
  const { data, error, loading } = useApi(`/results/broadsheet${qs({ classId, termId })}`)
  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>
  if (!data.rows.length) return <Empty>No pupils in this class.</Empty>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pupil</th>
            {data.subjects.map((s) => <th key={s} className="num">{s}</th>)}
            <th className="num">Average</th><th>Position</th><th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.studentId}>
              <td>{r.name}</td>
              {data.subjects.map((s) => <td key={s} className="num">{r.totals[s] ?? '—'}</td>)}
              <td className="num"><strong>{r.average ?? '—'}</strong></td>
              <td>{r.position ?? '—'}</td>
              <td><Link to={`/report/${r.studentId}/${termId}`} target="_blank">Report card</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Scores() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [params] = useSearchParams()
  const { data: classes } = useApi('/classes')
  const { terms, current } = useTerms()
  const [classId, setClassId] = useState(Number(params.get('classId')) || '')
  const [termId, setTermId] = useState(null)
  const [view, setView] = useState('entry')

  useEffect(() => { if (!classId && classes?.length) setClassId(classes[0].id) }, [classes, classId])
  useEffect(() => { if (!termId && current) setTermId(current.id) }, [current, termId])

  const cls = classes?.find((c) => c.id === classId)
  const term = terms.find((t) => t.id === termId)

  return (
    <>
      <PageHeader title="Results" subtitle="Enter scores and review class performance" />
      <Card
        title={
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'entry'} className={view === 'entry' ? 'active' : ''} onClick={() => setView('entry')}>Score entry</button>
            <button role="tab" aria-selected={view === 'broadsheet'} className={view === 'broadsheet' ? 'active' : ''} onClick={() => setView('broadsheet')}>Broadsheet</button>
          </div>
        }
        actions={
          <>
            <ClassSelect classes={classes} value={classId} onChange={setClassId} />
            {terms.length > 0 && <TermSelect terms={terms} value={termId} onChange={setTermId} />}
          </>
        }
      >
        {!classes && <Loading />}
        {classes && !classes.length && <Empty>You are not assigned to any class.</Empty>}
        {cls && termId && view === 'entry' && <ScoreEntry key={`${cls.id}-${termId}`} cls={cls} termId={termId} published={term?.resultsPublished} isAdmin={isAdmin} />}
        {cls && termId && view === 'broadsheet' && <Broadsheet classId={cls.id} termId={termId} />}
      </Card>
    </>
  )
}
