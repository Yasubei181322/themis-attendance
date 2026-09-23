import React from 'react'
import { AppProvider, useApp } from './contexts/AppContext.jsx'
import Login from './components/Login.jsx'
import StaffDashboard from './components/staff/StaffDashboard.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'

function AppInner() {
  const { currentUser } = useApp()

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
