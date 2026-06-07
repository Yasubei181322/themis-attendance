import React, { useState, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import {
  getWorkMinutes, getEffectiveBreakMinutes, getAutoBreakMinutes,
  formatDate, formatTime, formatMinutes,
} from '../../utils/calculations.js'

function BreakRequestForm({ record, onSubmit }) {
  const [minutes, setMinutes] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!record.clockOut) return null

  const req = record.breakRequest

  if (req) {
    const statusLabel = { pending: '申請中', approved: '承認済', rejected: '却下' }
    const statusClass = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' }
    return (
      <div className="break-request-status">
        <span className="label">休憩修正申請：</span>
        <span className={`status-badge ${statusClass[req.status]}`}>{statusLabel[req.status]}</span>
        <span className="req-detail"> {req.requestedBreakMinutes}分 / {req.reason}</span>
        {req.adminComment && <div className="admin-comment">管理者コメント：{req.adminComment}</div>}
      </div>
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    const m = parseInt(minutes)
    if (!m || m < 0 || m > 480) { setError('正しい時間（分）を入力してください'); return }
    if (!reason.trim()) { setError('理由を入力してください'); return }
    onSubmit(record.id, m, reason.trim())
    setMinutes('')
    setReason('')
    setError('')
  }

  return (
    <form className="break-request-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>実際の休憩時間（分）</label>
        <input
          type="number" min="0" max="480"
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          placeholder="例：60"
          style={{ width: 80 }}
        />
        <label style={{ marginLeft: 16 }}>理由</label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="修正理由を入力"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-sm btn-secondary">申請</button>
      </div>
      {error && <div className="error-msg">{error}</div>}
    </form>
  )
}

export default function StaffDashboard() {
  const { currentUser, staffList, logout, clockIn, clockOut, updateRecord, submitBreakRequest, getActiveRecord, getStaffRecords } = useApp()
  const [now, setNow] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const staff = staffList.find(s => s.id === currentUser.id)
  if (!staff) return null

  const activeRecord = getActiveRecord(staff.id)
  const allRecords = getStaffRecords(staff.id)

  const monthRecords = allRecords
    .filter(r => {
      const d = new Date(r.clockIn)
      return d.getFullYear() === selectedMonth.year && d.getMonth() + 1 === selectedMonth.month
    })
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))


  function handleClockIn() {
    if (!clockIn(staff.id)) alert('既に出勤中です')
  }

  function handleClockOut() {
    if (!clockOut(staff.id)) alert('出勤記録がありません')
  }

  // Generate month options (last 6 months)
  const monthOptions = []
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthOptions.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="brand-icon">⚖</span>
          <span className="brand-name">勤怠管理　Themis</span>
        </div>
        <div className="header-user">
          <span className="user-name">{staff.name}</span>
          <button className="btn btn-outline-sm" onClick={logout}>ログアウト</button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Clock widget */}
        <section className="clock-section">
          <div className="current-time">{now.toLocaleTimeString('ja-JP')}</div>
          <div className="current-date">{now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>

          <div className="clock-status">
            {activeRecord ? (
              <>
                <div className="status-clocked-in">
                  <span className="status-dot active" />
                  出勤中 &nbsp;
                  <span className="clock-since">{formatTime(activeRecord.clockIn)} より</span>
                </div>
                <button className="btn btn-clock btn-clockout" onClick={handleClockOut}>退 勤</button>
              </>
            ) : (
              <>
                <div className="status-clocked-out">
                  <span className="status-dot" />
                  未出勤
                </div>
                <button className="btn btn-clock btn-clockin" onClick={handleClockIn}>出 勤</button>
              </>
            )}
          </div>
        </section>

        {/* Monthly records */}
        <section className="records-section">
          <div className="section-header">
            <h2>勤怠履歴</h2>
            <select
              value={`${selectedMonth.year}-${selectedMonth.month}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                setSelectedMonth({ year: parseInt(y), month: parseInt(m) })
              }}
            >
              {monthOptions.map(o => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {o.year}年{o.month}月
                </option>
              ))}
            </select>
          </div>

          {monthRecords.length === 0 ? (
            <div className="empty-state">この月の勤怠記録はありません</div>
          ) : (
            <div className="records-table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th>休憩</th>
                    <th>勤務時間</th>
                    <th>片道交通費</th>
                    <th>往復交通費</th>
                    <th>備考</th>
                    <th>休憩申請</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRecords.map(r => {
                    const workMins = getWorkMinutes(r)
                    const breakMins = getEffectiveBreakMinutes(r)
                    return (
                      <React.Fragment key={r.id}>
                        <tr>
                          <td>{formatDate(r.clockIn)}</td>
                          <td>{formatTime(r.clockIn)}</td>
                          <td>{r.clockOut ? formatTime(r.clockOut) : <span className="in-progress">出勤中</span>}</td>
                          <td>{r.clockOut ? `${breakMins}分` : '-'}</td>
                          <td>{r.clockOut ? formatMinutes(workMins) : '-'}</td>
                          <td>
                            <input
                              type="number" min="0"
                              className="transport-input"
                              value={r.transportationFee || 0}
                              onChange={e => updateRecord(r.id, { transportationFee: parseInt(e.target.value) || 0 })}
                            />円
                          </td>
                          <td>
                            <input
                              type="number" min="0"
                              className="transport-input"
                              value={r.transportationRoundTrip || 0}
                              onChange={e => updateRecord(r.id, { transportationRoundTrip: parseInt(e.target.value) || 0 })}
                            />円
                          </td>
                          <td>
                            <input
                              type="text"
                              className="note-input"
                              value={r.note || ''}
                              onChange={e => updateRecord(r.id, { note: e.target.value })}
                              placeholder="備考"
                            />
                          </td>
                          <td>
                            {r.breakRequest ? (
                              <span className={`status-badge status-${r.breakRequest.status}`}>
                                {{ pending: '申請中', approved: '承認済', rejected: '却下' }[r.breakRequest.status]}
                              </span>
                            ) : r.clockOut ? '未申請' : '-'}
                          </td>
                        </tr>
                        {r.clockOut && (
                          <tr className="break-request-row">
                            <td colSpan="8">
                              <BreakRequestForm record={r} onSubmit={submitBreakRequest} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
