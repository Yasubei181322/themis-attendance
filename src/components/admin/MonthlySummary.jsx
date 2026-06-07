import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import {
  calcMonthlySummary, formatMinutes, formatDate, formatTime,
  getWorkMinutes, getEffectiveBreakMinutes, calculatePay,
} from '../../utils/calculations.js'

function DailyDetail({ records, staff }) {
  const sorted = [...records].sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>日付</th>
          <th>出勤</th>
          <th>退勤</th>
          <th>休憩</th>
          <th>勤務時間</th>
          {staff.employmentType === 'parttime' && <><th>残業</th><th>深夜</th></>}
          <th>日当</th>
          <th>交通費</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => {
          if (!r.clockOut) return null
          const workMins = getWorkMinutes(r)
          const breakMins = getEffectiveBreakMinutes(r)
          const pay = calculatePay(r, staff)
          return (
            <tr key={r.id}>
              <td>{formatDate(r.clockIn)}</td>
              <td>{formatTime(r.clockIn)}</td>
              <td>{formatTime(r.clockOut)}</td>
              <td>{breakMins}分</td>
              <td>{formatMinutes(workMins)}</td>
              {staff.employmentType === 'parttime' && (
                <>
                  <td>{formatMinutes(pay.overtimeMinutes)}</td>
                  <td>{formatMinutes(pay.lateNightMinutes)}</td>
                </>
              )}
              <td><strong>{pay.totalPay.toLocaleString()}円</strong></td>
              <td>{(r.transportationFee || 0).toLocaleString()}円</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function MonthlySummary() {
  const { staffList, records } = useApp()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [expandedId, setExpandedId] = useState(null)

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1]

  const summaries = staffList.map(staff => ({
    staff,
    summary: calcMonthlySummary(records, staff, year, month),
  }))

  const grandTotal = summaries.reduce((acc, { summary: s }) => ({
    workDays: acc.workDays + s.workDays,
    totalLaborPay: acc.totalLaborPay + s.totalLaborPay,
    totalTransportation: acc.totalTransportation + s.totalTransportation,
    withholdingTax: acc.withholdingTax + s.withholdingTax,
    netPay: acc.netPay + s.netPay,
  }), { workDays: 0, totalLaborPay: 0, totalTransportation: 0, withholdingTax: 0, netPay: 0 })

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>月次集計</h2>
        <div className="filter-row">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
          </select>
        </div>
      </div>

      <div className="table-scroll">
        <table className="admin-table summary-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>契約形態</th>
              <th>出勤日数</th>
              <th>総勤務時間</th>
              <th>残業時間</th>
              <th>深夜時間</th>
              <th>時給</th>
              <th>労働報酬</th>
              <th>交通費</th>
              <th>源泉徴収</th>
              <th>支払合計</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ staff, summary: s }) => (
              <React.Fragment key={staff.id}>
                <tr className={s.workDays === 0 ? 'no-work-row' : ''}>
                  <td>{staff.name}</td>
                  <td>
                    <span className={`emp-badge ${staff.employmentType}`}>
                      {staff.employmentType === 'parttime' ? 'アルバイト' : '業務委託'}
                    </span>
                  </td>
                  <td>{s.workDays}日</td>
                  <td>{formatMinutes(s.totalWorkMinutes)}</td>
                  <td>{staff.employmentType === 'parttime' ? formatMinutes(s.totalOvertimeMinutes) : <span className="muted">-</span>}</td>
                  <td>{staff.employmentType === 'parttime' ? formatMinutes(s.totalLateNightMinutes) : <span className="muted">-</span>}</td>
                  <td><strong>{staff.hourlyRate.toLocaleString()}円</strong></td>
                  <td><strong>{s.totalLaborPay.toLocaleString()}円</strong></td>
                  <td>{s.totalTransportation.toLocaleString()}円</td>
                  <td className={s.withholdingTax > 0 ? 'withholding' : 'muted'}>
                    {s.withholdingTax > 0 ? `-${s.withholdingTax.toLocaleString()}円` : '-'}
                  </td>
                  <td className="total-pay"><strong>{s.netPay.toLocaleString()}円</strong></td>
                  <td>
                    {s.workDays > 0 && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setExpandedId(expandedId === staff.id ? null : staff.id)}
                      >
                        {expandedId === staff.id ? '▲' : '▼ 詳細'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === staff.id && (
                  <tr className="detail-row">
                    <td colSpan="12">
                      <DailyDetail records={s.records} staff={staff} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="grand-total">
              <td colSpan="2"><strong>合計</strong></td>
              <td><strong>{grandTotal.workDays}日</strong></td>
              <td colSpan="4"></td>
              <td><strong>{grandTotal.totalLaborPay.toLocaleString()}円</strong></td>
              <td><strong>{grandTotal.totalTransportation.toLocaleString()}円</strong></td>
              <td><strong>{grandTotal.withholdingTax > 0 ? `-${grandTotal.withholdingTax.toLocaleString()}円` : '-'}</strong></td>
              <td><strong>{grandTotal.netPay.toLocaleString()}円</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
