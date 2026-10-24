# Havruta

Private Next.js application using TypeScript and the App Router. This repository contains the application foundation; calendar features can be added next.

## Requirements

Node.js 22 or newer and npm.

## Local development

```bash
git clone https://github.com/MayaBachrach/havruta.git
cd havruta
npm install
npm run dev
```

Open http://localhost:3000.

## Checks and production

```bash
npm run typecheck
npm run build
npm start
```

Commit the generated `package-lock.json` after the first successful install to lock dependency versions.

## Structure

- `src/app/page.tsx`: homepage
- `src/app/layout.tsx`: root layout and metadata
- `src/app/globals.css`: global styles
- `next.config.ts`: Next.js configuration

Keep secrets in `.env.local` (ignored by Git). No external services or secrets are required for this starter.
