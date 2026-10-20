import { useParams } from 'react-router-dom'
import { useApi } from '../services/useApi'
import { className, date, label, money } from '../services/format'
import { Alert, Loading } from '../components/ui'

export default function Receipt() {
  const { paymentId } = useParams()
  const { data, error } = useApi(`/fees/payments/${paymentId}/receipt`)

  if (error) return <div className="print-page"><Alert>{error}</Alert></div>
  if (!data) return <Loading />
  const { payment: p, balanceAfter } = data

  return (
    <div className="print-page">
      <div className="no-print actions">
        <button className="btn btn-primary" onClick={() => window.print()}>Print receipt</button>
      </div>
      <article className="report receipt">
        <header className="report-head">
          <img src="/favicon.svg" alt="" width="56" height="56" />
          <div>
            <h1>Global Virgins Montessori Academy</h1>
            <p>Official Payment Receipt</p>
          </div>
        </header>
        <dl className="report-info">
          <dt>Receipt no.</dt><dd><strong>{p.receiptNo}</strong></dd>
          <dt>Date</dt><dd>{date(p.paidOn)}</dd>
          <dt>Pupil</dt><dd>{p.Student.lastName} {p.Student.firstName}</dd>
          <dt>Admission no.</dt><dd>{p.Student.admissionNo}</dd>
          <dt>Class</dt><dd>{className(p.Student.SchoolClass)}</dd>
          <dt>Term</dt><dd>{p.Term.name} Term, {p.Term.AcademicSession.name}</dd>
          <dt>Payment method</dt><dd>{label(p.method)}</dd>
          <dt>Amount paid</dt><dd className="big">{money(p.amount)}</dd>
          <dt>Balance outstanding</dt><dd>{money(balanceAfter)}</dd>
          <dt>Received by</dt><dd>{p.recordedBy?.fullName || '—'}</dd>
        </dl>
        <div className="signatures"><span>Bursar's signature</span><span>School stamp</span></div>
      </article>
    </div>
  )
}
