// assets/orders.js
(() => {
  const ORDERS_KEY = "flyloop_orders";
  const list = document.getElementById("ordersList");
  if (!list) return;

  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");

  // show only flight orders (for now)
  const flights = orders.filter(o => (o.orderType || o.type || "flight") === "flight");

  if (!flights.length) {
    list.innerHTML = `<div class="pill">No booked flights yet.</div>`;
    return;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  list.innerHTML = flights.map(f => {
    const route = `${esc(f.origin || "—")} → ${esc(f.destination || "—")}`;
    const date  = esc(f.departDate || "—");
    const time1 = esc(f.departTime || "—");
    const time2 = esc(f.arriveTime || "—");
    const cabin = esc(f.cabin || "ECONOMY");
    const pax   = esc(f.adults || 1);
    const price = esc(f.priceText || (typeof f.price === "number" ? `CAD ${f.price.toFixed(2)}` : "CAD —"));
    const id    = esc(f.id || f.orderId || "—");

    return `
      <div class="hotel-item">
        <div class="hotel-top">
          <div>
            <div class="hotel-name">${route}</div>
            <div class="hotel-sub">${date} • ${time1} → ${time2} • ${cabin} • ${pax} pax</div>
          </div>
          <div class="pill">${price}</div>
        </div>

        <div class="hotel-tags">
          <span class="hotel-tag">Order: ${id}</span>
          <span class="hotel-tag">${esc(f.status || "Booked")}</span>
        </div>

        <div class="hotel-actions">
          <button class="btn-outline" type="button" data-order-id="${id}">View</button>
          <button class="btn-outline" type="button" data-cancel-id="${id}">Cancel (demo)</button>
        </div>
      </div>
    `;
  }).join("");

  // Demo actions
  list.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-order-id]");
    const cancelBtn = e.target.closest("[data-cancel-id]");

    if (viewBtn) {
      const id = viewBtn.getAttribute("data-order-id");
      alert("Demo order view: " + id);
    }

    if (cancelBtn) {
      const id = cancelBtn.getAttribute("data-cancel-id");
      alert("Demo cancel (not implemented): " + id);
    }
  });
})();
