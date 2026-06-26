import React, { useState } from 'react'

export default function ExcelExport() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/export/monthly?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('エラーが発生しました')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `勤務実績表_${year}年${month}月.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Excel出力（勤務実績表）</h2>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ marginBottom: 16, color: '#555' }}>
          全スタッフの月次勤務実績表をExcelファイルで出力します。<br />
          出勤・退勤・休憩・深夜時間・給与・交通費が含まれます。
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="form-group">
            <label>年</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>月</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={loading}
          style={{ width: '100%', fontSize: 15, padding: '12px 0' }}
        >
          {loading ? '生成中...' : `📥 ${year}年${month}月の実績表をダウンロード`}
        </button>
      </div>
    </div>
  )
}
