const API_URL = "http://127.0.0.1:5000";
import { serviceRegistry } from "http://127.0.0.1:3000/js/service_registry.js";


// State
let currentMonth = getCurrentMonthString();


export async function render(container) {
    container.innerHTML = `
        <div class="reports-container">
            <section class="reports-section">
                <div class="reports-section-header">
                    <h3>Account balances</h3>
                </div>
                <div id="account-balances-list"></div>
            </section>

            <div class="reports-month-selector">
                <label for="reports-month">Month</label>
                <input type="month" id="reports-month" value="${currentMonth}" />
            </div>

            <section class="reports-section">
                <div class="reports-section-header">
                    <h3>Totals by category</h3>
                </div>
                <div id="totals-by-category-list"></div>
            </section>

            <section class="reports-section">
                <div class="reports-section-header">
                    <h3>Totals by person</h3>
                </div>
                <div id="totals-by-person-list"></div>
            </section>
        </div>
    `;

    document.getElementById("reports-month").addEventListener("change", (e) => {
        currentMonth = e.target.value;
        loadMonthlyReports();
    });

    await Promise.all([
        loadAccountBalances(),
        loadMonthlyReports(),
    ]);
}


function getCurrentMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}


async function loadAccountBalances() {
    const auth = serviceRegistry.get("auth");
    const list = document.getElementById("account-balances-list");

    try {
        const response = await fetch(`${API_URL}/budget/reports/account-balances`, {
            headers: auth.authHeaders()
        });
        const accounts = await response.json();
        renderAccountBalances(accounts);
    } catch (e) {
        list.innerHTML = `<div class="budget-empty">Failed to load account balances: ${e.message}</div>`;
    }
}


function renderAccountBalances(accounts) {
    const list = document.getElementById("account-balances-list");

    if (accounts.length === 0) {
        list.innerHTML = `<div class="budget-empty">No accounts yet.</div>`;
        return;
    }

    list.innerHTML = `
        <div class="account-balances-grid">
            ${accounts.map(a => {
        const balance = parseFloat(a.account_balance);
        const isNegative = balance < 0;
        return `
                    <div class="account-balance-card ${isNegative ? 'negative' : ''}">
                        <div class="account-balance-name">${a.account_name}</div>
                        <div class="account-balance-type">${a.account_type}</div>
                        <div class="account-balance-amount">${balance.toFixed(2)} €</div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}


async function loadMonthlyReports() {
    await Promise.all([
        loadTotalsByCategory(),
        loadTotalsByPerson(),
    ]);
}


async function loadTotalsByCategory() {
    const auth = serviceRegistry.get("auth");
    const list = document.getElementById("totals-by-category-list");

    try {
        const response = await fetch(
            `${API_URL}/budget/reports/totals-by-category?month=${currentMonth}`,
            { headers: auth.authHeaders() }
        );
        const reports = await response.json();
        renderTotalsByCategory(reports);
    } catch (e) {
        list.innerHTML = `<div class="budget-empty">Failed to load: ${e.message}</div>`;
    }
}


function renderTotalsByCategory(reports) {
    const list = document.getElementById("totals-by-category-list");

    if (reports.length === 0) {
        list.innerHTML = `<div class="budget-empty">No movements this month.</div>`;
        return;
    }

    // Split income / expense
    const incomes = reports.filter(r => r.kind === "income");
    const expenses = reports.filter(r => r.kind === "expense");

    list.innerHTML = `
        ${expenses.length > 0 ? `
            <div class="reports-subsection">
                <h4>Expenses</h4>
                ${expenses.map(r => renderCategoryRow(r)).join('')}
            </div>
        ` : ''}
        ${incomes.length > 0 ? `
            <div class="reports-subsection">
                <h4>Income</h4>
                ${incomes.map(r => renderCategoryRow(r)).join('')}
            </div>
        ` : ''}
    `;

    bindExpandToggles(list);
}


function renderCategoryRow(report) {
    const sign = report.kind === "income" ? "+" : "-";
    const total = parseFloat(report.total).toFixed(2);

    return `
        <div class="report-row">
            <button class="expand-toggle" data-target="cat-${report.category_id}">▶</button>
            <span class="category-color-dot" style="background: ${report.color}"></span>
            <span class="report-row-name">${report.category_name}</span>
            <span class="report-row-amount ${report.kind}">${sign}${total} €</span>
        </div>
        <div class="report-row-details hidden" id="cat-${report.category_id}">
            ${report.by_person.map(ps => `
                <div class="report-row-detail">
                    <span class="report-row-detail-name">${ps.person_name}</span>
                    <span class="report-row-detail-amount">${parseFloat(ps.total).toFixed(2)} €</span>
                </div>
            `).join('')}
        </div>
    `;
}


async function loadTotalsByPerson() {
    const auth = serviceRegistry.get("auth");
    const list = document.getElementById("totals-by-person-list");

    try {
        const response = await fetch(
            `${API_URL}/budget/reports/totals-by-person?month=${currentMonth}`,
            { headers: auth.authHeaders() }
        );
        const reports = await response.json();
        renderTotalsByPerson(reports);
    } catch (e) {
        list.innerHTML = `<div class="budget-empty">Failed to load: ${e.message}</div>`;
    }
}


function renderTotalsByPerson(reports) {
    const list = document.getElementById("totals-by-person-list");

    if (reports.length === 0) {
        list.innerHTML = `<div class="budget-empty">No movements this month.</div>`;
        return;
    }

    list.innerHTML = reports.map(r => renderPersonRow(r)).join('');

    bindExpandToggles(list);
}


function renderPersonRow(report) {
    const personIdKey = report.person_id === null ? "unassigned" : report.person_id;
    const total = parseFloat(report.total).toFixed(2);

    return `
        <div class="report-row">
            <button class="expand-toggle" data-target="person-${personIdKey}">▶</button>
            <span class="report-row-name">${report.person_name}</span>
            <span class="report-row-amount">${total} €</span>
        </div>
        <div class="report-row-details hidden" id="person-${personIdKey}">
            ${report.by_category.map(cs => `
                <div class="report-row-detail">
                    <span class="category-color-dot" style="background: ${cs.color}"></span>
                    <span class="report-row-detail-name">${cs.category_name}</span>
                    <span class="report-row-detail-amount">${parseFloat(cs.total).toFixed(2)} €</span>
                </div>
            `).join('')}
        </div>
    `;
}


function bindExpandToggles(scope) {
    scope.querySelectorAll(".expand-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            target.classList.toggle("hidden");
            btn.textContent = target.classList.contains("hidden") ? "▶" : "▼";
        });
    });
}