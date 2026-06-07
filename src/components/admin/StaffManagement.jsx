import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'

export default function StaffManagement() {
  const { staffList, updateStaff, addStaff } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', pin: '', hourlyRate: 1300, employmentType: 'parttime' })
  const [addError, setAddError] = useState('')

  function startEdit(staff) {
    setEditingId(staff.id)
    setEditData({ name: staff.name, pin: staff.pin, hourlyRate: staff.hourlyRate, employmentType: staff.employmentType })
  }

  function saveEdit(id) {
    if (!editData.name.trim()) return
    if (editData.pin.length !== 4 || !/^\d{4}$/.test(editData.pin)) { alert('PINは4桁の数字で入力してください'); return }
    const rate = parseInt(editData.hourlyRate)
    if (rate < 1000 || rate > 3000) { alert('時給は1000〜3000円の範囲で入力してください'); return }
    updateStaff(id, { name: editData.name, pin: editData.pin, hourlyRate: rate, employmentType: editData.employmentType })
    setEditingId(null)
  }

  function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    if (!newStaff.name.trim()) { setAddError('氏名を入力してください'); return }
    if (!/^\d{4}$/.test(newStaff.pin)) { setAddError('PINは4桁の数字で入力してください'); return }
    const rate = parseInt(newStaff.hourlyRate)
    if (rate < 1000 || rate > 3000) { setAddError('時給は1000〜3000円で入力してください'); return }
    addStaff({ name: newStaff.name.trim(), pin: newStaff.pin, hourlyRate: rate, employmentType: newStaff.employmentType })
    setNewStaff({ name: '', pin: '', hourlyRate: 1300, employmentType: 'parttime' })
    setShowAdd(false)
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>スタッフ管理</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'キャンセル' : '＋ スタッフ追加'}
        </button>
      </div>

      {showAdd && (
        <form className="add-staff-form card" onSubmit={handleAdd}>
          <h3>新規スタッフ登録</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>氏名</label>
              <input type="text" value={newStaff.name} onChange={e => setNewStaff(p => ({...p, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>PINコード（4桁）</label>
              <input type="text" maxLength="4" value={newStaff.pin} onChange={e => setNewStaff(p => ({...p, pin: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>時給（円）</label>
              <input type="number" min="1000" max="3000" value={newStaff.hourlyRate} onChange={e => setNewStaff(p => ({...p, hourlyRate: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>契約形態</label>
              <select value={newStaff.employmentType} onChange={e => setNewStaff(p => ({...p, employmentType: e.target.value}))}>
                <option value="parttime">アルバイト</option>
                <option value="contract">業務委託</option>
              </select>
            </div>
          </div>
          {addError && <div className="error-msg">{addError}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">登録</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>キャンセル</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>氏名</th>
            <th>PIN</th>
            <th>時給</th>
            <th>契約形態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map(staff => (
            <tr key={staff.id}>
              <td className="muted">{staff.id}</td>
              {editingId === staff.id ? (
                <>
                  <td><input type="text" value={editData.name} onChange={e => setEditData(p=>({...p,name:e.target.value}))} className="inline-input" /></td>
                  <td><input type="text" maxLength="4" value={editData.pin} onChange={e => setEditData(p=>({...p,pin:e.target.value}))} className="inline-input" style={{width:60}} /></td>
                  <td><input type="number" min="1000" max="3000" value={editData.hourlyRate} onChange={e => setEditData(p=>({...p,hourlyRate:e.target.value}))} className="inline-input" style={{width:80}} /></td>
                  <td>
                    <select value={editData.employmentType} onChange={e => setEditData(p=>({...p,employmentType:e.target.value}))}>
                      <option value="parttime">アルバイト</option>
                      <option value="contract">業務委託</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(staff.id)}>保存</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>取消</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{staff.name}</td>
                  <td className="pin-cell">{'●'.repeat(4)}</td>
                  <td><strong>{staff.hourlyRate.toLocaleString()}円</strong></td>
                  <td><span className={`emp-badge ${staff.employmentType}`}>{staff.employmentType === 'parttime' ? 'アルバイト' : '業務委託'}</span></td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => startEdit(staff)}>編集</button></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
