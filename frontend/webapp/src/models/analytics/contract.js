// Provider contract (JSDoc typedefs; editor hints only — no runtime export).
/**
 * @typedef {Object} AnalyticsUser
 * @property {string} userid
 * @property {string} [username]
 *
 * @typedef {Object} AnalyticsConfig
 * @property {boolean} [enabled]
 *
 * @typedef {Object} AnalyticsProvider
 * @property {(cfg?: AnalyticsConfig) => void}                      init
 * @property {(user: AnalyticsUser|null) => void}                   identify
 * @property {(path: string, title?: string, opts?: {initial?: boolean}) => void} pageview
 * @property {(name: string, opts?: {revenue?: number}) => void}    goal
 */
export {};
