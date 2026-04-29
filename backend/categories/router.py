from flask import Blueprint, jsonify, request

from addons.budget.backend.categories.repository import category_repository
from core.addons.auth.backend import login_required

categories_router = Blueprint("budget_categories", __name__)


@categories_router.route("/budget/categories", methods=["GET"])
@login_required
def get_all_categories():
    return jsonify(category_repository.get_all()), 200


@categories_router.route("/budget/categories/<int:id>", methods=["GET"])
@login_required
def get_category_by_id(id):
    category = category_repository.get_by_id(id)

    if category is None:
        return jsonify({"success": False, "message": "No category found with this ID"}), 404

    return jsonify(category), 200


@categories_router.route("/budget/categories", methods=["POST"])
@login_required
def create_category():
    data = request.get_json()

    try:
        created_category = category_repository.create(data["name"], data["kind"], data["color"])
        return jsonify({"success": True, "message": "Category created", "category": created_category}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@categories_router.route("/budget/categories/<int:id>", methods=["PUT"])
@login_required
def update_category(id):
    data = request.get_json()

    try:
        category_repository.update(id, data)
        return jsonify({"success": True, "message": "category updated"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@categories_router.route("/budget/categories/<int:id>", methods=["DELETE"])
@login_required
def delete_category(id):
    try:
        category_repository.delete(id)
        return jsonify({"success": True, "message": "Category deleted"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400
