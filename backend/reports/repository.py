from dataclasses import dataclass
from os.path import split

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

    def get_all_accounts_balance(self):
        accounts = database.fetch_all("budget_accounts")
        indexed_data = self._load_indexed_data()

        account_reports = []
        for account in accounts:
            account_report = AccountReport(
                account["id"],
                account["name"],
                account["type"],
                float(account["initial_balance"])
            )

            for transaction in indexed_data["transactions_by_account"].get(account["id"], []):
                for split in indexed_data["splits_by_transaction"].get(transaction["id"], []):
                    cat = indexed_data["categories_by_id"].get(split["category_id"])
                    if cat is None:
                        continue
                    amount = float(split["amount"])
                    account_report.account_balance += amount if cat["kind"] == "income" else -amount

            account_reports.append(account_report)

        return account_reports

    def get_totals_by_category(self, year: int, month: int):
        indexed_data = self._load_indexed_data()

        transactions_in_month = [
            t for t in indexed_data["transactions"]
            if t["transaction_date"].year == year and t["transaction_date"].month == month
        ]

        splits_in_month = [
            split
            for transaction in transactions_in_month
            for split in indexed_data["split_by_transaction"].get(transaction["id"], [])
        ]

        category_reports_by_id = {}
        for category in indexed_data["categories_by_id"].values():
            person_shares = [
                PersonShare(person_id, person["name"], 0.0)
                for person_id, person in indexed_data["persons_by_id"].items()
            ]
            person_shares.append(PersonShare(None, "Unassigned", 0.0))

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

    # :TODO: Find a way to call _load_indexed_data only once for all reports without
    #  coupling it with others repositories and without having only one big full report route

    def _load_indexed_data(self):
        transactions = database.fetch_all("budget_transactions")
        splits = database.fetch_all("budget_transaction_splits")
        categories = database.fetch_all("budget_categories")
        persons = database.fetch_all("auth_persons")

        return {
            "transactions": transactions,
            "splits": splits,
            "categories_by_id": {c["id"]: c for c in categories},
            "persons_by_id": {p["id"]: p for p in persons},
            "transactions_by_account": self._index_by(transactions, "account_id"),
            "splits_by_transaction": self._index_by(splits, "transaction_id"),
        }

    def _index_by(self, items, key):
        indexed = {}
        for item in items:
            indexed.setdefault(item[key], []).append(item)
        return indexed


reports_repository = ReportsRepository()
