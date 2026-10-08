# Leads Apps Script (Week 5)

`Code.gs` is the Google Apps Script web app that the website sends leads to. It is deployed separately in Google Apps Script; this copy is for reference and version control only. Nothing here runs on Vercel.

Deployed version: **5.4** (`bot-v5.4-sheetid`).

## What it does

- **WhatsApp clicks** (from `/api/wa-click`): adds a row to the `WhatsApp Clicks` tab and emails the team. The same button on the same page within 15 seconds is logged once (cache check, then a check of the Sheet's last 20 rows, under the script lock).
- **Qualified leads** (from the WhatsApp bot): `Qualified Leads` tab + "New Qualified WhatsApp Lead" email. Idempotent by Lead ID.
- **Handoffs** (from the WhatsApp bot): `Handoffs` tab + "WhatsApp guest needs a team member" email. Idempotent by Handoff ID.

It is a standalone script: it opens the Sheet by ID (`LEADS_SHEET_ID`), never `getActiveSpreadsheet()`.

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

`LAST_BOT_LEAD_RESULT` and `LAST_DIAG_REPORT` are written by the script itself (diagnostics, no personal data).

## Deploying a change

1. Paste `Code.gs` into the Apps Script editor and save.
2. If permissions changed, run `diagnoseBotLead` once from the editor and click Allow.
3. Deploy → Manage deployments → edit the existing deployment → Version: **New version** → Deploy. This keeps the same `/exec` URL. Settings: Execute as **Me**, Who has access **Anyone**.

## Diagnostics

Run `diagnoseBotLead` from the editor. It logs a one-line JSON report (`version`, `props`, `sheet`, `lastResult`, `dryRun`) and saves it to `LAST_DIAG_REPORT`. The dry run writes and deletes one test row and sends no email. The report never contains secrets, phone numbers, emails or guest text.
