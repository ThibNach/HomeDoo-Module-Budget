from flask import Blueprint
from .accounts.router import accounts_router
from .categories.router import categories_router
from .transactions.router import transactions_router

router = Blueprint("budget", __name__)
router.register_blueprint(accounts_router)
router.register_blueprint(categories_router)
router.register_blueprint(transactions_router)