#!/usr/bin/env node

/**
 * Read-only Clicky Web Analytics API client.
 *
 * Credentials are environment-only so the sitekey does not land in shell
 * history or process listings:
 *   CLICKY_SITE_ID=... CLICKY_SITEKEY=... node scripts/traffic.cli.mjs summary
 *
 * Official API: https://clicky.com/help/api
 */

import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const API_URL = 'https://api.clicky.com/api/stats/4';
const RESERVED_PARAMS = new Set(['site_id', 'sitekey', 'output', 'json_callback', 'json_var', 'type']);

const COMMANDS = {
  summary: {
    type: 'visitors,visitors-unique,actions,actions-pageviews,time-average-pretty,bounce-rate',
    date: 'today',
  },
  pages: { type: 'pages', date: 'last-7-days', limit: 20 },
  sources: { type: 'traffic-sources', date: 'last-7-days', limit: 20 },
  goals: { type: 'goals', date: 'last-7-days', limit: 20 },
  visitors: { type: 'visitors-list', date: 'today', limit: 30 },
  actions: { type: 'actions-list', date: 'today', limit: 30 },
  online: { type: 'visitors-online' },
  query: {},
};

const HELP = `traffic.cli — read-only Clicky JSON API client

Usage:
  CLICKY_SITE_ID=... CLICKY_SITEKEY=... node scripts/traffic.cli.mjs <command> [options]

Commands:
  summary     visitors/actions/bounce/time totals (default: today)
  pages       top pages (default: last 7 days)
  sources     traffic sources (default: last 7 days)
  goals       goal totals (default: last 7 days)
  visitors    recent visitor sessions (default: today, limit 30)
  actions     recent actions (default: today, limit 30)
  online      visitors currently online
  query       arbitrary API data type; requires --type

Options:
  --date <range>       Clicky date expression, e.g. today or last-30-days
  --type <types>       comma-separated API types (query command only)
  --limit <n|all>      result limit; list endpoints are capped by Clicky
  --page <n>           page through list results
  --daily              return totals per day
  --hourly             return supported totals per hour
  --param <key=value>  additional Clicky filter; repeatable
  --compact            emit compact JSON instead of pretty JSON
  --timeout <ms>       request timeout (default: 15000)
  -h, --help           show this help

Environment:
  CLICKY_SITE_ID       required numeric Clicky site id
  CLICKY_SITEKEY       required Clicky Analytics API sitekey (secret)

The repository root .env is loaded automatically when present. Existing shell
environment values take precedence. The sitekey is intentionally not accepted
as a CLI option.`;

export function loadRepositoryEnv(env = process.env) {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url));
  const existing = { ...env };
  try {
    loadEnvFile(envPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  // A caller's exported environment is always more explicit than `.env`.
  Object.assign(process.env, existing);
}

export function parseArgs(argv) {
  const parsed = { command: 'summary', params: [], compact: false, daily: false, hourly: false };
  const args = [...argv];
  if (args[0] && !args[0].startsWith('-')) parsed.command = args.shift();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '-h' || token === '--help') { parsed.help = true; continue; }
    if (token === '--compact') { parsed.compact = true; continue; }
    if (token === '--daily') { parsed.daily = true; continue; }
    if (token === '--hourly') { parsed.hourly = true; continue; }
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);

    const key = token.slice(2).replaceAll('-', '_');
    if (!['date', 'type', 'limit', 'page', 'param', 'timeout'].includes(key)) {
      throw new Error(`unknown option: ${token}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
    index += 1;
    if (key === 'param') parsed.params.push(value);
    else parsed[key] = value;
  }
  return parsed;
}

function positiveInteger(value, label, { max } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || (max && number > max)) {
    throw new Error(`${label} must be a positive integer${max ? ` no greater than ${max}` : ''}`);
  }
  return number;
}

function addCustomParam(search, assignment) {
  const splitAt = assignment.indexOf('=');
  if (splitAt < 1) throw new Error(`--param must be key=value: ${assignment}`);
  const key = assignment.slice(0, splitAt);
  const value = assignment.slice(splitAt + 1);
  if (!/^[A-Za-z0-9_.\-[\]]+$/.test(key)) throw new Error(`invalid Clicky parameter name: ${key}`);
  if (RESERVED_PARAMS.has(key)) throw new Error(`--param cannot override ${key}`);
  search.append(key, value);
}

export function buildRequest(parsed, env = process.env) {
  const preset = COMMANDS[parsed.command];
  if (!preset) throw new Error(`unknown command: ${parsed.command}`);

  const siteId = env.CLICKY_SITE_ID || env.REACT_APP_CLICKY_SITE_ID;
  const sitekey = env.CLICKY_SITEKEY;
  if (!siteId || !/^\d+$/.test(siteId)) throw new Error('CLICKY_SITE_ID must be a numeric site id');
  if (!sitekey) throw new Error('CLICKY_SITEKEY is required');

  if (parsed.command !== 'query' && parsed.type) {
    throw new Error('--type is available only with the query command');
  }
  const type = parsed.type || preset.type;
  if (!type) throw new Error('query requires --type <comma-separated-types>');
  if (!/^[a-z0-9,-]+$/i.test(type)) throw new Error('invalid Clicky data type list');

  const url = new URL(API_URL);
  url.searchParams.set('site_id', siteId);
  url.searchParams.set('sitekey', sitekey);
  url.searchParams.set('type', type);
  url.searchParams.set('output', 'json');

  const date = parsed.date || preset.date;
  if (date) url.searchParams.set('date', date);

  const limit = parsed.limit || preset.limit;
  if (limit) {
    if (limit !== 'all') positiveInteger(limit, '--limit', { max: 1000 });
    url.searchParams.set('limit', String(limit));
  }
  if (parsed.page) url.searchParams.set('page', String(positiveInteger(parsed.page, '--page')));
  if (parsed.daily) url.searchParams.set('daily', '1');
  if (parsed.hourly) url.searchParams.set('hourly', '1');
  for (const assignment of parsed.params) addCustomParam(url.searchParams, assignment);

  const timeout = parsed.timeout ? positiveInteger(parsed.timeout, '--timeout', { max: 120_000 }) : 15_000;
  return { url, timeout };
}

export function redactSecrets(text, secrets = []) {
  return secrets.filter(Boolean).reduce(
    (value, secret) => value.replaceAll(String(secret), '[REDACTED]'),
    String(text),
  );
}

export async function fetchClicky({ url, timeout }, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'bomonline-traffic-cli/1.0' },
      signal: controller.signal,
    });
    const body = await response.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Clicky returned non-JSON data (HTTP ${response.status})`);
    }
    if (!response.ok) throw new Error(`Clicky API failed with HTTP ${response.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function main(argv = process.argv.slice(2), env = process.env, fetchImpl = fetch) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const request = buildRequest(parsed, env);
  const result = await fetchClicky(request, fetchImpl);
  process.stdout.write(`${JSON.stringify(result, null, parsed.compact ? 0 : 2)}\n`);
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  loadRepositoryEnv();
  main().catch((error) => {
    const message = error?.name === 'AbortError'
      ? 'Clicky API request timed out'
      : redactSecrets(error?.message || error, [process.env.CLICKY_SITEKEY]);
    process.stderr.write(`traffic.cli: ${message}\n`);
    process.exitCode = 1;
  });
}
