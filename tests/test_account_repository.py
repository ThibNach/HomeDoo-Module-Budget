from unittest.mock import MagicMock
from addons.budget.backend.accounts.repository import AccountRepository


def test_get_all_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")
    mock_database.fetch_all.return_value = []

    repo = AccountRepository()
    result = repo.get_all()

    mock_database.fetch_all.assert_called_once_with("budget_accounts")
    assert result == []


def test_get_by_id_returns_first_result(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")
    mock_database.fetch_where.return_value = [{"id": 1, "name": "Checking"}]

    repo = AccountRepository()
    result = repo.get_by_id(1)

    assert result == {"id": 1, "name": "Checking"}


def test_get_by_id_returns_none_when_not_found(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")
    mock_database.fetch_where.return_value = []

    repo = AccountRepository()
    result = repo.get_by_id(999)

    assert result is None


def test_create_returns_new_id(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")
    mock_database.insert_item.return_value = [{"id": 42}]

    repo = AccountRepository()
    result = repo.create("Checking", "checking", 1000)

    mock_database.insert_item.assert_called_once_with(
        "budget_accounts",
        {"name": "Checking", "type": "checking", "initial_balance": 1000},
        returning="id"
    )
    assert result == 42


def test_update_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")

    repo = AccountRepository()
    repo.update(1, {"name": "New Name"})

    mock_database.update_item.assert_called_once_with(
        "budget_accounts",
        {"name": "New Name"},
        {"id": 1}
    )
    

def test_delete_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.accounts.repository.database")

    repo = AccountRepository()
    repo.delete(1)

    mock_database.delete_item.assert_called_once_with(
        "budget_accounts",
        {"id": 1}
    )