const API_URL = "http://127.0.0.1:5000";
import { serviceRegistry } from "http://127.0.0.1:3000/js/service_registry.js";


// Local cache for related data
let accounts = [];
let categories = [];
let persons = [];
let transactions = [];


export async function render(container) {
    container.innerHTML = `
        <div class="budget-header">
            <h2>Transactions</h2>
            <button id="add-transaction-btn" class="budget-btn-primary">+ Add Transaction</button>
        </div>

        <div class="transactions-filters">
            <label>Account
                <select id="filter-account"><option value="">All</option></select>
            </label>
            <label>Category
                <select id="filter-category"><option value="">All</option></select>
            </label>
        </div>

        <div id="transactions-list"></div>

        <div id="transaction-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="transaction-modal-title">Add Transaction</h3>

                <div class="transaction-mode-toggle">
                    <button type="button" class="mode-btn active" data-mode="transaction">Transaction</button>
                    <button type="button" class="mode-btn" data-mode="transfer">Transfer</button>
                </div>

                <div id="transaction-fields">
                    <label>Account</label>
                    <select id="transaction-account"></select>

                    <label>Date</label>
                    <input type="date" id="transaction-date" />

                    <label>Total Amount</label>
                    <input type="number" id="transaction-amount" step="0.01" />

                    <label>Description</label>
                    <input type="text" id="transaction-description" />

                    <div class="splits-section">
                        <h4>Splits</h4>
                        <div id="splits-list"></div>
                        <button type="button" id="add-split-btn" class="add-split-btn">+ Add Split</button>
                        <div id="splits-validation" class="splits-validation"></div>
                    </div>
                </div>

                <div id="transfer-fields" class="hidden">
                    <label>From Account</label>
                    <select id="transfer-from"></select>

                    <label>To Account</label>
                    <select id="transfer-to"></select>

                    <label>Date</label>
                    <input type="date" id="transfer-date" />

                    <label>Amount</label>
                    <input type="number" id="transfer-amount" step="0.01" min="0.01" />

                    <label>Description (optional)</label>
                    <input type="text" id="transfer-description" />
                </div>

                <div class="modal-actions">
                    <button id="transaction-cancel" class="budget-btn-secondary">Cancel</button>
                    <button id="transaction-confirm" class="budget-btn-primary">Save</button>
                </div>
            </div>
        </div>
    `;

    await loadRelatedData();
    populateFilters();
    await loadTransactions();

    document.getElementById("add-transaction-btn").addEventListener("click", () => openModal());
    document.getElementById("transaction-cancel").addEventListener("click", closeModal);
    document.getElementById("transaction-confirm").addEventListener("click", saveModal);
    document.getElementById("add-split-btn").addEventListener("click", () => addSplitRow());

    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    document.getElementById("transaction-amount").addEventListener("input", validateSplits);

    document.getElementById("filter-account").addEventListener("change", renderTransactions);
    document.getElementById("filter-category").addEventListener("change", renderTransactions);
}


async function loadRelatedData() {
    const auth = serviceRegistry.get("auth");
    const headers = auth.authHeaders();

    const [accRes, catRes, personsRes] = await Promise.all([
        fetch(`${API_URL}/budget/accounts`, { headers }),
        fetch(`${API_URL}/budget/categories`, { headers }),
        fetch(`${API_URL}/auth/persons`, { headers })
    ]);

    accounts = await accRes.json();
    categories = await catRes.json();
    persons = await personsRes.json();
}


function isTransferCategory(cat) {
    return cat.name === "Transfer Out" || cat.name === "Transfer In";
}


function populateFilters() {
    const accountFilter = document.getElementById("filter-account");
    accounts.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        accountFilter.appendChild(opt);
    });

    const categoryFilter = document.getElementById("filter-category");
    categories.filter(c => !isTransferCategory(c)).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        categoryFilter.appendChild(opt);
    });
}


async function loadTransactions() {
    const auth = serviceRegistry.get("auth");
    const response = await fetch(`${API_URL}/budget/transactions`, {
        headers: auth.authHeaders()
    });
    transactions = await response.json();
    renderTransactions();
}


function renderTransactions() {
    const accountFilter = document.getElementById("filter-account").value;
    const categoryFilter = document.getElementById("filter-category").value;

    let filtered = transactions;

    if (accountFilter) {
        filtered = filtered.filter(t => t.account_id === parseInt(accountFilter));
    }
    if (categoryFilter) {
        filtered = filtered.filter(t =>
            t.splits.some(s => s.category_id === parseInt(categoryFilter))
        );
    }

    const list = document.getElementById("transactions-list");

    if (filtered.length === 0) {
        list.innerHTML = `<div class="budget-empty">No transactions found.</div>`;
        return;
    }

    // Sort by date, most recent first
    filtered.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

    let html = `
        <table class="transactions-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(t => {
        const account = accounts.find(a => a.id === t.account_id);
        const amount = parseFloat(t.amount);
        const kindClass = getDominantKind(t);

        html += `
            <tr>
                <td><button class="expand-toggle" data-id="${t.id}">▶</button></td>
                <td>${formatDate(t.transaction_date)}</td>
                <td>${t.description || ''}</td>
                <td>${account ? account.name : 'Unknown'}</td>
                <td class="transaction-amount ${kindClass}">${amount.toFixed(2)} €</td>
                <td>
                    <button class="budget-btn-secondary edit-btn" data-id="${t.id}">Edit</button>
                    <button class="budget-btn-danger delete-btn" data-id="${t.id}">Delete</button>
                </td>
            </tr>
            <tr class="transaction-splits-row hidden" data-splits-id="${t.id}">
                <td colspan="6">
                    ${t.splits.map(s => {
                        const cat = categories.find(c => c.id === s.category_id);
                        const person = persons.find(p => p.id === s.person_id);
                        return `
                            <div class="split-line">
                                <span class="category-color-dot" style="background: ${cat ? cat.color : '#888'}"></span>
                                <strong>${cat ? cat.name : 'Unknown'}</strong>
                                ${person ? ` — ${person.name}` : ''}
                                ${s.description ? ` — ${s.description}` : ''}
                                : ${parseFloat(s.amount).toFixed(2)} €
                            </div>
                        `;
                    }).join('')}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    list.innerHTML = html;

    document.querySelectorAll(".expand-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = document.querySelector(`[data-splits-id="${btn.dataset.id}"]`);
            row.classList.toggle("hidden");
            btn.textContent = row.classList.contains("hidden") ? "▶" : "▼";
        });
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const t = transactions.find(tr => tr.id === parseInt(btn.dataset.id));
            openModal(t);
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteTransaction(btn.dataset.id));
    });
}


function getDominantKind(transaction) {
    if (!transaction.splits || transaction.splits.length === 0) return '';
    const cat = categories.find(c => c.id === transaction.splits[0].category_id);
    return cat ? cat.kind : '';
}


function formatDate(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return dateValue;
    return d.toISOString().split('T')[0];
}


let editingTransactionId = null;
let currentMode = "transaction";

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    document.getElementById("transaction-fields").classList.toggle("hidden", mode !== "transaction");
    document.getElementById("transfer-fields").classList.toggle("hidden", mode !== "transfer");
}


function openModal(transaction = null) {
    editingTransactionId = transaction ? transaction.id : null;
    document.getElementById("transaction-modal-title").textContent = transaction ? "Edit Transaction" : "Add Transaction";

    // When editing, force transaction mode and hide the toggle (cannot transform a transaction into a transfer)
    const toggle = document.querySelector(".transaction-mode-toggle");
    if (transaction) {
        switchMode("transaction");
        toggle.classList.add("hidden");
    } else {
        switchMode("transaction");
        toggle.classList.remove("hidden");
    }

    // Populate accounts dropdowns
    const accountSelect = document.getElementById("transaction-account");
    accountSelect.innerHTML = "";
    accounts.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        accountSelect.appendChild(opt);
    });

    const fromSelect = document.getElementById("transfer-from");
    const toSelect = document.getElementById("transfer-to");
    fromSelect.innerHTML = "";
    toSelect.innerHTML = "";
    accounts.forEach(a => {
        const optFrom = document.createElement("option");
        optFrom.value = a.id;
        optFrom.textContent = a.name;
        fromSelect.appendChild(optFrom);

        const optTo = document.createElement("option");
        optTo.value = a.id;
        optTo.textContent = a.name;
        toSelect.appendChild(optTo);
    });
    if (accounts.length > 1) toSelect.value = accounts[1].id;

    // Set transaction fields
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("transaction-date").value = transaction ? formatDate(transaction.transaction_date) : today;
    document.getElementById("transaction-amount").value = transaction ? transaction.amount : "";
    document.getElementById("transaction-description").value = transaction ? (transaction.description || "") : "";
    if (transaction) accountSelect.value = transaction.account_id;

    // Reset transfer fields
    document.getElementById("transfer-date").value = today;
    document.getElementById("transfer-amount").value = "";
    document.getElementById("transfer-description").value = "";

    // Populate splits
    const splitsList = document.getElementById("splits-list");
    splitsList.innerHTML = "";

    if (transaction && transaction.splits.length > 0) {
        transaction.splits.forEach(s => addSplitRow(s));
    } else {
        addSplitRow();
    }

    validateSplits();
    document.getElementById("transaction-modal").classList.remove("hidden");
}


function closeModal() {
    document.getElementById("transaction-modal").classList.add("hidden");
    editingTransactionId = null;
}


async function saveModal() {
    if (currentMode === "transfer") {
        await saveTransfer();
    } else {
        await saveTransaction();
    }
}


function addSplitRow(split = null) {
    const splitsList = document.getElementById("splits-list");
    const row = document.createElement("div");
    row.className = "split-row";

    const categoryOptions = categories.filter(c => !isTransferCategory(c)).map(c =>
        `<option value="${c.id}" ${split && split.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const personOptions = `<option value="">— None —</option>` + persons.map(p =>
        `<option value="${p.id}" ${split && split.person_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    row.innerHTML = `
        <div>
            <label>Amount</label>
            <input type="number" step="0.01" class="split-amount" value="${split ? split.amount : ''}" />
        </div>
        <div>
            <label>Category</label>
            <select class="split-category">${categoryOptions}</select>
        </div>
        <div>
            <label>Person</label>
            <select class="split-person">${personOptions}</select>
        </div>
        <button type="button" class="split-remove">×</button>
    `;

    splitsList.appendChild(row);

    row.querySelector(".split-amount").addEventListener("input", validateSplits);
    row.querySelector(".split-remove").addEventListener("click", () => {
        row.remove();
        validateSplits();
    });

    validateSplits();
}


function validateSplits() {
    const totalAmount = parseFloat(document.getElementById("transaction-amount").value) || 0;
    const splitInputs = document.querySelectorAll(".split-amount");
    const splitsTotal = Array.from(splitInputs)
        .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);

    const validation = document.getElementById("splits-validation");

    if (Math.abs(totalAmount - splitsTotal) < 0.01 && totalAmount > 0) {
        validation.className = "splits-validation valid";
        validation.textContent = `✓ Splits match transaction amount`;
    } else {
        validation.className = "splits-validation invalid";
        validation.textContent = `Splits sum: ${splitsTotal.toFixed(2)} € — Transaction: ${totalAmount.toFixed(2)} € (difference: ${(totalAmount - splitsTotal).toFixed(2)} €)`;
    }
}


async function saveTransaction() {
    const accountId = parseInt(document.getElementById("transaction-account").value);
    const amount = parseFloat(document.getElementById("transaction-amount").value);
    const description = document.getElementById("transaction-description").value.trim();
    const date = document.getElementById("transaction-date").value;

    if (!accountId || !amount || !date) return alert("Account, amount and date are required");

    // Collect splits
    const splitRows = document.querySelectorAll(".split-row");
    const splits = Array.from(splitRows).map(row => {
        const splitAmount = parseFloat(row.querySelector(".split-amount").value);
        const categoryId = parseInt(row.querySelector(".split-category").value);
        const personId = row.querySelector(".split-person").value;
        return {
            amount: splitAmount,
            category_id: categoryId,
            person_id: personId ? parseInt(personId) : null
        };
    });

    if (splits.length === 0) return alert("At least one split is required");

    const splitsTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(splitsTotal - amount) > 0.01) {
        return alert(`Splits total (${splitsTotal.toFixed(2)}) does not match transaction amount (${amount.toFixed(2)})`);
    }

    const auth = serviceRegistry.get("auth");
    const headers = { "Content-Type": "application/json", ...auth.authHeaders() };

    const body = {
        transaction: {
            amount,
            description,
            transaction_date: date,
            account_id: accountId
        },
        splits
    };

    try {
        let response;
        if (editingTransactionId) {
            response = await fetch(`${API_URL}/budget/transactions/${editingTransactionId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify(body)
            });
        } else {
            response = await fetch(`${API_URL}/budget/transactions`, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });
        }
        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadTransactions();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}


async function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;

    const auth = serviceRegistry.get("auth");
    try {
        const response = await fetch(`${API_URL}/budget/transactions/${id}`, {
            method: "DELETE",
            headers: auth.authHeaders()
        });
        const data = await response.json();

        if (data.success) {
            await loadTransactions();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}


async function saveTransfer() {
    const fromAccountId = parseInt(document.getElementById("transfer-from").value);
    const toAccountId = parseInt(document.getElementById("transfer-to").value);
    const amount = parseFloat(document.getElementById("transfer-amount").value);
    const date = document.getElementById("transfer-date").value;
    const description = document.getElementById("transfer-description").value.trim();

    if (!fromAccountId || !toAccountId || !amount || !date) {
        return alert("From, to, amount and date are required");
    }
    if (fromAccountId === toAccountId) {
        return alert("Source and destination accounts must be different");
    }
    if (amount <= 0) {
        return alert("Amount must be positive");
    }

    const auth = serviceRegistry.get("auth");
    const headers = { "Content-Type": "application/json", ...auth.authHeaders() };

    try {
        const response = await fetch(`${API_URL}/budget/transfers`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                from_account_id: fromAccountId,
                to_account_id: toAccountId,
                amount,
                transaction_date: date,
                description
            })
        });
        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadTransactions();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}
