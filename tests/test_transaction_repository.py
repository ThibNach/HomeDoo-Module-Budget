import pytest
from unittest.mock import MagicMock
from addons.budget.backend.transactions.repository import TransactionRepository


def test_get_all_returns_transactions_with_splits(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")
    mock_database.fetch_all.return_value = [
        {"id": 1, "amount": 100, "description": "Courses"}
    ]
    mock_database.fetch_where.return_value = [
        {"id": 1, "transaction_id": 1, "amount": 80, "category_id": 1},
        {"id": 2, "transaction_id": 1, "amount": 20, "category_id": 2}
    ]

    repo = TransactionRepository()
    result = repo.get_all()

    assert len(result) == 1
    assert "splits" in result[0]
    assert len(result[0]["splits"]) == 2


def test_get_by_id_returns_transaction_with_splits(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")
    mock_database.fetch_where.side_effect = [
        [{"id": 1, "amount": 100}],
        [{"id": 1, "transaction_id": 1, "amount": 100}]
    ]

    repo = TransactionRepository()
    result = repo.get_by_id(1)

    assert result is not None
    assert result["amount"] == 100
    assert len(result["splits"]) == 1


def test_get_by_id_returns_none_when_not_found(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")
    mock_database.fetch_where.return_value = []

    repo = TransactionRepository()
    result = repo.get_by_id(999)

    assert result is None


def test_create_with_splits_validates_at_least_one_split():
    repo = TransactionRepository()

    with pytest.raises(ValueError, match="At least one split is required"):
        repo.create_with_splits(
            {"amount": 100, "description": "Test"},
            []
        )


def test_create_with_splits_validates_amount_matches():
    repo = TransactionRepository()

    with pytest.raises(ValueError, match="does not match"):
        repo.create_with_splits(
            {"amount": 100, "description": "Test"},
            [
                {"amount": 50, "category_id": 1},
                {"amount": 30, "category_id": 2}
            ]
        )


def test_create_with_splits_uses_transaction(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")
    mock_database.execute_transaction.return_value = 42

    repo = TransactionRepository()
    result = repo.create_with_splits(
        {"amount": 100, "description": "Test"},
        [{"amount": 100, "category_id": 1}]
    )

    mock_database.execute_transaction.assert_called_once()
    assert result == 42


def test_create_with_splits_inserts_transaction_and_splits(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")
    mock_database.insert_item.return_value = [{"id": 42}]

    captured_callback = None
    def capture(callback):
        nonlocal captured_callback
        captured_callback = callback
        return 42
    mock_database.execute_transaction.side_effect = capture

    repo = TransactionRepository()
    repo.create_with_splits(
        {"amount": 100, "description": "Test"},
        [
            {"amount": 80, "category_id": 1},
            {"amount": 20, "category_id": 2}
        ]
    )

    mock_cursor = MagicMock()
    captured_callback(mock_cursor)

    assert mock_database.insert_item.call_count == 3

    splits_inserts = mock_database.insert_item.call_args_list[1:]
    for call in splits_inserts:
        split_data = call[0][1]
        assert split_data["transaction_id"] == 42


def test_update_validates_splits_when_amount_changes():
    repo = TransactionRepository()

    with pytest.raises(ValueError, match="does not match"):
        repo.update(
            1,
            {"amount": 200},
            [{"amount": 100, "category_id": 1}]
        )


def test_update_uses_transaction(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")

    repo = TransactionRepository()
    repo.update(
        1,
        {"description": "New desc"},
        [{"amount": 100, "category_id": 1}]
    )

    mock_database.execute_transaction.assert_called_once()


def test_delete_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.transactions.repository.database")

    repo = TransactionRepository()
    repo.delete(1)

    mock_database.delete_item.assert_called_once_with(
        "budget_transactions",
        {"id": 1}
    )