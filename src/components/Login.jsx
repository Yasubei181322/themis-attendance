import React, { useState } from 'react'
import { useApp } from '../contexts/AppContext.jsx'

export default function Login() {
  const { staffList, loginStaff, loginAdmin } = useApp()
  const [mode, setMode] = useState('staff') // 'staff' | 'admin'
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [adminPw, setAdminPw] = useState('')
  const [error, setError] = useState('')

  function handleStaffLogin(e) {
    e.preventDefault()
    setError('')
    if (!selectedStaffId) { setError('スタッフを選択してください'); return }
    if (pin.length !== 4) { setError('PINは4桁で入力してください'); return }
    if (!loginStaff(selectedStaffId, pin)) {
      setError('PINコードが正しくありません')
    }
  }

  function handleAdminLogin(e) {
    e.preventDefault()
    setError('')
    if (!loginAdmin(adminPw)) {
      setError('パスワードが正しくありません')
    }
  }

  function handlePinInput(digit) {
    if (pin.length < 4) setPin(prev => prev + digit)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">⚖</div>
          <h1>勤怠管理　Themis</h1>
          <p className="login-subtitle">日本橋法律特許事務所</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'staff' ? 'active' : ''}`}
            onClick={() => { setMode('staff'); setError(''); setPin('') }}
          >スタッフログイン</button>
          <button
            className={`login-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => { setMode('admin'); setError(''); setAdminPw('') }}
          >管理者ログイン</button>
        </div>

        {mode === 'staff' && (
          <form onSubmit={handleStaffLogin} className="login-form">
            <div className="form-group">
              <label>スタッフ名</label>
              <select
                value={selectedStaffId}
                onChange={e => { setSelectedStaffId(e.target.value); setPin(''); setError('') }}
              >
                <option value="">-- 選択してください --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>PINコード</label>
              <div className="pin-display">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
                ))}
              </div>
              <div className="pin-pad">
                {[1,2,3,4,5,6,7,8,9].map(d => (
                  <button key={d} type="button" className="pin-btn" onClick={() => handlePinInput(String(d))}>
                    {d}
                  </button>
                ))}
                <button type="button" className="pin-btn pin-btn-clear" onClick={() => setPin('')}>C</button>
                <button type="button" className="pin-btn" onClick={() => handlePinInput('0')}>0</button>
                <button type="button" className="pin-btn pin-btn-back" onClick={() => setPin(p => p.slice(0,-1))}>←</button>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full">ログイン</button>
          </form>
        )}

        {mode === 'admin' && (
          <form onSubmit={handleAdminLogin} className="login-form">
            <div className="form-group">
              <label>管理者パスワード</label>
              <input
                type="password"
                value={adminPw}
                onChange={e => { setAdminPw(e.target.value); setError('') }}
                placeholder="パスワードを入力"
                autoFocus
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full">管理者ログイン</button>
          </form>
        )}
      </div>
    </div>
  )
}
