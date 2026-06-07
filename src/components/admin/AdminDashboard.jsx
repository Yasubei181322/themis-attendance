import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import StaffManagement from './StaffManagement.jsx'
import AttendanceManagement from './AttendanceManagement.jsx'
import BreakRequestManagement from './BreakRequestManagement.jsx'
import MonthlySummary from './MonthlySummary.jsx'
import CSVExport from './CSVExport.jsx'

const TABS = [
  { id: 'staff', label: 'スタッフ管理' },
  { id: 'attendance', label: '勤怠記録' },
  { id: 'breaks', label: '休憩申請' },
  { id: 'monthly', label: '月次集計' },
  { id: 'csv', label: 'CSV出力' },
]

export default function AdminDashboard() {
  const { records, logout } = useApp()
  const [activeTab, setActiveTab] = useState('staff')

  const pendingCount = records.filter(r => r.breakRequest?.status === 'pending').length

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="brand-icon">⚖</span>
          <span className="brand-name">勤怠管理　Themis</span>
          <span className="admin-badge">管理者</span>
        </div>
        <div className="header-user">
          <button className="btn btn-outline-sm" onClick={logout}>ログアウト</button>
        </div>
      </header>

      <nav className="admin-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'breaks' && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {activeTab === 'staff' && <StaffManagement />}
        {activeTab === 'attendance' && <AttendanceManagement />}
        {activeTab === 'breaks' && <BreakRequestManagement />}
        {activeTab === 'monthly' && <MonthlySummary />}
        {activeTab === 'csv' && <CSVExport />}
      </main>
    </div>
  )
}
