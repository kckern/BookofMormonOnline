import { getRedis, type RedisClient } from '../config/redis.js';

export interface BotBudgetResult {
  allowed: boolean;
  reason?: 'limiter-unavailable' | 'hourly-limit' | 'daily-limit' | 'limiter-error';
  hourlyCount?: number;
  dailyCount?: number;
}

const LUA = `
local hourly = redis.call('INCR', KEYS[1])
if hourly == 1 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
local daily = redis.call('INCR', KEYS[2])
if daily == 1 then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
if hourly > tonumber(ARGV[1]) then return {0, hourly, daily, 1} end
if daily > tonumber(ARGV[2]) then return {0, hourly, daily, 2} end
return {1, hourly, daily, 0}
`;

function positiveInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Global, Redis-backed spend guard. Real generation fails closed without Redis. */
export async function consumeBotGenerationBudget(clientOverride?: RedisClient | null): Promise<BotBudgetResult> {
  if (process.env['BOT_LLM_MOCK']) return { allowed: true };
  const redis = clientOverride === undefined ? await getRedis() : clientOverride;
  if (!redis) return { allowed: false, reason: 'limiter-unavailable' };

  const hourlyLimit = positiveInt('BOT_LLM_HOURLY_LIMIT', 30);
  const dailyLimit = positiveInt('BOT_LLM_DAILY_LIMIT', 100);
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  try {
    const raw = await redis.eval(LUA, {
      keys: [`bots:llm-budget:hour:${hour}`, `bots:llm-budget:day:${day}`],
      arguments: [String(hourlyLimit), String(dailyLimit), '3700', '90000'],
    }) as Array<number | string>;
    const [allowed, hourlyCount, dailyCount, reason] = raw.map(Number);
    return {
      allowed: allowed === 1,
      reason: reason === 1 ? 'hourly-limit' : reason === 2 ? 'daily-limit' : undefined,
      hourlyCount,
      dailyCount,
    };
  } catch {
    return { allowed: false, reason: 'limiter-error' };
  }
}
