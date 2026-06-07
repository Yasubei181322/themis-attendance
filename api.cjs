const express = require('express')
const { Pool } = require('pg')
const path = require('path')
const cors = require('cors')

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
        break_req_at TIMESTAMPTZ
      )
    `)
    // 初期スタッフ登録
    const { rows } = await client.query('SELECT COUNT(*) FROM staff')
    if (parseInt(rows[0].count) === 0) {
      const initial = [
        ['staff001','スタッフ001','1001',1300,'parttime'],
        ['staff002','スタッフ002','1002',1400,'contract'],
        ['staff003','スタッフ003','1003',1500,'parttime'],
        ['staff004','スタッフ004','1004',1300,'contract'],
        ['staff005','スタッフ005','1005',1400,'parttime'],
        ['staff006','スタッフ006','1006',1500,'contract'],
        ['staff007','スタッフ007','1007',1300,'parttime'],
        ['staff008','スタッフ008','1008',1400,'contract'],
        ['staff009','スタッフ009','1009',1500,'parttime'],
        ['staff010','スタッフ010','1010',1300,'contract'],
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
    breakRequest } = req.body
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
      break_req_at = $10
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
  ])
  const { rows } = await pool.query('SELECT * FROM records WHERE id=$1', [req.params.id])
  res.json(rowToRecord(rows[0]))
})

app.delete('/api/records/:id', async (req, res) => {
  await pool.query('DELETE FROM records WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

// ============ 静的ファイル配信 ============
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
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
