// Foundational types for the Week 5 WhatsApp qualification bot (stretch).
// Types only (plus the list of state names); no behaviour. The state machine comes in a later phase.

// Conversation states. The deterministic state machine (later phase) owns every transition; Groq never does.
export const CONVERSATION_STATES = [
  "NEW",
  "ASK_DATES",
  "ASK_CHECKOUT",
  "ASK_GUESTS",
  "ASK_STAY",
  "ASK_REQUIREMENTS",
  "CONFIRM",
  "QUALIFIED",
  "HANDED_OFF",
  "OPTED_OUT",
] as const;

export type ConversationStateName = (typeof CONVERSATION_STATES)[number];

// How a conversation ended up with the team. "QUALIFIED": all required fields collected and confirmed by the
// guest. "HUMAN_REQUESTED": the guest asked for a person. "NEEDS_FOLLOW_UP": the bot gave up (retry limits).
export type QualificationOutcome = "QUALIFIED" | "HUMAN_REQUESTED" | "NEEDS_FOLLOW_UP";

// Where the conversation is running. Production is not used yet.
export type BotChannel = "sandbox" | "production";

// The fields the bot collects. null = not collected yet.
export interface LeadFields {
  checkIn: string | null; // ISO date YYYY-MM-DD
  checkOut: string | null; // ISO date YYYY-MM-DD
  guests: number | null; // exact count
  guestsHint: string | null; // e.g. "6+" from the website widget, when the exact count is not known
  destination: string | null; // destination slug from config/destinations.config.ts
  property: string | null; // property slug from config/properties.config.ts
  requirements: string | null; // free text, length-capped; "" = guest said none; null = not answered yet
}

// Fields the bot asks for, used for per-field retry counters.
// "confirm" counts confirmation replies the bot could not understand.
export type AskableField = "dates" | "checkOut" | "guests" | "stay" | "requirements" | "confirm";

// Where pre-filled values came from (attribution only; pre-filled values are still validated and confirmed).
export type PrefillSource = "none" | "website-availability" | "property-ref" | "destination-ref";

// One incoming WhatsApp message, as received from the Twilio webhook (after signature verification).
export interface WhatsAppInboundMessage {
  messageSid: string;
  accountSid: string;
  from: string; // sender E.164, e.g. "+919000000001" (the "whatsapp:" prefix removed)
  to: string; // receiving number E.164
  body: string; // message text, length-capped
  numMedia: number;
  profileName: string | null; // WhatsApp profile name (not verified)
  waId: string | null;
  // "ok": body holds the text. "empty" (e.g. media only) and "too_long": body is "" and the text is never passed on.
  bodyStatus: InboundBodyStatus;
}

export type InboundBodyStatus = "ok" | "empty" | "too_long";

// Control words the guest can send at any time.
export type GuestKeyword = "STOP" | "AGENT" | "RESTART" | "YES";

// The result of deterministic parsing of one guest message (later phase), before any AI extraction.
export interface ParsedGuestMessage {
  text: string; // trimmed, length-capped message text
  isEmpty: boolean; // no usable text (e.g. media-only)
  hasMedia: boolean;
  keyword: GuestKeyword | null;
  ref: string | null; // website attribution, e.g. "W-PROP-studio-925", validated against WHATSAPP_REF_PATTERN
  fields: Partial<LeadFields>; // values found deterministically (still subject to validation)
}

// The stored state of one guest's conversation, keyed by the sender's number.
export interface ConversationState {
  version: number; // schema version of this record
  sender: string; // E.164
  state: ConversationStateName;
  fields: LeadFields;
  ref: string | null;
  prefillSource: PrefillSource;
  attempts: Partial<Record<AskableField, number>>;
  botTurns: number;
  profileName: string | null;
  channel: BotChannel;
  startedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  leadId: string | null;
  outcome: QualificationOutcome | null;
  leadDelivered: boolean;
  lastReminderAt: string | null; // last post-handoff reminder (ISO timestamp)
}

// The lead handed to the team (Google Sheet + email), built only from validated fields.
export interface QualifiedLead {
  leadId: string;
  outcome: QualificationOutcome;
  channel: BotChannel;
  guestWhatsApp: string; // E.164
  guestName: string | null; // WhatsApp profile name (not verified)
  ref: string | null;
  prefillSource: PrefillSource;
  fields: LeadFields;
  nights: number | null;
  notes: string[]; // deterministic validation notes, e.g. "exceeds listed max guests"
  conversationStartedAt: string;
  handedOffAt: string;
  botTurns: number;
}

// Fallback AI extraction (Phase 4), AFTER validation against the website catalog and the deterministic date
// rules. Values only fill fields the deterministic parser and the conversation do not already have.
export type ExtractionIntent =
  | "booking_inquiry" | "availability_inquiry" | "general_question" | "correction" | "confirmation" | "human_request" | "other";

export interface ValidatedExtraction {
  checkIn: string | null; // ISO, passed the deterministic parser and check-in rules
  checkOut: string | null; // ISO, passed the deterministic parser and check-out rules
  guests: number | null; // integer 1-20
  destination: string | null; // catalog slug
  property: string | null; // catalog slug
  requirements: string | null; // verbatim excerpt of the guest's own message, <= 300 chars
  intent: ExtractionIntent | null; // informational only; never drives the state machine
}

// Shape of the AI extractor's JSON after key/type checks (before business validation).
export interface RawExtraction {
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  destination: string | null;
  property: string | null;
  requirements: string | null;
  intent: string | null;
}

// Minimal context for the model. No phone numbers, names, transcripts or internal data.
export interface ExtractionRequestContext {
  todayIst: string; // YYYY-MM-DD
  currentStep: string; // e.g. "ASK_DATES"
  known: { checkIn: string | null; checkOut: string | null; guests: number | null; destination: string | null; property: string | null };
  destinations: string[]; // names from the website config
  properties: string[]; // names from the website config
}

// A conversation handed to the team WITHOUT confirmation (guest asked for a person, or the bot gave up).
// Never QUALIFIED. Carries only what was collected so far (each field may be null).
export type HandoffReason = "HUMAN_REQUESTED" | "NEEDS_FOLLOW_UP";

export interface HandoffLead {
  handoffId: string;
  reason: HandoffReason;
  channel: BotChannel;
  guestWhatsApp: string; // E.164
  ref: string | null;
  fields: LeadFields;
  conversationStartedAt: string;
  handedOffAt: string;
  botTurns: number;
}
