import { useEffect, useState } from 'react'
import { downloadFile, qs } from '../services/api'
import { useApi, useTerms } from '../services/useApi'
import { money } from '../services/format'
import { Alert, Card, ClassSelect, Empty, Field, Loading, PageHeader, TermSelect } from '../components/ui'

const REPORTS = {
  enrolment: { label: 'Enrolment', usesTerm: false, usesClass: false, about: 'Active pupils in each class, by gender.' },
  attendance: { label: 'Attendance', usesTerm: true, usesClass: true, usesDates: true, about: "Each pupil's attendance for the term, or for dates you choose." },
  performance: { label: 'Academic performance', usesTerm: true, usesClass: true, about: "Each pupil's average, grade and position in class for the term." },
  fees: { label: 'Fee collection', usesTerm: true, usesClass: true, about: 'What each pupil was billed, has paid and still owes for the term.' },
}

function ReportTable({ data }) {
  const show = (col, value) => (value === null || value === undefined || value === '' ? '—' : col.money ? money(value) : col.key === 'rate' ? `${value}%` : value)
  if (!data.rows.length) return <Empty>No data for these filters.</Empty>
  return (
    <div className="table-wrap">
      <table className="report-view">
        <thead><tr>{data.columns.map((c) => <th key={c.key} className={c.numeric ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}>{data.columns.map((c) => <td key={c.key} className={c.numeric ? 'num' : ''}>{show(c, r[c.key])}</td>)}</tr>
          ))}
        </tbody>
        {data.totals && (
          <tfoot>
            <tr>{data.columns.map((c) => <td key={c.key} className={c.numeric ? 'num' : ''}>{data.totals[c.key] === undefined ? '' : show(c, data.totals[c.key])}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function Reports() {
  const { data: available } = useApi('/reports')
  const { data: classes } = useApi('/classes')
  const { terms, current } = useTerms()
  const [type, setType] = useState(null)
  const [termId, setTermId] = useState(null)
  const [classId, setClassId] = useState('')
  const [dates, setDates] = useState({ from: '', to: '' })
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { if (!type && available?.length) setType(available[0]) }, [available, type])
  useEffect(() => { if (!termId && current) setTermId(current.id) }, [current, termId])

  const meta = type && REPORTS[type]
  const datesSet = dates.from && dates.to
  const params = meta ? {
    ...(meta.usesTerm && !(meta.usesDates && datesSet) && { termId }),
    ...(meta.usesClass && { classId }),
    ...(meta.usesDates && datesSet && { from: dates.from, to: dates.to }),
  } : {}
  const ready = meta && (!meta.usesTerm || termId || (meta.usesDates && datesSet))
  const { data, error, loading } = useApi(ready ? `/reports/${type}${qs(params)}` : null)

  const download = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadFile(`/reports/${type}${qs({ ...params, format: 'csv' })}`, `gvma-${type}-report.csv`)
    } catch (err) {
      setDownloadError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="View school reports, download them for Excel, or print them" />
      {available && !available.length && <Card><Empty>No reports are available for your role.</Empty></Card>}
      {meta && (
        <Card
          className="no-print"
          title={
            <div className="tabs" role="tablist">
              {available.map((k) => (
                <button key={k} role="tab" aria-selected={type === k} className={type === k ? 'active' : ''} onClick={() => setType(k)}>{REPORTS[k].label}</button>
              ))}
            </div>
          }
        >
          <p className="muted small">{meta.about}</p>
          <div className="toolbar">
            {meta.usesTerm && terms.length > 0 && !(meta.usesDates && datesSet) && <TermSelect terms={terms} value={termId} onChange={setTermId} />}
            {meta.usesClass && <ClassSelect classes={classes} value={classId} onChange={setClassId} allowAll />}
            {meta.usesDates && (
              <>
                <Field label="From"><input type="date" value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} /></Field>
                <Field label="To"><input type="date" value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} /></Field>
                {datesSet && <button className="btn btn-small btn-ghost" onClick={() => setDates({ from: '', to: '' })}>Use term dates</button>}
              </>
            )}
            <span className="spacer" />
            <button className="btn" onClick={() => window.print()} disabled={!data}>Print</button>
            <button className="btn btn-primary" onClick={download} disabled={!data || downloading}>{downloading ? 'Preparing…' : 'Download CSV (Excel)'}</button>
          </div>
          <Alert>{downloadError}</Alert>
        </Card>
      )}
      <Alert>{error}</Alert>
      {loading && !data && <Loading />}
      {data && (
        <Card className="printable-report">
          <div className="print-only report-head">
            <img src="/favicon.svg" alt="" width="40" height="40" />
            <strong>Global Virgins Montessori Academy</strong>
          </div>
          <h2>{data.title}</h2>
          <p className="muted small">{data.subtitle} · {data.rows.length} row{data.rows.length === 1 ? '' : 's'}</p>
          <ReportTable data={data} />
        </Card>
      )}
    </>
  )
}
