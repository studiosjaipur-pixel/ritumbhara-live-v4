# Asset owner onboarding + e-signed agreement

The Apps Script web app behind `public/partner-onboarding.html`. It replaces the code in the existing onboarding Apps Script project (the one whose `/exec` URL is `SUBMIT_URL` in the page). Same Sheet, same Applications folder.

## Flow

1. The owner fills in steps 1–4 and picks **FOCO** at step 5.
2. The page asks this web app for a preview. The owner reads the full agreement with their details filled in.
3. They type their name, draw a signature, tick the box and submit.
4. The script saves the row and documents as before. It also copies the agreement template into the application folder, fills it in, places the owner's signature, and saves `… (owner signed).pdf`.
5. The team gets a **Countersign needed** email with a button. The owner gets a short "we've received it" email.
6. The team opens the link, reviews the PDF, signs and clicks **Countersign and send to owner**.
7. The script places the company signature, saves `… (executed).pdf`, emails it to the owner (and the team) and marks the row **Executed**.

### Aadhaar eSign (Digio)

When `DIGIO_CLIENT_ID` and `DIGIO_CLIENT_SECRET` are set in Script Properties, steps 3–7 change:

- The owner doesn't draw a signature. They accept the agreement and, after submitting, go straight to Digio to sign with Aadhaar OTP. Digio also emails them the link.
- Digio then emails `DIGIO_COMPANY_SIGNER` (default shivam@ritumbhara.com) to sign for Ritumbhara with Aadhaar.
- When both have signed, the Aadhaar-signed PDF is saved in the application folder, emailed to the owner and the team, and the row is marked **Executed**. The owner's name as per Aadhaar is recorded in "Owner Aadhaar Name".

Without the Digio keys, the drawn-signature flow above is used, so the page keeps working either way.

Turning it on:

1. Get a Digio account with Aadhaar eSign enabled. Ask Digio for sandbox keys first.
2. Script Properties: `DIGIO_CLIENT_ID`, `DIGIO_CLIENT_SECRET`, and `DIGIO_ENV` = `sandbox` (switch to `production` with the production keys when you go live).
3. Run `testDigioKeys` to check the keys, then `setupDigioSync` once (it re-checks pending signatures every 30 minutes).
4. In the Digio dashboard (Profile → Webhooks), add this web app's `/exec` URL with the `DOC.SIGNED` event. Optional, but it makes the executed copy go out within seconds instead of up to 30 minutes.

FOFO has no agreement template yet, so FOFO applications are saved and emailed to the team as before, with no signing.

New Sheet columns are added at the end automatically: Partnership Model, Agreement Status, Agreement Doc, Owner-signed PDF, Owner Signed (IST), Owner Typed Name, Countersigned (IST), Countersigned By, Executed PDF, Agreement Token.

## Setup (once)

1. Open the existing onboarding Apps Script project (the one deployed at the page's `SUBMIT_URL`). Keep a copy of the old code.
2. Replace `Code.gs` with this `Code.gs` and `appsscript.json` with this one (it adds the Docs, triggers and email-address permissions). Add an HTML file called `Countersign` and paste in `Countersign.html`.
3. Optional, under Project Settings → Script Properties: set `TEAM_EMAILS` (comma-separated). Default: shivam@ritumbhara.com.
4. In the editor, run `setupAgreementTemplate` and allow the permissions it asks for. It copies the Amar Bagh SLA, swaps his details for `{{PLACEHOLDERS}}`, and logs the new template's link.
5. Open that template and check it. The log lists anything it couldn't swap. Fix those by hand. Leave the `{{PLACEHOLDERS}}` as they are.
6. Optional: run `testOwnerSignedAgreement`. It submits a test application to your own email, so you get the Countersign email and can try the whole flow.
7. Deploy → Manage deployments → edit the existing deployment → Version: **New version** → Deploy. Keep "Execute as: Me" and "Who has access: Anyone". The URL stays the same, so the page doesn't need a new `SUBMIT_URL`.
8. Then publish the updated `public/partner-onboarding.html`.

Do step 7 before step 8. The new script still accepts the old page, but the new page needs the new script.

## Changing the terms

Fixed terms (30% share, ₹2,500 marketing cap, 36-month lock-in, clauses) live in the template doc. Edit them there. The change shows up in the website preview and in new agreements straight away. Keep the `{{PLACEHOLDERS}}`.

Effective date = the day the owner signs. Term = 5 years from then (`TERM_YEARS` in `Code.gs`).

## Notes

- Anyone with a countersign link can sign for Ritumbhara. Don't forward those emails.
- Each agreement records the owner's typed name, email, time (IST) and device in an "Electronic execution record" at the end of the doc.
- Aadhaar eSign is recognised under the IT Act, 2000. Stamp duty is a separate question: ask your lawyer whether these agreements need e-stamping in Rajasthan (Digio offers e-stamping too).
