"""
engine/loader.py
================
Responsible for loading the raw transaction CSV dataset and returning
two clean DataFrames:
  - edges_df  : every individual transaction (edges of the money graph)
  - gt_df     : ground-truth fraud account IDs (one row per fraud account)

Designed to handle multiple Kaggle / real-world CSV column-name formats
gracefully via detect_columns().
"""

import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Column alias registry
# Standard name → ordered list of candidate column names to try
# ---------------------------------------------------------------------------
_COLUMN_ALIASES: dict[str, list[str]] = {
    # Account-transfer datasets  (PaySim, Kaggle bank fraud …)
    # Login / session datasets   (user_id acts as the originating account)
    "from_account": [
        "nameOrig", "from_account", "sender", "account_id_from", "source",
        "user_id", "userId", "user", "account_id", "account",
    ],
    # Destination — counterpart account, IP, or device acting as the edge target
    "to_account": [
        "nameDest", "to_account", "receiver", "account_id_to", "destination",
        "login_ip", "ip_address", "device_id", "session_id",
    ],
    "amount":    ["amount", "Amount", "transaction_amount", "amt"],
    "timestamp": [
        "step", "timestamp", "time", "Time", "date", "Date", "datetime",
        "hour_of_day",
    ],
    "is_fraud":  [
        "isFraud", "is_fraud", "fraud", "Fraud", "label", "Class",
        "target_column_name", "target", "Target",
    ],
    "txn_type":  [
        "type", "transaction_type", "Type", "txn_type",
        "device_type", "connection_type",
    ],  # optional
}

# Columns that MUST be resolved — missing any of these raises ValueError
_REQUIRED_COLUMNS: tuple[str, ...] = ("from_account", "to_account", "amount")


# ---------------------------------------------------------------------------
# 1. detect_columns
# ---------------------------------------------------------------------------
def detect_columns(df: pd.DataFrame) -> dict:
    """Detect and map standard column names to the actual column names in *df*.

    Iterates through the alias registry for each standard name and returns
    the first matching column found in *df*. Optional columns (txn_type,
    timestamp, is_fraud) are mapped to ``None`` when absent rather than
    raising an error.

    Parameters
    ----------
    df : pd.DataFrame
        The raw DataFrame whose columns are to be inspected.

    Returns
    -------
    dict
        Mapping of ``standard_name -> actual_column_name`` (or ``None``
        for optional columns that were not found).

    Raises
    ------
    ValueError
        If any *required* column (from_account, to_account, amount) cannot
        be resolved from the aliases.
    """
    actual_cols = set(df.columns.tolist())
    column_map: dict[str, str | None] = {}
    missing_required: list[str] = []

    for standard_name, aliases in _COLUMN_ALIASES.items():
        resolved = next((a for a in aliases if a in actual_cols), None)

        if resolved is None and standard_name in _REQUIRED_COLUMNS:
            missing_required.append(standard_name)

        column_map[standard_name] = resolved  # None for optional + not found

    if missing_required:
        raise ValueError(
            f"Could not detect required column(s): {missing_required}.\n"
            f"Columns found in CSV: {sorted(actual_cols)}\n"
            f"Please add your column names to the alias registry in loader.py."
        )

    return column_map


# ---------------------------------------------------------------------------
# 2. load_and_aggregate
# ---------------------------------------------------------------------------
def load_and_aggregate(
    csv_path: str,
    chunksize: int = 250_000,
) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """Load a transaction CSV in chunks, clean it, and aggregate fraud labels.

    Reads *csv_path* in chunks of *chunksize* rows. On the first chunk the
    column schema is auto-detected via :func:`detect_columns`. Each chunk is
    cleaned (invalid amounts dropped, NaN accounts dropped) and appended.
    Fraud-touched account IDs (both sender and receiver of any fraudulent
    transaction) are collected into a ground-truth set.

    Parameters
    ----------
    csv_path : str
        Absolute or relative path to the CSV file.
    chunksize : int, optional
        Number of rows per read chunk (default 250 000).

    Returns
    -------
    edges_df : pd.DataFrame
        Cleaned transaction DataFrame with standardised column names:
        ``from_account``, ``to_account``, ``amount``, and optionally
        ``timestamp``, ``is_fraud``, ``txn_type``.
    gt_df : pd.DataFrame
        Ground-truth fraud accounts with columns:
        ``account_id`` (str) and ``is_fraud_gt`` (bool, always True).
    column_map : dict
        The resolved alias mapping returned by :func:`detect_columns`.

    Raises
    ------
    ValueError
        Propagated from :func:`detect_columns` if required columns are absent.
    FileNotFoundError
        If *csv_path* does not exist.
    """
    column_map: dict | None = None
    chunks: list[pd.DataFrame] = []
    fraud_account_ids: set[str] = set()

    # ---- columns we always keep (standard names) --------------------------
    ALWAYS_KEEP = ["from_account", "to_account", "amount"]
    OPTIONAL_KEEP = ["timestamp", "is_fraud", "txn_type"]

    reader = pd.read_csv(csv_path, chunksize=chunksize, low_memory=False)

    for chunk_idx, raw_chunk in enumerate(reader):

        # --- Step 1: detect schema once on the first chunk -----------------
        if column_map is None:
            column_map = detect_columns(raw_chunk)

            # Build rename dict (skip None / not-found optional columns)
            rename_map = {
                actual: standard
                for standard, actual in column_map.items()
                if actual is not None and actual != standard
            }
        else:
            rename_map = {
                actual: standard
                for standard, actual in column_map.items()
                if actual is not None and actual != standard
            }

        # --- Step 2: rename to standard names ------------------------------
        chunk = raw_chunk.rename(columns=rename_map)

        # --- Step 3: select only the columns we care about -----------------
        cols_present = [
            c for c in ALWAYS_KEEP + OPTIONAL_KEEP
            if c in chunk.columns
        ]
        chunk = chunk[cols_present].copy()

        # --- Step 4: clean amount ------------------------------------------
        chunk["amount"] = pd.to_numeric(chunk["amount"], errors="coerce")
        chunk = chunk.dropna(subset=["amount"])
        chunk = chunk[chunk["amount"] > 0]

        # --- Step 5: drop rows with missing account IDs --------------------
        chunk = chunk.dropna(subset=["from_account", "to_account"])
        chunk["from_account"] = chunk["from_account"].astype(str).str.strip()
        chunk["to_account"]   = chunk["to_account"].astype(str).str.strip()
        chunk = chunk[chunk["from_account"] != ""]
        chunk = chunk[chunk["to_account"]   != ""]

        # --- Step 6: collect fraud-touched accounts ------------------------
        if "is_fraud" in chunk.columns:
            chunk["is_fraud"] = pd.to_numeric(chunk["is_fraud"], errors="coerce").fillna(0).astype(int)
            fraud_mask = chunk["is_fraud"] == 1
            fraud_account_ids.update(chunk.loc[fraud_mask, "from_account"].tolist())
            fraud_account_ids.update(chunk.loc[fraud_mask, "to_account"].tolist())

        chunks.append(chunk)

    # ---- Concatenate all chunks -------------------------------------------
    if not chunks:
        raise ValueError(f"No valid data rows found in '{csv_path}'.")

    edges_df = pd.concat(chunks, ignore_index=True)

    # ---- Build ground-truth DataFrame -------------------------------------
    if fraud_account_ids:
        gt_df = pd.DataFrame({
            "account_id":  sorted(fraud_account_ids),
            "is_fraud_gt": True,
        })
    else:
        # Dataset has no fraud labels — return empty gt frame
        gt_df = pd.DataFrame(columns=["account_id", "is_fraud_gt"])

    # ---- Summary print ----------------------------------------------------
    total_txns         = len(edges_df)
    unique_accounts    = pd.concat([
        edges_df["from_account"], edges_df["to_account"]
    ]).nunique()

    fraud_txn_count = 0
    fraud_txn_pct   = 0.0
    if "is_fraud" in edges_df.columns:
        fraud_txn_count = int(edges_df["is_fraud"].sum())
        fraud_txn_pct   = fraud_txn_count / total_txns * 100 if total_txns else 0.0

    print(f"Loaded {total_txns:,} transactions")
    print(f"Unique accounts: {unique_accounts:,}")
    print(f"Fraud-labeled transactions: {fraud_txn_count:,} ({fraud_txn_pct:.1f}%)")
    print(f"Fraud-touched accounts: {len(fraud_account_ids):,}")

    return edges_df, gt_df, column_map


# ---------------------------------------------------------------------------
# 3. get_dataset_stats
# ---------------------------------------------------------------------------
def get_dataset_stats(edges_df: pd.DataFrame) -> dict:
    """Return a lightweight summary dictionary describing *edges_df*.

    Parameters
    ----------
    edges_df : pd.DataFrame
        The cleaned transaction DataFrame produced by :func:`load_and_aggregate`.

    Returns
    -------
    dict
        A flat dictionary with the following keys:

        - ``num_transactions``    : int   — total row count
        - ``num_unique_accounts`` : int   — distinct account IDs (senders + receivers)
        - ``total_amount``        : float — sum of all transaction amounts
        - ``has_fraud_labels``    : bool  — True if ``is_fraud`` column is present
        - ``fraud_txn_count``     : int   — number of rows where ``is_fraud == 1``
        - ``fraud_txn_pct``       : float — fraud_txn_count / num_transactions * 100
    """
    num_transactions = len(edges_df)

    num_unique_accounts = int(
        pd.concat([edges_df["from_account"], edges_df["to_account"]]).nunique()
    )

    total_amount = float(edges_df["amount"].sum())

    has_fraud_labels = "is_fraud" in edges_df.columns

    fraud_txn_count = 0
    fraud_txn_pct   = 0.0
    if has_fraud_labels:
        fraud_txn_count = int(edges_df["is_fraud"].sum())
        fraud_txn_pct   = (
            round(fraud_txn_count / num_transactions * 100, 2)
            if num_transactions else 0.0
        )

    return {
        "num_transactions":    num_transactions,
        "num_unique_accounts": num_unique_accounts,
        "total_amount":        total_amount,
        "has_fraud_labels":    has_fraud_labels,
        "fraud_txn_count":     fraud_txn_count,
        "fraud_txn_pct":       fraud_txn_pct,
    }
