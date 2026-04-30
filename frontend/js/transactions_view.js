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
    document.getElementById("transaction-confirm").addEventListener("click", saveTransaction);
    document.getElementById("add-split-btn").addEventListener("click", () => addSplitRow());

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


function populateFilters() {
    const accountFilter = document.getElementById("filter-account");
    accounts.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        accountFilter.appendChild(opt);
    });

    const categoryFilter = document.getElementById("filter-category");
    categories.forEach(c => {
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

function openModal(transaction = null) {
    editingTransactionId = transaction ? transaction.id : null;
    document.getElementById("transaction-modal-title").textContent = transaction ? "Edit Transaction" : "Add Transaction";

    // Populate accounts dropdown
    const accountSelect = document.getElementById("transaction-account");
    accountSelect.innerHTML = "";
    accounts.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        accountSelect.appendChild(opt);
    });

    // Set fields
    document.getElementById("transaction-date").value = transaction ? formatDate(transaction.transaction_date) : new Date().toISOString().split('T')[0];
    document.getElementById("transaction-amount").value = transaction ? transaction.amount : "";
    document.getElementById("transaction-description").value = transaction ? (transaction.description || "") : "";
    if (transaction) accountSelect.value = transaction.account_id;

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


function addSplitRow(split = null) {
    const splitsList = document.getElementById("splits-list");
    const row = document.createElement("div");
    row.className = "split-row";

    const categoryOptions = categories.map(c =>
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
