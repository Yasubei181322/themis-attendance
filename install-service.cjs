const Service = require('node-windows').Service

const svc = new Service({
  name: 'Themis勤怠管理',
  description: '日本橋法律特許事務所 勤怠管理システム',
  script: 'C:\\Users\\nakay\\law-firm-attendance\\server.cjs',
  nodeOptions: [],
  wait: 2,
  grow: 0.5,
})

svc.on('install', () => {
  console.log('サービス登録完了。起動します...')
  svc.start()
})

svc.on('start', () => {
  console.log('Themisサービス起動しました。')
})

svc.on('error', (err) => {
  console.error('エラー:', err)
})

svc.install()
