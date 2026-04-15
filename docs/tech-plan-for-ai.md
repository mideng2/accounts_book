# Personal Finance PWA Tech Stack And Development Plan For AI

## 1. Technical Goal

Build a mobile-first personal finance PWA using frontend-friendly technology.

Key constraints:

1. No iOS developer account required
2. Installable to iPhone Home Screen
3. Local-only data
4. No backend
5. Supports Alipay CSV import and China Merchants Bank PDF import

## 2. Recommended Tech Stack

### Core app stack

1. `Vue 3`
2. `Vite`
3. `TypeScript`
4. `Pinia`
5. `Vue Router`
6. `LESS`

### PWA

1. `vite-plugin-pwa`

Goals:

1. Generate `manifest.webmanifest`
2. Register service worker
3. Support install-to-home-screen flow
4. Cache static shell assets for offline access

### Local persistence

1. `IndexedDB`
2. `Dexie`

Rationale:

- More suitable than localStorage for structured records and import history.
- Easy to version and evolve.

### Parsing and data utilities

1. `papaparse` for Alipay CSV
2. `pdfjs-dist` for China Merchants Bank PDF text extraction
3. `dayjs` for date handling
4. Optional `zod` for schema validation

### Visualization

1. `echarts`

Use for:

1. Spending trend
2. Category distribution
3. Asset trend
4. Yearly summary charts

### Utility

1. `@vueuse/core`

## 3. Stack Decision Notes

1. Keep the stack simple and frontend-native.
2. Do not introduce server frameworks.
3. Do not introduce Electron / native wrappers for V1.
4. Do not build a generic file-import framework; keep parsers source-specific.
5. Keep UI components lightweight and project-owned instead of depending on a heavy mobile UI kit unless clearly necessary.

## 4. Project Structure

Recommended structure:

```txt
src/
  app/
    router/
    store/
    providers/
  pages/
    ledger/
    stats/
    add/
    assets/
    imports/
    settings/
  components/
    base/
    business/
  modules/
    transactions/
    accounts/
    assets/
    categories/
    imports/
    reports/
    backup/
  db/
    schema.ts
    tables/
    repositories/
  services/
    importers/
      alipay/
      cmb/
    statistics/
    backup/
  types/
  utils/
  styles/
```

Design guidance:

1. Put source-specific import logic under `services/importers/alipay` and `services/importers/cmb`.
2. Keep page components thin.
3. Put transaction aggregation and chart preparation into service or module layers.

## 5. State Strategy

### Use Pinia for

1. Current UI state
2. Current month / filters
3. Selected account / selected category
4. Import wizard step state

### Use IndexedDB for

1. Transactions
2. Accounts
3. Categories
4. Asset snapshots
5. Import tasks
6. Import items
7. App settings if needed

Rule:

- Pinia is for in-memory state.
- IndexedDB is for durable business data.

## 6. Data Model Proposal

### 6.1 transactions

Suggested fields:

1. `id`
2. `type` - `expense | income`
3. `amount` - store as integer cents
4. `accountId`
5. `categoryId`
6. `occurredAt`
7. `merchant`
8. `note`
9. `source` - `manual | alipay_import | cmb_import`
10. `sourceId`
11. `createdAt`
12. `updatedAt`

### 6.2 accounts

Suggested fields:

1. `id`
2. `name`
3. `kind` - `asset | liability`
4. `platform` - `cash | alipay | cmb | credit_card | manual`
5. `balance`
6. `isManuallyMaintained`
7. `sort`
8. `createdAt`
9. `updatedAt`

### 6.3 categories

Suggested fields:

1. `id`
2. `name`
3. `type` - `expense | income`
4. `icon`
5. `color`
6. `sort`
7. `enabled`

### 6.4 assetSnapshots

Suggested fields:

1. `id`
2. `snapshotDate`
3. `totalAsset`
4. `totalLiability`
5. `netAsset`
6. `note`
7. `createdAt`

### 6.5 importTasks

Suggested fields:

1. `id`
2. `channel` - `alipay | cmb`
3. `fileName`
4. `fileHash`
5. `status` - `draft | parsed | confirmed | failed`
6. `totalCount`
7. `importedCount`
8. `skippedCount`
9. `createdAt`

### 6.6 importItems

Suggested fields:

1. `id`
2. `taskId`
3. `channel`
4. `rawText`
5. `occurredAt`
6. `amount`
7. `direction`
8. `merchant`
9. `description`
10. `sourceOrderId`
11. `dedupeKey`
12. `status` - `pending | ready | skipped | imported`
13. `skipReason`

## 7. Domain Rules To Implement

### Transaction rules

1. Record real spending and relevant real income.
2. Do not record credit card repayment as a transaction.
3. Do not record own-account transfers as consumption.
4. Skip recharge / withdrawal / internal balance flow by default.

### Asset rules

1. Asset balances are mainly edited manually.
2. Net asset trend can be based on stored snapshots.
3. The app should not require strict transaction-derived balance reconciliation.

### Import rules

1. All imported items must go through normalization.
2. All imported items should be previewable before final insert.
3. Deduplication must happen before confirmation.

## 8. Import Architecture

Recommended import pipeline:

1. `select file`
2. `detect source`
3. `parse raw data`
4. `normalize to import items`
5. `filter non-consumption rows`
6. `generate dedupe keys`
7. `preview`
8. `confirm import`
9. `write transactions`

### 8.1 Alipay importer

Folder:

```txt
src/services/importers/alipay/
  parseCsv.ts
  normalize.ts
  filters.ts
  mapToTransaction.ts
```

Responsibilities:

1. Decode CSV text
2. Find the real header row
3. Parse rows with Papa Parse
4. Normalize Chinese columns to internal fields
5. Skip `不计收支`
6. Skip non-consumption flows by keyword rules
7. Map remaining rows to import candidates

### 8.2 China Merchants Bank importer

Folder:

```txt
src/services/importers/cmb/
  extractPdfText.ts
  parseStatement.ts
  filters.ts
  mapToTransaction.ts
```

Responsibilities:

1. Extract text from PDF via `pdfjs-dist`
2. Convert page text into structured candidate rows
3. Parse known statement pattern only
4. Filter repayment / transfer / non-consumption entries
5. Map remaining rows to import candidates

Important implementation note:

- Do not attempt a generic PDF parser for all banks.
- Tune the parser against the user's known CMB sample template.

## 9. Backup And Restore

Must be included in V1.

### Export

1. Export all business data as a single JSON file
2. Include app version and export timestamp

### Restore

1. Import a JSON backup file
2. Validate schema version
3. Restore all tables safely

Optional:

1. Export transaction list as CSV for external review

## 10. PWA Requirements

### Required

1. Manifest with app name, icons, theme colors
2. Standalone display mode
3. Service worker registration
4. Offline shell availability

### UX notes

1. Show install guidance if opened in Safari and not yet installed
2. Handle app updates gracefully
3. Avoid relying on network for core usage

## 11. UI / UX Implementation Notes

### Main tabs

1. Ledger
2. Statistics
3. Add
4. Assets
5. Settings

### UX goals

1. Mobile-first
2. Thumb-friendly navigation
3. Simple and fast add flow
4. Clear charts
5. Calm asset overview

### Design direction

1. Reference the structure of familiar bookkeeping apps
2. Keep visuals original
3. Avoid generic template-looking mobile UI
4. Optimize for readability and quick scanning

## 12. Recommended Development Order

### Phase 1: App foundation

Tasks:

1. Initialize Vite + Vue + TypeScript + LESS
2. Configure router and Pinia
3. Configure PWA plugin
4. Set up Dexie schema
5. Build app shell and bottom tab layout

Deliverable:

- Installable PWA shell running locally

### Phase 2: Core manual bookkeeping

Tasks:

1. Category seed data
2. Account management
3. Add/edit/delete transaction
4. Ledger page with monthly summary

Deliverable:

- User can manually use the app without imports

### Phase 3: Asset management

Tasks:

1. Asset and liability account screens
2. Manual balance editing
3. Net asset summary card
4. Asset snapshot creation
5. Asset trend chart

Deliverable:

- User can track total assets and trend

### Phase 4: Statistics

Tasks:

1. Monthly trend
2. Category ranking
3. Category share
4. Yearly summary

Deliverable:

- User can see where money went

### Phase 5: Alipay CSV import

Tasks:

1. File picker
2. CSV decoding and parsing
3. Row normalization
4. Filtering non-consumption rows
5. Deduplication
6. Import preview
7. Confirm import

Deliverable:

- Stable high-value automated import flow

### Phase 6: CMB PDF import

Tasks:

1. PDF text extraction
2. Statement row parsing
3. Known-template filtering logic
4. Deduplication
5. Import preview and confirmation

Deliverable:

- CMB PDF import working for the user's known statement template

### Phase 7: Backup / restore and polish

Tasks:

1. JSON backup export
2. JSON restore
3. Better empty states
4. Better error messages
5. iPhone PWA usability polish

Deliverable:

- Safer day-to-day usage

## 13. Testing Priorities

### Unit test priorities

1. Alipay row normalization
2. Alipay filter rules
3. CMB parser output
4. Deduplication logic
5. Asset aggregation

### Manual test priorities

1. iPhone Safari PWA install
2. Offline reload
3. File import flow on mobile
4. Backup and restore
5. Ledger and statistics rendering on small screens

## 14. AI Implementation Guidance

When AI works on this project:

1. Prefer incremental, shippable slices.
2. Complete one module end-to-end before adding speculative abstractions.
3. Keep importers isolated and testable.
4. Avoid premature plugin systems or enterprise architecture.
5. Use typed domain models.
6. Keep money values as integer cents.
7. Keep all core flows usable on mobile Safari.

## 15. Suggested First Execution Tasks

If another AI starts implementing from scratch, begin with:

1. Scaffold the Vite + Vue + TypeScript + LESS + Pinia + Router project
2. Add and configure `vite-plugin-pwa`
3. Set up Dexie schema and repositories
4. Build a bottom-tab mobile layout
5. Implement the ledger page and add-transaction flow
6. Seed categories and accounts
7. Implement asset page and asset snapshot storage

Only after that, move into import functionality.
