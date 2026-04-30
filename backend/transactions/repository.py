from core.backend import database

TRANSACTIONS_TABLE = "budget_transactions"
SPLITS_TABLE = "budget_transaction_splits"


class TransactionRepository:
    """
    Manages transactions and their splits.
    
    A transaction represents a single money movement on an account
    (e.g., 100€ paid for groceries). It can be broken down into
    multiple splits, each assigning part of the amount to a specific
    category and optionally a person (e.g., 80€ for parent's food,
    20€ for daughter's food).
    
    Splits are not exposed as a separate entity — they only exist
    within the context of a transaction. This repository orchestrates
    both tables to ensure data consistency.
    """

    def get_all(self):
        """
        Returns all transactions, each with their splits.
        
        TODO: Currently uses N+1 queries (one for transactions,
        one per transaction for its splits). Acceptable for MVP
        given the expected data volume (< 1000 transactions).
        For larger volumes, this should be optimized with a single
        query using PostgreSQL's json_agg to aggregate splits in JSON
        directly within the transaction row.
        """
        transactions = database.fetch_all(TRANSACTIONS_TABLE)
        for transaction in transactions:
            transaction["splits"] = database.fetch_where(
                SPLITS_TABLE,
                {"transaction_id": transaction["id"]}
            )
        return transactions

    def get_by_id(self, transaction_id):
        """Returns a single transaction with its splits, or None if not found."""
        result = database.fetch_where(TRANSACTIONS_TABLE, {"id": transaction_id})
        if not result:
            return None

        transaction = result[0]
        transaction["splits"] = database.fetch_where(
            SPLITS_TABLE,
            {"transaction_id": transaction_id}
        )
        return transaction

    def create_with_splits(self, transaction_data, splits_data):
        """
        Creates a transaction and its splits atomically.
        
        Validation rules:
        - At least one split is required
        - The sum of split amounts must equal the transaction amount
        
        Both the transaction and its splits are inserted in a single
        database transaction. If any insert fails, all changes are
        rolled back.
        """
        self._validate_splits(transaction_data["amount"], splits_data)

        def operations(cursor):
            transaction_result = database.insert_item(
                TRANSACTIONS_TABLE,
                transaction_data,
                cursor=cursor,
                returning="id"
            )
            transaction_id = transaction_result[0]["id"]

            for split in splits_data:
                split_with_fk = {**split, "transaction_id": transaction_id}
                database.insert_item(SPLITS_TABLE, split_with_fk, cursor=cursor)

            return transaction_id

        return database.execute_transaction(operations)

    def update(self, transaction_id, transaction_updates, splits_data):
        """
        Updates a transaction and replaces its splits atomically.
        
        Splits are not partially updated — the existing splits are
        deleted and replaced by the new set. This simplifies the
        validation logic (no need to track changes per split) at the
        cost of additional inserts. Acceptable given typical split
        count per transaction (1-5).
        """
        new_amount = transaction_updates.get("amount")
        if new_amount is not None:
            self._validate_splits(new_amount, splits_data)

        def operations(cursor):
            database.update_item(
                TRANSACTIONS_TABLE,
                transaction_updates,
                {"id": transaction_id},
                cursor=cursor
            )

            database.delete_item(
                SPLITS_TABLE,
                {"transaction_id": transaction_id},
                cursor=cursor
            )

            for split in splits_data:
                split_with_fk = {**split, "transaction_id": transaction_id}
                database.insert_item(SPLITS_TABLE, split_with_fk, cursor=cursor)

        database.execute_transaction(operations)

    def delete(self, transaction_id):
        """
        Deletes a transaction. The associated splits are deleted
        automatically by the ON DELETE CASCADE constraint.
        """
        database.delete_item(TRANSACTIONS_TABLE, {"id": transaction_id})

    def _validate_splits(self, transaction_amount, splits_data):
        """
        Ensures splits are consistent with the transaction amount.
        Raises ValueError if validation fails.
        """
        if not splits_data:
            raise ValueError("At least one split is required")

        splits_total = sum(split["amount"] for split in splits_data)
        if splits_total != transaction_amount:
            raise ValueError(
                f"Sum of splits ({splits_total}) does not match "
                f"transaction amount ({transaction_amount})"
            )


transaction_repository = TransactionRepository()