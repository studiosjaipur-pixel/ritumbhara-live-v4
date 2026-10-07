// Test-only fake of the Upstash REST client (RedisClient interface). Implements just the commands the bot's store
// uses, with a controllable clock and failure switch. It lives in tests/ only: production code has no in-memory store.
import { RELEASE_LOCK_SCRIPT } from "../../lib/whatsapp-bot/store.ts";

export function createFakeRedis() {
  const data = new Map(); // key -> { value: string, expiresAt: number | null }
  const state = { nowMs: Date.parse("2026-10-07T06:30:00Z"), down: false, calls: [] };

  function live(key) {
    const e = data.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= state.nowMs) { data.delete(key); return null; }
    return e;
  }

  function exec(args) {
    const [cmd, ...rest] = args.map(String);
    const op = cmd.toUpperCase();
    state.calls.push(op);
    switch (op) {
      case "GET": { const e = live(rest[0]); return e ? e.value : null; }
      case "SET": {
        const [key, value, ...opts] = rest;
        let nx = false, xx = false, ttlMs = null;
        for (let i = 0; i < opts.length; i++) {
          const o = opts[i].toUpperCase();
          if (o === "NX") nx = true;
          else if (o === "XX") xx = true;
          else if (o === "EX") ttlMs = Number(opts[++i]) * 1000;
          else if (o === "PX") ttlMs = Number(opts[++i]);
          else throw new Error("fake redis: unsupported SET option " + o);
        }
        const exists = live(key) !== null;
        if ((nx && exists) || (xx && !exists)) return null;
        data.set(key, { value, expiresAt: ttlMs === null ? null : state.nowMs + ttlMs });
        return "OK";
      }
      case "DEL": { let n = 0; for (const k of rest) { if (live(k)) { data.delete(k); n++; } } return n; }
      case "INCR": {
        const e = live(rest[0]);
        const next = (e ? parseInt(e.value, 10) : 0) + 1;
        data.set(rest[0], { value: String(next), expiresAt: e ? e.expiresAt : null });
        return next;
      }
      case "EVAL": {
        const [script, numKeys, key, token] = rest;
        if (script !== RELEASE_LOCK_SCRIPT || numKeys !== "1") throw new Error("fake redis: unknown script");
        const e = live(key);
        if (e && e.value === token) { data.delete(key); return 1; }
        return 0;
      }
      default: throw new Error("fake redis: unsupported command " + op);
    }
  }

  const client = {
    async command(args) {
      if (state.down) { const { RedisUnavailableError } = await import("../../lib/whatsapp-bot/upstash.ts"); throw new RedisUnavailableError("network"); }
      return exec(args);
    },
    async pipeline(commands) {
      if (state.down) { const { RedisUnavailableError } = await import("../../lib/whatsapp-bot/upstash.ts"); throw new RedisUnavailableError("network"); }
      return commands.map(exec);
    },
  };

  return {
    client,
    state,
    advance(ms) { state.nowMs += ms; },
    ttlSeconds(key) { const e = live(key); return e && e.expiresAt !== null ? Math.round((e.expiresAt - state.nowMs) / 1000) : e ? -1 : -2; },
    get(key) { const e = live(key); return e ? e.value : null; },
    keys() { return [...data.keys()].filter((k) => live(k) !== null); },
  };
}
