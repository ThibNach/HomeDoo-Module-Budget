from dataclasses import dataclass

from core.backend import database


@dataclass
class AccountReport:
    account_id: int
    account_name: str
    account_type: str
    account_balance: float


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

    def get_expense_by_category(self, category_id, date):
        #:TODO: return for all categories
        # indexed_data = self._load_indexed_data()
        pass
        
    # :TODO: Find a way to call _load_indexed_data only once for all reports without
    #  coupling it with others repositories and without having only one big full report route
    # 

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
