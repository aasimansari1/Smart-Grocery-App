/* ==========================================================
   Smart Grocery App — script.js
   Handles: add / edit / delete / search / filter / chart /
            dark mode / localStorage persistence
   ========================================================== */

// ----- Storage keys -----
const STORAGE_KEY = "smartGroceryItems";
const THEME_KEY = "smartGroceryTheme";

// ----- App state -----
let items = loadItems();        // array of { id, name, price, qty, category }
let editingId = null;           // id of the item currently being edited (or null)
let chartInstance = null;       // Chart.js instance (so we can update/destroy it)

// ----- Category keyword map -----
// Used by detectCategory() to auto-tag each item.
// Keywords are lowercased and matched against the item name.
const CATEGORY_KEYWORDS = {
    Fruits: [
        "apple", "banana", "orange", "grape", "mango", "pineapple",
        "strawberry", "blueberry", "watermelon", "peach", "pear",
        "kiwi", "cherry", "lemon", "lime", "papaya", "guava", "fruit"
    ],
    Vegetables: [
        "carrot", "potato", "tomato", "onion", "broccoli", "spinach",
        "lettuce", "cabbage", "cucumber", "pepper", "garlic", "ginger",
        "corn", "pea", "bean", "celery", "pumpkin", "vegetable", "veggie"
    ],
    Dairy: [
        "milk", "cheese", "yogurt", "butter", "cream", "ghee",
        "curd", "paneer", "egg", "eggs"
    ],
    Snacks: [
        "chips", "biscuit", "cookie", "chocolate", "candy", "popcorn",
        "cracker", "wafer", "snack", "soda", "juice", "cola", "pepsi",
        "coke", "ice cream", "nuts"
    ]
};

// ----- DOM elements -----
const itemForm = document.getElementById("itemForm");
const itemNameInput = document.getElementById("itemName");
const itemPriceInput = document.getElementById("itemPrice");
const itemQtyInput = document.getElementById("itemQty");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formError = document.getElementById("formError");

const totalItemsEl = document.getElementById("totalItems");
const totalCostEl = document.getElementById("totalCost");
const totalCategoriesEl = document.getElementById("totalCategories");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const itemsTbody = document.getElementById("itemsTbody");
const emptyMsg = document.getElementById("emptyMsg");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

// ==========================================================
// Storage helpers
// ==========================================================
function loadItems() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Failed to load items:", e);
        return [];
    }
}

function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ==========================================================
// Category detection
// Matches lowercased item name against keyword lists.
// Returns the first matching category, otherwise "Others".
// ==========================================================
function detectCategory(name) {
    const lower = name.toLowerCase().trim();
    for (const category in CATEGORY_KEYWORDS) {
        const keywords = CATEGORY_KEYWORDS[category];
        for (const kw of keywords) {
            if (lower.includes(kw)) return category;
        }
    }
    return "Others";
}

// ==========================================================
// Add / Edit / Delete
// ==========================================================
itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    formError.textContent = "";

    // Read & validate inputs
    const name = itemNameInput.value.trim();
    const price = parseFloat(itemPriceInput.value);
    const qty = parseInt(itemQtyInput.value, 10);

    if (!name) {
        formError.textContent = "Please enter an item name.";
        return;
    }
    if (isNaN(price) || price < 0) {
        formError.textContent = "Please enter a valid price.";
        return;
    }
    if (isNaN(qty) || qty < 1) {
        formError.textContent = "Quantity must be at least 1.";
        return;
    }

    if (editingId) {
        // Update existing item
        const item = items.find((i) => i.id === editingId);
        if (item) {
            item.name = name;
            item.price = price;
            item.qty = qty;
            item.category = detectCategory(name);
        }
        exitEditMode();
    } else {
        // Add new item
        items.push({
            id: Date.now(),               // simple unique id
            name,
            price,
            qty,
            category: detectCategory(name)
        });
    }

    saveItems();
    itemForm.reset();
    itemQtyInput.value = 1;
    render();
});

function startEditMode(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    editingId = id;
    itemNameInput.value = item.name;
    itemPriceInput.value = item.price;
    itemQtyInput.value = item.qty;
    submitBtn.textContent = "Update";
    cancelEditBtn.classList.remove("hidden");
    itemNameInput.focus();
}

function exitEditMode() {
    editingId = null;
    submitBtn.textContent = "Add";
    cancelEditBtn.classList.add("hidden");
    itemForm.reset();
    itemQtyInput.value = 1;
}

cancelEditBtn.addEventListener("click", exitEditMode);

function deleteItem(id) {
    if (!confirm("Delete this item?")) return;
    items = items.filter((i) => i.id !== id);
    if (editingId === id) exitEditMode();
    saveItems();
    render();
}

// ==========================================================
// Filtering — combine search text + category filter
// ==========================================================
function getVisibleItems() {
    const search = searchInput.value.toLowerCase().trim();
    const cat = categoryFilter.value;

    return items.filter((item) => {
        const matchesSearch = !search || item.name.toLowerCase().includes(search);
        const matchesCat = cat === "all" || item.category === cat;
        return matchesSearch && matchesCat;
    });
}

searchInput.addEventListener("input", render);
categoryFilter.addEventListener("change", render);

// ==========================================================
// Rendering — table, stats, chart
// ==========================================================
function render() {
    renderTable();
    renderStats();
    renderChart();
}

function renderTable() {
    const visible = getVisibleItems();
    itemsTbody.innerHTML = "";

    if (visible.length === 0) {
        emptyMsg.classList.remove("hidden");
        emptyMsg.textContent = items.length === 0
            ? "No items yet. Add your first grocery item above!"
            : "No items match your search/filter.";
        return;
    }
    emptyMsg.classList.add("hidden");

    visible.forEach((item) => {
        const subtotal = (item.price * item.qty).toFixed(2);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(item.name)}</td>
            <td><span class="cat-badge cat-${item.category}">${item.category}</span></td>
            <td>$${item.price.toFixed(2)}</td>
            <td>${item.qty}</td>
            <td>$${subtotal}</td>
            <td>
                <button class="action-btn edit" data-id="${item.id}" data-action="edit">Edit</button>
                <button class="action-btn delete" data-id="${item.id}" data-action="delete">Delete</button>
            </td>
        `;
        itemsTbody.appendChild(tr);
    });
}

// Delegate edit/delete clicks instead of attaching N listeners
itemsTbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === "edit") startEditMode(id);
    else if (btn.dataset.action === "delete") deleteItem(id);
});

function renderStats() {
    // Stats reflect ALL items, not just filtered ones
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
    const totalCost = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const cats = new Set(items.map((i) => i.category));

    totalItemsEl.textContent = totalQty;
    totalCostEl.textContent = `$${totalCost.toFixed(2)}`;
    totalCategoriesEl.textContent = cats.size;
}

// ==========================================================
// Chart — pie chart of spending by category
// ==========================================================
function renderChart() {
    const ctx = document.getElementById("categoryChart");
    if (!ctx) return;

    // Aggregate spending per category
    const totals = {};
    items.forEach((item) => {
        totals[item.category] = (totals[item.category] || 0) + item.price * item.qty;
    });

    const labels = Object.keys(totals);
    const data = Object.values(totals);

    // Color per category — keep consistent with CSS badges
    const colorMap = {
        Fruits: "#f59e0b",
        Vegetables: "#10b981",
        Dairy: "#3b82f6",
        Snacks: "#ec4899",
        Others: "#6b7280"
    };
    const colors = labels.map((l) => colorMap[l] || "#999");

    // Destroy old chart so we can redraw cleanly
    if (chartInstance) chartInstance.destroy();

    if (labels.length === 0) {
        // Nothing to chart yet
        return;
    }

    const isDark = document.body.classList.contains("dark");

    chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: isDark ? "#1e293b" : "#fff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: isDark ? "#f1f5f9" : "#1f2937" }
                }
            }
        }
    });
}

// ==========================================================
// Dark mode
// ==========================================================
function applyTheme(theme) {
    if (theme === "dark") {
        document.body.classList.add("dark");
        themeIcon.textContent = "Light";
    } else {
        document.body.classList.remove("dark");
        themeIcon.textContent = "Dark";
    }
    // Re-render chart so legend/border colors match the new theme
    renderChart();
}

themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
});

// ==========================================================
// Utility — escape HTML to avoid injection from item names
// ==========================================================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ==========================================================
// Init
// ==========================================================
applyTheme(localStorage.getItem(THEME_KEY) || "light");
render();
