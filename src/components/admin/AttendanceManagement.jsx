import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import { getWorkMinutes, getEffectiveBreakMinutes, formatDate, formatTime, formatMinutes, isOverdueClockIn, isOverdueBreak, toLocalInput, fromLocalInput } from '../../utils/calculations.js'

export default function AttendanceManagement() {
  const { staffList, records, addRecord, updateRecord, deleteRecord } = useApp()
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
      clockIn: toLocalInput(r.clockIn),
      breakStart: toLocalInput(r.breakStart),
      breakEnd: toLocalInput(r.breakEnd),
      clockOut: toLocalInput(r.clockOut),
      transportationFee: r.transportationFee || 0,
      transportationRoundTrip: r.transportationRoundTrip || 0,
      note: r.note || '',
    })
  }

  // 入力内容の整合性チェック。問題があれば文言を返す
  function validateTimes(d) {
    if (!d.clockIn) return '出勤時刻を入力してください'
    const t = s => (s ? new Date(s).getTime() : null)
    const cin = t(d.clockIn), cout = t(d.clockOut), bs = t(d.breakStart), be = t(d.breakEnd)
    if ((bs === null) !== (be === null)) return '休憩は開始と終了の両方を入力してください（休憩なしの場合は両方空欄）'
    if (cout !== null && cout <= cin) return '退勤は出勤より後の時刻にしてください'
    if (bs !== null && be <= bs) return '休憩終了は休憩開始より後の時刻にしてください'
    if (bs !== null && (bs < cin || (cout !== null && be > cout))) return '休憩は出勤〜退勤の間に収めてください'
    return ''
  }

  function toFields(d) {
    return {
      clockIn: fromLocalInput(d.clockIn),
      breakStart: fromLocalInput(d.breakStart),
      breakEnd: fromLocalInput(d.breakEnd),
      clockOut: fromLocalInput(d.clockOut),
      transportationFee: parseInt(d.transportationFee) || 0,
      transportationRoundTrip: parseInt(d.transportationRoundTrip) || 0,
      note: d.note,
    }
  }

  function saveEdit(id) {
    const err = validateTimes(editData)
    if (err) { alert(err); return }
    updateRecord(id, toFields(editData))
    setEditingId(null)
  }

  const emptyAdd = { staffId: '', clockIn: '', breakStart: '', breakEnd: '', clockOut: '', transportationFee: 0, transportationRoundTrip: 0, note: '' }
  const [showAdd, setShowAdd] = useState(false)
  const [addData, setAddData] = useState(emptyAdd)

  function handleAdd(e) {
    e.preventDefault()
    if (!addData.staffId) { alert('スタッフを選択してください'); return }
    const err = validateTimes(addData)
    if (err) { alert(err); return }
    addRecord(addData.staffId, toFields(addData))
    const d = new Date(addData.clockIn)
    setFilterYear(d.getFullYear())
    setFilterMonth(d.getMonth() + 1)
    setAddData(emptyAdd)
    setShowAdd(false)
  }

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1]

  const overdueRecords = records.filter(r => isOverdueClockIn(r) || isOverdueBreak(r))

  return (
    <div className="admin-section">
      {overdueRecords.length > 0 && (
        <div className="overdue-alert">
          <strong>⚠ 打刻漏れの可能性がある記録が{overdueRecords.length}件あります</strong>
          <ul>
            {overdueRecords.map(r => {
              const staff = staffList.find(s => s.id === r.staffId)
              return (
                <li key={r.id}>
                  {staff?.name || r.staffId}：{formatDate(r.clockIn)}
                  {isOverdueClockIn(r) ? '　退勤の打刻がありません' : '　休憩終了の打刻がありません'}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="section-header">
        <h2>勤怠記録管理</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'キャンセル' : '＋ 記録を追加'}
        </button>
      </div>

      {showAdd && (
        <form className="add-staff-form card" onSubmit={handleAdd}>
          <h3>勤務記録の手入力</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>スタッフ</label>
              <select value={addData.staffId} onChange={e => setAddData(p => ({...p, staffId: e.target.value}))}>
                <option value="">-- 選択してください --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.active === false ? '（退職済）' : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>出勤</label>
              <input type="datetime-local" value={addData.clockIn} onChange={e => setAddData(p => ({...p, clockIn: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>休憩開始（任意）</label>
              <input type="datetime-local" value={addData.breakStart} onChange={e => setAddData(p => ({...p, breakStart: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>休憩終了（任意）</label>
              <input type="datetime-local" value={addData.breakEnd} onChange={e => setAddData(p => ({...p, breakEnd: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>退勤</label>
              <input type="datetime-local" value={addData.clockOut} onChange={e => setAddData(p => ({...p, clockOut: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>交通費（片道・円）</label>
              <input type="number" min="0" value={addData.transportationFee} onChange={e => setAddData(p => ({...p, transportationFee: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>交通費（往復・円）</label>
              <input type="number" min="0" value={addData.transportationRoundTrip} onChange={e => setAddData(p => ({...p, transportationRoundTrip: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>備考</label>
              <input type="text" value={addData.note} onChange={e => setAddData(p => ({...p, note: e.target.value}))} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">登録</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>キャンセル</button>
          </div>
        </form>
      )}

      <div className="section-header">
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
              <th>休憩開始</th>
              <th>休憩終了</th>
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
                      <td className="muted">編集中</td>
                      <td><input type="datetime-local" value={editData.clockIn} onChange={e=>setEditData(p=>({...p,clockIn:e.target.value}))} className="inline-input" /></td>
                      <td><input type="datetime-local" value={editData.breakStart} onChange={e=>setEditData(p=>({...p,breakStart:e.target.value}))} className="inline-input" /></td>
                      <td><input type="datetime-local" value={editData.breakEnd} onChange={e=>setEditData(p=>({...p,breakEnd:e.target.value}))} className="inline-input" /></td>
                      <td><input type="datetime-local" value={editData.clockOut} onChange={e=>setEditData(p=>({...p,clockOut:e.target.value}))} className="inline-input" /></td>
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
                      <td>{r.breakStart ? formatTime(r.breakStart) : '-'}</td>
                      <td>{r.breakEnd   ? formatTime(r.breakEnd)   : '-'}</td>
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
