/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DEVICE_SECRET: string;
  ADMIN_TOKEN: string;
}

const CONFIG = {
  version: 'demo-2026.07.10', defaultBlocks: 100, rewardEvery: 10,
  defaultRewards: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [(i + 1) * 10, (i + 1) / 10])),
  extensionPrices: { 10: .1, 20: .18, 30: .25, 40: .32, 50: .38, 60: .44, 70: .5, 80: .56, 90: .62, 100: .68 },
  medalBonuses: [0, .02, .04, .06, .08, .1, .12],
};

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const cents = (value: number) => Math.round(value * 100);
const uuid = () => crypto.randomUUID().replaceAll('-', '');
const encoder = new TextEncoder();

async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function playerFromRequest(request: Request, env: Env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [playerId, provided] = token.split('.');
  if (!playerId || !provided || await signature(playerId, env.DEVICE_SECRET) !== provided) return null;
  return env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, number | string>>();
}

function profile(row: Record<string, number | string>) {
  return { name: row.display_name, plays: row.plays, balance: Number(row.balance_cents) / 100, xp: row.xp, totalReward: Number(row.total_reward_cents) / 100, highestBlock: row.highest_block };
}

async function body(request: Request) { return request.json<Record<string, any>>(); }

async function api(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/identity' && request.method === 'POST') {
    const { deviceId } = await body(request);
    if (typeof deviceId !== 'string' || deviceId.length < 16) return json({ error: 'invalid device id' }, 400);
    const deviceHash = await digest(deviceId);
    let row = await env.DB.prepare('SELECT * FROM players WHERE device_id_hash = ?').bind(deviceHash).first<Record<string, number | string>>();
    if (!row) {
      const playerId = `plr_${uuid()}`;
      const now = Date.now();
      await env.DB.prepare('INSERT INTO players (player_id, device_id_hash, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)').bind(playerId, deviceHash, `星星玩家${playerId.slice(-4)}`, now, now).run();
      row = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, number | string>>();
    }
    const playerId = String(row!.player_id);
    return json({ playerId, token: `${playerId}.${await signature(playerId, env.DEVICE_SECRET)}`, profile: profile(row!) });
  }

  if (path.startsWith('/api/admin/')) {
    if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'unauthorized' }, 401);
    if (path === '/api/admin/stats') {
      const [players, rounds, rewards, active, recharge, extensions] = await env.DB.batch([
        env.DB.prepare('SELECT COUNT(*) count FROM players'), env.DB.prepare('SELECT COUNT(*) count, AVG(block) average_block, MAX(block) highest_block FROM rounds'),
        env.DB.prepare('SELECT COALESCE(SUM(base_reward_cents + bonus_reward_cents), 0) reward_cents FROM rounds'), env.DB.prepare('SELECT COUNT(*) count FROM active_rounds'),
        env.DB.prepare("SELECT COALESCE(SUM(amount_cents), 0) recharge_cents FROM balance_ledger WHERE type = 'RECHARGE'"),
        env.DB.prepare('SELECT COUNT(*) count, COALESCE(SUM(price_cents), 0) spent_cents FROM extension_orders'),
      ]);
      return json({ players: players.results[0], rounds: rounds.results[0], rewards: rewards.results[0], activeRounds: active.results[0], recharge: recharge.results[0], extensions: extensions.results[0] });
    }
    if (path === '/api/admin/players') return json((await env.DB.prepare('SELECT player_id, display_name, plays, balance_cents, xp, total_reward_cents, highest_block, created_at, last_seen_at FROM players ORDER BY created_at DESC LIMIT 500').all()).results);
    if (path === '/api/admin/rounds') return json((await env.DB.prepare('SELECT * FROM rounds ORDER BY ended_at DESC LIMIT 500').all()).results);
    if (path === '/api/admin/rewards') return json((await env.DB.prepare('SELECT * FROM balance_ledger ORDER BY created_at DESC LIMIT 500').all()).results);
    if (path === '/api/admin/play-ledger') return json((await env.DB.prepare('SELECT * FROM play_ledger ORDER BY created_at DESC LIMIT 500').all()).results);
    if (path === '/api/admin/leaderboard/weekly') {
      const since = Date.now() - 7 * 86400000;
      return json((await env.DB.prepare('SELECT p.player_id, p.display_name, COALESCE(SUM(r.base_reward_cents + r.bonus_reward_cents), 0) reward_cents FROM players p LEFT JOIN rounds r ON r.player_id = p.player_id AND r.ended_at >= ? GROUP BY p.player_id ORDER BY reward_cents DESC LIMIT 100').bind(since).all()).results);
    }
  }

  const player = await playerFromRequest(request, env);
  if (!player) return json({ error: 'unauthorized' }, 401);
  const playerId = String(player.player_id);
  await env.DB.prepare('UPDATE players SET last_seen_at = ? WHERE player_id = ?').bind(Date.now(), playerId).run();

  if (path === '/api/profile') return json(profile(player));
  if (path === '/api/config') return json(CONFIG);
  if (path === '/api/active-round') {
    const round = await env.DB.prepare('SELECT * FROM active_rounds WHERE player_id = ?').bind(playerId).first<Record<string, any>>();
    return json(round ? { roundId: round.round_id, seed: round.seed, practice: Boolean(round.practice), startedAt: round.started_at, snapshot: JSON.parse(round.snapshot_json), extensionPurchases: [], configVersion: round.config_version, seedProof: round.seed_proof } : null);
  }
  if (path === '/api/rounds' && request.method === 'POST') {
    if (await env.DB.prepare('SELECT 1 found FROM active_rounds WHERE player_id = ?').bind(playerId).first()) return json({ error: '已有一局正在处理中' }, 409);
    const { practice = false } = await body(request);
    if (!practice && Number(player.plays) < 1) return json({ error: 'Play 次数不足' }, 400);
    const roundId = `rnd_${uuid()}`; const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000; const now = Date.now();
    if (!practice) await env.DB.batch([env.DB.prepare('UPDATE players SET plays = plays - 1 WHERE player_id = ?').bind(playerId), env.DB.prepare("INSERT INTO play_ledger (player_id, change_amount, source, round_id, created_at) VALUES (?, -1, 'ROUND', ?, ?)").bind(playerId, roundId, now)]);
    const proof = await signature(`${roundId}:${seed}:${CONFIG.version}`, env.DEVICE_SECRET);
    await env.DB.prepare('INSERT INTO active_rounds VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(roundId, playerId, seed, practice ? 1 : 0, CONFIG.version, proof, JSON.stringify({ block: 0, rewards: [], stable: true, extending: false }), now).run();
    const fresh = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, any>>();
    return json({ roundId, seed, profile: profile(fresh!) }, 201);
  }
  const roundMatch = path.match(/^\/api\/rounds\/([^/]+)(?:\/(snapshot|extension|settle))?$/);
  if (roundMatch) {
    const [, roundId, action] = roundMatch;
    const active = await env.DB.prepare('SELECT * FROM active_rounds WHERE round_id = ? AND player_id = ?').bind(roundId, playerId).first<Record<string, any>>();
    if (action === 'settle' && request.method === 'POST') {
      const result = await body(request);
      const existing = await env.DB.prepare('SELECT 1 found FROM rounds WHERE round_id = ?').bind(roundId).first();
      if (!existing) {
        const rewardCents = cents(Number(result.baseUsdt) + Number(result.bonusUsdt)); const now = Date.now();
        const giftedPlays = Array.isArray(result.rewards) ? result.rewards.filter((reward: any) => reward.kind === 'play').reduce((sum: number, reward: any) => sum + Number(reward.value || 0), 0) : 0;
        const statements = [
          env.DB.prepare('INSERT INTO rounds VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(roundId, playerId, result.block, result.reason, JSON.stringify(result.rewards), cents(result.baseUsdt), cents(result.bonusUsdt), result.xpEarned, result.startedAt, now),
          env.DB.prepare('UPDATE players SET balance_cents = balance_cents + ?, total_reward_cents = total_reward_cents + ?, plays = plays + ?, xp = xp + ?, highest_block = MAX(highest_block, ?) WHERE player_id = ?').bind(rewardCents, rewardCents, giftedPlays, result.xpEarned, result.block, playerId),
          env.DB.prepare('DELETE FROM active_rounds WHERE round_id = ?').bind(roundId),
          env.DB.prepare("INSERT INTO balance_ledger (player_id, amount_cents, type, round_id, created_at) VALUES (?, ?, 'REWARD', ?, ?)").bind(playerId, rewardCents, roundId, now),
        ];
        if (giftedPlays) statements.push(env.DB.prepare("INSERT INTO play_ledger (player_id, change_amount, source, round_id, created_at) VALUES (?, ?, 'REWARD', ?, ?)").bind(playerId, giftedPlays, roundId, now));
        await env.DB.batch(statements);
      }
      const fresh = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, any>>();
      return json(profile(fresh!));
    }
    if (!active) return json({ error: '局次已失效' }, 404);
    if (!action && request.method === 'DELETE') { await env.DB.prepare('DELETE FROM active_rounds WHERE round_id = ?').bind(roundId).run(); return json({ ok: true }); }
    if (action === 'snapshot' && request.method === 'PUT') { const { snapshot } = await body(request); await env.DB.prepare('UPDATE active_rounds SET snapshot_json = ? WHERE round_id = ?').bind(JSON.stringify(snapshot), roundId).run(); return json({ ok: true }); }
    if (action === 'extension' && request.method === 'POST') {
      const { blocks } = await body(request); const price = (CONFIG.extensionPrices as Record<number, number>)[blocks]; const priceCents = cents(price ?? 0);
      if (!price || Number(player.balance_cents) < priceCents) return json({ error: '平台余额不足' }, 400);
      const now = Date.now();
      await env.DB.batch([env.DB.prepare('UPDATE players SET balance_cents = balance_cents - ? WHERE player_id = ?').bind(priceCents, playerId), env.DB.prepare('INSERT INTO extension_orders (player_id, round_id, blocks, price_cents, created_at) VALUES (?, ?, ?, ?, ?)').bind(playerId, roundId, blocks, priceCents, now), env.DB.prepare("INSERT INTO balance_ledger (player_id, amount_cents, type, round_id, created_at) VALUES (?, ?, 'EXTENSION', ?, ?)").bind(playerId, -priceCents, roundId, now)]);
      const fresh = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, any>>(); return json(profile(fresh!));
    }
  }
  if (path === '/api/recharge' && request.method === 'POST') {
    const { amount } = await body(request); if (![1, 5, 10, 20].includes(amount)) return json({ error: '无效充值档位' }, 400);
    const gift = Math.floor(amount / 5); const amountCents = cents(amount); const now = Date.now();
    const statements = [env.DB.prepare('UPDATE players SET balance_cents = balance_cents + ?, plays = plays + ? WHERE player_id = ?').bind(amountCents, gift, playerId), env.DB.prepare("INSERT INTO balance_ledger (player_id, amount_cents, type, created_at) VALUES (?, ?, 'RECHARGE', ?)").bind(playerId, amountCents, now)];
    if (gift) statements.push(env.DB.prepare("INSERT INTO play_ledger (player_id, change_amount, source, created_at) VALUES (?, ?, 'RECHARGE_GIFT', ?)").bind(playerId, gift, now));
    await env.DB.batch(statements);
    const fresh = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, any>>(); return json(profile(fresh!));
  }
  if (path === '/api/plays/purchase' && request.method === 'POST') {
    const { count } = await body(request); const cost = Number(count) * 500; if (!Number.isInteger(count) || count < 1 || Number(player.balance_cents) < cost) return json({ error: '平台余额不足或数量无效' }, 400);
    const now = Date.now();
    await env.DB.batch([env.DB.prepare('UPDATE players SET balance_cents = balance_cents - ?, plays = plays + ? WHERE player_id = ?').bind(cost, count, playerId), env.DB.prepare("INSERT INTO balance_ledger (player_id, amount_cents, type, created_at) VALUES (?, ?, 'PLAY_PURCHASE', ?)").bind(playerId, -cost, now), env.DB.prepare("INSERT INTO play_ledger (player_id, change_amount, source, created_at) VALUES (?, ?, 'PURCHASE', ?)").bind(playerId, count, now)]);
    const fresh = await env.DB.prepare('SELECT * FROM players WHERE player_id = ?').bind(playerId).first<Record<string, any>>(); return json(profile(fresh!));
  }
  if (path === '/api/records') return json((await env.DB.prepare('SELECT * FROM rounds WHERE player_id = ? ORDER BY ended_at DESC LIMIT 50').bind(playerId).all()).results.map((row: any) => ({ roundId: row.round_id, block: row.block, reason: row.end_reason, rewards: JSON.parse(row.rewards_json), baseUsdt: row.base_reward_cents / 100, bonusUsdt: row.bonus_reward_cents / 100, xpEarned: row.xp_earned, startedAt: row.started_at })));
  if (path === '/api/ranking/weekly') {
    const weekStart = Date.now() - 7 * 86400000;
    const rows = (await env.DB.prepare('SELECT p.player_id, p.display_name, COALESCE(SUM(r.base_reward_cents + r.bonus_reward_cents), 0) reward_cents FROM players p LEFT JOIN rounds r ON r.player_id = p.player_id AND r.ended_at >= ? GROUP BY p.player_id ORDER BY reward_cents DESC LIMIT 100').bind(weekStart).all()).results as any[];
    return json(rows.map((row, i) => ({ rank: i + 1, playerName: row.display_name, reward: row.reward_cents / 100, isCurrentUser: row.player_id === playerId })));
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    try { return path.startsWith('/api/') ? await api(request, env, path) : env.ASSETS.fetch(request); }
    catch (error) { console.error(error); return json({ error: 'internal error' }, 500); }
  },
};
