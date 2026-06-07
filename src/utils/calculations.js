// Auto break deduction based on gross work minutes
export function getAutoBreakMinutes(grossWorkMinutes) {
  if (grossWorkMinutes > 480) return 60
  if (grossWorkMinutes > 360) return 45
  return 0
}

// Effective break minutes (approved request takes precedence)
export function getEffectiveBreakMinutes(record) {
  if (!record.clockOut) return 0
  const grossMins = (new Date(record.clockOut) - new Date(record.clockIn)) / 60000
  if (record.breakRequest?.status === 'approved') {
    return record.breakRequest.requestedBreakMinutes
  }
  return getAutoBreakMinutes(grossMins)
}

// Net work minutes after break deduction
export function getWorkMinutes(record) {
  if (!record.clockOut) return 0
  const grossMins = (new Date(record.clockOut) - new Date(record.clockIn)) / 60000
  return Math.max(0, grossMins - getEffectiveBreakMinutes(record))
}

// Build time segments marking late-night (22:00-05:00) periods
function buildTimeSegments(start, end) {
  const segments = []
  let current = new Date(start)

  while (current < end) {
    const hour = current.getHours()
    const isLateNight = hour >= 22 || hour < 5

    let nextBoundary = new Date(current)
    if (hour >= 22) {
      nextBoundary.setDate(nextBoundary.getDate() + 1)
      nextBoundary.setHours(0, 0, 0, 0)
    } else if (hour < 5) {
      nextBoundary.setHours(5, 0, 0, 0)
    } else {
      nextBoundary.setHours(22, 0, 0, 0)
    }

    const segEnd = nextBoundary < end ? nextBoundary : new Date(end)
    const minutes = (segEnd - current) / 60000

    if (minutes > 0) {
      segments.push({ isLateNight, minutes })
    }
    current = segEnd
  }
  return segments
}

// Calculate pay with overtime and late-night premiums
export function calculatePay(record, staff) {
  if (!record.clockOut) {
    return { regularMinutes: 0, overtimeMinutes: 0, lateNightMinutes: 0, totalPay: 0 }
  }

  const grossMins = (new Date(record.clockOut) - new Date(record.clockIn)) / 60000
  const breakMins = getEffectiveBreakMinutes(record)
  const workMins = Math.max(0, grossMins - breakMins)

  if (staff.employmentType === 'contract') {
    return {
      regularMinutes: workMins,
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      totalPay: Math.round(staff.hourlyRate * workMins / 60),
    }
  }

  // Part-time: apply overtime & late-night premiums
  const segments = buildTimeSegments(new Date(record.clockIn), new Date(record.clockOut))
  const breakRatio = grossMins > 0 ? breakMins / grossMins : 0

  let totalPay = 0
  let cumulativeMins = 0
  let overtimeMinutes = 0
  let lateNightMinutes = 0

  for (const seg of segments) {
    const netMins = seg.minutes * (1 - breakRatio)
    const segStart = cumulativeMins
    const segEnd = cumulativeMins + netMins

    // Portion within regular time (<= 8h cumulative)
    const regularPortion = Math.max(0, Math.min(segEnd, 480) - Math.max(segStart, 0))
    // Portion in overtime (beyond 8h)
    const overtimePortion = Math.max(0, segEnd - Math.max(segStart, 480))

    if (seg.isLateNight) {
      lateNightMinutes += netMins
      totalPay += (regularPortion / 60) * staff.hourlyRate * 1.25
      totalPay += (overtimePortion / 60) * staff.hourlyRate * 1.5
      overtimeMinutes += overtimePortion
    } else {
      totalPay += (regularPortion / 60) * staff.hourlyRate * 1.0
      totalPay += (overtimePortion / 60) * staff.hourlyRate * 1.25
      overtimeMinutes += overtimePortion
    }

    cumulativeMins += netMins
  }

  return {
    regularMinutes: Math.max(0, workMins - overtimeMinutes),
    overtimeMinutes: Math.round(overtimeMinutes),
    lateNightMinutes: Math.round(lateNightMinutes),
    totalPay: Math.round(totalPay),
  }
}

// Format minutes as HH:MM
export function formatMinutes(mins) {
  if (!mins && mins !== 0) return '-'
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.round(Math.abs(mins) % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

// Format datetime
export function formatDateTime(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  return d.toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatTime(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// Monthly summary for a staff member
export function calcMonthlySummary(records, staff, year, month) {
  const filtered = records.filter(r => {
    if (r.staffId !== staff.id) return false
    const d = new Date(r.clockIn)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  let totalWorkMinutes = 0
  let totalOvertimeMinutes = 0
  let totalLateNightMinutes = 0
  let totalLaborPay = 0
  let totalTransportation = 0
  let workDays = 0

  for (const r of filtered) {
    if (!r.clockOut) continue
    workDays++
    const pay = calculatePay(r, staff)
    totalWorkMinutes += getWorkMinutes(r)
    totalOvertimeMinutes += pay.overtimeMinutes
    totalLateNightMinutes += pay.lateNightMinutes
    totalLaborPay += pay.totalPay
    totalTransportation += (r.transportationFee || 0) + (r.transportationRoundTrip || 0)
  }

  const withholdingTax = staff.employmentType === 'contract'
    ? Math.round(totalLaborPay * 0.1021)
    : 0

  const netPay = totalLaborPay - withholdingTax + totalTransportation

  return {
    workDays,
    totalWorkMinutes,
    totalOvertimeMinutes,
    totalLateNightMinutes,
    totalLaborPay,
    totalTransportation,
    withholdingTax,
    netPay,
    records: filtered,
  }
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
