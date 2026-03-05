console.log("✅ app.js cargó");

// ===== Utilidades para LocalStorage =====
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== Estado =====
let products = loadJSON("products", []);
let salesToday = loadJSON("salesToday", []);
let lastSale = null;

// ===== Elementos =====
const el = {
  // Productos
  name: document.querySelector("#pName"),
  code: document.querySelector("#pCode"),
  price: document.querySelector("#pPrice"),
  stock: document.querySelector("#pStock"),
  addBtn: document.querySelector("#add-product"),

  // Búsquedas
  searchName: document.querySelector("#search"),
  searchCode: document.querySelector("#searchCode"),

  // Tabla productos
  tableBody: document.querySelector("#products-body"),

  // Venta
  saleProduct: document.querySelector("#sale-product"),
  saleQty: document.querySelector("#sale-qty"),
  saleForm: document.querySelector("#saleForm"),
  undoBtn: document.querySelector("#undoBtn"),

  // Ingreso mercadería
  restockProduct: document.querySelector("#restock-product"),
  restockQty: document.querySelector("#restock-qty"),
  restockForm: document.querySelector("#restockForm"),

  // Ventas de hoy
  salesTbody: document.querySelector("#salesTbody"),

  // Resumen arriba
  todayLabel: document.querySelector("#todayLabel"),
  soldItems: document.querySelector("#soldItems"),
  soldTotal: document.querySelector("#soldTotal"),

  // Otros
  lowStockInput: document.querySelector("#lowStock"),
  newDayBtn: document.querySelector("#btnNewDay"),
  clearAllBtn: document.querySelector("#btnResetAll"),
  exportBtn: document.querySelector("#btnExportCSV"),
};

// ===== Seguridad =====
for (const [k, v] of Object.entries(el)) {
  if (!v) console.warn("⚠️ Elemento no encontrado:", k);
}

// ===== Normalizar texto =====
function normalize(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ===== Selects =====
function updateSelects() {
  const options = products
    .map((p, i) => `<option value="${i}">${p.name}</option>`)
    .join("");

  el.saleProduct.innerHTML = options;
  el.restockProduct.innerHTML = options;
}

// ===== Resumen (Fecha / Items / Total) =====
function renderSummary() {
  const now = new Date();

  el.todayLabel.textContent = now.toLocaleDateString("es-AR", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const items = salesToday.reduce((acc, s) => acc + Number(s.qty || 0), 0);
  const total = salesToday.reduce((acc, s) => acc + Number(s.total || 0), 0);

  el.soldItems.textContent = String(items);
  el.soldTotal.textContent = total.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

// ===== Render Productos con filtro + stock bajo =====
function applyFiltersAndRender() {
  const qName = normalize(el.searchName.value);
  const qCode = normalize(el.searchCode.value);

  el.tableBody.innerHTML = "";

  const lowLimit = Number(el.lowStockInput.value ?? 0);

  products.forEach((p, i) => {
    const okName = !qName || normalize(p.name).includes(qName);
    const okCode = !qCode || normalize(p.code).includes(qCode);

    if (!okName || !okCode) return;

    const tr = document.createElement("tr");

    const isLow = Number(p.stock) <= lowLimit;
    if (isLow) tr.classList.add("table-danger");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.code || ""}</td>
      <td class="text-end">$${Number(p.price).toFixed(2)}</td>
      <td class="text-end fw-semibold">${p.stock}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-del="${i}">Eliminar</button>
      </td>
    `;

    el.tableBody.appendChild(tr);
  });

  updateSelects();
  saveJSON("products", products);
}

// ===== Render Ventas =====
function renderSales() {
  el.salesTbody.innerHTML = "";

  salesToday.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.time}</td>
      <td>${s.product}</td>
      <td class="text-end">${s.qty}</td>
      <td class="text-end">$${Number(s.total).toFixed(2)}</td>
    `;
    el.salesTbody.appendChild(tr);
  });

  renderSummary();
}

// ===== Listeners filtro =====
el.searchName.addEventListener("input", applyFiltersAndRender);
el.searchCode.addEventListener("input", applyFiltersAndRender);
el.lowStockInput.addEventListener("input", applyFiltersAndRender);

// ===== Agregar Producto =====
el.addBtn.addEventListener("click", (e) => {
  e.preventDefault();

  const name = el.name.value.trim();
  const code = el.code.value.trim();
  const price = Number(el.price.value);
  const stock = Number(el.stock.value);

  if (!name || !(price >= 0) || !(stock >= 0)) return;

  products.push({ name, code, price, stock });

  el.name.value = "";
  el.code.value = "";
  el.price.value = "";
  el.stock.value = "";

  applyFiltersAndRender();
});

// ===== Eliminar Producto =====
el.tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;

  const i = Number(btn.dataset.del);
  products.splice(i, 1);

  applyFiltersAndRender();
});

// ===== Venta =====
el.saleForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const idx = Number(el.saleProduct.value);
  const qty = Number(el.saleQty.value);

  if (!products[idx] || qty <= 0) return;

  if (products[idx].stock < qty) {
    alert("Stock insuficiente");
    return;
  }

  products[idx].stock -= qty;

  const sale = {
    time: new Date().toLocaleTimeString(),
    product: products[idx].name,
    qty,
    total: qty * products[idx].price,
  };

  salesToday.push(sale);
  lastSale = { idx, qty };

  saveJSON("salesToday", salesToday);

  applyFiltersAndRender();
  renderSales();
});

// ===== Deshacer última venta =====
el.undoBtn.addEventListener("click", () => {
  if (!lastSale || salesToday.length === 0) return;

  products[lastSale.idx].stock += lastSale.qty;
  salesToday.pop();

  saveJSON("salesToday", salesToday);

  applyFiltersAndRender();
  renderSales();

  lastSale = null;
});

// ===== Ingreso de mercadería =====
el.restockForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const idx = Number(el.restockProduct.value);
  const qty = Number(el.restockQty.value);

  if (!products[idx] || qty <= 0) return;

  products[idx].stock += qty;

  applyFiltersAndRender();
});

// ===== Nuevo día =====
el.newDayBtn.addEventListener("click", () => {
  salesToday = [];
  lastSale = null;

  saveJSON("salesToday", salesToday);

  renderSales();      // actualiza resumen también
});

// ===== Borrar todo =====
el.clearAllBtn.addEventListener("click", () => {
  if (!confirm("Borrar todo?")) return;

  products = [];
  salesToday = [];
  lastSale = null;

  saveJSON("products", products);
  saveJSON("salesToday", salesToday);

  applyFiltersAndRender();
  renderSales();
});

// ===== Exportar CSV =====
function exportSalesCSV() {
  const header = ["Hora", "Producto", "Cantidad", "Total"];

  const rows = salesToday.map((s) => [s.time, s.product, s.qty, s.total]);

  const csv = [header, ...rows]
    .map((r) =>
      r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ventas.csv";
  a.click();

  URL.revokeObjectURL(url);
}

el.exportBtn.addEventListener("click", exportSalesCSV);

// ===== Inicializar =====
applyFiltersAndRender();
renderSales();