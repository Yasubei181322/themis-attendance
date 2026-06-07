import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext.jsx'
import { exportExcelCheck, exportMoneyForward, exportPayslipData } from '../../utils/csvExport.js'
import { calcMonthlySummary } from '../../utils/calculations.js'

export default function CSVExport() {
  const { staffList, records } = useApp()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1]

  const summaries = staffList.map(s => calcMonthlySummary(records, s, year, month))
  const totalStaff = summaries.filter(s => s.workDays > 0).length

  const ym = `${year}年${month}月`

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>CSV出力</h2>
        <div className="filter-row">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
          </select>
        </div>
      </div>

      <div className="csv-info">
        <span className="muted">{ym}：出勤スタッフ {totalStaff}名</span>
      </div>

      <div className="csv-cards">
        <div className="csv-card">
          <div className="csv-card-number">①</div>
          <div className="csv-card-body">
            <h3>Excelチェック用</h3>
            <p className="muted small">氏名・年月・出勤日数・総勤務時間・時給・労働報酬・交通費・支払合計</p>
            <button
              className="btn btn-primary"
              onClick={() => exportExcelCheck(staffList, records, year, month)}
              disabled={totalStaff === 0}
            >
              ダウンロード
            </button>
          </div>
        </div>

        <div className="csv-card">
          <div className="csv-card-number">②</div>
          <div className="csv-card-body">
            <h3>MoneyForward給与インポート用</h3>
            <p className="muted small">社員番号・氏名・支給年月・基本給・交通費・支給合計・源泉徴収区分・源泉徴収額</p>
            <button
              className="btn btn-primary"
              onClick={() => exportMoneyForward(staffList, records, year, month)}
              disabled={totalStaff === 0}
            >
              ダウンロード
            </button>
          </div>
        </div>

        <div className="csv-card">
          <div className="csv-card-number">③</div>
          <div className="csv-card-body">
            <h3>給与明細元データ用</h3>
            <p className="muted small">①の全列＋残業時間・深夜時間・源泉徴収区分・源泉徴収額・差引支払額</p>
            <button
              className="btn btn-primary"
              onClick={() => exportPayslipData(staffList, records, year, month)}
              disabled={totalStaff === 0}
            >
              ダウンロード
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
