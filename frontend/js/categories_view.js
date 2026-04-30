const API_URL = "http://127.0.0.1:5000";
import { serviceRegistry } from "http://127.0.0.1:3000/js/service_registry.js";


export async function render(container) {
    container.innerHTML = `
        <div class="budget-header">
            <h2>Categories</h2>
            <button id="add-category-btn" class="budget-btn-primary">+ Add Category</button>
        </div>
        <div id="categories-list"></div>

        <div id="category-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="category-modal-title">Add Category</h3>
                <label>Name</label>
                <input type="text" id="category-name" />
                <label>Kind</label>
                <select id="category-kind">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                </select>
                <label>Color</label>
                <input type="color" id="category-color" value="#888888" />
                <div class="modal-actions">
                    <button id="category-cancel" class="budget-btn-secondary">Cancel</button>
                    <button id="category-confirm" class="budget-btn-primary">Save</button>
                </div>
            </div>
        </div>
    `;

    await loadCategories();

    document.getElementById("add-category-btn").addEventListener("click", () => openModal());
    document.getElementById("category-cancel").addEventListener("click", closeModal);
    document.getElementById("category-confirm").addEventListener("click", saveCategory);
}


async function loadCategories() {
    const auth = serviceRegistry.get("auth");
    const response = await fetch(`${API_URL}/budget/categories`, {
        headers: auth.authHeaders()
    });
    const categories = await response.json();

    const list = document.getElementById("categories-list");
    list.innerHTML = "";

    if (categories.length === 0) {
        list.innerHTML = `<div class="budget-empty">No categories yet. Create your first one!</div>`;
        return;
    }

    categories.forEach(cat => {
        const item = document.createElement("div");
        item.className = "budget-item";
        item.innerHTML = `
            <div class="budget-item-info">
                <span class="category-color-dot" style="background: ${cat.color}"></span>
                <strong>${cat.name}</strong>
                <span class="category-kind-badge ${cat.kind}">${cat.kind}</span>
            </div>
            <div class="budget-item-actions">
                <button class="budget-btn-secondary edit-btn" data-id="${cat.id}">Edit</button>
                <button class="budget-btn-danger delete-btn" data-id="${cat.id}">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cat = categories.find(c => c.id === parseInt(btn.dataset.id));
            openModal(cat);
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteCategory(btn.dataset.id));
    });
}


let editingCategoryId = null;

function openModal(cat = null) {
    editingCategoryId = cat ? cat.id : null;
    document.getElementById("category-modal-title").textContent = cat ? "Edit Category" : "Add Category";
    document.getElementById("category-name").value = cat ? cat.name : "";
    document.getElementById("category-kind").value = cat ? cat.kind : "expense";
    document.getElementById("category-color").value = cat ? cat.color : "#888888";
    document.getElementById("category-modal").classList.remove("hidden");
}


function closeModal() {
    document.getElementById("category-modal").classList.add("hidden");
    editingCategoryId = null;
}


async function saveCategory() {
    const name = document.getElementById("category-name").value.trim();
    const kind = document.getElementById("category-kind").value;
    const color = document.getElementById("category-color").value;

    if (!name) return alert("Name is required");

    const auth = serviceRegistry.get("auth");
    const headers = { "Content-Type": "application/json", ...auth.authHeaders() };

    try {
        let response;
        if (editingCategoryId) {
            response = await fetch(`${API_URL}/budget/categories/${editingCategoryId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ name, kind, color })
            });
        } else {
            response = await fetch(`${API_URL}/budget/categories`, {
                method: "POST",
                headers,
                body: JSON.stringify({ name, kind, color })
            });
        }
        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadCategories();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}


async function deleteCategory(id) {
    if (!confirm("Delete this category?")) return;

    const auth = serviceRegistry.get("auth");
    try {
        const response = await fetch(`${API_URL}/budget/categories/${id}`, {
            method: "DELETE",
            headers: auth.authHeaders()
        });
        const data = await response.json();

        if (data.success) {
            await loadCategories();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}
