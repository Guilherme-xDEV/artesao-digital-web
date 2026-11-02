# Artesão Digital — versão web

Versão web do sistema de controle de estoque e vendas do Centro de Artesanato de Tauá.

**Stack:** Vite + React + TypeScript, Tailwind CSS v4, Firebase (Auth, Firestore, Hosting),
React Router, React Hook Form + Zod, html5-qrcode, qrcode.react, Recharts.

## Running locally

```bash
npm install
cp .env.example .env   # fill in the Firebase web app configuration
npm run dev
```

In the Firebase console, enable **Authentication** (Email/Password and Google) and create
the **Cloud Firestore** database.

Deploy the Firestore rules with:

```bash
firebase deploy --only firestore:rules
```

## Development phases

- [x] 1. Foundation (Tauá theme, routes, layout, Firebase)
- [x] 2. Authentication (email/password, registration, Google sign-in)
- [x] 3. Products and QR codes (catalog, create/update/deactivate, UUID QR, download and print)
- [x] 4. Sales (camera scanner, manual lookup, atomic sale and stock update)
- [x] 5. Dashboard and history (sales metrics, 7/30-day charts, recent sales, best sellers)
- [x] 6. Firestore Security Rules tests and final adjustments
- [ ] 7. Firebase Hosting and production Firestore deployment

## Firestore data model

- `artesaos/{uid}`: artisan profile; document ID matches Firebase Authentication UID.
- `produtos/{qrCodeId}`: product data; document ID and `qrCodeId` use the same UUID.
- `vendas/{id}`: immutable sale snapshot with seller, artisan, product, unit price,
  quantity, total and server timestamp.

Prices and totals are stored as integer cents to avoid floating-point currency errors.
Product removal is logical (`ativo: false`) so sales history is preserved.

## Important verification

The Firebase Emulator Suite tests run in GitHub Actions and cover artisan profile privacy,
product ownership, QR Code/document identity, stock protection, atomic sale registration,
and append-only sales. The lint and production build checks also run in CI.

Production Hosting deployment and Firestore rules publication have not been performed.
They must be completed against the intended Firebase project after confirming its target
configuration and deployment credentials.
