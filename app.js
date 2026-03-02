const $ = (id) => document.getElementById(id);

const KEY_PRODUCTS = "feria_products_v2";
const KEY_DAY = "feria_day_v2";

let products = loadJSON(KEY_PRODUCTS, []);
let day = loadJSON(KEY_DAY, null);

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
function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function showMsg(text) {
  const el = $("msg");
  el.textContent = text;
  el.classList.remove("d-none");
  setTimeout(() => el.classList.add("d-none"), 2600);
}

function getDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return ${y}-${m}-${d};
}

function ensureDay() {
  const todayKey = getDayKey();
  if (!day || day.dayKey !== todayKey) {
    day = {
      dayKey: todayKey,
      sales: [], // {timeISO, productId, name, qty, total}
      soldTotal: 0,
      soldItems: 0,
    };
    saveJSON(KEY_DAY, day);
  }
  $("todayLabel").textContent = new Date().toLocaleDateString("es-AR");
}

function lowStockThreshold() {
  const v = Number($("lowStock").value);
  return Number.isFinite(v) ? v : 3;
}

// ---------- Render ----------
function renderSummary() {
  $("soldItems").textContent = String(day.soldItems || 0);
  $("soldTotal").textContent = money(day.soldTotal || 0);
}

function renderProducts() {
  const tbody = $("productsTbody");
  const qName = $("search").value.trim().toLowerCase();
  const qCode = $("searchCode").value.trim().toLowerCase();
  const low = lowStockThreshold();

  const filtered = products
    .filter(p => {
      const okName = p.name.toLowerCase().includes(qName);
      const okCode = qCode ? String(p.code || "").toLowerCase().includes(qCode) : true;
      return okName && okCode;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  tbody.innerHTML = filtered.map(p => {
    const isLow = Number(p.stock) <= low;
    return `
      <tr class="${isLow ? "low-stock" : ""}">
        <td>${escapeHtml(p.name)}</td>
        <td class="text-secondary">${escapeHtml(p.code || "")}</td>
        <td class="text-end">${money(p.price)}</td>
        <td class="text-end fw-semibold">${p.stock}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-info" data-edit="${p.id}">Editar</button>
          <button class="btn btn-sm btn-outline-light ms-1" data-add="${p.id}">+Stock</button>
          <button class="btn btn-sm btn-outline-danger ms-1" data-del="${p.id}">Borrar</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => deleteProduct(btn.dataset.del)));
  tbody.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => quickEdit(btn.dataset.edit)));
  tbody.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => quickAddStock(btn.dataset.add)));

  renderProductSelects();
}

function renderProductSelects() {
  const options = products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => <option value="${p.id}">${escapeHtml(p.name)} — ${money(p.price)} (stock: ${p.stock})</option>)
    .join("");

  $("saleProduct").innerHTML = options || <option value="">No hay productos</option>;
  $("restockProduct").innerHTML = options || <option value="">No hay productos</option>;

  $("saleProduct").disabled = products.length === 0;
  $("restockProduct").disabled = products.length === 0;
}

function renderSales() {
  const tbody = $("salesTbody");
  const list = day.sales.slice().reverse();
  tbody.innerHTML = list.map(s => `
    <tr>
      <td class="text-secondary">${new Date(s.timeISO).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${escapeHtml(s.name)}</td>
      <td class="text-end">${s.qty}</td>
      <td class="text-end">${money(s.total)}</td>
    </tr>
  ).join("") || `<tr><td colspan="4" class="text-secondary">Todavía no hay ventas hoy.</td></tr>;
}

// ---------- Productos ----------
function addProduct(name, code, price, stock) {
  const cleanCode = String(code || "").trim();

  // Evitar códigos duplicados si el usuario los usa
  if (cleanCode) {
    const exists = products.some(p => String(p.code || "").trim().toLowerCase() === cleanCode.toLowerCase());
    if (exists) return showMsg("Ese código ya existe. Usá otro.");
  }

  products.push({
    id: uid(),
    name: name.trim(),
    code: cleanCode || "",
    price: Number(price),
    stock: Number(stock),
  });

  saveJSON(KEY_PRODUCTS, products);
  renderProducts();
}

function deleteProduct(id) {
  products = products.filter(p => p.id !== id);
  saveJSON(KEY_PRODUCTS, products);
  renderProducts();
}

function quickEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const newName = prompt("Nombre del producto:", p.name);
  if (newName === null) return;

  const newCode = prompt("Código (opcional):", p.code || "");
  if (newCode === null) return;

  const newPrice = prompt("Precio:", String(p.price));
  if (newPrice === null) return;

  const newStock = prompt("Stock:", String(p.stock));
  if (newStock === null) return;

  const priceNum = Number(newPrice);
  const stockNum = Number(newStock);

  const cleanCode = String(newCode || "").trim();
  if (cleanCode) {
    const dup = products.some(x => x.id !== p.id && String(x.code || "").trim().toLowerCase() === cleanCode.toLowerCase());
    if (dup) return showMsg("Ese código ya existe. Usá otro.");
  }

  if (!newName.trim()) return showMsg("Nombre inválido.");
  if (Number.isNaN(priceNum) || priceNum < 0) return showMsg("Precio inválido.");
  if (!Number.isInteger(stockNum) || stockNum < 0) return showMsg("Stock inválido.");

  p.name = newName.trim();
  p.code = cleanCode || "";
  p.price = priceNum;
  p.stock = stockNum;

  saveJSON(KEY_PRODUCTS, products);
  renderProducts();
}

function quickAddStock(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const add = prompt(Sumar stock a "${p.name}" (actual: ${p.stock}), "1");
  if (add === null) return;
  const addNum = Number(add);
  if (!Number.isInteger(addNum) || addNum <= 0) return showMsg("Cantidad inválida.");
  p.stock += addNum;
  saveJSON(KEY_PRODUCTS, products);
  renderProducts();
}

// ---------- Ventas / Stock ----------
function registerSale(productId, qty) {
  const p = products.find(x => x.id === productId);
  if (!p) return showMsg("Producto no encontrado.");
  if (!Number.isInteger(qty) || qty <= 0) return showMsg("Cantidad inválida.");
  if (p.stock < qty) return showMsg("No hay stock suficiente.");

  p.stock -= qty;
  const total = p.price * qty;

  day.sales.push({
    timeISO: new Date().toISOString(),
    productId: p.id,
    name: p.name,
    qty,
    total,
  });

  day.soldItems += qty;
  day.soldTotal += total;

  saveJSON(KEY_PRODUCTS, products);
  saveJSON(KEY_DAY, day);

  renderProducts();
  renderSummary();
  renderSales();
}

function restock(productId, qty) {
  const p = products.find(x => x.id === productId);
  if (!p) return showMsg("Producto no encontrado.");
  if (!Number.isInteger(qty) || qty <= 0) return showMsg("Cantidad inválida.");
  p.stock += qty;

  saveJSON(KEY_PRODUCTS, products);
  renderProducts();
  showMsg("Stock actualizado ✅");
}

function undoLastSale() {
  if (!day.sales.length) return showMsg("No hay ventas para deshacer.");

  const last = day.sales[day.sales.length - 1];
  const p = products.find(x => x.id === last.productId);

  // devolver stock si existe el producto
  if (p) p.stock += last.qty;

  // revertir totales del día
  day.soldItems = Math.max(0, (day.soldItems || 0) - last.qty);
  day.soldTotal = Math.max(0, (day.soldTotal || 0) - last.total);

  // quitar venta
  day.sales.pop();

  saveJSON(KEY_PRODUCTS, products);
  saveJSON(KEY_DAY, day);

  renderProducts();
  renderSummary();
  renderSales();
  showMsg("Última venta deshecha ✅");
}

// ---------- Día / Reset / CSV ----------
function newDay() {
  const ok = confirm("¿Arrancar un nuevo día? (Reinicia ventas del día y resumen, NO borra productos)");
  if (!ok) return;
  day = {
    dayKey: getDayKey(),
    sales: [],
    soldTotal: 0,
    soldItems: 0,
  };
  saveJSON(KEY_DAY, day);
  ensureDay();
  renderSummary();
  renderSales();
}

function resetAll() {
  const ok = confirm("Esto borra TODO (productos y ventas guardadas). ¿Seguro?");
  if (!ok) return;
  localStorage.removeItem(KEY_PRODUCTS);
  localStorage.removeItem(KEY_DAY);
  products = [];
  day = null;
  ensureDay();
  renderProducts();
  renderSummary();
  renderSales();
}

function exportSalesCSV() {
  if (!day.sales.length) return showMsg("No hay ventas para exportar.");

  const header = ["fecha", "hora", "producto", "codigo", "cantidad", "precio_unitario", "total"];
  const rows = day.sales.map(s => {
    const d = new Date(s.timeISO);
    const p = products.find(x => x.id === s.productId);
    const code = p ? (p.code || "") : "";
    const priceUnit = s.qty ? (s.total / s.qty) : 0;
    return [
      d.toLocaleDateString("es-AR"),
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      s.name,
      code,
      s.qty,
      priceUnit,
      s.total
    ];
  });

  const csv = [header, ...rows]
    .map(r => r.map(cell => "${String(cell).replaceAll('"', '""')}").join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = ventas_${day.dayKey}.csv;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Events ----------
$("productForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("pName").value;
  const code = $("pCode").value;
  const price = $("pPrice").value;
  const stock = $("pStock").value;

  const priceNum = Number(price);
  const stockNum = Number(stock);

  if (!name.trim()) return;
  if (Number.isNaN(priceNum) || priceNum < 0) return showMsg("Precio inválido.");
  if (!Number.isInteger(stockNum) || stockNum < 0) return showMsg("Stock inválido.");

  addProduct(name, code, priceNum, stockNum);
  e.target.reset();
  $("pName").focus();
});

$("search").addEventListener("input", renderProducts);
$("searchCode").addEventListener("input", renderProducts);

// Si usan lector, normalmente manda "Enter" al final:
$("searchCode").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.preventDefault();
});

$("saleForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = $("saleProduct").value;
  const qty = Number($("saleQty").value);

  if (!productId) return showMsg("Cargá productos primero.");
  if (!Number.isInteger(qty) || qty <= 0) return showMsg("Cantidad inválida.");

  registerSale(productId, qty);
  $("saleQty").value = 1;
});

$("restockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = $("restockProduct").value;
  const qty = Number($("restockQty").value);

  if (!productId) return showMsg("Cargá productos primero.");
  if (!Number.isInteger(qty) || qty <= 0) return showMsg("Cantidad inválida.");

  restock(productId, qty);
  $("restockQty").value = 1;
});

$("btnUndo").addEventListener("click", undoLastSale);
$("btnNewDay").addEventListener("click", newDay);
$("btnResetAll").addEventListener("click", resetAll);
$("btnExportCSV").addEventListener("click", exportSalesCSV);

$("lowStock").addEventListener("input", renderProducts);

// Init
ensureDay();
renderProducts();
renderSummary();
renderSales();