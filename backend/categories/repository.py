from core.backend import database

CATEGORIES_TABLE = "budget_categories"

# System categories used for inter-account transfers.
# These are auto-created at module setup and should not be edited
# or deleted by users.
TRANSFER_OUT_NAME = "Transfer Out"
TRANSFER_IN_NAME = "Transfer In"


class CategoryRepository:
    def get_all(self):
        return database.fetch_all(CATEGORIES_TABLE)

    def get_by_id(self, category_id):
        result = database.fetch_where(CATEGORIES_TABLE, {"id": category_id})
        return result[0] if result else None

    def get_by_name(self, name):
        result = database.fetch_where(CATEGORIES_TABLE, {"name": name})
        return result[0] if result else None

    def create(self, name, kind, color):
        result = database.insert_item(CATEGORIES_TABLE, {"name": name, "kind": kind, "color": color}, returning="id")
        return result[0]["id"]

    def update(self, category_id, updates: dict):
        database.update_item(CATEGORIES_TABLE, updates, {"id": category_id})

    def delete(self, category_id):
        database.delete_item(CATEGORIES_TABLE, {"id": category_id})

    def ensure_transfer_categories(self):
        """
        Ensures that the system 'Transfer Out' and 'Transfer In' categories exist.
        Called at module setup. Returns a tuple (out_id, in_id).
        """
        out_category = self.get_by_name(TRANSFER_OUT_NAME)
        out_id = out_category["id"] if out_category else self.create(TRANSFER_OUT_NAME, "expense", "#7f8c8d")

        in_category = self.get_by_name(TRANSFER_IN_NAME)
        in_id = in_category["id"] if in_category else self.create(TRANSFER_IN_NAME, "income", "#7f8c8d")

        return out_id, in_id


category_repository = CategoryRepository()
