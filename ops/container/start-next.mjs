import { spawn } from 'node:child_process'

const backend = process.env.BACKEND_HEALTH_URL ?? 'http://127.0.0.1:5005/health'
const deadline = Date.now() + 60_000

while (true) {
  try {
    const response = await fetch(backend, { signal: AbortSignal.timeout(2_000) })
    if (response.ok) break
  } catch {
    // Backend is still starting. PM2 owns its retries; wait before exposing Next.
  }
  if (Date.now() >= deadline) {
    console.error(`[next-readiness] backend did not become ready within 60s: ${backend}`)
    process.exit(1)
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
}

const child = spawn(
  '/app/frontend/next/node_modules/.bin/next',
  ['start', '--port', '8200'],
  { stdio: 'inherit' },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error('[next-readiness] failed to launch Next:', error)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
