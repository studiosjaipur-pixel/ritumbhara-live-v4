import { randomUUID } from "crypto";
import { REDIS_NAMESPACES, type RedisNamespace } from "./config";
import { CONVERSATION_STATES, type ConversationState } from "./types";
import { createUpstashClient, type RedisClient } from "./upstash";

// Conversation storage for the Week 5 WhatsApp bot (stretch). SERVER-ONLY.
// Backed by Upstash Redis over REST (see upstash.ts). Every guarantee (de-duplication, locking, opt-out, rate
// limiting) comes from atomic Redis commands, so it holds across serverless instances. There is no in-memory
// fallback: if Redis is unreachable, operations throw RedisUnavailableError and the caller must not pretend
// anything was saved.

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/store is server-only and must not be imported in browser code.");
}

// Expiry times (seconds unless stated).
export const STORE_TTL = {
  conversation: 7 * 24 * 60 * 60, // active conversation, refreshed on each message
  conversationAfterHandoff: 30 * 24 * 60 * 60, // keeps a returning guest from being asked again
  messageProcessing: 60, // MessageSid claimed but not finished (lets a retry through if processing crashed)
  messageProcessed: 48 * 60 * 60, // MessageSid finished (duplicate deliveries get no second reply)
  senderLockMs: 15000, // per-sender lock while one message is processed (covers a lead delivery of up to 8 s)
} as const;

export const CONVERSATION_SCHEMA_VERSION = 1;

const E164 = /^\+[1-9]\d{7,14}$/;
const MESSAGE_SID = /^(SM|MM)[0-9a-fA-F]{32}$/;
const SCOPE = /^[A-Za-z0-9:+_-]{1,64}$/;

function checked(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error("Invalid " + what + " for store key");
  return value;
}

function checkedNamespace(namespace: string): RedisNamespace {
  if ((REDIS_NAMESPACES as readonly string[]).indexOf(namespace) === -1) throw new Error("Invalid Redis namespace for store keys");
  return namespace as RedisNamespace;
}

// Redis key layout. Only validated E.164 numbers and Twilio MessageSids are ever used in keys. Every key the bot
// writes is built here; with a namespace each one starts with "<namespace>:" ("production:wa:conv:+91…").
export function createStoreKeys(namespace?: RedisNamespace) {
  const p = (namespace === undefined ? "" : checkedNamespace(namespace) + ":") + "wa:";
  return {
    conversation: function (sender: string) { return p + "conv:" + checked(sender, E164, "sender"); },
    optOut: function (sender: string) { return p + "optout:" + checked(sender, E164, "sender"); },
    message: function (messageSid: string) { return p + "msg:" + checked(messageSid, MESSAGE_SID, "MessageSid"); },
    senderLock: function (sender: string) { return p + "lock:" + checked(sender, E164, "sender"); },
    rateLimit: function (scope: string, windowStart: number) { return p + "rl:" + checked(scope, SCOPE, "scope") + ":" + windowStart; },
  };
}

// Un-namespaced layout ("wa:…"), kept for in-memory tests only. Real Redis always goes through
// createUpstashConversationStore, which requires a namespace.
export const storeKeys = createStoreKeys();

export type MessageClaim = "claimed" | "duplicate";

export interface ConversationStore {
  // Conversation state for one sender, or null if none, expired or unreadable.
  getConversation(sender: string): Promise<ConversationState | null>;
  // Saves the state with an expiry (seconds).
  saveConversation(state: ConversationState, ttlSeconds: number): Promise<void>;
  // Removes the state (STOP, RESTART).
  deleteConversation(sender: string): Promise<void>;

  // Atomically claims a MessageSid for processing. "duplicate" if it was already claimed or processed.
  claimMessage(messageSid: string): Promise<MessageClaim>;
  // Marks a claimed MessageSid as fully processed (kept ~48 h).
  markMessageProcessed(messageSid: string): Promise<void>;
  // Gives up a claim without processing (e.g. the sender was busy), so a redelivery can be processed.
  releaseMessageClaim(messageSid: string): Promise<void>;

  // Per-sender lock. Returns a token when acquired, null when another request holds it.
  acquireSenderLock(sender: string, ttlMs: number): Promise<string | null>;
  // Releases the lock only if it is still held with this token.
  releaseSenderLock(sender: string, token: string): Promise<void>;

  // Opt-out (STOP) state. It has no expiry and outlives the conversation. false clears it (START).
  isOptedOut(sender: string): Promise<boolean>;
  setOptedOut(sender: string, optedOut: boolean): Promise<void>;

  // Fixed-window counter. Returns the count in the current window, including this hit.
  incrementRateLimit(scope: string, windowSeconds: number, nowMs: number): Promise<number>;
}

// Deletes the lock only if it still holds our token (so an expired lock re-taken by another request is untouched).
export const RELEASE_LOCK_SCRIPT =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

function parseConversation(raw: unknown, sender: string): ConversationState | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as ConversationState;
    if (!value || typeof value !== "object") return null;
    if (value.version !== CONVERSATION_SCHEMA_VERSION || value.sender !== sender) return null;
    if ((CONVERSATION_STATES as readonly string[]).indexOf(value.state) === -1) return null;
    if (!value.fields || typeof value.fields !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

export function createConversationStore(client: RedisClient, namespace?: RedisNamespace): ConversationStore {
  const storeKeys = createStoreKeys(namespace);
  return {
    getConversation: async function (sender) {
      return parseConversation(await client.command(["GET", storeKeys.conversation(sender)]), sender);
    },
    saveConversation: async function (state, ttlSeconds) {
      await client.command(["SET", storeKeys.conversation(state.sender), JSON.stringify(state), "EX", Math.max(1, Math.floor(ttlSeconds))]);
    },
    deleteConversation: async function (sender) {
      await client.command(["DEL", storeKeys.conversation(sender)]);
    },

    claimMessage: async function (messageSid) {
      const result = await client.command(["SET", storeKeys.message(messageSid), "processing", "NX", "EX", STORE_TTL.messageProcessing]);
      return result === "OK" ? "claimed" : "duplicate";
    },
    markMessageProcessed: async function (messageSid) {
      await client.command(["SET", storeKeys.message(messageSid), "done", "EX", STORE_TTL.messageProcessed]);
    },
    releaseMessageClaim: async function (messageSid) {
      await client.command(["DEL", storeKeys.message(messageSid)]);
    },

    acquireSenderLock: async function (sender, ttlMs) {
      const token = randomUUID();
      const result = await client.command(["SET", storeKeys.senderLock(sender), token, "NX", "PX", Math.max(1, Math.floor(ttlMs))]);
      return result === "OK" ? token : null;
    },
    releaseSenderLock: async function (sender, token) {
      await client.command(["EVAL", RELEASE_LOCK_SCRIPT, 1, storeKeys.senderLock(sender), token]);
    },

    isOptedOut: async function (sender) {
      return (await client.command(["GET", storeKeys.optOut(sender)])) !== null;
    },
    setOptedOut: async function (sender, optedOut) {
      if (optedOut) await client.command(["SET", storeKeys.optOut(sender), "1"]);
      else await client.command(["DEL", storeKeys.optOut(sender)]);
    },

    incrementRateLimit: async function (scope, windowSeconds, nowMs) {
      const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
      const key = storeKeys.rateLimit(scope, windowStart);
      // Create the window key with its expiry first (NX), then count; INCR keeps the expiry.
      const results = await client.pipeline([
        ["SET", key, 0, "NX", "EX", windowSeconds + 5],
        ["INCR", key],
      ]);
      const count = Number(results[1]);
      return isFinite(count) ? count : 0;
    },
  };
}

// The real store. A namespace is mandatory, so Preview and Production keys can never mix in a shared database.
export function createUpstashConversationStore(url: string, token: string, namespace: RedisNamespace): ConversationStore {
  return createConversationStore(createUpstashClient({ url: url, token: token }), checkedNamespace(namespace));
}
