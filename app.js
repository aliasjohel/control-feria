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
  // Productos (izquierda)
  name: document.querySelector("#pName"),
  code: document.querySelector("#pCode"),
  price: document.querySelector("#pPrice"),
  stock: document.querySelector("#pStock"),
  addBtn: document.querySelector("#add-product"),

  // Búsquedas (izquierda)
searchName: document.querySelector("#search"),
searchCode: document.querySelector("#searchCode"),
  // Tabla (izquierda)
  tableBody: document.querySelector("#products-body"),

  // Venta (derecha)
  saleProduct: document.querySelector("#sale-product"),
  saleQty: document.querySelector("#sale-qty"),
  sellBtn: document.querySelector("#sell-btn"),
undoBtn: document.querySelector("#undoBtn"),
  // Ingreso mercadería (derecha)
  restockProduct: document.querySelector("#restock-product"),
  restockQty: document.querySelector("#restock-qty"),
  restockForm: document.querySelector("#restockForm"),
  // Otros
  lowStockInput: document.querySelector("#lowStock"),
  
  newDayBtn: document.querySelector("#new-day"),
  clearAllBtn: document.querySelector("#clear-all"),
  exportBtn: document.querySelector("#btnExportCSV"),
};
// ===== Render Productos =====
function renderProducts() {
  el.tableBody.innerHTML = "";

  products.forEach((p, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.code || ""}</td>
      <td>${p.price}</td>
      <td>${p.stock}</td>
      <td>
        <button data-del="${i}">Eliminar</button>
      </td>
    `;

    el.tableBody.appendChild(tr);
  });

  updateSelects();
  saveJSON("products", products);
}

// ===== Selects =====
function updateSelects() {
  const options = products
    .map((p, i) => `<option value="${i}">${p.name}</option>`)
    .join("");

  el.saleProduct.innerHTML = options;
  el.ingressProduct.innerHTML = options;
}

// ===== Agregar Producto =====
el.addBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const name = el.name.value.trim();
  const code = el.code.value.trim();
  const price = Number(el.price.value);
  const stock = Number(el.stock.value);

  if (!name || price <= 0 || stock < 0) return;

  products.push({ name, code, price, stock });

  el.name.value = "";
  el.code.value = "";
  el.price.value = "";
  el.stock.value = "";

  renderProducts();
});

// ===== Eliminar Producto =====
el.tableBody.addEventListener("click", e => {
  if (e.target.dataset.del !== undefined) {
    const i = Number(e.target.dataset.del);
    products.splice(i, 1);
    renderProducts();
  }
});

// ===== Venta =====
el.sellBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const idx = Number(el.saleProduct.value);
  const qty = Number(el.saleQty.value);

  if (!products[idx] || qty <= 0) return;
  if (products[idx].stock < qty) return alert("Stock insuficiente");

  products[idx].stock -= qty;

  const sale = {
    time: new Date().toLocaleTimeString(),
    product: products[idx].name,
    qty,
    total: qty * products[idx].price
  };

  salesToday.push(sale);
  lastSale = { idx, qty };

  saveJSON("salesToday", salesToday);

  renderProducts();
  renderSales();
});

// ===== Render Ventas =====
function renderSales() {
  el.salesBody.innerHTML = "";

  salesToday.forEach(s => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.time}</td>
      <td>${s.product}</td>
      <td>${s.qty}</td>
      <td>${s.total}</td>
    `;

    el.salesBody.appendChild(tr);
  });
}

// ===== Deshacer venta =====
el.undoBtn.addEventListener("click", () => {
  if (!lastSale) return;

  products[lastSale.idx].stock += lastSale.qty;
  salesToday.pop();

  saveJSON("salesToday", salesToday);

  renderProducts();
  renderSales();

  lastSale = null;
});

// ===== Ingreso de mercadería =====
el.ingressBtn.addEventListener("click", () => {
  const idx = Number(el.ingressProduct.value);
  const qty = Number(el.ingressQty.value);

  if (!products[idx] || qty <= 0) return;

  products[idx].stock += qty;

  renderProducts();
});

// ===== Nuevo día =====
el.newDayBtn.addEventListener("click", () => {
  salesToday = [];
  saveJSON("salesToday", salesToday);
  renderSales();
});

// ===== Borrar todo =====
el.clearBtn.addEventListener("click", () => {
  if (!confirm("Borrar todo?")) return;

  products = [];
  salesToday = [];

  saveJSON("products", products);
  saveJSON("salesToday", salesToday);

  renderProducts();
  renderSales();
});

// ===== Exportar CSV =====
function exportSalesCSV() {
  const header = ["Hora", "Producto", "Cantidad", "Total"];

  const rows = salesToday.map(s => [
    s.time,
    s.product,
    s.qty,
    s.total
  ]);

  const csv = [header, ...rows]
    .map(r => r.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(","))
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
renderProducts();
renderSales();