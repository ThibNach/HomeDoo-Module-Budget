const API_URL = "http://127.0.0.1:5000";

const VIEWS = {
    reports: {label: "Reports", isDefault: true},
    transactions: {label: "Transactions"},
    accounts: {label: "Accounts"},
    categories: {label: "Categories"},
};

let currentView = "reports";


export async function render() {
    currentView = "reports";
    
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
            <div class="budget-topbar">
                <div class="budget-burger">
                    <button id="budget-burger-btn" class="budget-burger-btn">☰</button>
                    <div id="budget-burger-dropdown" class="budget-burger-dropdown hidden">
                        ${Object.entries(VIEWS).map(([key, view]) =>
        `<a href="#" data-view="${key}">${view.label}</a>`
    ).join('')}
                    </div>
                </div>
            </div>
            <div id="budget-content"></div>
        </div>
    `;

    const burgerBtn = document.getElementById("budget-burger-btn");
    const dropdown = document.getElementById("budget-burger-dropdown");

    burgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("hidden");
    });

    document.querySelectorAll("#budget-burger-dropdown a").forEach(link => {
        link.addEventListener("click", async (e) => {
            e.preventDefault();
            dropdown.classList.add("hidden");
            await switchView(link.dataset.view);
        });
    });

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && e.target !== burgerBtn) {
            dropdown.classList.add("hidden");
        }
    });

    await switchView(currentView);
}


async function switchView(viewName) {
    currentView = viewName;

    const content = document.getElementById("budget-content");

    const viewModule = await import(`${API_URL}/addons/budget/js/${viewName}_view.js`);
    await viewModule.render(content);
}