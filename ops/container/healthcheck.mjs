const probes = [
  ['backend', 'http://127.0.0.1:5005/health'],
  ['next', 'http://127.0.0.1:8200/robots.txt'],
  ['cra', 'http://127.0.0.1:8201/'],
]

for (const [name, url] of probes) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await response.body?.cancel()
  } catch (error) {
    console.error(`[healthcheck] ${name} failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
