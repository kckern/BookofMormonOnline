/** @implements {import('../contract.js').AnalyticsProvider} */
export class NoopProvider {
  init() {}
  identify() {}
  pageview() {}
  goal() {}
}
