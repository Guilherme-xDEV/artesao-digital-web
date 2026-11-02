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

Build and deploy the web application with:

```bash
npm run build
firebase deploy --only hosting
```

## Development phases

- [x] 1. Foundation (Tauá theme, routes, layout, Firebase)
- [x] 2. Authentication (email/password, registration, Google sign-in)
- [x] 3. Products and QR codes (catalog, create/update/deactivate, UUID QR, download and print)
- [x] 4. Sales (camera scanner, manual lookup, atomic sale and stock update)
- [x] 5. Dashboard and history (sales metrics, 7/30-day charts, recent sales, best sellers)
- [x] 6. Artisan profile (edit name and phone, update Firebase Auth profile, sign out)
- [x] 7. Firestore Security Rules tests and final adjustments
- [x] 8. Firebase Hosting and production Firestore deployment

## Shared Firestore data contract

Both the web and Android applications use the same Firebase project and collections.

- `artesaos/{uid}`: artisan profile. The document ID and `uid` match Firebase Authentication.
  The numeric `id` remains as a compatibility key for older Android data.
- `produtos/{documentId}`: `id` is a deterministic numeric compatibility key,
  `firestoreId` is the authoritative document ID, `artesaoId` is the owner's Firebase Auth
  UID, `qrCodeId` stores the QR payload, `precoCentavos` is an integer,
  `quantidadeEstoque` is an integer, and `ativo` is boolean.
- `vendas/{id}`: immutable sale snapshot with `produtoId`, artisan and seller identifiers,
  `precoUnitarioCentavos`, `quantidade`, `totalCentavos`, and server timestamp `dataHora`.

New products use the QR UUID as both the Firestore document ID and the QR payload. Historical
Android products may have a different document ID and QR payload; those identifiers are
preserved during migration so existing labels continue to work.

Prices and totals use integer cents to avoid floating-point currency errors. Product removal is
logical (`ativo: false`) so sales history is preserved.

## Legacy data compatibility and migration

Older Android versions stored numeric `artesaoId` values and decimal `preco` values. The
updated applications can read those documents. When an artisan opens **Meus produtos**, the
application migrates that artisan's legacy product documents in place by converting ownership
to the Auth UID and `preco` to `precoCentavos`. The existing Firestore document ID and
`qrCodeId` are not changed. Legacy sale records remain readable in the sales history.

Deploy the updated rules before releasing the updated Android app or relying on automatic
migration. This repository does not run a global migration and does not rewrite documents
belonging to other artisans.

## Validation

The Firebase Emulator Suite tests run in GitHub Actions and cover artisan profile privacy,
product ownership, canonical creation, legacy product migration, stock protection, atomic sale
registration, legacy sales access, and append-only sales. The lint and production build checks
also run in CI. The Android repository has a Gradle build check for the Firestore integration
changes.
