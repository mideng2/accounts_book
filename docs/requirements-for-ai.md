# Personal Finance PWA Requirements For AI

## 1. Project Summary

Build a mobile-first personal finance PWA for a single user.

Primary goals:

1. Help the user understand where money was spent.
2. Help the user track total assets and net asset trend over time.
3. Reduce manual bookkeeping by importing supported statement files.

This is **not** a strict accounting system. It is a **personal spending tracker + asset trend tracker**.

## 2. Product Positioning

- Product type: offline-capable personal finance PWA
- Target platform: iPhone Safari installed to Home Screen as a PWA
- Storage model: local-only, no server
- User model: single user, single device
- Design reference: can reference the information architecture of apps like Shark Bookkeeping, but do not copy their UI directly

## 3. Confirmed Scope

### In scope for V1

1. Manual bookkeeping
2. Transaction list and filtering
3. Monthly and yearly spending statistics
4. Asset management with manual balance editing
5. Asset trend tracking
6. Local persistence
7. Local backup and restore
8. Importing supported statement files

### Out of scope for V1

1. Multi-user
2. Multi-device sync
3. Server or cloud backend
4. Budget system
5. WeChat statement import
6. OCR receipt recognition
7. Automatic bank data fetching
8. Full accounting / double-entry bookkeeping

## 4. Core Business Definition

The app uses a **consumption-oriented bookkeeping model**.

Meaning:

1. Record real spending.
2. Record real income when relevant.
3. Do not try to represent all money movement as accounting flows.

### Important bookkeeping rules

1. Credit card repayment should **not** be recorded as a transaction.
2. Transfers between own accounts should **not** be recorded as spending.
3. Recharge, withdrawal, balance transfer, Yu'e Bao interest, and similar non-consumption flows should usually be skipped.
4. If the user spends `30 CNY` on a platform using a credit card, record the actual `30 CNY` consumption.
5. End-of-month credit card repayment should not create another expense transaction.
6. Asset balances are maintained manually and should not fully depend on transaction-derived calculations.

## 5. Supported Import Sources

Only support the user's current real-world sources and formats.

### Supported in V1

1. Alipay statement CSV
2. China Merchants Bank statement PDF

### Not required in V1

1. Generic CSV import from arbitrary banks
2. Generic PDF import engine
3. Universal bank statement parsing

Implementation guidance:

- Build **source-specific parsers**, not a universal parser platform.
- Hard-code or configure rules specifically for:
  - Alipay CSV sample format already provided
  - China Merchants Bank fixed PDF export template already provided

## 6. Import Goals

The import system is a major feature. It should allow the user to avoid entering every transaction manually.

### Import flow

1. Select file
2. Detect source and file type
3. Parse rows/items into normalized transaction candidates
4. Show import preview
5. Filter out non-consumption items
6. Allow manual correction before final import
7. Deduplicate against existing transactions
8. Confirm import

### Import output

Imported items should become app transactions after user confirmation.

## 7. Import Rules

### 7.1 Alipay CSV rules

Use the actual CSV format provided by the user.

Expected useful columns include:

1. `交易时间`
2. `交易分类`
3. `交易对方`
4. `商品说明`
5. `收/支`
6. `金额`
7. `交易订单号`
8. `商家订单号`

Rules:

1. Keep real `支出` records as expense candidates.
2. Keep relevant `收入` records as income candidates if needed.
3. Skip `不计收支` by default.
4. Skip non-consumption flows such as recharge, withdrawal, account transfer, Yu'e Bao interest, internal balance movement, and similar entries.
5. Use transaction type, description, and keywords together to judge whether an item is a real consumption transaction.

### 7.2 China Merchants Bank PDF rules

Use the real PDF format provided by the user.

Rules:

1. Only support this fixed exported electronic statement template in V1.
2. Extract time, amount, direction, summary / merchant text, and statement unique identifier if available.
3. Skip credit card repayment related rows.
4. Skip transfer / recharge / withdrawal / non-consumption rows when detected.
5. Keep real purchase / payment rows as expense candidates.

Important note:

- Do not design a generic OCR-heavy PDF solution for V1.
- Prefer a deterministic parser for the known China Merchants Bank PDF template.

## 8. Core Features

### 8.1 Manual transaction entry

User can:

1. Add expense
2. Add income
3. Edit transaction
4. Delete transaction
5. Choose category
6. Choose account
7. Input amount
8. Select date/time
9. Add note
10. Add merchant / description

### 8.2 Ledger / transaction list

The ledger page should provide:

1. Monthly income, expense, and balance summary
2. Date-grouped transaction list
3. Basic filtering
4. Quick access to add transaction

### 8.3 Statistics

The statistics area should provide:

1. Monthly spending trend
2. Category ranking
3. Category proportion view
4. Yearly summary

Main goal:

- Help the user see where money was spent.

### 8.4 Asset management

The asset module should provide:

1. Asset accounts
2. Liability accounts
3. Total asset
4. Total liability
5. Net asset
6. Manual balance editing
7. Asset trend chart

Business rule:

- The user wants to manually maintain balances and observe trend changes.
- This module does not need to be strictly derived from transactions.

### 8.5 Import management

The import module should provide:

1. Import entry
2. Import preview
3. Import history
4. Imported item status
5. Deduplication
6. Error messaging for invalid files

### 8.6 Local data management

The app should provide:

1. Local persistence
2. Export backup file
3. Import backup file
4. Version-safe restore

## 9. Pages / Screens

Suggested primary navigation:

1. Ledger
2. Statistics
3. Add Transaction
4. Assets
5. Settings / Me

Additional pages:

1. Import page
2. Import preview page
3. Account management page
4. Category management page
5. Backup / restore page

## 10. UX Principles

1. Mobile-first and optimized for iPhone screen sizes
2. Designed for PWA installation to Home Screen
3. Fast entry for common bookkeeping actions
4. Low cognitive load
5. Import should feel like a guided flow, not a technical tool
6. Asset page should feel calm and clear, with strong summary cards and trend visuals

## 11. Data and Transaction Semantics

### A transaction should usually include

1. Type: expense or income
2. Amount
3. Account
4. Category
5. Time
6. Merchant / counterparty
7. Note
8. Source
9. Source unique ID if imported

### An account should usually include

1. Name
2. Kind: asset or liability
3. Platform type such as cash, Alipay, CMB, credit card, manual
4. Current balance
5. Whether the balance is manually maintained

### Asset trend tracking

Asset trend can be based on periodic snapshots:

1. The user edits balances manually.
2. The app stores net asset snapshots over time.
3. Charts are generated from snapshots.

## 12. Deduplication Rules

Use a layered strategy:

1. Prefer `source + source unique id`
2. Fallback to `time + amount + merchant/description`
3. Prevent duplicate import within the same import task

## 13. Risks and Constraints

1. China Merchants Bank PDF parsing may be brittle if the export template changes.
2. PWA local data is suitable for this project, but backup/restore is still required.
3. The product should prioritize reliability for the two known formats over generality.
4. The project should avoid overengineering for unsupported data sources.

## 14. Non-Functional Requirements

1. Works offline after first load
2. Local-only data storage
3. Smooth on iPhone Safari / Home Screen PWA
4. Good mobile touch targets
5. Clear import error handling
6. Data export and restore available in V1

## 15. Implementation Priorities

Priority order:

1. App shell and local database
2. Manual transaction entry
3. Ledger page
4. Asset management and asset snapshots
5. Statistics
6. Alipay CSV import
7. China Merchants Bank PDF import
8. Backup and restore

## 16. AI Collaboration Notes

When using AI to implement this project:

1. Respect the product scope and do not add server-side architecture.
2. Prefer simple, deterministic logic over abstract framework-heavy solutions.
3. Optimize for maintainability in a solo project.
4. Implement import logic as isolated source-specific modules.
5. Do not turn this into a generic bookkeeping platform.
6. Keep the UI original and mobile-first, while only referencing competing apps at the level of interaction patterns.
