const API_URL = "http://127.0.0.1:5000";
import { serviceRegistry } from "http://127.0.0.1:3000/js/service_registry.js";


export async function render(container) {
    container.innerHTML = `
        <div class="budget-header">
            <h2>Accounts</h2>
            <button id="add-account-btn" class="budget-btn-primary">+ Add Account</button>
        </div>
        <div id="accounts-list"></div>

        <div id="account-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="account-modal-title">Add Account</h3>
                <label>Name</label>
                <input type="text" id="account-name" />
                <label>Type</label>
                <select id="account-type">
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                </select>
                <label>Initial Balance</label>
                <input type="number" id="account-balance" step="0.01" value="0" />
                <div class="modal-actions">
                    <button id="account-cancel" class="budget-btn-secondary">Cancel</button>
                    <button id="account-confirm" class="budget-btn-primary">Save</button>
                </div>
            </div>
        </div>
    `;

    await loadAccounts();

    document.getElementById("add-account-btn").addEventListener("click", () => openModal());
    document.getElementById("account-cancel").addEventListener("click", closeModal);
    document.getElementById("account-confirm").addEventListener("click", saveAccount);
}


async function loadAccounts() {
    const auth = serviceRegistry.get("auth");
    const response = await fetch(`${API_URL}/budget/accounts`, {
        headers: auth.authHeaders()
    });
    const accounts = await response.json();

    const list = document.getElementById("accounts-list");
    list.innerHTML = "";

    if (accounts.length === 0) {
        list.innerHTML = `<div class="budget-empty">No accounts yet. Create your first one!</div>`;
        return;
    }

    accounts.forEach(account => {
        const item = document.createElement("div");
        item.className = "budget-item";
        const balance = parseFloat(account.initial_balance);
        item.innerHTML = `
            <div class="budget-item-info">
                <strong>${account.name}</strong>
                <span class="account-type-badge">${account.type}</span>
                <div class="budget-item-meta">Initial balance</div>
            </div>
            <div class="account-balance ${balance < 0 ? 'negative' : ''}">
                ${balance.toFixed(2)} €
            </div>
            <div class="budget-item-actions">
                <button class="budget-btn-secondary edit-btn" data-id="${account.id}">Edit</button>
                <button class="budget-btn-danger delete-btn" data-id="${account.id}">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const account = accounts.find(a => a.id === parseInt(btn.dataset.id));
            openModal(account);
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteAccount(btn.dataset.id));
    });
}


let editingAccountId = null;

function openModal(account = null) {
    editingAccountId = account ? account.id : null;
    document.getElementById("account-modal-title").textContent = account ? "Edit Account" : "Add Account";
    document.getElementById("account-name").value = account ? account.name : "";
    document.getElementById("account-type").value = account ? account.type : "checking";
    document.getElementById("account-balance").value = account ? account.initial_balance : "0";
    document.getElementById("account-modal").classList.remove("hidden");
}


function closeModal() {
    document.getElementById("account-modal").classList.add("hidden");
    editingAccountId = null;
}


async function saveAccount() {
    const name = document.getElementById("account-name").value.trim();
    const type = document.getElementById("account-type").value;
    const balance = parseFloat(document.getElementById("account-balance").value);

    if (!name) return alert("Name is required");
    if (isNaN(balance)) return alert("Invalid balance");

    const auth = serviceRegistry.get("auth");
    const headers = { "Content-Type": "application/json", ...auth.authHeaders() };

    try {
        let response;
        if (editingAccountId) {
            response = await fetch(`${API_URL}/budget/accounts/${editingAccountId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ name, type, initial_balance: balance })
            });
        } else {
            response = await fetch(`${API_URL}/budget/accounts`, {
                method: "POST",
                headers,
                body: JSON.stringify({ name, account_type: type, initial_balance: balance })
            });
        }
        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadAccounts();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}


async function deleteAccount(id) {
    if (!confirm("Delete this account? All its transactions will be deleted too.")) return;

    const auth = serviceRegistry.get("auth");
    try {
        const response = await fetch(`${API_URL}/budget/accounts/${id}`, {
            method: "DELETE",
            headers: auth.authHeaders()
        });
        const data = await response.json();

        if (data.success) {
            await loadAccounts();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}
