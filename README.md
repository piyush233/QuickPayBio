# QuickPayBio

A mobile-first progressive web app for local service providers in India. Create a shareable service page, list prices, receive direct UPI payments, and let customers contact you on WhatsApp.

## Features

- Fast profile creation with a custom page slug
- Public service and price list with direct UPI intent links
- WhatsApp booking link
- Private edit link created with a random token; the token is stored as a hash in SQLite
- Installable PWA with an offline app shell and cached public profiles
- SQLite persistence in this project folder

## Requirements

- Node.js 20 or newer
- npm
- A UPI ID and WhatsApp number to publish a real profile

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open <http://localhost:3002>. The first run creates `data/quickpaybio.sqlite` and its tables automatically. To use another port, set `PORT` before starting the server, for example:

```sh
PORT=3005 npm start
```

The local app uses HTTP. PWA installation is available in production over HTTPS (or on `localhost`).

## Create and use a page

1. Enter your business or display name and choose a service category.
2. Add the WhatsApp number customers should contact. Use 10 digits for an Indian number; the app adds country code `91` to the WhatsApp link.
3. Enter your UPI ID, such as `name@bank`. Find this in the UPI app connected to the bank account where you want to receive payments. Never enter or share a UPI PIN or OTP.
4. Choose a page address and optionally add an introduction and up to eight services with whole-rupee prices.
5. Select **CREATE MY PAGE NOW**. Your public page opens at `http://localhost:3002/<your-slug>`.
6. Keep the private edit link shown after creation. Its `#edit=...` fragment grants edit access. Do not share that private link; share the plain public URL instead.
7. On the public page, **Pay with UPI** opens a UPI app. The service-specific **Pay ₹…** links open UPI with the selected service and amount prefilled. Payment moves directly between the customer and the provider's UPI app; QuickPayBio does not process or hold money.
8. **Book on WhatsApp** opens a chat with a prefilled message.

If you lose the private edit link, the current MVP has no account recovery flow. Back up the full private link somewhere secure.

## Checks

```sh
npm run check
```

`/health` returns a small JSON health response. The profile API is under `/api/profiles`:

- `POST /api/profiles` creates a profile and returns its slug and one-time edit token.
- `GET /api/profiles/:slug` returns public profile data.
- `PUT /api/profiles/:slug` updates a profile when sent `Authorization: Bearer <edit-token>`.

## Screenshots

Screenshots are stored in [`screenshots/`](screenshots/):

- [Create a page](screenshots/create-page.png)
- [Public service and payment page](screenshots/public-profile.png)

## Project layout

```text
quickpaybio/
├── data/                 # Local SQLite database (ignored by Git)
├── public/               # PWA frontend, manifest, icon, service worker
├── screenshots/          # App screenshots for this README
├── src/
│   ├── routes/profiles.js
│   ├── services/db.js
│   └── index.js
├── package.json
└── README.md
```

## Deployment note

This MVP stores data in a local SQLite file and is suitable for local development or a single persistent host. Do not deploy it to an ephemeral serverless filesystem: profiles would be lost between instances or deployments. Use a persistent disk or move the database layer to managed Postgres before scaling across multiple instances. Serve production traffic over HTTPS.
