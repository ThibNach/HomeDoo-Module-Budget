from addons.budget.backend.categories.repository import CategoryRepository


def test_get_all_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")
    mock_database.fetch_all.return_value = []

    repo = CategoryRepository()
    result = repo.get_all()

    mock_database.fetch_all.assert_called_once_with("budget_categories")
    assert result == []


def test_get_by_id_returns_first_result(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")
    mock_database.fetch_where.return_value = [{"id": 1, "name": "Food", "kind": "expense"}]

    repo = CategoryRepository()
    result = repo.get_by_id(1)

    assert result == {"id": 1, "name": "Food", "kind": "expense"}


def test_get_by_id_returns_none_when_not_found(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")
    mock_database.fetch_where.return_value = []

    repo = CategoryRepository()
    result = repo.get_by_id(999)

    assert result is None


def test_create_returns_new_id(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")
    mock_database.insert_item.return_value = [{"id": 5}]

    repo = CategoryRepository()
    result = repo.create("Food", "expense", "#FF0000")

    mock_database.insert_item.assert_called_once_with(
        "budget_categories",
        {"name": "Food", "kind": "expense", "color": "#FF0000"},
        returning="id"
    )
    assert result == 5


def test_update_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")

    repo = CategoryRepository()
    repo.update(1, {"name": "New Name"})

    mock_database.update_item.assert_called_once_with(
        "budget_categories",
        {"name": "New Name"},
        {"id": 1}
    )


def test_delete_calls_database(mocker):
    mock_database = mocker.patch("addons.budget.backend.categories.repository.database")

    repo = CategoryRepository()
    repo.delete(1)

    mock_database.delete_item.assert_called_once_with(
        "budget_categories",
        {"id": 1}
    )