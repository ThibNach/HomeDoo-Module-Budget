from flask import Blueprint, request, jsonify

from addons.budget.backend.transactions.repository import transaction_repository
from core.addons.auth.backend import login_required

transactions_router = Blueprint("budget_transactions", __name__)


@transactions_router.route("/budget/transactions", methods=["GET"])
@login_required
def get_all_transactions():
    return jsonify(transaction_repository.get_all()), 200


@transactions_router.route("/budget/transactions/<int:id>", methods=["GET"])
@login_required
def get_transaction_by_id(id):
    transaction = transaction_repository.get_by_id(id)

    if transaction is None:
        return jsonify({"success": False, "error": "Transaction not found"}), 404

    return jsonify(transaction), 200


@transactions_router.route("/budget/transactions", methods=["POST"])
@login_required
def create_transaction():
    data = request.get_json()

    transaction_data = data.get("transaction")
    splits_data = data.get("splits")

    if not transaction_data or not splits_data:
        return jsonify({
            "success": False,
            "error": "Missing transaction or splits data"
        }), 400

    try:
        transaction_id = transaction_repository.create_with_splits(transaction_data, splits_data)
        return jsonify({
            "success": True,
            "message": "Transaction created",
            "transaction_id": transaction_id
        }), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@transactions_router.route("/budget/transactions/<int:id>", methods=["PUT"])
@login_required
def update_transaction(id):
    data = request.get_json()

    transaction_updates = data.get("transaction", {})
    splits_data = data.get("splits", [])

    if not splits_data:
        return jsonify({
            "success": False,
            "error": "Splits data is required"
        }), 400

    try:
        transaction_repository.update(id, transaction_updates, splits_data)
        return jsonify({"success": True, "message": "Transaction updated"}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@transactions_router.route("/budget/transactions/<int:id>", methods=["DELETE"])
@login_required
def delete_transaction(id):
    try:
        transaction_repository.delete(id)
        return jsonify({"success": True, "message": "Transaction deleted"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@transactions_router.route("/budget/transfers", methods=["POST"])
@login_required
def create_transfer():
    data = request.get_json()

    from_account_id = data.get("from_account_id")
    to_account_id = data.get("to_account_id")
    amount = data.get("amount")
    transaction_date = data.get("transaction_date")
    description = data.get("description", "")

    if not from_account_id or not to_account_id or amount is None or not transaction_date:
        return jsonify({
            "success": False,
            "error": "Missing required fields (from_account_id, to_account_id, amount, transaction_date)"
        }), 400

    try:
        out_id, in_id = transaction_repository.create_transfer(
            from_account_id, to_account_id, amount, transaction_date, description
        )
        return jsonify({
            "success": True,
            "message": "Transfer created",
            "out_transaction_id": out_id,
            "in_transaction_id": in_id
        }), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500