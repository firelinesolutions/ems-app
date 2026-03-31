# EMS Cardiac Arrest QA Dashboard

Web app for collecting cardiac arrest run data, reviewing quality trends, and exporting filtered PDF reports.

## Tech stack

- Next.js app router
- React + TypeScript
- Local JSON persistence (`data/ems-db.json`) through API routes
- PDF export with `jspdf` + `jspdf-autotable`

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Password protection

This app includes a simple shared-password gate for non-public deployments.

- **Required env vars**:
  - `EMS_SHARED_PASSWORD`: the shared password users must enter
  - `EMS_AUTH_SECRET`: a long random secret used to mint/verify the auth cookie

For local dev, create a `.env.local` file:

```bash
EMS_SHARED_PASSWORD="your-password-here"
EMS_AUTH_SECRET="generate-a-long-random-string-here"
```

On Vercel, set these as Environment Variables for the project (Production/Preview as needed).

## Project layout

- `src/app/page.tsx`
  - Main UI page (entry form, filters, table, notes modal, PDF export)
- `src/app/api/options/route.ts`
  - Returns stations + supply catalog
- `src/app/api/runs/route.ts`
  - GET runs, POST run creation and validation
- `src/app/api/runs/[id]/route.ts`
  - DELETE run endpoint
- `src/lib/types.ts`
  - Shared domain types and small item metadata helpers
- `src/lib/store.ts`
  - DB read/write and migration logic for catalog/backfill updates
- `data/ems-db.json`
  - Runtime data file (local persistence)

## Extension guide (where to add things)

### 1) Add or remove supply items

1. Update `cardiacSupplyCatalog` in `src/lib/store.ts`.
2. If the item needs a required size, add its id to `SUPPLY_ITEM_IDS_REQUIRING_SIZE` in `src/lib/types.ts`.
3. Add label/placeholder metadata in `supplyItemSizeFieldMeta()` in `src/lib/types.ts`.

### 2) Add new run fields (example: compression fraction)

1. Add field type in `RunRecord` + payload type support in `src/lib/types.ts`.
2. Add API handling and validation in `src/app/api/runs/route.ts` (`POST` and `GET` mapper defaulting for older records).
3. Add UI form state + input control in `src/app/page.tsx`.
4. Include field in table columns, notes modal, and PDF export (same file).

### 3) Add new dashboard filters

1. Add filter state in `src/app/page.tsx`.
2. Include matching logic in `filteredRuns`.
3. Add control in the filter grid.
4. Update the PDF header line so generated reports reflect active filters.

### 4) Add PDF columns / styling

Edit `handleExportPdf()` in `src/app/page.tsx`:

- column headers: `head`
- row data: `body`
- color logic: `didParseCell` + `outcomePdfRowStyles()`

## Coding standards for this project

- Keep API validation strict; UI validation is convenience only.
- Default older records safely in API `GET` mappings to avoid breaking existing JSON data.
- Use helper functions for repeated formatting (`formatUsedItemDisplay`, `formatAgeDisplay`, etc.).
- Prefer small migrations in `readDb()` when renaming fields/items so existing data remains usable.

## Build check

```bash
npm run build
```
