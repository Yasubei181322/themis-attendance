import React, { createContext, useContext, useState, useEffect } from 'react'
import { INITIAL_STAFF } from '../data/initialData.js'
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
  function loginAdmin(password) {
    if (password !== 'admin1234') return false
    setCurrentUser({ type: 'admin' })
    return true
  }
  function logout() { setCurrentUser(null) }

  // ===== 打刻 =====
  async function clockIn(staffId) {
    const existing = records.find(r => r.staffId === staffId && !r.clockOut)
    if (existing) return false
    if (USE_API) {
      const rec = await api('/records', 'POST', { staffId, clockIn: new Date().toISOString() })
      setRecords(prev => [...prev, rec])
    } else {
      setRecords(prev => [...prev, {
        id: generateId(), staffId, clockIn: new Date().toISOString(), clockOut: null,
        transportationFee: 0, transportationRoundTrip: 0, note: '', breakRequest: null,
      }])
    }
    return true
  }

  async function clockOut(staffId) {
    const record = records.find(r => r.staffId === staffId && !r.clockOut)
    if (!record) return false
    if (USE_API) {
      const updated = await api(`/records/${record.id}`, 'PUT', { clockOut: new Date().toISOString() })
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, clockOut: new Date().toISOString() } : r))
    }
    return true
  }

  async function updateRecord(recordId, updates) {
    if (USE_API) {
      const record = records.find(r => r.id === recordId)
      const updated = await api(`/records/${recordId}`, 'PUT', { ...record, ...updates })
      setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updates } : r))
    }
  }

  async function deleteRecord(recordId) {
    if (USE_API) await api(`/records/${recordId}`, 'DELETE')
    setRecords(prev => prev.filter(r => r.id !== recordId))
  }

  async function submitBreakRequest(recordId, requestedBreakMinutes, reason) {
    const br = { requestedBreakMinutes, reason, status: 'pending', adminComment: null, requestedAt: new Date().toISOString() }
    if (USE_API) {
      const record = records.find(r => r.id === recordId)
      const updated = await api(`/records/${recordId}`, 'PUT', { ...record, breakRequest: br })
      setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, breakRequest: br } : r))
    }
  }

  async function approveBreakRequest(recordId) {
    if (USE_API) {
      const record = records.find(r => r.id === recordId)
      const updated = await api(`/records/${recordId}`, 'PUT', { ...record, breakRequest: { ...record.breakRequest, status: 'approved', adminComment: null } })
      setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, breakRequest: { ...r.breakRequest, status: 'approved', adminComment: null } } : r))
    }
  }

  async function rejectBreakRequest(recordId, comment) {
    if (USE_API) {
      const record = records.find(r => r.id === recordId)
      const updated = await api(`/records/${recordId}`, 'PUT', { ...record, breakRequest: { ...record.breakRequest, status: 'rejected', adminComment: comment } })
      setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, breakRequest: { ...r.breakRequest, status: 'rejected', adminComment: comment } } : r))
    }
  }

  async function updateStaff(staffId, updates) {
    if (USE_API) {
      const staff = staffList.find(s => s.id === staffId)
      const updated = await api(`/staff/${staffId}`, 'PUT', { ...staff, ...updates })
      setStaffList(prev => prev.map(s => s.id === staffId ? updated : s))
    } else {
      setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, ...updates } : s))
    }
  }

  async function addStaff(staffData) {
    // 既存IDの最大番号+1でID生成（削除後も重複しない）
    const maxNum = staffList.reduce((max, s) => {
      const n = parseInt(s.id.replace(/\D/g, '')) || 0
      return n > max ? n : max
    }, 0)
    const newStaff = { id: 'staff' + String(maxNum + 1).padStart(3, '0'), ...staffData }
    if (USE_API) {
      const created = await api('/staff', 'POST', newStaff)
      setStaffList(prev => [...prev, created])
    } else {
      setStaffList(prev => [...prev, newStaff])
    }
  }

  async function startBreak(staffId) {
    const record = records.find(r => r.staffId === staffId && !r.clockOut)
    if (!record) return false
    const now = new Date().toISOString()
    if (USE_API) {
      const updated = await api(`/records/${record.id}`, 'PUT', { breakStart: now })
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, breakStart: now } : r))
    }
    return true
  }

  async function endBreak(staffId) {
    const record = records.find(r => r.staffId === staffId && !r.clockOut)
    if (!record || !record.breakStart) return false
    const now = new Date().toISOString()
    if (USE_API) {
      const updated = await api(`/records/${record.id}`, 'PUT', { breakEnd: now })
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r))
    } else {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, breakEnd: now } : r))
    }
    return true
  }

  async function deleteStaff(staffId) {
    if (!window.confirm('このスタッフを削除しますか？\n（関連する勤怠記録は残ります）')) return
    if (USE_API) await api(`/staff/${staffId}`, 'DELETE')
    setStaffList(prev => prev.filter(s => s.id !== staffId))
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
      updateStaff, addStaff, deleteStaff, startBreak, endBreak,
      getStaff, getStaffRecords, getActiveRecord,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
