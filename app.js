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
let salesHistory = loadJSON("salesHistory", {});
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
  saleProductInput: document.querySelector("#sale-product-input"),
  saleProductsList: document.querySelector("#sale-products-list"),
  saleQty: document.querySelector("#sale-qty"),
  saleForm: document.querySelector("#saleForm"),
  undoBtn: document.querySelector("#undoBtn"),

  // Ingreso mercadería
  restockProductInput: document.querySelector("#restock-product-input"),
  restockProductsList: document.querySelector("#restock-products-list"),
  restockQty: document.querySelector("#restock-qty"),
  restockForm: document.querySelector("#restockForm"),

  // Ventas de hoy
  salesTbody: document.querySelector("#salesTbody"),

  // Resumen arriba
  todayLabel: document.querySelector("#todayLabel"),
  soldItems: document.querySelector("#soldItems"),
  soldTotal: document.querySelector("#soldTotal"),
  topProduct: document.querySelector("#topProduct"),
  stockTotal: document.querySelector("#stockTotal"),

  // Historial
  historyDate: document.querySelector("#historyDate"),
  loadHistoryBtn: document.querySelector("#btnLoadHistory"),
  todayHistoryBtn: document.querySelector("#btnTodayHistory"),
  historyLabel: document.querySelector("#historyLabel"),
  historyItems: document.querySelector("#historyItems"),
  historyTotal: document.querySelector("#historyTotal"),
  historyTopProduct: document.querySelector("#historyTopProduct"),
  historyTbody: document.querySelector("#historyTbody"),

  // Otros
  lowStockInput: document.querySelector("#lowStock"),
  newDayBtn: document.querySelector("#btnNewDay"),
  clearAllBtn: document.querySelector("#btnResetAll"),
  exportBtn: document.querySelector("#btnExportCSV"),
  whatsappBtn: document.querySelector("#btnWhatsApp"),
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

// ===== Fecha =====
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatDateLabel(dateKey) {
  if (!dateKey) return "—";

  const [year, month, day] = dateKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ===== Texto visible para sugerencias =====
function getProductDisplayText(product) {
  const codePart = product.code ? ` | Código: ${product.code}` : "";
  return `${product.name}${codePart}`;
}

// ===== Buscar producto por texto escrito =====
function findProductIndexByInputValue(inputValue) {
  const q = normalize(inputValue.trim());
  if (!q) return -1;

  // Coincidencia exacta con el texto visible
  const exactIndex = products.findIndex((p) => normalize(getProductDisplayText(p)) === q);
  if (exactIndex !== -1) return exactIndex;

  // Coincidencia exacta por nombre
  const exactNameIndex = products.findIndex((p) => normalize(p.name) === q);
  if (exactNameIndex !== -1) return exactNameIndex;

  // Coincidencia exacta por código
  const exactCodeIndex = products.findIndex((p) => normalize(p.code) === q);
  if (exactCodeIndex !== -1) return exactCodeIndex;

  return -1;
}

// ===== Estadísticas =====
function getTopProduct(salesArray) {
  if (!salesArray.length) return "—";

  const map = {};

  salesArray.forEach((s) => {
    const name = s.product || "Sin nombre";
    map[name] = (map[name] || 0) + Number(s.qty || 0);
  });

  let topName = "—";
  let topQty = 0;

  for (const [name, qty] of Object.entries(map)) {
    if (qty > topQty) {
      topName = name;
      topQty = qty;
    }
  }

  return `${topName} (${topQty})`;
}

// ===== Datalist =====
function updateProductLists() {
  const saleQuery = normalize(el.saleProductInput.value);
  const restockQuery = normalize(el.restockProductInput.value);

  const saleFiltered = products.filter((p) => {
    if (!saleQuery) return true;
    return (
      normalize(p.name).includes(saleQuery) ||
      normalize(p.code).includes(saleQuery)
    );
  });

  const restockFiltered = products.filter((p) => {
    if (!restockQuery) return true;
    return (
      normalize(p.name).includes(restockQuery) ||
      normalize(p.code).includes(restockQuery)
    );
  });

  el.saleProductsList.innerHTML = saleFiltered
    .map((p) => `<option value="${getProductDisplayText(p)}"></option>`)
    .join("");

  el.restockProductsList.innerHTML = restockFiltered
    .map((p) => `<option value="${getProductDisplayText(p)}"></option>`)
    .join("");
}

// ===== Resumen =====
function renderSummary() {
  const todayKey = getTodayKey();

  el.todayLabel.textContent = formatDateLabel(todayKey);

  const items = salesToday.reduce((acc, s) => acc + Number(s.qty || 0), 0);
  const total = salesToday.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const stockValue = products.reduce((acc, p) => {
    return acc + Number(p.price || 0) * Number(p.stock || 0);
  }, 0);

  el.soldItems.textContent = String(items);
  el.soldTotal.textContent = formatCurrency(total);
  el.topProduct.textContent = getTopProduct(salesToday);
  el.stockTotal.textContent = formatCurrency(stockValue);
}

// ===== Render Productos =====
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
      <td class="text-end">${formatCurrency(p.price)}</td>
      <td class="text-end fw-semibold">${p.stock}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-del="${i}">Eliminar</button>
      </td>
    `;

    el.tableBody.appendChild(tr);
  });

  updateProductLists();
  renderSummary();
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
      <td class="text-end">${formatCurrency(s.total)}</td>
    `;
    el.salesTbody.appendChild(tr);
  });

  renderSummary();
}

// ===== Render Historial =====
function renderHistoryByDate(dateKey) {
  el.historyTbody.innerHTML = "";

  const list = dateKey === getTodayKey()
    ? salesToday
    : (salesHistory[dateKey] || []);

  el.historyLabel.textContent = formatDateLabel(dateKey);

  const items = list.reduce((acc, s) => acc + Number(s.qty || 0), 0);
  const total = list.reduce((acc, s) => acc + Number(s.total || 0), 0);

  el.historyItems.textContent = String(items);
  el.historyTotal.textContent = formatCurrency(total);
  el.historyTopProduct.textContent = getTopProduct(list);

  list.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.time}</td>
      <td>${s.product}</td>
      <td class="text-end">${s.qty}</td>
      <td class="text-end">${formatCurrency(s.total)}</td>
    `;
    el.historyTbody.appendChild(tr);
  });
}

// ===== Guardar día en historial =====
function saveCurrentDayToHistory() {
  const todayKey = getTodayKey();

  if (!salesToday.length) return;

  salesHistory[todayKey] = [...salesToday];
  saveJSON("salesHistory", salesHistory);
}

// ===== Listeners filtro =====
el.searchName.addEventListener("input", applyFiltersAndRender);
el.searchCode.addEventListener("input", applyFiltersAndRender);
el.lowStockInput.addEventListener("input", applyFiltersAndRender);
el.saleProductInput.addEventListener("input", updateProductLists);
el.restockProductInput.addEventListener("input", updateProductLists);

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

  const idx = findProductIndexByInputValue(el.saleProductInput.value);
  const qty = Number(el.saleQty.value);

  if (idx === -1 || !products[idx]) {
    alert("Elegí un producto válido de la lista.");
    return;
  }

  if (qty <= 0) return;

  if (products[idx].stock < qty) {
    alert("Stock insuficiente");
    return;
  }

  products[idx].stock -= qty;

  const sale = {
    time: new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    product: products[idx].name,
    qty,
    total: qty * products[idx].price,
  };

  salesToday.push(sale);
  lastSale = { idx, qty };

  saveJSON("salesToday", salesToday);

  el.saleQty.value = 1;
  el.saleProductInput.value = "";

  applyFiltersAndRender();
  renderSales();
  renderHistoryByDate(getTodayKey());
});

// ===== Deshacer última venta =====
el.undoBtn.addEventListener("click", () => {
  if (!lastSale || salesToday.length === 0) return;

  products[lastSale.idx].stock += lastSale.qty;
  salesToday.pop();

  saveJSON("salesToday", salesToday);

  applyFiltersAndRender();
  renderSales();
  renderHistoryByDate(getTodayKey());

  lastSale = null;
});

// ===== Ingreso de mercadería =====
el.restockForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const idx = findProductIndexByInputValue(el.restockProductInput.value);
  const qty = Number(el.restockQty.value);

  if (idx === -1 || !products[idx]) {
    alert("Elegí un producto válido de la lista.");
    return;
  }

  if (qty <= 0) return;

  products[idx].stock += qty;

  el.restockQty.value = 1;
  el.restockProductInput.value = "";

  applyFiltersAndRender();
});

// ===== Nuevo día =====
el.newDayBtn.addEventListener("click", () => {
  if (salesToday.length) {
    saveCurrentDayToHistory();
  }

  salesToday = [];
  lastSale = null;

  saveJSON("salesToday", salesToday);

  renderSales();
  renderHistoryByDate(getTodayKey());
});

// ===== Borrar todo =====
el.clearAllBtn.addEventListener("click", () => {
  if (!confirm("Borrar todo?")) return;

  products = [];
  salesToday = [];
  salesHistory = {};
  lastSale = null;

  saveJSON("products", products);
  saveJSON("salesToday", salesToday);
  saveJSON("salesHistory", salesHistory);

  el.saleProductInput.value = "";
  el.restockProductInput.value = "";

  applyFiltersAndRender();
  renderSales();
  renderHistoryByDate(getTodayKey());
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

// ===== WhatsApp =====
function sendSalesToWhatsApp() {
  if (!salesToday.length) {
    alert("No hay ventas cargadas hoy para enviar.");
    return;
  }

  const fecha = formatDateLabel(getTodayKey());
  const items = salesToday.reduce((acc, s) => acc + Number(s.qty || 0), 0);
  const total = salesToday.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const top = getTopProduct(salesToday);

  const detalle = salesToday
    .map((s) => {
      return `• ${s.product}\n  Cant: ${s.qty} | Total: ${formatCurrency(s.total)}`;
    })
    .join("\n\n");

  const mensaje =
`🧾 *CIERRE DEL DÍA*
📅 ${fecha}

------------------------------
${detalle}
------------------------------

📦 *Items vendidos:* ${items}
🏆 *Más vendido:* ${top}
💰 *Total vendido:* ${formatCurrency(total)}`;

  const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.location.href = url;
}

// ===== Historial botones =====
el.loadHistoryBtn.addEventListener("click", () => {
  const dateKey = el.historyDate.value;
  if (!dateKey) {
    alert("Elegí una fecha.");
    return;
  }

  renderHistoryByDate(dateKey);
});

el.todayHistoryBtn.addEventListener("click", () => {
  const todayKey = getTodayKey();
  el.historyDate.value = todayKey;
  renderHistoryByDate(todayKey);
});

// ===== Listeners extra =====
el.exportBtn.addEventListener("click", exportSalesCSV);
el.whatsappBtn.addEventListener("click", sendSalesToWhatsApp);

// ===== Inicializar =====
applyFiltersAndRender();
renderSales();

const todayKey = getTodayKey();
if (el.historyDate) el.historyDate.value = todayKey;
renderHistoryByDate(todayKey);