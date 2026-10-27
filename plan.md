# Udhaar Book MVP plan

## Product direction

This is a mobile-first offline collection register for kirana shopkeepers. The screen should feel like a calm paper register upgraded for fast daily action: deep teal navigation, red receivables, green received money, large type, large touch targets, and short Hindi-first labels with English support.

## Core decisions

- Use a plain browser PWA in this environment so the user can run it immediately on Android and install it to the home screen.
- Keep the first version dependency-free and offline-capable.
- Persist sync-ready entity fields (`id`, timestamps, version, soft-delete marker, device ID, sync status) even though the MVP has no server.
- Store money as integer paise in the state model.
- Prefer empty states over demo/fake data.

## Project structure

- `index.html`: app shell and metadata.
- `styles.css`: responsive mobile-first design system.
- `app.js`: state, domain logic, rendering, forms and actions.
- `manifest.json` / `sw.js`: installability and offline cache.
- `README.md`: local run and data-safety instructions.

## Delivery outcomes

1. User can onboard, choose Hindi/English, add a party and see it in the list.
2. User can record gave/got entries with calculator expressions and see a correct balance.
3. User can open detail, set promises, log reminders and use WhatsApp/call actions.
4. User can filter collection work by today, overdue and next seven days.
5. User can edit settings and export/import a JSON backup.
6. Empty, loading-free, invalid-input and confirmation states are present for the implemented flows.
