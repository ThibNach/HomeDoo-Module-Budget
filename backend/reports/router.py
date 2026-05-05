from dataclasses import asdict

from flask import Blueprint, request, jsonify

from addons.budget.backend.reports.repository import reports_repository
from core.addons.auth.backend import login_required

reports_router = Blueprint("budget_reports", __name__)


@reports_router.route("/budget/reports/account-balances", methods=["GET"])
@login_required
def get_account_balances():
    reports = reports_repository.get_all_accounts_balance()
    return jsonify([asdict(r) for r in reports]), 200


@reports_router.route("/budget/reports/totals-by-category", methods=["GET"])
@login_required
def get_totals_by_category():
    year, month, error = _parse_month_param()
    if error is not None:
        return error

    reports = reports_repository.get_totals_by_category(year, month)
    return jsonify([asdict(r) for r in reports]), 200


@reports_router.route("/budget/reports/totals-by-person", methods=["GET"])
@login_required
def get_totals_by_person():
    year, month, error = _parse_month_param()
    if error is not None:
        return error

    reports = reports_repository.get_totals_by_person(year, month)
    return jsonify([asdict(r) for r in reports]), 200


def _parse_month_param():
    """
    Parses the 'month' query param expected as 'YYYY-MM'.

    Returns (year, month, None) on success, or (None, None, error_response)
    on failure where error_response is a Flask jsonify tuple.
    """
    month_param = request.args.get("month")
    if not month_param:
        return None, None, (jsonify({
            "success": False,
            "error": "Missing required query parameter 'month' (expected format: YYYY-MM)"
        }), 400)

    try:
        year_str, month_str = month_param.split("-")
        year = int(year_str)
        month = int(month_str)
        if not (1 <= month <= 12):
            raise ValueError("month must be between 1 and 12")
    except (ValueError, AttributeError):
        return None, None, (jsonify({
            "success": False,
            "error": f"Invalid 'month' parameter: '{month_param}' (expected format: YYYY-MM)"
        }), 400)

    return year, month, None