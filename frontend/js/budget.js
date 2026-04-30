const API_URL = "http://127.0.0.1:5000";

let currentTab = "transactions";


export async function render() {
    if (!document.getElementById("budget-css")) {
        const link = document.createElement("link");
        link.id = "budget-css";
        link.rel = "stylesheet";
        link.href = `${API_URL}/addons/budget/styles/budget.css`;
        document.head.appendChild(link);
    }

    const app = document.getElementById("app");
    app.innerHTML = `
        <div class="budget-container">
            <div class="budget-tabs">
                <button class="budget-tab" data-tab="transactions">Transactions</button>
                <button class="budget-tab" data-tab="accounts">Accounts</button>
                <button class="budget-tab" data-tab="categories">Categories</button>
            </div>
            <div id="budget-content"></div>
        </div>
    `;

    document.querySelectorAll(".budget-tab").forEach(tab => {
        tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    await switchTab(currentTab);
}


async function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll(".budget-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    const content = document.getElementById("budget-content");

    const viewModule = await import(`${API_URL}/addons/budget/js/${tabName}_view.js`);
    await viewModule.render(content);
}
