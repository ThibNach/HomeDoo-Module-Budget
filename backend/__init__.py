from .router import router
from .categories.repository import category_repository


def setup(app):
    app.register_blueprint(router)
    category_repository.ensure_transfer_categories()
