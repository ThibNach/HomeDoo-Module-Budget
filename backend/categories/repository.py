from core.backend import database

CATEGORIES_TABLE = "budget_categories"


class CategoryRepository:
    def get_all(self):
        return database.fetch_all(CATEGORIES_TABLE)

    def get_by_id(self, category_id):
        result = database.fetch_where(CATEGORIES_TABLE, {"id": category_id})
        return result[0] if result else None

    def create(self, name, kind, color):
        result = database.insert_item(CATEGORIES_TABLE, {"name": name, "kind": kind, "color": color}, returning="id")
        return result[0]["id"]

    def update(self, category_id, updates: dict):
        database.update_item(CATEGORIES_TABLE, updates, {"id": category_id})

    def delete(self, category_id):
        database.delete_item(CATEGORIES_TABLE, {"id": category_id})


category_repository = CategoryRepository()
