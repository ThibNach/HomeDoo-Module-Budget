from flask import Blueprint, request, jsonify

from addons.budget.backend.accounts.repository import account_repository
from core.addons.auth.backend import login_required

accounts_router = Blueprint("budget_accounts", __name__)


@accounts_router.route("/budget/accounts", methods=["GET"])
@login_required
def get_accounts():
    return jsonify(account_repository.get_all()), 200


@accounts_router.route("/budget/accounts/<int:id>", methods=["GET"])
@login_required
def get_account_by_id(id):
    account = account_repository.get_by_id(id)
    if account is None:
        return jsonify({"success": False, "error": "Account not found"}), 400
    return jsonify(account)


@accounts_router.route("/budget/accounts", methods=["POST"])
@login_required
def create_account():
    data = request.get_json()

    try:
        created_account = account_repository.create(data["name"], data["account_type"], data["initial_balance"])
        return jsonify({"success": True, "message": "Account created", "account_id": created_account}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@accounts_router.route("/budget/accounts/<int:id>", methods=["PUT"])
@login_required
def update_account(id):
    data = request.get_json()

    try:
        account_repository.update(id, data)
        return jsonify({"success": True, "message": "Account updated"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@accounts_router.route("/budget/accounts/<int:id>", methods=["DELETE"])
@login_required
def delete_account(id):
    try:
        account_repository.delete(id)
        return jsonify({"success": True, "message": "Account deleted"}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400
