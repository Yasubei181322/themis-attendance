import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { INITIAL_STAFF, ADMIN_PASSWORD } from '../data/initialData.js'
import { generateId } from '../utils/calculations.js'

const AppContext = createContext(null)
const USE_API = import.meta.env.PROD  // Renderでtrue、ローカルでfalse

// ===== API呼び出し =====
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ===== localStorage =====
const LS_STAFF = 'lfa_staff'
const LS_RECORDS = 'lfa_records'
function loadLS(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}

export function AppProvider({ children }) {
  const [staffList, setStaffList] = useState(() => USE_API ? [] : loadLS(LS_STAFF, INITIAL_STAFF))
  const [records, setRecords]     = useState(() => USE_API ? [] : loadLS(LS_RECORDS, []))
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(USE_API)
  const [saving, setSaving] = useState(false)

  // 画面を先に更新し、サーバー保存は記録ごとに順番通り裏で行う
  const recordsRef = useRef(records)
  recordsRef.current = records
  const queueRef = useRef({})
  const createRef = useRef({})
  const aliasRef = useRef({})
  const pendingRef = useRef(0)

  function trackSave(promise) {
    pendingRef.current += 1
    setSaving(true)
    return promise.finally(() => {
      pendingRef.current -= 1
      if (pendingRef.current === 0) setSaving(false)
    })
  }

  async function resyncRecords() {
    try {
      const recs = await api('/records')
      recordsRef.current = recs
      setRecords(recs)
    } catch { /* 次回の読み込みで同期される */ }
  }

  function setRecordsNow(next) {
    recordsRef.current = next
    setRecords(next)
  }

  function syncRecord(recordId, body) {
    const key = aliasRef.current[recordId] || recordId
    const run = async () => {
      if (createRef.current[recordId]) {
        await createRef.current[recordId]
      }
      const id = aliasRef.current[recordId] || recordId
      await api(`/records/${id}`, 'PUT', body)
    }
    const next = (queueRef.current[key] || Promise.resolve()).then(run)
    queueRef.current[key] = next.catch(() => {})
    trackSave(next).catch(() => {
      alert('通信に失敗しました。画面を更新して記録を確認してください。')
      resyncRecords()
    })
  }

  useEffect(() => {
    function warn(e) {
      if (pendingRef.current > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // API: 初回データ取得
  useEffect(() => {
    if (!USE_API) return
    Promise.all([api('/staff'), api('/records')])
      .then(([staff, recs]) => { setStaffList(staff); setRecords(recs); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // localStorage: 自動保存
  useEffect(() => { if (!USE_API) localStorage.setItem(LS_STAFF, JSON.stringify(staffList)) }, [staffList])
  useEffect(() => { if (!USE_API) localStorage.setItem(LS_RECORDS, JSON.stringify(records)) }, [records])

  // ===== 認証 =====
  function loginStaff(staffId, pin) {
    const staff = staffList.find(s => s.id === staffId && s.pin === pin)
    if (!staff) return false
    setCurrentUser({ type: 'staff', id: staffId })
    return true
  }
  async function loginAdmin(password) {
    if (USE_API) {
      try {
        await api('/login-admin', 'POST', { password })
      } catch {
        return false
      }
    } else {
      if (password !== ADMIN_PASSWORD) return false
    }
    setCurrentUser({ type: 'admin' })
    return true
  }
  function logout() { setCurrentUser(null) }

  // ===== 打刻 =====
  function clockIn(staffId) {
    const existing = recordsRef.current.find(r => r.staffId === staffId && !r.clockOut)
    if (existing) return false
    const now = new Date().toISOString()
    const tempId = generateId()
    setRecordsNow([...recordsRef.current, {
      id: tempId, staffId, clockIn: now, clockOut: null,
      transportationFee: 0, transportationRoundTrip: 0, note: '',
      breakRequest: null, breakStart: null, breakEnd: null,
    }])
    if (USE_API) {
      const p = api('/records', 'POST', { staffId, clockIn: now }).then(rec => {
        aliasRef.current[tempId] = rec.id
        queueRef.current[rec.id] = queueRef.current[tempId]
        setRecordsNow(recordsRef.current.map(r => r.id === tempId ? { ...r, id: rec.id } : r))
      })
      createRef.current[tempId] = p
      trackSave(p).catch(() => {
        alert('出勤の記録に失敗しました。もう一度お試しください。')
        setRecordsNow(recordsRef.current.filter(r => r.id !== tempId))
      })
    }
    return true
  }

  function patchRecord(recordId, updates) {
    const id = aliasRef.current[recordId] || recordId
    const current = recordsRef.current.find(r => r.id === id)
    if (!current) return false
    const merged = { ...current, ...updates }
    setRecordsNow(recordsRef.current.map(r => r.id === id ? merged : r))
    if (USE_API) syncRecord(id, merged)
    return true
  }

  function clockOut(staffId) {
    const record = recordsRef.current.find(r => r.staffId === staffId && !r.clockOut)
    if (!record) return false
    return patchRecord(record.id, { clockOut: new Date().toISOString() })
  }

  function updateRecord(recordId, updates) {
    patchRecord(recordId, updates)
  }

  function deleteRecord(recordId) {
    const id = aliasRef.current[recordId] || recordId
    setRecordsNow(recordsRef.current.filter(r => r.id !== id))
    if (USE_API) {
      trackSave(api(`/records/${id}`, 'DELETE')).catch(() => {
        alert('削除に失敗しました。画面を更新して確認してください。')
        resyncRecords()
      })
    }
  }

  function submitBreakRequest(recordId, requestedBreakMinutes, reason) {
    patchRecord(recordId, {
      breakRequest: { requestedBreakMinutes, reason, status: 'pending', adminComment: null, requestedAt: new Date().toISOString() },
    })
  }

  function approveBreakRequest(recordId) {
    const record = recordsRef.current.find(r => r.id === recordId)
    if (!record) return
    patchRecord(recordId, { breakRequest: { ...record.breakRequest, status: 'approved', adminComment: null } })
  }

  function rejectBreakRequest(recordId, comment) {
    const record = recordsRef.current.find(r => r.id === recordId)
    if (!record) return
    patchRecord(recordId, { breakRequest: { ...record.breakRequest, status: 'rejected', adminComment: comment } })
  }

  async function resyncStaff() {
    try { setStaffList(await api('/staff')) } catch { /* 次回の読み込みで同期される */ }
  }

  function updateStaff(staffId, updates) {
    const staff = staffList.find(s => s.id === staffId)
    if (!staff) return
    const merged = { ...staff, ...updates }
    setStaffList(prev => prev.map(s => s.id === staffId ? merged : s))
    if (USE_API) {
      trackSave(api(`/staff/${staffId}`, 'PUT', merged)).catch(() => {
        alert('保存に失敗しました。画面を更新して確認してください。')
        resyncStaff()
      })
    }
  }

  function addStaff(staffData) {
    // 既存IDの最大番号+1でID生成（削除後も重複しない）
    const maxNum = staffList.reduce((max, s) => {
      const n = parseInt(s.id.replace(/\D/g, '')) || 0
      return n > max ? n : max
    }, 0)
    const newStaff = { id: 'staff' + String(maxNum + 1).padStart(3, '0'), active: true, ...staffData }
    setStaffList(prev => [...prev, newStaff])
    if (USE_API) {
      trackSave(api('/staff', 'POST', newStaff)).catch(() => {
        alert('スタッフの登録に失敗しました。もう一度お試しください。')
        setStaffList(prev => prev.filter(s => s.id !== newStaff.id))
      })
    }
  }

  function startBreak(staffId) {
    const record = recordsRef.current.find(r => r.staffId === staffId && !r.clockOut)
    if (!record || record.breakStart) return false
    return patchRecord(record.id, { breakStart: new Date().toISOString() })
  }

  function endBreak(staffId) {
    const record = recordsRef.current.find(r => r.staffId === staffId && !r.clockOut)
    if (!record || !record.breakStart || record.breakEnd) return false
    return patchRecord(record.id, { breakEnd: new Date().toISOString() })
  }

  async function deleteStaff(staffId) {
    if (!window.confirm('このスタッフを完全に削除しますか？\n月次集計からも表示されなくなります。\n（退職者として記録を残したい場合は「退職」を使ってください）')) return
    setStaffList(prev => prev.filter(s => s.id !== staffId))
    if (USE_API) {
      trackSave(api(`/staff/${staffId}`, 'DELETE')).catch(() => {
        alert('削除に失敗しました。画面を更新して確認してください。')
        resyncStaff()
      })
    }
  }

  async function retireStaff(staffId) {
    if (!window.confirm('このスタッフを退職済みにしますか？\n（ログイン選択には表示されなくなりますが、月次データは残ります）')) return
    await updateStaff(staffId, { active: false })
  }

  async function reactivateStaff(staffId) {
    await updateStaff(staffId, { active: true })
  }

  const getStaff = (id) => staffList.find(s => s.id === id)
  const getStaffRecords = (staffId) => records.filter(r => r.staffId === staffId)
  const getActiveRecord = (staffId) => records.find(r => r.staffId === staffId && !r.clockOut)

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#1a2744', color:'white', fontSize:18, flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:40 }}>⚖</div>
        <div>Themis 読み込み中...</div>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      staffList, records, currentUser,
      loginStaff, loginAdmin, logout,
      clockIn, clockOut, updateRecord, deleteRecord,
      submitBreakRequest, approveBreakRequest, rejectBreakRequest,
      updateStaff, addStaff, deleteStaff, retireStaff, reactivateStaff, startBreak, endBreak,
      getStaff, getStaffRecords, getActiveRecord,
    }}>
      {children}
      {saving && <div className="saving-badge">保存中…（このまま少しお待ちください）</div>}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
