# Production API health and guarded reboot

`bom-health-checker` runs every five minutes through EventBridge. It POSTs a
minimal GraphQL query to the public `/graphql` route, verifying the complete
Cloudflare → ALB → NPM → Fastify path, then publishes
`BOM/Production APIHealthy` with the production EC2 instance ID.

The `bom-production-api-unhealthy` CloudWatch alarm requires three failed or
missing five-minute periods (`TreatMissingData=breaching`). Its transition into `ALARM` is matched by
`bom-production-api-reboot`, which invokes the existing `admin-api-reboot`
Lambda directly with a reboot request. EventBridge triggers only on the state
transition, so it cannot reboot the instance every five minutes while an outage
persists. One success returns the alarm to `OK`.

The old implementation was unsafe and ineffective: it sent GraphQL to `/`,
treated the returned HTML as a failed JSON response, and called a disabled,
unauthenticated API Gateway execute-api endpoint. That produced a false failure
and HTTP 403 every five minutes.

Deployment resources:

- Lambda: `bom-health-checker`
- Schedule: `bom-health-check-schedule`
- Metric: `BOM/Production`, `APIHealthy`, dimension
  `InstanceId=i-02c9619a48343a8d9`
- Alarm: `bom-production-api-unhealthy`
- EventBridge rule: `bom-production-api-reboot`
- Recovery Lambda: `admin-api-reboot`
