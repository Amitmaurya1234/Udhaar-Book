# Udhaar Book

Udhaar Book is a simple Hindi-first digital bahi-khata for shopkeepers. The interface is inspired by the ease of familiar ledger apps: one clear home balance, a searchable party list, large `उधार दिया` / `पैसे मिले` actions, and quick reminders. It is an original design and does not copy KhataBook branding or assets.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` in a browser. The app is a dependency-free static PWA and stores its Phase 1 data in local browser storage. Use Settings → Backup & Restore regularly.

## Deploy on Vercel

Import this GitHub repository into Vercel. Keep the project as a static site with no build command and no output directory. Vercel will serve `index.html` directly. The required public files are `index.html`, `styles.css`, `app.js`, `manifest.json`, and `sw.js`.

## Included

The current MVP includes onboarding, Hindi/English switching, party search/filter/sort, receivable/payable totals, add/edit party, opening balance, credit limit, calculator-style gave/got entries with paise-safe arithmetic, due dates, running balances, reminders, WhatsApp/SMS/call actions, promise dates, follow-up history, today/overdue collection filters, reminder templates, UPI/payment note settings, local JSON backup/restore, and clear-all-data.

The UI deliberately keeps advanced features behind the party detail and Settings areas so the daily flow stays easy: open the app, find a party, record money, or remind the customer.

## Data and SMS note

Every party and transaction keeps `createdAt` and `updatedAt` timestamps. Party detail shows total given, total received, outstanding balance, exact date/time, relative time, and the running balance after every entry. The Give/Get flow starts with the calculator; note, due date, and bill/photo fields appear after confirming the amount. Calculator clear, backspace, memory plus/minus/recall, and expression editing are supported.

This static PWA can open the device SMS composer for a reminder, but it cannot silently read or analyse incoming SMS. Automatic SMS/passbook analysis requires a separate Android native app with explicit SMS permissions and must comply with Google Play's restricted SMS-permission policy. It should be implemented only after confirming the app's eligibility and user consent.
