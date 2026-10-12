# Leads Apps Script (Week 5 + Week 6)

`Code.gs` is the Google Apps Script web app that the website sends leads to. It is deployed separately in Google Apps Script; this copy is for reference and version control only. Nothing here runs on Vercel.

Repo version: **6.6** (`bot-v6.6-follow-up-live`). To see which version is live, run `diagnoseBotLead` (it reports `version`).

## What it does

- **WhatsApp clicks** (from `/api/wa-click`): adds a row to the `WhatsApp Clicks` tab and emails the team. The same button on the same page within 15 seconds is logged once (cache check, then a check of the Sheet's last 20 rows, under the script lock).
- **Qualified leads** (from the WhatsApp bot): `Qualified Leads` tab + "New Qualified WhatsApp Lead" email. Idempotent by Lead ID.
- **Handoffs** (from the WhatsApp bot): `Handoffs` tab + "WhatsApp guest needs a team member" email. Idempotent by Handoff ID.
- **Lead status tracking** (Week 6, Step 1), **lead scoring** (Step 2), **follow-up reminders** (Step 3), the **conversion report** (Stretch 1) and **automatic WhatsApp follow-ups** (Stretch 2; off by default, live sending disabled by default): see below.

It is a standalone script: it opens the Sheet by ID (`LEADS_SHEET_ID`), never `getActiveSpreadsheet()`.

## Lead status tracking (Week 6, Step 1)

Applies to `Qualified Leads` and `Handoffs` only. `WhatsApp Clicks` is lead intent, not a lead, and is unchanged.

| Column | Behaviour |
|---|---|
| `Status` (column C, unchanged) | Dropdown: `New`, `Contacted`, `Booked`, `Lost`. New leads start as `New`. |
| `Status Updated (IST)` (new) | Set when a lead row is created, and whenever the team changes `Status`. |
| `Next Follow-up` (new, IST) | Set from the status: `New` = 1 day later, `Contacted` = 2 days later, `Booked` / `Lost` = empty. The team can overwrite it. |

- The two new columns are added after `Email Status`. Existing columns are not moved.
- Bot-lead values are written by header name. A column the team adds is never written into.
- `Email Status` is written to its own column, found by header name, rather than "the last column".
- A status change is handled by `onLeadStatusEdit`, an installable "on edit" trigger. It ignores:
  - other tabs and other columns;
  - the header row;
  - rows without a Lead/Handoff ID;
  - values that aren't one of the four statuses;
  - re-selecting the value a cell already had.
- Edits made by the script itself don't fire the trigger.

Status tracking itself never contacts a guest. Automatic WhatsApp follow-ups are a separate, opt-in feature (Stretch 2); live sending is disabled by default.

### One-time setup after deploying 6.1 (or later)

Run `setupLeadStatusTracking` once from the editor. It's safe to run again. It does the following:

- **Columns:** adds the two columns to both lead tabs if they're missing, and creates a missing tab with the full header row.
- **Dropdown:** puts the `Status` dropdown on every data row.
- **Existing statuses:**
  - empty `Status` becomes `New`;
  - a different-case value (`booked`) becomes `Booked`;
  - any other value is left as it is and counted as `invalid` in the log, for the team to fix by hand.
- **Empty date cells only:**
  - `New` rows get `Status Updated (IST)` = their `Received (IST)` time, and `Next Follow-up` 1 day after that;
  - `Contacted` rows get `Next Follow-up` 2 days from now;
  - `Booked` / `Lost` rows have `Next Follow-up` cleared.
- **Trigger:** installs the `onLeadStatusEdit` trigger for the leads Sheet, once.
- **Log:** writes a summary with counts only (no phone numbers or lead details), labelled `LEAD STATUS SETUP`.

The first run asks for one extra permission ("manage triggers"). Click Allow.

## Lead scoring (Week 6, Step 2)

Two more columns on `Qualified Leads` and `Handoffs`, after `Next Follow-up`: `Score` (0–100) and `Priority`. They are calculated when a lead or handoff is written, using only existing lead columns. Every rule is in one function, `scoreLead_`, and the bands are in `priorityFor_`.

| Rule | Points |
|---|---|
| Check-in date already passed | score = 0 (nothing else counts) |
| Qualified lead | +40 |
| Handoff: guest asked for a person (`HUMAN_REQUESTED`) | +25 |
| Handoff: bot could not finish (`NEEDS_FOLLOW_UP`) | +10 |
| Check-in within 7 days (today = day 0) | +20 |
| Check-in in 8–30 days | +10 (the 7-day and 30-day rules never add up) |
| Both check-in and check-out given | +10 |
| Specific property given | +10 |
| 3 or more nights | +10 |
| Ref from a property page (`W-PROP-…`) or the availability widget (`…-AVAILABILITY`) | +5 |

- **Priority bands:** 70–100 **Hot**, 40–69 **Warm**, below 40 **Cold**.
- **Highest possible score:** 95.
- **"Today"** is the date in India. A date that is missing or invalid counts as "not given".

**Recalculating.** The 7-day, 30-day and "already passed" rules depend on the date, so a score drifts over time. Run `recalculateLeadScores` from the editor to re-score every open lead using today's date.

- **Open** means Status `New`, `Contacted` or empty.
- `Booked`, `Lost` and other statuses keep their last score.
- The function adds the `Score` and `Priority` columns if they're missing.
- It logs counts only, labelled `LEAD SCORE RECALC`.
- It doesn't run automatically yet; there is no daily trigger.

After deploying 6.2, run `setupLeadStatusTracking` (if 6.1 setup hasn't been run), then `recalculateLeadScores` once, so existing leads get a score.

## Follow-up reminders (Week 6, Step 3)

`sendFollowUpDigest` runs once a day. It emails **one** digest to `TEAM_EMAILS` listing every lead whose follow-up is due.

**A lead is due when all of these are true:**
- `Next Follow-up` is today or earlier (date in India);
- `Status` is not `Booked` or `Lost`;
- the row has a valid Lead ID (`L-` + 10 hex) on `Qualified Leads`, or a valid Handoff ID (`H-` + 10 hex) on `Handoffs`.

**Order:** Hot, then Warm, then Cold, then rows without a Priority. Within a priority, overdue leads come first, then higher Score, then the oldest follow-up date.

**OVERDUE** is shown when the follow-up date is before today, or when a lead is still `New` more than 24 hours after `Received (IST)`.

**Each entry shows:**
- the type and ID, Status, Priority and Score;
- the handoff Reason, and the guest's WhatsApp number;
- property, destination, check-in, check-out, nights and guests;
- the Next Follow-up and Received times;
- a direct link to the row (`…/edit#gid=<tab>&range=A<row>`).

Fields that are empty are left out. The email ends with a link to the Sheet.

**Safety:**
- It is a reminder only. It never changes `Status` or any other cell; `Next Follow-up` stays the scheduling tool. It never sends WhatsApp messages and never uses Twilio.
- No email is sent when nothing is due.
- It uses the same recipient and daily-quota check as every other email from this script (`teamMailCheck_`). If `TEAM_EMAILS` is empty or the quota is too low, nothing is sent and the reason is logged.
- At most one digest per day. After a digest is sent, its date is saved in `LAST_FOLLOW_UP_DIGEST`, and later runs that day send nothing. To send again the same day (for example while testing), delete that Script Property.
- The log line `FOLLOW-UP DIGEST` holds counts only.

**Daily trigger:** run `setupFollowUpReminders` once.
- It installs the daily trigger at about 09:30, in the project's time zone (Project Settings → Time zone). Apps Script runs it within about 15 minutes of 09:30.
- India time is used only if the project has no time zone set.
- If the project time zone isn't `Asia/Kolkata`, the log says so.
- Running it again never adds a second trigger, and it removes any extra copies.

## Conversion report (Week 6, Stretch 1)

Run `generateConversionReport` from the editor whenever you want fresh numbers. There is no trigger. It rebuilds a separate **`Conversion Report`** tab from the current data.

- **Read-only on the data tabs.** It reads `Qualified Leads`, `Handoffs` and `WhatsApp Clicks`, and writes only the report tab. It never changes a lead row, sends email or contacts a guest.
- **Safe to run again.** Each run clears the report tab and rebuilds it.
- **Won't overwrite another tab.** If a non-empty `Conversion Report` tab exists that this script didn't create (cell A1 isn't `Conversion Report`), it stops with an error.

**Definitions:**
- **One lead** = one valid Lead ID (`L-…`) or Handoff ID (`H-…`). A repeated ID is counted once, and rows without a valid ID are skipped. Both counts appear as notes in the report.
- **Status:** empty counts as `New`; any value other than the four statuses goes under `Other status`.
- **Open** = New + Contacted.
- **Booking conversion** = Booked / Total.
- **Contact rate** = Contacted / Total. This uses the current status, so a lead that has moved on to Booked no longer counts as Contacted.
- **Reached rate** = (Contacted + Booked) / Total.
- **Rates** have one decimal. `N/A` means there was nothing to divide by.

**Section "By Source":**

Source | Total leads | Qualified | Handoffs | Unique guests | New | Contacted | Booked | Lost | Other status | Open leads | Booking conversion % | Contact rate % | Reached rate %

Plus a Total row. `Source` is the channel: `whatsapp-bot` (Production) or `whatsapp-bot-sandbox` (tests).

**Section "By Ref (website entry point)":**

Ref | Entry point | the same 13 columns | WhatsApp clicks | Click → Lead % (approx.)

Plus a Total row.

- **Entry point** is worked out from the Ref: Floating button, Contact page, Property page, Availability widget, Direct (no website Ref), or Other website link.
- **Clicks** are counted by exact Ref from `WhatsApp Clicks`.
- **Click → Lead % is approximate.** Clicks aren't matched to individual leads, not every click becomes a message, and clicks count even when the bot is off. It is `N/A` when a Ref has no clicks.
- **The Total row's Click → Lead %** uses only leads that came from a website Ref (`W-…`).

## Automatic WhatsApp follow-ups (Week 6, Stretch 2)

**Off by default. Live sending is disabled by default and needs four separate switches.** `sendWhatsAppFollowUps` (daily at about 11:00, or run by hand) picks eligible leads and calls the website's `POST /api/whatsapp/follow-up`. Which mode it runs in depends on `WA_FOLLOW_UP_MODE`:

| `WA_FOLLOW_UP_MODE` | What happens |
|---|---|
| `off` (default, or not set) | Nothing is read and nobody is contacted. |
| `dry_run` | Asks the website "could we send?" for each lead. **No message is sent.** |
| `live` | The website sends **one approved WhatsApp template** per lead. Refused unless all four live switches are on (below). |

**Live needs all four switches.** If any is missing, nothing is sent:
1. Script Property `WA_FOLLOW_UP_MODE` = `live`.
2. Script Property `WA_FOLLOW_UP_LIVE_ENABLED` = `true` (a second key, so a typo in the mode can't send).
3. Vercel `WHATSAPP_FOLLOW_UP_LIVE_ENABLED` = `true`.
4. Vercel `WHATSAPP_BOT_ENABLED` = `true` with a valid bot configuration, so a guest's STOP reply is recorded. Hospitality OS must also be running and forwarding replies to the website bot.

The website also requires `TWILIO_ACCOUNT_SID` and the **approved template's Content SID** in `WHATSAPP_FOLLOW_UP_CONTENT_SID`. There is no default template: without it, live is refused (409).

**An approved WhatsApp template is required.** Follow-ups go out days after the guest's last message, outside WhatsApp's 24-hour window, so WhatsApp only allows a Meta-approved template. Create the template in Twilio (Content Template Builder), get it approved for WhatsApp, and put its Content SID (`HX…`) in Vercel. The message text is whatever the approved template says; this code never sends free-form text.

**How a run works:**
1. Under the script lock, it checks no other follow-up run is in progress (`WA_FOLLOW_UP_RUNNING`), reads `Qualified Leads`, picks the eligible leads, marks each one `In progress: …` and reserves them against the daily cap.
2. Outside the lock, it calls the website once per lead. The website checks the guest's opt-out (the bot's STOP record) and claims the lead in Redis.
   - In dry run, the claim lasts 24 hours.
   - In live, the claim is permanent and is taken *before* Twilio is called, so a lead can never get a second automatic message, not even after a failed send.
3. Under the lock again, it writes the results to the row found again by Lead ID.

**What reaches the guest (live):** only the approved template. If the template has variables, `WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES` maps them to these guest-safe fields only: `destination`, `property`, `checkIn`, `checkOut` (dates are shown as "10 Dec 2026"). Lead ID, score, priority, Source, Ref, requirements, notes and the handoff number are never sent to Twilio. `property` is shown as the property's name from the website's property list (`config/properties.config.ts`); a lead with no property, or a value that isn't a website property, shows **"our stays"** instead, because a template variable can never be empty.

**A lead is processed only when all of these are true:**
- it is on `Qualified Leads` (handoffs are never followed up automatically), with a valid Lead ID (first row with that ID);
- `Status` is `Contacted` (never New, Booked, Lost, empty or anything else);
- `Source` is exactly `whatsapp-bot` (sandbox and diagnostic rows are never used), and it is not the diagnostic Lead ID;
- `Received (IST)` is on or after `WA_FOLLOW_UP_START_DATE`;
- `Next Follow-up` is today or earlier, and `Check-in` is today or later (India dates);
- `Auto Follow-up` is not `No`;
- the phone is valid, not in `WA_FOLLOW_UP_BLOCKED_PHONES` and, if `WA_FOLLOW_UP_ALLOWED_PHONES` is set, in that list;
- it hasn't been processed: `WA Message ID` is empty, and `WA Follow-up Status` is empty or a same-day-only status from an earlier day.

**Per run and per day:**
- At most one lead per phone number per run.
- At most `WA_FOLLOW_UP_DAILY_CAP` endpoint calls per India day (default 10, highest 50).
- Only between 10:00 and 19:00 India time, and never while another follow-up run is in progress.
- Live only: **one automatic follow-up per guest number per 30 days**, even if the guest has several Lead IDs (the website enforces this in Redis).
- A run starts no new endpoint call after 4 minutes, so results are always written before Apps Script's 6-minute limit.
- The cap is shared by dry runs and live sends, and a lead dry-run-checked today is not sent live until tomorrow.
- Order: Hot, Warm, Cold, then higher Score, then the oldest follow-up date.

**Results in `WA Follow-up Status`** (each ends with the time, e.g. `(2026-10-12 11:02 IST)`):

| Status | Meaning | Blocks the lead |
|---|---|---|
| `Dry run: would send` / `already checked in the last 24 hours` / `guest opted out, would not send` / `check failed (…)` | Dry-run answers. No message. | That day only |
| `In progress: dry_run run` / `In progress: live run` | A run picked the lead and is working on it. | That day only |
| `Live: sent` | Sent. `WA Follow-up Sent (IST)` and `WA Message ID` (Twilio Message SID) are filled in. | Permanently |
| `Live: not sent, already claimed earlier` | The website had already claimed this lead. | Permanently |
| `Live: not sent, this guest already got an automatic follow-up recently` | Another lead for the same number was followed up in the last 30 days. | Permanently |
| `Live: not sent, guest opted out` | The guest replied STOP. | Permanently |
| `Live: send failed (<reason>), not retried` | Twilio refused or didn't answer. The claim is kept so it is never resent; check Twilio. | Permanently |
| `Live: will retry, not sent (<reason>)` | Rejected before the website claimed the lead (e.g. bad data, live switched off, network). | That day only |

- **Run-wide problems stop the run.** These include: endpoint off, wrong secret, live not available, Redis down, Twilio authentication or rate-limit errors, and a send without a Message SID. The unused part of the daily cap is given back, and the `In progress` marker is removed from leads that weren't called.
- **Any text the team types** in `WA Follow-up Status` blocks that lead permanently.

**Never changed:** `Status`, `Next Follow-up`, `Score` and every other column. No email is sent. The inbound bot, STOP handling, scoring, status tracking, digest and report work exactly as before. The log line `WA FOLLOW-UP` and the property `WA_FOLLOW_UP_LAST_RUN` hold counts only.

**Setup:**
1. Run `setupWhatsAppFollowUps` once. It adds the 4 columns below to `Qualified Leads` (not `Handoffs`), puts a Yes/No dropdown on `Auto Follow-up`, and installs the daily trigger at about 11:00 in the project's time zone. It is safe to run again and never adds a second trigger. It does **not** switch anything on, and it warns if the project time zone isn't `Asia/Kolkata`.
2. The first run asks for the permission **"Connect to an external service"** (`script.external_request`). Click Allow.
3. Set the Script Properties below, then set `WA_FOLLOW_UP_MODE` to `dry_run`.

**Before going live** (recommended order):
1. Get the template approved and configure the website (see `.env.example`).
2. Make sure Hospitality OS forwards replies, and `WHATSAPP_BOT_ENABLED=true`.
3. Set `WA_FOLLOW_UP_ALLOWED_PHONES` to one team phone and `WA_FOLLOW_UP_DAILY_CAP` to `1`.
4. Turn on the four live switches and run once by hand.
5. Reply STOP from that phone and confirm the next run shows `guest opted out`.
6. Only then remove the allow list.

| New column (Qualified Leads) | Meaning |
|---|---|
| `Auto Follow-up` | Team switch per lead: `No` = never; empty or `Yes` = allowed |
| `WA Follow-up Status` | Last result (table above) |
| `WA Follow-up Sent (IST)` | Time a live follow-up was sent |
| `WA Message ID` | Twilio Message SID of the live follow-up |

To turn it off, set `WA_FOLLOW_UP_MODE` to `off` (or delete it). Setting `WA_FOLLOW_UP_LIVE_ENABLED` to anything other than `true` stops live sending immediately.

## Script Properties

Set in Apps Script → Project Settings → Script Properties. Never commit the real values.

| Property | Value |
|---|---|
| `LEADS_SHEET_ID` | ID of the leads Google Sheet (the part of its URL between `/d/` and `/edit`) |
| `LEAD_SINK_SECRET` | Same value as `LEAD_SINK_SECRET` in Vercel |
| `QUALIFIED_LEAD_SINK_SECRET` | Same value as `QUALIFIED_LEAD_SINK_SECRET` in Vercel (must differ from `LEAD_SINK_SECRET`) |
| `TEAM_EMAILS` | Comma-separated recipients, e.g. `team@example.com, owner@example.com` |
| `EMAIL_HOURLY_CAP` | Optional, default `20` (click emails only) |
| `DIAG_KEY` | Optional, temporary. Enables `/exec?diag=<DIAG_KEY>`. Delete when not debugging. |
| `WA_FOLLOW_UP_MODE` | Optional. `off` (default), `dry_run` or `live`. `live` also needs `WA_FOLLOW_UP_LIVE_ENABLED`. |
| `WA_FOLLOW_UP_LIVE_ENABLED` | Optional, default off. Must be exactly `true` for live sending (second key). Leave unset until the live test. |
| `WA_FOLLOW_UP_ENDPOINT` | `https://<site>/api/whatsapp/follow-up` (no query string) |
| `WA_FOLLOW_UP_SECRET` | Same value as `WHATSAPP_FOLLOW_UP_SECRET` in Vercel (at least 32 characters) |
| `WA_FOLLOW_UP_START_DATE` | `yyyy-MM-dd`. Leads received before this date are never followed up. Required. |
| `WA_FOLLOW_UP_DAILY_CAP` | Optional, default `10`, highest `50`: endpoint calls (checks or sends) per India day |
| `WA_FOLLOW_UP_BLOCKED_PHONES` | Optional. Comma-separated `+<country><number>` numbers that are never followed up |
| `WA_FOLLOW_UP_ALLOWED_PHONES` | Optional. If set, ONLY these numbers can be followed up (for testing with team phones) |

`LAST_BOT_LEAD_RESULT` and `LAST_DIAG_REPORT` are written by the script itself (diagnostics, no personal data). `LAST_FOLLOW_UP_DIGEST` holds the date of the last digest sent. `WA_FOLLOW_UP_COUNT` (today's endpoint calls), `WA_FOLLOW_UP_LAST_RUN` (counts-only summary) and `WA_FOLLOW_UP_RUNNING` (present only while a run is in progress; expires after 10 minutes) are written by the follow-up run.

## Deploying a change

1. Paste `Code.gs` into the Apps Script editor and save.
2. If permissions changed, run `diagnoseBotLead` once from the editor and click Allow.
3. Deploy → Manage deployments → edit the existing deployment → Version: **New version** → Deploy. This keeps the same `/exec` URL. Settings: Execute as **Me**, Who has access **Anyone**.
4. For 6.1+: run `setupLeadStatusTracking` once, then `recalculateLeadScores` once. For 6.3: run `setupFollowUpReminders` once (see above). For 6.5/6.6: nothing is required; follow-ups stay off (and live stays off) until you follow the setup in the Stretch 2 section.

## Diagnostics

Run `diagnoseBotLead` from the editor. It logs a one-line JSON report (`version`, `props`, `sheet`, `lastResult`, `dryRun`) and saves it to `LAST_DIAG_REPORT`. The dry run writes and deletes one test row and sends no email. From 6.1, the dry run also adds any missing lead-tab header (for example the two Week 6 columns). The report never contains secrets, phone numbers, emails or guest text.

## Tests

`tests/apps-script/lead-status.test.mjs` (Step 1), `lead-score.test.mjs` (Step 2), `follow-up.test.mjs` (Step 3), `conversion-report.test.mjs` (Stretch 1), `whatsapp-follow-up.test.mjs` and `whatsapp-follow-up-live.test.mjs` (Stretch 2; the endpoint is faked, no network) run this `Code.gs` in Node, with fake Google services from `tests/helpers/apps-script-env.mjs`. They run with the rest of the suite:

```
node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
```
