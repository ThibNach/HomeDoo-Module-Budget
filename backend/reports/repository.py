from dataclasses import dataclass
from psycopg2 import sql
from datetime import date

from core.backend import database


@dataclass
class AccountReport:
    account_id: int
    account_name: str
    account_type: str
    account_balance: float


@dataclass
class PersonShare:
    person_id: int | None
    person_name: str
    total: float


@dataclass
class CategoryReport:
    category_id: int
    category_name: str
    kind: str
    color: str
    total: float
    by_person: list[PersonShare]


@dataclass
class CategoryShare:
    category_id: int
    category_name: str
    color: str
    total: float


@dataclass
class PersonReport:
    person_id: int | None
    person_name: str
    total: float
    by_category: list[CategoryShare]


class ReportsRepository:

    #:TODO: Refactor to use database.execute_raw_query to let the DB make the aggregate
    def get_all_accounts_balance(self):
        accounts = database.fetch_all("budget_accounts")

        transactions = database.fetch_all("budget_transactions")
        splits = database.fetch_all("budget_transaction_splits")
        categories = database.fetch_all("budget_categories")

        transactions_by_id = {t["id"]: t for t in transactions}
        categories_by_id = {c["id"]: c for c in categories}

        account_reports_by_id = {
            account["id"]: AccountReport(
                account_id=account["id"],
                account_name=account["name"],
                account_type=account["type"],
                account_balance=float(account["initial_balance"]),
            )
            for account in accounts
        }

        for split in splits:
            transaction = transactions_by_id.get(split["transaction_id"])
            if transaction is None:
                continue

            category = categories_by_id.get(split["category_id"])
            if category is None:
                continue

            account_report = account_reports_by_id.get(transaction["account_id"])
            if account_report is None:
                continue

            amount = float(split["amount"])
            signed_amount = amount if category["kind"] == "income" else -amount
            account_report.account_balance += signed_amount

        return list(account_reports_by_id.values())

    def get_totals_by_category(self, year: int, month: int):
        splits_in_month = self._get_splits_in_month(year, month)

        persons = database.fetch_all("auth_persons")
        all_person_entries = [(p["id"], p["name"]) for p in persons]
        all_person_entries.append((None, "Unassigned"))

        categories = database.fetch_all("budget_categories")

        category_reports_by_id = {}
        for category in categories:
            person_shares = [
                PersonShare(person_id, person_name, 0.0)
                for person_id, person_name in all_person_entries
            ]

            category_reports_by_id[category["id"]] = CategoryReport(
                category_id=category["id"],
                category_name=category["name"],
                kind=category["kind"],
                color=category["color"],
                total=0.0,
                by_person=person_shares,
            )

        for split in splits_in_month:
            category_report = category_reports_by_id.get(split["category_id"])
            if category_report is None:
                continue

            amount = float(split["amount"])
            category_report.total += amount

            person_share = next(
                (ps for ps in category_report.by_person if ps.person_id == split.get("person_id")),
                None
            )
            if person_share is not None:
                person_share.total += amount

        return [
            CategoryReport(
                category_id=report.category_id,
                category_name=report.category_name,
                color=report.color,
                kind=report.kind,
                total=report.total,
                by_person=[ps for ps in report.by_person if ps.total != 0],
            )
            for report in category_reports_by_id.values()
            if report.total != 0
        ]

    def get_totals_by_person(self, year: int, month: int):
        persons = database.fetch_all("auth_persons")
        categories = database.fetch_all("budget_categories")
        splits_in_month = self._get_splits_in_month(year, month)

        person_report_by_id = {}
        all_person_entries = [(p["id"], p["name"]) for p in persons]
        all_person_entries.append((None, "Unassigned"))

        for person_id, person_name in all_person_entries:
            category_shares = [
                CategoryShare(
                    category_id=category["id"],
                    category_name=category["name"],
                    color=category["color"],
                    total=0.0,
                ) for category in categories
            ]
            person_report_by_id[person_id] = PersonReport(
                person_id=person_id,
                person_name=person_name,
                total=0.0,
                by_category=category_shares,
            )

        for split in splits_in_month:
            person_report = person_report_by_id.get(split.get("person_id"))
            if person_report is None:
                continue

            amount = float(split["amount"])
            person_report.total += amount

            category_share = next(
                (cs for cs in person_report.by_category if split.get("category_id") == cs.category_id), None)

            if category_share is not None:
                category_share.total += amount

        return [
            PersonReport(
                person_id=report.person_id,
                person_name=report.person_name,
                total=report.total,
                by_category=[cs for cs in report.by_category if cs.total != 0]
            ) for report in person_report_by_id.values() if report.total != 0
        ]

    def _get_splits_in_month(self, year: int, month: int, cursor=None):
        # :TODO: Filter system categories properly. Currently filtered by name
        # because we don't have a kind="transfer" or is_system column yet.

        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

        query = sql.SQL("""
                        SELECT {splits}.*
                        FROM {splits}
                            JOIN {transactions} ON {splits}.{tx_id} = {transactions}.{id}
                            JOIN {categories} ON {splits}.{cat_id} = {categories}.{id}
                        WHERE {transactions}.{date_col} >= {start_ph}
                          AND {transactions}.{date_col} < {end_ph}
                          AND {categories}.{name_col} NOT IN ({transfer_in}, {transfer_out})
                        """).format(
            splits=sql.Identifier("budget_transaction_splits"),
            transactions=sql.Identifier("budget_transactions"),
            categories=sql.Identifier("budget_categories"),
            tx_id=sql.Identifier("transaction_id"),
            cat_id=sql.Identifier("category_id"),
            id=sql.Identifier("id"),
            date_col=sql.Identifier("transaction_date"),
            name_col=sql.Identifier("name"),
            start_ph=sql.Placeholder(),
            end_ph=sql.Placeholder(),
            transfer_in=sql.Placeholder(),
            transfer_out=sql.Placeholder(),
        )

        return database.execute_raw_query(
            query,
            [start, end, "Transfer In", "Transfer Out"]
        )


reports_repository = ReportsRepository()
