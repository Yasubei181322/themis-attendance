import React from 'react'
import { AppProvider, useApp } from './contexts/AppContext.jsx'
import Login from './components/Login.jsx'
import StaffDashboard from './components/staff/StaffDashboard.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'

function AppInner() {
  const { currentUser, loading } = useApp()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>読み込み中...</p>
      </div>
    )
  }

  if (!currentUser) return <Login />
  if (currentUser.type === 'admin') return <AdminDashboard />
  return <StaffDashboard />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
