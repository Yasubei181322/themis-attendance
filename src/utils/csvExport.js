import { calcMonthlySummary, formatMinutes } from './calculations.js'

function escapeCsv(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function rowToCsv(row) {
  return row.map(escapeCsv).join(',')
}

function downloadCsv(filename, rows) {
  const bom = '﻿'
  const content = bom + rows.map(rowToCsv).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function minutesToHours(mins) {
  return (mins / 60).toFixed(2)
}

// ① Excel check CSV
export function exportExcelCheck(staffList, records, year, month) {
  const header = ['氏名', '年月', '出勤日数', '総勤務時間', '時給', '労働報酬', '交通費', '支払合計']
  const rows = [header]

  for (const staff of staffList) {
    const s = calcMonthlySummary(records, staff, year, month)
    if (s.workDays === 0) continue
    const ym = `${year}/${String(month).padStart(2, '0')}`
    rows.push([
      staff.name,
      ym,
      s.workDays,
      minutesToHours(s.totalWorkMinutes),
      staff.hourlyRate,
      s.totalLaborPay,
      s.totalTransportation,
      s.totalLaborPay + s.totalTransportation,
    ])
  }

  downloadCsv(`勤怠_Excel確認_${year}${String(month).padStart(2, '0')}.csv`, rows)
}

// ② MoneyForward payroll import CSV
export function exportMoneyForward(staffList, records, year, month) {
  const header = ['社員番号', '氏名', '支給年月', '基本給', '交通費', '支給合計', '源泉徴収区分', '源泉徴収額']
  const rows = [header]

  for (const staff of staffList) {
    const s = calcMonthlySummary(records, staff, year, month)
    if (s.workDays === 0) continue
    const ym = `${year}/${String(month).padStart(2, '0')}`
    const kubun = staff.employmentType === 'contract' ? '業務委託' : 'アルバイト'
    rows.push([
      staff.id,
      staff.name,
      ym,
      s.totalLaborPay,
      s.totalTransportation,
      s.totalLaborPay + s.totalTransportation,
      kubun,
      s.withholdingTax,
    ])
  }

  downloadCsv(`勤怠_MoneyForward_${year}${String(month).padStart(2, '0')}.csv`, rows)
}

// ③ Payslip source data CSV
export function exportPayslipData(staffList, records, year, month) {
  const header = [
    '氏名', '年月', '出勤日数', '総勤務時間', '時給', '労働報酬', '交通費', '支払合計',
    '残業時間', '深夜時間', '源泉徴収区分', '源泉徴収額', '差引支払額',
  ]
  const rows = [header]

  for (const staff of staffList) {
    const s = calcMonthlySummary(records, staff, year, month)
    if (s.workDays === 0) continue
    const ym = `${year}/${String(month).padStart(2, '0')}`
    const kubun = staff.employmentType === 'contract' ? '業務委託' : 'アルバイト'
    rows.push([
      staff.name,
      ym,
      s.workDays,
      minutesToHours(s.totalWorkMinutes),
      staff.hourlyRate,
      s.totalLaborPay,
      s.totalTransportation,
      s.totalLaborPay + s.totalTransportation,
      minutesToHours(s.totalOvertimeMinutes),
      minutesToHours(s.totalLateNightMinutes),
      kubun,
      s.withholdingTax,
      s.netPay,
    ])
  }

  downloadCsv(`勤怠_給与明細元データ_${year}${String(month).padStart(2, '0')}.csv`, rows)
}
