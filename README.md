# Budget Module

A budget tracking module for HomeDoo, designed for personal and family finance management. It supports multiple accounts, categorized transactions with multi-category splits, and atomic inter-account transfers.

## Overview

This module demonstrates how to build a feature-rich addon on top of the HomeDoo core, leveraging:
- The core's database layer with custom transaction support
- The auth module's `@login_required` decorator and persons table
- Modular sub-routing for clean separation of domain entities

It is structured into three sub-modules (accounts, categories, transactions), each with its own repository and router. Splits and transfers are managed internally by the transactions sub-module to preserve consistency.

## Domain Model

### Entities

| Entity | Description |
|---|---|
| Account | A money holder (checking, savings, cash, credit) with an initial balance |
| Category | A label for transactions, with a kind (expense/income) and a color |
| Transaction | A single money movement on an account |
| Split | A breakdown of a transaction across categories and persons |

### Schema Diagram

```
budget_accounts (id, name, type, initial_balance)
        ▲
        │ FK (CASCADE)
        │
budget_transactions (id, amount, description, transaction_date, account_id)
        ▲
        │ FK (CASCADE)
        │
budget_transaction_splits (id, transaction_id, amount, category_id, person_id, description)
        │                                              │              │
        │                              FK (RESTRICT)   │              │ FK (SET NULL)
        ▼                                              ▼              ▼
budget_categories (id, name, kind, color)        auth_persons (cross-module FK)
```

### Cross-module dependency

The splits table references `auth_persons` to track which person is associated with each spending. This dependency is declared in `module.json` (`"dependencies": ["auth"]`) and resolved by the core's schema parser.

## Splitting

A transaction can be broken down across multiple categories and persons. For example, a 100€ grocery transaction can be split into:
- 80€ → "Food" category, parent's split
- 20€ → "Food" category, child's split

The `TransactionRepository.create_with_splits` method enforces:
- At least one split per transaction
- The sum of split amounts equals the transaction amount
- Atomic creation: if any insert fails, the entire operation is rolled back

This is implemented using the core's `database.execute_transaction(callback)` method, which follows the Execute Around Method pattern.

## Inter-account Transfers

A transfer is materialized as **two transactions** — an expense on the source account and an income on the destination account — both using auto-created system categories ("Transfer Out" and "Transfer In").

The `create_transfer` method orchestrates four atomic inserts (2 transactions + 2 splits) within a single database transaction. If any of them fails, the two accounts are guaranteed to remain consistent.

System categories are created automatically at module setup via `category_repository.ensure_transfer_categories()` and hidden from the user-facing category management UI.

## Module Structure

```
budget/
├── module.json                         # Module manifest
├── README.md
├── backend/
│   ├── __init__.py                     # setup() registers routes and ensures system categories
│   ├── router.py                       # Aggregates sub-routers
│   ├── tables_schema.json              # Database schema with cross-module FKs
│   ├── accounts/
│   │   ├── repository.py               # AccountRepository (CRUD)
│   │   └── router.py                   # /budget/accounts routes
│   ├── categories/
│   │   ├── repository.py               # CategoryRepository (CRUD + ensure_transfer_categories)
│   │   └── router.py                   # /budget/categories routes
│   └── transactions/
│       ├── repository.py               # TransactionRepository (splitting + transfers)
│       └── router.py                   # /budget/transactions + /budget/transfers routes
├── frontend/
│   ├── js/
│   │   ├── budget.js                   # Entry point, tabbed navigation
│   │   ├── accounts_view.js            # Account management UI
│   │   ├── categories_view.js          # Category management UI
│   │   └── transactions_view.js        # Transaction list, splits, transfers UI
│   └── styles/
│       └── budget.css
└── tests/
    ├── test_account_repository.py
    ├── test_category_repository.py
    └── test_transaction_repository.py
```

## API Reference

### Accounts

| Method | Path | Description |
|---|---|---|
| GET | `/budget/accounts` | List all accounts |
| GET | `/budget/accounts/<id>` | Get one account |
| POST | `/budget/accounts` | Create an account |
| PUT | `/budget/accounts/<id>` | Update an account |
| DELETE | `/budget/accounts/<id>` | Delete an account (cascades to transactions) |

### Categories

| Method | Path | Description |
|---|---|---|
| GET | `/budget/categories` | List all categories (including system ones) |
| GET | `/budget/categories/<id>` | Get one category |
| POST | `/budget/categories` | Create a category |
| PUT | `/budget/categories/<id>` | Update a category |
| DELETE | `/budget/categories/<id>` | Delete a category (RESTRICT if used by splits) |

### Transactions

| Method | Path | Description |
|---|---|---|
| GET | `/budget/transactions` | List all transactions with their splits |
| GET | `/budget/transactions/<id>` | Get one transaction with its splits |
| POST | `/budget/transactions` | Create a transaction with splits (atomic) |
| PUT | `/budget/transactions/<id>` | Update a transaction and replace its splits (atomic) |
| DELETE | `/budget/transactions/<id>` | Delete a transaction (cascades to splits) |
| POST | `/budget/transfers` | Create an inter-account transfer (atomic, 2 transactions) |

All routes are protected by `@login_required` and require a valid JWT in the `Authorization` header.

## Frontend

The UI is structured as a tabbed interface with three views:

- **Transactions** — main view with a sortable table, filters by account/category, and a unified modal for both transactions and transfers (toggle at the top of the modal)
- **Accounts** — manage money holders with their type and initial balance
- **Categories** — manage labels (system categories are hidden from this view)

Transaction creation supports dynamic split rows with real-time validation: the sum of splits must match the transaction amount before saving.

## Design Decisions

### Why are splits not exposed as a standalone entity?

Splits never exist outside the context of a transaction. Exposing a `SplitRepository` with its own routes would allow the creation of orphaned splits or inconsistent state (e.g., a split whose amount doesn't match its parent). Keeping splits as an internal concern of the transactions sub-module enforces consistency by construction.

### Why update transactions by replacing splits entirely?

When updating a transaction, the existing splits are deleted and recreated with the new payload. This avoids tracking individual split changes (which split was removed, which was added, which was modified) at the cost of a few extra inserts. Given the typical split count per transaction (1-5), the simplification outweighs the performance cost.

### Why model transfers as two transactions instead of a dedicated entity?

A transfer is conceptually two operations on two accounts. Modeling it as two transactions:
- Reuses existing infrastructure (no new table)
- Lets each affected account see the transfer in its own history naturally
- Keeps reporting consistent (total of expenses, total of income)

The atomicity is preserved by wrapping both transaction inserts in a single `execute_transaction` call.

### Why no ORM for the joins?

The `transactions.get_all` method currently performs N+1 queries (one for transactions, one per transaction for its splits). For the MVP this is acceptable given expected data volume. A future optimization would use PostgreSQL's `json_agg` to aggregate splits into a single JSON column within the transaction query, avoiding N+1.

## Known Limitations and Future Improvements

- **N+1 query** in transactions listing (documented above)
- **No reporting/aggregation** views (e.g., total per category per month). The data model supports it; only the UI and aggregation queries are missing.
- **No recurring transactions** (e.g., monthly rent). Could be added with a separate `recurring_transactions` table and a generator.
- **No budget targets** per category (e.g., 400€/month for groceries). A `budgets` table could hold monthly limits and alerts.
- **System categories deletion is not blocked at the API level** — only by the FK constraint and by hiding them in the UI. A backend safeguard could explicitly reject these deletions.
- **No CSV import** of bank statements. Would require a parser per bank format.

## Testing

Unit tests are located in `tests/` and use `pytest` with `pytest-mock`. They cover:
- All CRUD operations for each repository
- Validation logic for splits (at least one, sum matches amount)
- Transaction atomicity (callback pattern for `execute_transaction`)

Run from the project's `core/backend/` directory:

```bash
poetry run pytest ../../addons/budget/tests/
```
