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
function toHHMM(mins) {
  if (!mins) return ''
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.round(Math.abs(mins) % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function calcBreakMins(r) {
  if (r.break_start && r.break_end) return Math.round((new Date(r.break_end) - new Date(r.break_start)) / 60000)
  if (r.break_req_status === 'approved') return r.break_req_minutes || 0
  if (r.clock_in && r.clock_out) {
    const gross = (new Date(r.clock_out) - new Date(r.clock_in)) / 60000
    return gross > 480 ? 60 : gross > 360 ? 45 : 0
  }
  return 0
}

function calcLateNightMins(r) {
  if (!r.clock_in || !r.clock_out) return 0
  let mins = 0, cur = new Date(r.clock_in)
  const end = new Date(r.clock_out)
  while (cur < end) {
    const h = cur.getHours()
    const late = h >= 22 || h < 5
    let next = new Date(cur)
    if (h >= 22) { next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0) }
    else if (h < 5) next.setHours(5, 0, 0, 0)
    else next.setHours(22, 0, 0, 0)
    if (next > end) next = new Date(end)
    if (late) mins += (next - cur) / 60000
    cur = next
  }
  return mins
}

app.get('/api/export/monthly', async (req, res) => {
  const year  = parseInt(req.query.year)
  const month = parseInt(req.query.month)
  if (!year || !month) return res.status(400).json({ error: 'year/month required' })

  const { rows: staffList } = await pool.query('SELECT * FROM staff ORDER BY id')
  const { rows: records }   = await pool.query(
    'SELECT * FROM records WHERE clock_in >= $1 AND clock_in < $2',
    [new Date(year, month - 1, 1), new Date(year, month, 1)]
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const dayNames    = ['日','月','火','水','木','金','土']
  const wb = new ExcelJS.Workbook()

  // ===== 共通スタイル =====
  const navy    = 'FF1F3864'
  const gold    = 'FFFFF2CC'
  const blue    = 'FFD6E4F0'
  const satC    = 'FFDDEBF7'
  const sunC    = 'FFFCE4EC'
  const gray    = 'FFF5F5F5'
  const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } })
  const thin = { style: 'thin', color: { argb: 'FFCCCCCC' } }
  const med  = { style: 'medium', color: { argb: 'FF888888' } }
  const bdr  = { top: thin, left: thin, bottom: thin, right: thin }
  const C    = { horizontal: 'center', vertical: 'middle' }
  const R    = { horizontal: 'right',  vertical: 'middle' }
  const L    = { horizontal: 'left',   vertical: 'middle' }

  const setCell = (ws, row, col, val, opts = {}) => {
    const c = ws.getCell(row, col)
    c.value = val
    if (opts.fill)   c.fill      = fill(opts.fill)
    if (opts.font)   c.font      = opts.font
    if (opts.align)  c.alignment = opts.align
    if (opts.numFmt) c.numFmt    = opts.numFmt
    if (opts.border !== false) c.border = opts.border || bdr
    return c
  }

  // ===== スタッフ別集計データを先に計算 =====
  const staffSummaries = staffList.map(staff => {
    const recs = records.filter(r => r.staff_id === staff.id)
    let workDays = 0, workMins = 0, lateNightMins = 0, transA = 0, transB = 0
    const byDay = {}
    for (const r of recs) {
      const d = new Date(r.clock_in).getDate()
      byDay[d] = r
      if (r.clock_out) {
        workDays++
        const gross = (new Date(r.clock_out) - new Date(r.clock_in)) / 60000
        workMins += Math.max(0, gross - calcBreakMins(r))
        lateNightMins += calcLateNightMins(r)
      }
      transA += r.transportation_fee || 0
      transB += r.transportation_round_trip || 0
    }
    const laborPay = Math.round(staff.hourly_rate * workMins / 60)
    return { staff, byDay, workDays, workMins, lateNightMins, transA, transB, laborPay, total: laborPay + transA + transB }
  })

  // ===================================
  // シート①：月次サマリー
  // ===================================
  const ws1 = wb.addWorksheet('月次サマリー')
  ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]

  // タイトル
  ws1.mergeCells(1, 1, 1, 10)
  setCell(ws1, 1, 1, `日本橋法律特許事務所　勤務実績表　${year}年${month}月`, {
    fill: navy, font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, align: C
  })
  ws1.getRow(1).height = 26

  // 空行
  ws1.getRow(2).height = 6

  // ヘッダー
  const s1headers = ['氏名','区分','出勤日数','勤務時間','深夜時間','時給','労働報酬','交通費(片道)','交通費(往復)','支払合計']
  s1headers.forEach((h, i) => {
    setCell(ws1, 3, i + 1, h, { fill: navy, font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, align: C })
  })
  ws1.getRow(3).height = 20

  // 列幅
  ;[16, 8, 8, 10, 8, 8, 10, 10, 10, 12].forEach((w, i) => { ws1.getColumn(i + 1).width = w })

  // データ行
  let totalLaborPay = 0, totalTransA = 0, totalTransB = 0, grandTotal = 0
  staffSummaries.forEach((s, idx) => {
    const row = idx + 4
    const bg  = idx % 2 === 0 ? 'FFFFFFFF' : gray
    setCell(ws1, row, 1, s.staff.name,       { fill: bg, font: { bold: true, size: 10 }, align: L })
    setCell(ws1, row, 2, s.staff.employment_type === 'contract' ? '業務委託' : 'アルバイト', { fill: bg, font: { size: 9 }, align: C })
    setCell(ws1, row, 3, s.workDays,          { fill: bg, align: C })
    setCell(ws1, row, 4, toHHMM(s.workMins),  { fill: bg, align: C })
    setCell(ws1, row, 5, toHHMM(s.lateNightMins) || '—', { fill: bg, align: C })
    setCell(ws1, row, 6, s.staff.hourly_rate, { fill: bg, align: R, numFmt: '#,##0' })
    setCell(ws1, row, 7, s.laborPay,          { fill: bg, align: R, numFmt: '#,##0' })
    setCell(ws1, row, 8, s.transA,            { fill: bg, align: R, numFmt: '#,##0' })
    setCell(ws1, row, 9, s.transB,            { fill: bg, align: R, numFmt: '#,##0' })
    setCell(ws1, row,10, s.total,             { fill: gold, font: { bold: true }, align: R, numFmt: '#,##0' })
    ws1.getRow(row).height = 18
    totalLaborPay += s.laborPay; totalTransA += s.transA; totalTransB += s.transB; grandTotal += s.total
  })

  // 合計行
  const totRow = staffSummaries.length + 4
  const totCells = ['合計', '', '', '', '', '', totalLaborPay, totalTransA, totalTransB, grandTotal]
  totCells.forEach((v, i) => {
    setCell(ws1, totRow, i + 1, v, {
      fill: navy, font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
      align: i < 2 ? C : R, numFmt: i >= 6 ? '#,##0' : undefined
    })
  })
  ws1.getRow(totRow).height = 20

  // ===================================
  // シート②以降：スタッフ別詳細
  // ===================================
  for (const s of staffSummaries) {
    const ws = wb.addWorksheet(s.staff.name.replace(/[\[\]*?:/\\]/g, ''))
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]

    // タイトル
    ws.mergeCells(1, 1, 1, 9)
    setCell(ws, 1, 1, `${s.staff.name}　勤務実績　${year}年${month}月`, {
      fill: navy, font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }, align: C
    })
    ws.getRow(1).height = 24

    // スタッフ情報
    ws.mergeCells(2, 1, 2, 9)
    setCell(ws, 2, 1,
      `区分：${s.staff.employment_type === 'contract' ? '業務委託' : 'アルバイト'}　時給：${s.staff.hourly_rate.toLocaleString()}円`,
      { fill: blue, font: { size: 10 }, align: L }
    )
    ws.getRow(2).height = 16

    // ヘッダー
    const headers = ['日付','曜日','出勤','退勤','休憩','勤務時間','深夜','交通費(片)','交通費(往復)','備考']
    headers.forEach((h, i) => {
      setCell(ws, 3, i + 1, h, { fill: navy, font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, align: C })
    })
    ws.getRow(3).height = 18

    // 追加の「備考」列
    ws.getColumn(1).width  = 10
    ws.getColumn(2).width  = 5
    ws.getColumn(3).width  = 7
    ws.getColumn(4).width  = 7
    ws.getColumn(5).width  = 7
    ws.getColumn(6).width  = 9
    ws.getColumn(7).width  = 7
    ws.getColumn(8).width  = 10
    ws.getColumn(9).width  = 10
    ws.getColumn(10).width = 16

    // 日付行
    let totalWorkMins = 0, totalLateNight = 0, tA = 0, tB = 0, wDays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const row  = d + 3
      const date = new Date(year, month - 1, d)
      const dow  = date.getDay()
      const isSat = dow === 6, isSun = dow === 0
      const bg = isSun ? sunC : isSat ? satC : 'FFFFFFFF'
      const dowColor = isSun ? 'FFB71C1C' : isSat ? 'FF1565C0' : 'FF000000'

      const dateStr = `${month}/${d}`
      setCell(ws, row, 1, dateStr, { fill: bg, font: { size: 10, color: { argb: dowColor } }, align: C })
      setCell(ws, row, 2, dayNames[dow], { fill: bg, font: { size: 10, color: { argb: dowColor } }, align: C })

      const r = s.byDay[d]
      if (r) {
        const ci = r.clock_in  ? new Date(r.clock_in)  : null
        const co = r.clock_out ? new Date(r.clock_out) : null
        const brk = calcBreakMins(r)
        const late = calcLateNightMins(r)
        const gross = (ci && co) ? (co - ci) / 60000 : 0
        const work  = Math.max(0, gross - brk)

        if (co) { wDays++; totalWorkMins += work; totalLateNight += late; tA += r.transportation_fee||0; tB += r.transportation_round_trip||0 }

        setCell(ws, row, 3, ci ? `${String(ci.getHours()).padStart(2,'0')}:${String(ci.getMinutes()).padStart(2,'0')}` : '', { fill: bg, align: C })
        setCell(ws, row, 4, co ? `${String(co.getHours()).padStart(2,'0')}:${String(co.getMinutes()).padStart(2,'0')}` : '出勤中', { fill: bg, align: C, font: co ? {} : { color: { argb: 'FFE53935' } } })
        setCell(ws, row, 5, brk  ? toHHMM(brk)  : '—', { fill: bg, align: C })
        setCell(ws, row, 6, co   ? toHHMM(work)  : '—', { fill: bg, align: C, font: { bold: !!co } })
        setCell(ws, row, 7, late ? toHHMM(late)  : '—', { fill: bg, align: C })
        setCell(ws, row, 8, r.transportation_fee || 0,        { fill: bg, align: R, numFmt: '#,##0' })
        setCell(ws, row, 9, r.transportation_round_trip || 0, { fill: bg, align: R, numFmt: '#,##0' })
        setCell(ws, row,10, r.note || '', { fill: bg, align: L })
      } else {
        for (let c = 3; c <= 10; c++) setCell(ws, row, c, '', { fill: bg, align: C })
      }
      ws.getRow(row).height = 16
    }

    // 合計行
    const totR = daysInMonth + 4
    const laborP = Math.round(s.staff.hourly_rate * totalWorkMins / 60)
    const totals = [`出勤 ${wDays}日`, '', '', '', '', toHHMM(totalWorkMins), toHHMM(totalLateNight)||'—', tA, tB, '']
    totals.forEach((v, i) => {
      setCell(ws, totR, i + 1, v, {
        fill: gold, font: { bold: true, size: 10 }, align: i >= 7 ? R : C,
        numFmt: i >= 7 ? '#,##0' : undefined, border: { top: med, left: thin, bottom: thin, right: thin }
      })
    })

    // 給与集計（右下に）
    const payR = totR + 2
    ;[
      [1, '時給', s.staff.hourly_rate, '#,##0'],
      [1, '労働報酬', laborP, '#,##0'],
      [1, '交通費(片道)', tA, '#,##0'],
      [1, '交通費(往復)', tB, '#,##0'],
      [1, '支払合計', laborP + tA + tB, '#,##0'],
    ].forEach(([_, label, val, fmt], i) => {
      setCell(ws, payR + i, 5, label, { fill: blue, font: { bold: true, size: 10 }, align: R })
      setCell(ws, payR + i, 6, val,   { fill: i === 4 ? gold : 'FFFFFFFF', font: { bold: i === 4, size: 10 }, align: R, numFmt: fmt })
    })
    ws.getRow(totR).height = 18
  }

  // ===== 支払明細シート（スタッフ別） =====
  for (const s of staffSummaries) {
    const ws = wb.addWorksheet(`支払明細_${s.staff.name.replace(/[\[\]*?:/\\]/g, '')}`)
    const laborP = Math.round(s.staff.hourly_rate * s.workMins / 60)
    const total  = laborP + s.transA + s.transB

    // 列幅
    ws.getColumn(1).width = 18
    ws.getColumn(2).width = 18

    // タイトル
    ws.mergeCells(1, 1, 1, 2)
    setCell(ws, 1, 1, `${s.staff.name}様　${year}年${month}月分　労働報酬`, {
      fill: navy, font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, align: C
    })
    ws.getRow(1).height = 28

    // 空行
    ws.getRow(2).height = 8

    // 明細行
    const rows = [
      ['出勤日数',   `${s.workDays}日`],
      ['勤務時間',   toHHMM(s.workMins)],
      ['時給',       s.staff.hourly_rate],
      ['労働報酬',   laborP],
      ['交通費（片道）', s.transA],
      ['交通費（往復）', s.transB],
      ['お支払合計', total],
    ]

    rows.forEach(([label, val], i) => {
      const row   = i + 3
      const isTotal = label === 'お支払合計'
      const bg    = isTotal ? gold : i % 2 === 0 ? 'FFFFFFFF' : gray
      const font  = { bold: isTotal, size: isTotal ? 12 : 11 }
      setCell(ws, row, 1, label, { fill: blue, font: { ...font, bold: true }, align: L })
      setCell(ws, row, 2, val,   {
        fill: bg, font, align: R,
        numFmt: typeof val === 'number' ? '#,##0' : undefined
      })
      ws.getRow(row).height = isTotal ? 24 : 20
    })

    // 区切り線（合計行の上）
    const totRow = rows.length + 2
    ws.getCell(totRow, 1).border = { ...bdr, top: med }
    ws.getCell(totRow, 2).border = { ...bdr, top: med }
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
