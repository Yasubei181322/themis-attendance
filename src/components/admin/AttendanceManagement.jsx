import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import { getWorkMinutes, getEffectiveBreakMinutes, formatDate, formatTime, formatMinutes } from '../../utils/calculations.js'

export default function AttendanceManagement() {
  const { staffList, records, updateRecord, deleteRecord } = useApp()
  const [filterStaff, setFilterStaff] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const filtered = records
    .filter(r => {
      if (filterStaff && r.staffId !== filterStaff) return false
      const d = new Date(r.clockIn)
      return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth
    })
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))

  function startEdit(r) {
    setEditingId(r.id)
    setEditData({
      clockIn: r.clockIn ? r.clockIn.slice(0, 16) : '',
      clockOut: r.clockOut ? r.clockOut.slice(0, 16) : '',
      transportationFee: r.transportationFee || 0,
      transportationRoundTrip: r.transportationRoundTrip || 0,
      note: r.note || '',
    })
  }

  function saveEdit(id) {
    const updates = {
      clockIn: editData.clockIn ? new Date(editData.clockIn).toISOString() : null,
      clockOut: editData.clockOut ? new Date(editData.clockOut).toISOString() : null,
      transportationFee: parseInt(editData.transportationFee) || 0,
      transportationRoundTrip: parseInt(editData.transportationRoundTrip) || 0,
      note: editData.note,
    }
    updateRecord(id, updates)
    setEditingId(null)
  }

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1]

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>勤怠記録管理</h2>
        <div className="filter-row">
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
            <option value="">全スタッフ</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}>
            {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">該当する勤怠記録がありません</div>
      ) : (
        <table className="admin-table admin-table-wide">
          <thead>
            <tr>
              <th>スタッフ</th>
              <th>日付</th>
              <th>出勤</th>
              <th>退勤</th>
              <th>休憩</th>
              <th>勤務時間</th>
              <th>片道交通費</th>
              <th>往復交通費</th>
              <th>備考</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const staff = staffList.find(s => s.id === r.staffId)
              const breakMins = getEffectiveBreakMinutes(r)
              const workMins = getWorkMinutes(r)
              return (
                <tr key={r.id}>
                  <td>{staff?.name || r.staffId}</td>
                  {editingId === r.id ? (
                    <>
                      <td colSpan="2">
                        <input type="datetime-local" value={editData.clockIn} onChange={e=>setEditData(p=>({...p,clockIn:e.target.value}))} className="inline-input" />
                      </td>
                      <td>
                        <input type="datetime-local" value={editData.clockOut} onChange={e=>setEditData(p=>({...p,clockOut:e.target.value}))} className="inline-input" />
                      </td>
                      <td>-</td>
                      <td>-</td>
                      <td><input type="number" min="0" value={editData.transportationFee} onChange={e=>setEditData(p=>({...p,transportationFee:e.target.value}))} className="inline-input" style={{width:70}} /></td>
                      <td><input type="number" min="0" value={editData.transportationRoundTrip} onChange={e=>setEditData(p=>({...p,transportationRoundTrip:e.target.value}))} className="inline-input" style={{width:70}} /></td>
                      <td><input type="text" value={editData.note} onChange={e=>setEditData(p=>({...p,note:e.target.value}))} className="inline-input" /></td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={()=>saveEdit(r.id)}>保存</button>
                        <button className="btn btn-sm btn-ghost" onClick={()=>setEditingId(null)}>取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{formatDate(r.clockIn)}</td>
                      <td>{formatTime(r.clockIn)}</td>
                      <td>{r.clockOut ? formatTime(r.clockOut) : <span className="in-progress">出勤中</span>}</td>
                      <td>{r.clockOut ? `${breakMins}分` : '-'}</td>
                      <td>{r.clockOut ? formatMinutes(workMins) : '-'}</td>
                      <td>{(r.transportationFee||0).toLocaleString()}円</td>
                      <td>{(r.transportationRoundTrip||0).toLocaleString()}円</td>
                      <td className="note-cell">{r.note || '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={()=>startEdit(r)}>編集</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>{if(confirm('この記録を削除しますか？')) deleteRecord(r.id)}}>削除</button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
