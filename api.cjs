const express = require('express')
const { Pool } = require('pg')
const path = require('path')
const cors = require('cors')
const ExcelJS = require('exceljs')

const app = express()
const PORT = process.env.PORT || 3737

// DB接続
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

app.use(cors())
app.use(express.json())

// ============ DB初期化 ============
async function initDB() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        hourly_rate INTEGER NOT NULL,
        employment_type TEXT NOT NULL
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        clock_in TIMESTAMPTZ NOT NULL,
        clock_out TIMESTAMPTZ,
        transportation_fee INTEGER DEFAULT 0,
        transportation_round_trip INTEGER DEFAULT 0,
        note TEXT DEFAULT '',
        break_req_minutes INTEGER,
        break_req_reason TEXT,
        break_req_status TEXT,
        break_req_comment TEXT,
        break_req_at TIMESTAMPTZ,
        break_start TIMESTAMPTZ,
        break_end TIMESTAMPTZ
      )
    `)
    await client.query('ALTER TABLE records ADD COLUMN IF NOT EXISTS break_start TIMESTAMPTZ')
    await client.query('ALTER TABLE records ADD COLUMN IF NOT EXISTS break_end TIMESTAMPTZ')
    // 初期スタッフ登録
    const { rows } = await client.query('SELECT COUNT(*) FROM staff')
    if (parseInt(rows[0].count) === 0) {
      const initial = [
        ['staff001','スタッフ001','1001',1300,'parttime'],
        ['staff002','スタッフ002','1002',1400,'contract'],
        ['staff003','スタッフ003','1003',1500,'parttime'],
        ['staff004','スタッフ004','1004',1300,'contract'],
        ['staff005','スタッフ005','1005',1400,'parttime'],
      ]
      for (const s of initial) {
        await client.query(
          'INSERT INTO staff VALUES ($1,$2,$3,$4,$5)',
          s
        )
      }
    }
    console.log('DB initialized')
  } finally {
    client.release()
  }
}

// ============ ヘルパー ============
function rowToRecord(r) {
  return {
    id: r.id,
    staffId: r.staff_id,
    clockIn: r.clock_in ? r.clock_in.toISOString() : null,
    clockOut: r.clock_out ? r.clock_out.toISOString() : null,
    transportationFee: r.transportation_fee || 0,
    transportationRoundTrip: r.transportation_round_trip || 0,
    note: r.note || '',
    breakRequest: r.break_req_status ? {
      requestedBreakMinutes: r.break_req_minutes,
      reason: r.break_req_reason,
      status: r.break_req_status,
      adminComment: r.break_req_comment,
      requestedAt: r.break_req_at ? r.break_req_at.toISOString() : null,
    } : null,
    breakStart: r.break_start ? r.break_start.toISOString() : null,
    breakEnd: r.break_end ? r.break_end.toISOString() : null,
  }
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ============ API: スタッフ ============
app.get('/api/staff', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM staff ORDER BY id')
  res.json(rows.map(r => ({
    id: r.id, name: r.name, pin: r.pin,
    hourlyRate: r.hourly_rate, employmentType: r.employment_type,
  })))
})

app.post('/api/staff', async (req, res) => {
  const { id, name, pin, hourlyRate, employmentType } = req.body
  await pool.query(
    'INSERT INTO staff VALUES ($1,$2,$3,$4,$5)',
    [id, name, pin, hourlyRate, employmentType]
  )
  res.json({ id, name, pin, hourlyRate, employmentType })
})

app.put('/api/staff/:id', async (req, res) => {
  const { name, pin, hourlyRate, employmentType } = req.body
  await pool.query(
    'UPDATE staff SET name=$1, pin=$2, hourly_rate=$3, employment_type=$4 WHERE id=$5',
    [name, pin, hourlyRate, employmentType, req.params.id]
  )
  res.json({ id: req.params.id, name, pin, hourlyRate, employmentType })
})

app.delete('/api/staff/:id', async (req, res) => {
  await pool.query('DELETE FROM staff WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

// ============ API: 勤怠記録 ============
app.get('/api/records', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM records ORDER BY clock_in DESC')
  res.json(rows.map(rowToRecord))
})

app.post('/api/records', async (req, res) => {
  const { staffId, clockIn } = req.body
  const id = generateId()
  await pool.query(
    'INSERT INTO records (id, staff_id, clock_in) VALUES ($1,$2,$3)',
    [id, staffId, clockIn]
  )
  res.json(rowToRecord({ id, staff_id: staffId, clock_in: new Date(clockIn), clock_out: null,
    transportation_fee: 0, transportation_round_trip: 0, note: '', break_req_status: null }))
})

app.put('/api/records/:id', async (req, res) => {
  const { clockIn, clockOut, transportationFee, transportationRoundTrip, note,
    breakRequest, breakStart, breakEnd } = req.body
  await pool.query(`
    UPDATE records SET
      clock_in = COALESCE($1, clock_in),
      clock_out = $2,
      transportation_fee = COALESCE($3, transportation_fee),
      transportation_round_trip = COALESCE($4, transportation_round_trip),
      note = COALESCE($5, note),
      break_req_minutes = $6,
      break_req_reason = $7,
      break_req_status = $8,
      break_req_comment = $9,
      break_req_at = $10,
      break_start = COALESCE($12, break_start),
      break_end = COALESCE($13, break_end)
    WHERE id = $11
  `, [
    clockIn || null,
    clockOut !== undefined ? clockOut : undefined,
    transportationFee !== undefined ? transportationFee : null,
    transportationRoundTrip !== undefined ? transportationRoundTrip : null,
    note !== undefined ? note : null,
    breakRequest?.requestedBreakMinutes ?? null,
    breakRequest?.reason ?? null,
    breakRequest?.status ?? null,
    breakRequest?.adminComment ?? null,
    breakRequest?.requestedAt ?? null,
    req.params.id,
    breakStart || null,
    breakEnd || null,
  ])
  const { rows } = await pool.query('SELECT * FROM records WHERE id=$1', [req.params.id])
  res.json(rowToRecord(rows[0]))
})

app.delete('/api/records/:id', async (req, res) => {
  await pool.query('DELETE FROM records WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

// ============ Excel エクスポート ============
app.get('/api/export/monthly', async (req, res) => {
  const year  = parseInt(req.query.year)
  const month = parseInt(req.query.month)
  if (!year || !month) return res.status(400).json({ error: 'year/month required' })

  const { rows: staffList } = await pool.query('SELECT * FROM staff ORDER BY id')
  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 1)
  const { rows: records } = await pool.query(
    'SELECT * FROM records WHERE clock_in >= $1 AND clock_in < $2',
    [startDate, endDate]
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`${year}.${month}`)

  // ===== スタイル定義 =====
  const headerFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  const subFill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
  const satFill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } }
  const sunFill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } }
  const totalFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  const thinBorder  = { style: 'thin', color: { argb: 'FFAAAAAA' } }
  const border      = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }
  const centerAlign = { horizontal: 'center', vertical: 'middle' }
  const rightAlign  = { horizontal: 'right', vertical: 'middle' }

  // ===== 列幅設定 =====
  ws.getColumn(1).width = 10  // スタッフ名
  ws.getColumn(2).width = 6   // 区分
  for (let d = 1; d <= daysInMonth; d++) ws.getColumn(d + 2).width = 7
  ws.getColumn(daysInMonth + 3).width = 8  // 出勤日数
  ws.getColumn(daysInMonth + 4).width = 10 // 合計時間
  ws.getColumn(daysInMonth + 5).width = 8  // 時給
  ws.getColumn(daysInMonth + 6).width = 10 // 労働報酬
  ws.getColumn(daysInMonth + 7).width = 8  // 交通費A
  ws.getColumn(daysInMonth + 8).width = 8  // 交通費B
  ws.getColumn(daysInMonth + 9).width = 10 // 総計
  ws.getColumn(daysInMonth + 10).width = 12 // 備考

  // ===== タイトル行 =====
  ws.mergeCells(1, 1, 1, daysInMonth + 10)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `日本橋法律特許事務所　勤務実績表（${year}年${month}月）`
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = headerFill
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 22

  // ===== 日付ヘッダー行 =====
  const dateRow = ws.getRow(2)
  dateRow.getCell(1).value = '氏名'
  dateRow.getCell(2).value = '区分'
  const dayNames = ['日','月','火','水','木','金','土']
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    const cell = dateRow.getCell(d + 2)
    cell.value = d
    cell.alignment = centerAlign
    cell.font = { bold: true, size: 9, color: { argb: dow === 0 ? 'FFB71C1C' : dow === 6 ? 'FF1565C0' : 'FF000000' } }
    if (dow === 6) cell.fill = satFill
    if (dow === 0) cell.fill = sunFill
    cell.border = border
  }
  dateRow.getCell(daysInMonth + 3).value = '出勤\n日数'
  dateRow.getCell(daysInMonth + 4).value = '合計\n勤務時間'
  dateRow.getCell(daysInMonth + 5).value = '時給\n(円)'
  dateRow.getCell(daysInMonth + 6).value = '労働\n報酬'
  dateRow.getCell(daysInMonth + 7).value = '交通費A\n(片道)'
  dateRow.getCell(daysInMonth + 8).value = '交通費B\n(往復)'
  dateRow.getCell(daysInMonth + 9).value = '総計\n(A+B+報酬)'
  dateRow.getCell(daysInMonth + 10).value = '備考'
  dateRow.height = 28
  for (let c = 1; c <= daysInMonth + 10; c++) {
    const cell = dateRow.getCell(c)
    if (!cell.fill || !cell.fill.fgColor) cell.fill = subFill
    cell.font = { ...(cell.font || {}), bold: true, size: 9 }
    cell.alignment = { ...centerAlign, wrapText: true }
    cell.border = border
  }

  // ===== 曜日行 =====
  const dowRow = ws.getRow(3)
  dowRow.getCell(1).value = ''; dowRow.getCell(2).value = ''
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    const cell = dowRow.getCell(d + 2)
    cell.value = dayNames[dow]
    cell.alignment = centerAlign
    cell.font = { size: 9, color: { argb: dow === 0 ? 'FFB71C1C' : dow === 6 ? 'FF1565C0' : 'FF000000' } }
    if (dow === 6) cell.fill = satFill
    if (dow === 0) cell.fill = sunFill
    cell.border = border
  }
  dowRow.height = 14

  // ===== スタッフ行 =====
  let currentRow = 4
  for (const staff of staffList) {
    const staffRecords = records.filter(r => r.staff_id === staff.id)
    const recordByDay = {}
    for (const r of staffRecords) {
      const d = new Date(r.clock_in).getDate()
      recordByDay[d] = r
    }

    const rowLabels = ['出勤', '退勤', '休憩', '深夜']
    const rowData   = [[], [], [], []]

    let workDays = 0, totalWorkMins = 0, totalTransA = 0, totalTransB = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const r = recordByDay[d]
      if (r) {
        workDays++
        const clockIn  = r.clock_in  ? new Date(r.clock_in)  : null
        const clockOut = r.clock_out ? new Date(r.clock_out) : null

        rowData[0][d] = clockIn  ? `${String(clockIn.getHours()).padStart(2,'0')}:${String(clockIn.getMinutes()).padStart(2,'0')}` : ''
        rowData[1][d] = clockOut ? `${String(clockOut.getHours()).padStart(2,'0')}:${String(clockOut.getMinutes()).padStart(2,'0')}` : '出勤中'

        // 休憩
        let breakMins = 0
        if (r.break_start && r.break_end) {
          breakMins = Math.round((new Date(r.break_end) - new Date(r.break_start)) / 60000)
        } else if (r.break_req_status === 'approved') {
          breakMins = r.break_req_minutes || 0
        } else if (clockIn && clockOut) {
          const grossMins = (clockOut - clockIn) / 60000
          breakMins = grossMins > 480 ? 60 : grossMins > 360 ? 45 : 0
        }
        rowData[2][d] = breakMins > 0 ? `${Math.floor(breakMins/60)}:${String(breakMins%60).padStart(2,'0')}` : ''

        // 深夜（22:00〜05:00）
        let lateNightMins = 0
        if (clockIn && clockOut) {
          const s = new Date(clockIn), e = new Date(clockOut)
          let cur = new Date(s)
          while (cur < e) {
            const h = cur.getHours()
            const isLate = h >= 22 || h < 5
            let next = new Date(cur)
            if (h >= 22) { next.setDate(next.getDate()+1); next.setHours(0,0,0,0) }
            else if (h < 5) { next.setHours(5,0,0,0) }
            else { next.setHours(22,0,0,0) }
            if (next > e) next = new Date(e)
            if (isLate) lateNightMins += (next - cur) / 60000
            cur = next
          }
        }
        rowData[3][d] = lateNightMins > 0 ? `${Math.floor(lateNightMins/60)}:${String(Math.round(lateNightMins%60)).padStart(2,'0')}` : ''

        if (clockIn && clockOut) {
          const grossMins = (clockOut - clockIn) / 60000
          totalWorkMins += Math.max(0, grossMins - breakMins)
        }
        totalTransA += r.transportation_fee || 0
        totalTransB += r.transportation_round_trip || 0
      } else {
        rowData[0][d] = ''; rowData[1][d] = ''; rowData[2][d] = ''; rowData[3][d] = ''
      }
    }

    const hourlyRate = staff.hourly_rate
    const laborPay   = Math.round(hourlyRate * totalWorkMins / 60)
    const totalPay   = laborPay + totalTransA + totalTransB
    const workHStr   = `${Math.floor(totalWorkMins/60)}:${String(Math.round(totalWorkMins%60)).padStart(2,'0')}`

    // スタッフ名を最初の行だけ表示（4行結合）
    ws.mergeCells(currentRow, 1, currentRow + 3, 1)
    const nameCell = ws.getCell(currentRow, 1)
    nameCell.value = staff.name
    nameCell.alignment = { ...centerAlign, wrapText: true }
    nameCell.font = { bold: true, size: 9 }
    nameCell.border = border

    // 集計列を最初の行のみ（4行結合）
    const summaryRow = currentRow
    const mergeAndSet = (col, val, fmt) => {
      ws.mergeCells(summaryRow, col, summaryRow + 3, col)
      const c = ws.getCell(summaryRow, col)
      c.value = val
      c.alignment = { ...centerAlign, wrapText: true }
      c.font = { size: 9 }
      c.fill = totalFill
      c.border = border
      if (fmt) c.numFmt = fmt
    }
    mergeAndSet(daysInMonth + 3, workDays)
    mergeAndSet(daysInMonth + 4, workHStr)
    mergeAndSet(daysInMonth + 5, hourlyRate, '#,##0')
    mergeAndSet(daysInMonth + 6, laborPay, '#,##0')
    mergeAndSet(daysInMonth + 7, totalTransA, '#,##0')
    mergeAndSet(daysInMonth + 8, totalTransB, '#,##0')
    mergeAndSet(daysInMonth + 9, totalPay, '#,##0')
    mergeAndSet(daysInMonth + 10, staff.employment_type === 'contract' ? '業務委託' : 'アルバイト')

    // 4行（出勤・退勤・休憩・深夜）
    for (let li = 0; li < 4; li++) {
      const row = ws.getRow(currentRow + li)
      row.height = 16
      row.getCell(2).value = rowLabels[li]
      row.getCell(2).alignment = centerAlign
      row.getCell(2).font = { size: 8 }
      row.getCell(2).fill = subFill
      row.getCell(2).border = border

      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month - 1, d).getDay()
        const cell = row.getCell(d + 2)
        cell.value = rowData[li][d] || ''
        cell.alignment = centerAlign
        cell.font = { size: 8 }
        cell.border = border
        if (dow === 6) cell.fill = satFill
        else if (dow === 0) cell.fill = sunFill
      }
    }

    // スタッフ間の区切り線
    for (let c = 1; c <= daysInMonth + 10; c++) {
      const cell = ws.getCell(currentRow + 3, c)
      cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: 'FF888888' } } }
    }

    currentRow += 4
  }

  // ===== レスポンス =====
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`勤務実績表_${year}年${month}月.xlsx`)}`)
  await wb.xlsx.write(res)
  res.end()
})

// ============ 静的ファイル配信 ============
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// ============ 起動 ============
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Themis running on port ${PORT}`))
  })
  .catch(err => {
    console.error('DB init error:', err)
    process.exit(1)
  })
