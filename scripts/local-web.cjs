// Local development only: keep Next.js in this process so the agent can track it.
process.env.NODE_ENV = 'development'
const path = require('node:path')
const { startServer } = require('../src/main/frontend/node_modules/next/dist/server/lib/start-server')
startServer({ dir: path.resolve(__dirname, '../src/main/frontend'), port: 3000, hostname: 'localhost', isDev: true, allowRetry: false }).catch(error => { console.error(error); process.exit(1) })
