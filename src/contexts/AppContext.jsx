import React, { createContext, useContext, useState, useEffect } from 'react'
import { INITIAL_STAFF } from '../data/initialData.js'
import { generateId } from '../utils/calculations.js'

const AppContext = createContext(null)

const LS_STAFF = 'lfa_staff'
const LS_RECORDS = 'lfa_records'

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function AppProvider({ children }) {
  const [staffList, setStaffList] = useState(() => loadFromStorage(LS_STAFF, INITIAL_STAFF))
  const [records, setRecords] = useState(() => loadFromStorage(LS_RECORDS, []))
  const [currentUser, setCurrentUser] = useState(null) // { type: 'admin' } or { type: 'staff', id }

  useEffect(() => {
    localStorage.setItem(LS_STAFF, JSON.stringify(staffList))
  }, [staffList])

  useEffect(() => {
    localStorage.setItem(LS_RECORDS, JSON.stringify(records))
  }, [records])

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

  function logout() {
    setCurrentUser(null)
  }

  // Attendance
  function clockIn(staffId) {
    const existing = records.find(r => r.staffId === staffId && !r.clockOut)
    if (existing) return false
    const newRecord = {
      id: generateId(),
      staffId,
      clockIn: new Date().toISOString(),
      clockOut: null,
      transportationFee: 0,
      transportationRoundTrip: 0,
      note: '',
      breakRequest: null,
    }
    setRecords(prev => [...prev, newRecord])
    return true
  }

  function clockOut(staffId) {
    const record = records.find(r => r.staffId === staffId && !r.clockOut)
    if (!record) return false
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, clockOut: new Date().toISOString() } : r
    ))
    return true
  }

  function updateRecord(recordId, updates) {
    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updates } : r))
  }

  function deleteRecord(recordId) {
    setRecords(prev => prev.filter(r => r.id !== recordId))
  }

  // Break requests
  function submitBreakRequest(recordId, requestedBreakMinutes, reason) {
    setRecords(prev => prev.map(r =>
      r.id === recordId ? {
        ...r,
        breakRequest: {
          requestedBreakMinutes,
          reason,
          status: 'pending',
          adminComment: null,
          requestedAt: new Date().toISOString(),
        }
      } : r
    ))
  }

  function approveBreakRequest(recordId) {
    setRecords(prev => prev.map(r =>
      r.id === recordId ? {
        ...r,
        breakRequest: { ...r.breakRequest, status: 'approved', adminComment: null }
      } : r
    ))
  }

  function rejectBreakRequest(recordId, comment) {
    setRecords(prev => prev.map(r =>
      r.id === recordId ? {
        ...r,
        breakRequest: { ...r.breakRequest, status: 'rejected', adminComment: comment }
      } : r
    ))
  }

  // Staff management
  function updateStaff(staffId, updates) {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, ...updates } : s))
  }

  function addStaff(staffData) {
    const newStaff = {
      id: 'staff' + String(staffList.length + 1).padStart(3, '0'),
      ...staffData,
    }
    setStaffList(prev => [...prev, newStaff])
  }

  const getStaff = (id) => staffList.find(s => s.id === id)
  const getStaffRecords = (staffId) => records.filter(r => r.staffId === staffId)
  const getActiveRecord = (staffId) => records.find(r => r.staffId === staffId && !r.clockOut)

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
