const https = require('https')
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch')

const REGION = process.env.AWS_REGION || 'us-west-2'
const HOSTNAME = process.env.HEALTH_HOSTNAME || 'bookofmormon.online'
const PATH = process.env.HEALTH_PATH || '/graphql'
const METRIC_NAMESPACE = process.env.METRIC_NAMESPACE || 'BOM/Production'
const METRIC_NAME = process.env.METRIC_NAME || 'APIHealthy'
const INSTANCE_ID = process.env.INSTANCE_ID || 'i-02c9619a48343a8d9'
const cloudWatch = new CloudWatchClient({ region: REGION })

exports.handler = async () => {
  const checkedAt = new Date()
  let healthy = false
  let reason = 'unknown'

  try {
    const result = await performHealthCheck()
    healthy = result.healthy
    reason = result.reason
  } catch (error) {
    reason = `probe_exception:${error instanceof Error ? error.message : String(error)}`
  }

  await publishHealthMetric(healthy, checkedAt)
  console.log(JSON.stringify({ event: 'bom_health_check', healthy, reason, checkedAt: checkedAt.toISOString() }))

  return {
    statusCode: healthy ? 200 : 503,
    body: JSON.stringify({ healthy, reason, timestamp: checkedAt.toISOString() }),
  }
}

function performHealthCheck() {
  const postData = JSON.stringify({ query: 'query Health { __typename }' })
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: HOSTNAME,
        port: 443,
        path: PATH,
        method: 'POST',
        timeout: 20_000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'BOMHealthChecker/2.0 bot',
        },
      },
      (response) => {
        let data = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          if (data.length < 64 * 1024) data += chunk
        })
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve({ healthy: false, reason: `http_${response.statusCode}` })
            return
          }
          try {
            const parsed = JSON.parse(data)
            const valid = parsed?.data?.__typename === 'Query' && !parsed.errors
            resolve({ healthy: valid, reason: valid ? 'graphql_ok' : 'graphql_shape_invalid' })
          } catch {
            resolve({ healthy: false, reason: 'invalid_json' })
          }
        })
      },
    )

    request.on('error', (error) => resolve({ healthy: false, reason: `request_error:${error.message}` }))
    request.on('timeout', () => {
      request.destroy()
      resolve({ healthy: false, reason: 'timeout' })
    })
    request.write(postData)
    request.end()
  })
}

async function publishHealthMetric(healthy, timestamp) {
  await cloudWatch.send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: METRIC_NAME,
          Dimensions: [{ Name: 'InstanceId', Value: INSTANCE_ID }],
          Timestamp: timestamp,
          Unit: 'Count',
          Value: healthy ? 1 : 0,
        },
      ],
    }),
  )
}
