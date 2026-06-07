import React, { createContext, useContext, useState, useEffect } from 'react'
import { generateId } from '../utils/calculations.js'

const AppContext = createContext(null)

const BASE = '/api'

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function AppProvider({ children }) {
  const [staffList, setStaffList] = useState([])
  const [records, setRecords] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/staff'),
      api('/records'),
    ]).then(([staff, recs]) => {
      setStaffList(staff)
      setRecords(recs)
      setLoading(false)
    }).catch(err => {
      console.error('Load error:', err)
      setLoading(false)
    })
  }, [])

  // Auth
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

  // Attendance
  async function clockIn(staffId) {
    const existing = records.find(r => r.staffId === staffId && !r.clockOut)
    if (existing) return false
    const rec = await api('/records', 'POST', { staffId, clockIn: new Date().toISOString() })
    setRecords(prev => [...prev, rec])
    return true
  }

  async function clockOut(staffId) {
    const record = records.find(r => r.staffId === staffId && !r.clockOut)
    if (!record) return false
    const updated = await api(`/records/${record.id}`, 'PUT', { clockOut: new Date().toISOString() })
    setRecords(prev => prev.map(r => r.id === record.id ? updated : r))
    return true
  }

  async function updateRecord(recordId, updates) {
    const record = records.find(r => r.id === recordId)
    if (!record) return
    const merged = { ...record, ...updates }
    const updated = await api(`/records/${recordId}`, 'PUT', merged)
    setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
  }

  async function deleteRecord(recordId) {
    await api(`/records/${recordId}`, 'DELETE')
    setRecords(prev => prev.filter(r => r.id !== recordId))
  }

  // Break requests
  async function submitBreakRequest(recordId, requestedBreakMinutes, reason) {
    const record = records.find(r => r.id === recordId)
    const updated = await api(`/records/${recordId}`, 'PUT', {
      ...record,
      breakRequest: {
        requestedBreakMinutes,
        reason,
        status: 'pending',
        adminComment: null,
        requestedAt: new Date().toISOString(),
      }
    })
    setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
  }

  async function approveBreakRequest(recordId) {
    const record = records.find(r => r.id === recordId)
    const updated = await api(`/records/${recordId}`, 'PUT', {
      ...record,
      breakRequest: { ...record.breakRequest, status: 'approved', adminComment: null }
    })
    setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
  }

  async function rejectBreakRequest(recordId, comment) {
    const record = records.find(r => r.id === recordId)
    const updated = await api(`/records/${recordId}`, 'PUT', {
      ...record,
      breakRequest: { ...record.breakRequest, status: 'rejected', adminComment: comment }
    })
    setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
  }

  // Staff management
  async function updateStaff(staffId, updates) {
    const staff = staffList.find(s => s.id === staffId)
    const updated = await api(`/staff/${staffId}`, 'PUT', { ...staff, ...updates })
    setStaffList(prev => prev.map(s => s.id === staffId ? updated : s))
  }

  async function addStaff(staffData) {
    const newStaff = {
      id: 'staff' + String(staffList.length + 1).padStart(3, '0'),
      ...staffData,
    }
    const created = await api('/staff', 'POST', newStaff)
    setStaffList(prev => [...prev, created])
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
      updateStaff, addStaff,
      getStaff, getStaffRecords, getActiveRecord,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
