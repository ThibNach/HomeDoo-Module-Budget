from core.backend import database

ACCOUNTS_TABLE = "budget_accounts"


class AccountRepository:

    def get_all(self):
        return database.fetch_all(ACCOUNTS_TABLE)

    def get_by_id(self, account_id):
        result = database.fetch_where(ACCOUNTS_TABLE, {"id": account_id})
        return result[0] if result else None
        
    def create(self, name, account_type, initial_balance):
        result = database.insert_item(ACCOUNTS_TABLE, {"name": name, "type": account_type, "initial_balance": initial_balance},returning="id")
        return result[0]["id"]
        
    def update(self, account_id, updates: dict):
        database.update_item(ACCOUNTS_TABLE, updates, {"id": account_id})

    def delete(self, account_id):
        database.delete_item(ACCOUNTS_TABLE, {"id": account_id})


account_repository = AccountRepository()
