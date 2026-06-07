import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import { formatDate, formatTime, getAutoBreakMinutes } from '../../utils/calculations.js'

export default function BreakRequestManagement() {
  const { staffList, records, approveBreakRequest, rejectBreakRequest } = useApp()
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectComment, setRejectComment] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')

  const requestRecords = records
    .filter(r => r.breakRequest && (filterStatus === 'all' || r.breakRequest.status === filterStatus))
    .sort((a, b) => new Date(b.breakRequest.requestedAt) - new Date(a.breakRequest.requestedAt))

  function handleApprove(r) {
    if (confirm(`${staffList.find(s=>s.id===r.staffId)?.name} の休憩修正申請を承認しますか？`)) {
      approveBreakRequest(r.id)
    }
  }

  function handleReject(r) {
    if (!rejectComment.trim()) { alert('却下理由を入力してください'); return }
    rejectBreakRequest(r.id, rejectComment.trim())
    setRejectingId(null)
    setRejectComment('')
  }

  const statusLabels = { pending: '申請中', approved: '承認済', rejected: '却下', all: '全て' }
  const statusCounts = {
    pending: records.filter(r => r.breakRequest?.status === 'pending').length,
    approved: records.filter(r => r.breakRequest?.status === 'approved').length,
    rejected: records.filter(r => r.breakRequest?.status === 'rejected').length,
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>休憩修正申請管理</h2>
        <div className="filter-row">
          {['pending','approved','rejected','all'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilterStatus(s)}
            >
              {statusLabels[s]}
              {s !== 'all' && statusCounts[s] > 0 && <span className="badge">{statusCounts[s]}</span>}
            </button>
          ))}
        </div>
      </div>

      {requestRecords.length === 0 ? (
        <div className="empty-state">該当する申請はありません</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>スタッフ</th>
              <th>勤務日</th>
              <th>出勤</th>
              <th>退勤</th>
              <th>自動控除</th>
              <th>申請休憩時間</th>
              <th>理由</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {requestRecords.map(r => {
              const staff = staffList.find(s => s.id === r.staffId)
              const req = r.breakRequest
              const grossMins = r.clockOut ? (new Date(r.clockOut) - new Date(r.clockIn)) / 60000 : 0
              const autoBreak = getAutoBreakMinutes(grossMins)
              return (
                <React.Fragment key={r.id}>
                  <tr>
                    <td>{staff?.name}</td>
                    <td>{formatDate(r.clockIn)}</td>
                    <td>{formatTime(r.clockIn)}</td>
                    <td>{r.clockOut ? formatTime(r.clockOut) : '-'}</td>
                    <td>{autoBreak}分</td>
                    <td><strong>{req.requestedBreakMinutes}分</strong></td>
                    <td className="note-cell">{req.reason}</td>
                    <td>
                      <span className={`status-badge status-${req.status}`}>
                        {{ pending: '申請中', approved: '承認済', rejected: '却下' }[req.status]}
                      </span>
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <>
                          <button className="btn btn-sm btn-approve" onClick={() => handleApprove(r)}>承認</button>
                          <button className="btn btn-sm btn-danger" onClick={() => { setRejectingId(r.id); setRejectComment('') }}>却下</button>
                        </>
                      )}
                      {req.status === 'rejected' && req.adminComment && (
                        <span className="muted small">{req.adminComment}</span>
                      )}
                    </td>
                  </tr>
                  {rejectingId === r.id && (
                    <tr className="reject-row">
                      <td colSpan="9">
                        <div className="reject-form">
                          <input
                            type="text"
                            placeholder="却下理由を入力してください"
                            value={rejectComment}
                            onChange={e => setRejectComment(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn-sm btn-danger" onClick={() => handleReject(r)}>確定却下</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setRejectingId(null)}>キャンセル</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
