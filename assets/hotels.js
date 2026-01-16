// assets/hotels.js
(() => {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toISODateLocal(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m - 1), d);
    dt.setDate(dt.getDate() + days);
    return toISODateLocal(dt);
  }

  function showHotelStatus(msg, show = true) {
    const el = $("hotelStatus");
    if (!el) return;
    el.style.display = show ? "inline-flex" : "none";
    el.textContent = msg;
  }

  // Init dropdown + date guards
  (function initHotelsUX() {
    const cityInput = $("hotelCity");
    const cityList  = $("hotelCities");
    const checkIn   = $("hotelCheckin");
    const checkOut  = $("hotelCheckout");
    if (!cityInput || !cityList || !checkIn || !checkOut) return;

    // Fill cities from airports.js
    const AIRPORTS = window.AIRPORTS || [];
    const uniqueCities = Array.from(new Set(
      AIRPORTS.map(a => (a?.city ? String(a.city).trim() : "")).filter(Boolean)
    )).sort((a,b) => a.localeCompare(b));

    cityList.innerHTML = uniqueCities
      .map(c => `<option value="${c.replaceAll('"', "&quot;")}"></option>`)
      .join("");

    // Date restrictions
    const today = toISODateLocal();
    checkIn.min = today;

    if (!checkIn.value || checkIn.value < today) checkIn.value = today;

    function syncCheckoutMin() {
      const minCheckout = addDaysISO(checkIn.value, 1);
      checkOut.min = minCheckout;
      if (!checkOut.value || checkOut.value < minCheckout) checkOut.value = minCheckout;
    }

    checkIn.addEventListener("change", () => {
      if (checkIn.value < today) checkIn.value = today;
      syncCheckoutMin();
    });

    checkOut.addEventListener("change", () => {
      const minCheckout = addDaysISO(checkIn.value, 1);
      if (checkOut.value < minCheckout) checkOut.value = minCheckout;
    });

    syncCheckoutMin();
  })();

  function renderHotels(city) {
    const results = $("hotelsResults");
    if (!results) return;

    const c = (city || "").trim() || "Your city";
    results.innerHTML = `
      <div class="hotel-item">
        <div class="hotel-top">
          <div>
            <div class="hotel-name">${escapeHtml(c)} Central Boutique</div>
            <div class="hotel-sub">City Center • 4★ • Free cancellation</div>
          </div>
          <div class="pill">$189 / night</div>
        </div>
        <div class="hotel-tags">
          <span class="hotel-tag">Breakfast</span>
          <span class="hotel-tag">Wi-Fi</span>
          <span class="hotel-tag">Gym</span>
        </div>
        <div class="hotel-actions">
          <button class="btn-outline" type="button">♡ Save</button>
          <button class="btn-primary" type="button">View deal</button>
        </div>
      </div>

      <div class="hotel-item">
        <div class="hotel-top">
          <div>
            <div class="hotel-name">${escapeHtml(c)} Old Town Suites</div>
            <div class="hotel-sub">Historic District • 4★</div>
          </div>
          <div class="pill">$210 / night</div>
        </div>
        <div class="hotel-tags">
          <span class="hotel-tag">Walkable</span>
          <span class="hotel-tag">Kitchenette</span>
          <span class="hotel-tag">Quiet rooms</span>
        </div>
        <div class="hotel-actions">
          <button class="btn-outline" type="button">♡ Save</button>
          <button class="btn-primary" type="button">View deal</button>
        </div>
      </div>

      <div class="hotel-item">
        <div class="hotel-top">
          <div>
            <div class="hotel-name">${escapeHtml(c)} Budget Smart</div>
            <div class="hotel-sub">Value Zone • 3★</div>
          </div>
          <div class="pill">$95 / night</div>
        </div>
        <div class="hotel-tags">
          <span class="hotel-tag">Best value</span>
          <span class="hotel-tag">24/7 desk</span>
          <span class="hotel-tag">Near transit</span>
        </div>
        <div class="hotel-actions">
          <button class="btn-outline" type="button">♡ Save</button>
          <button class="btn-primary" type="button">View deal</button>
        </div>
      </div>
    `;
  }

  // Search + clear handlers
  const hotelSearchBtn = $("hotelSearchBtn");
  const hotelClearBtn = $("hotelClearBtn");

  if (hotelSearchBtn) {
    hotelSearchBtn.addEventListener("click", () => {
      const inDate = $("hotelCheckin")?.value || "";
      const outDate = $("hotelCheckout")?.value || "";

      if (!inDate || !outDate || outDate <= inDate) {
        showHotelStatus("Fix dates: checkout must be after check-in.");
        return;
      }

      showHotelStatus("Searching…");
      renderHotels(($("hotelCity")?.value || "").trim());
      showHotelStatus("Ready");
    });
  }

  if (hotelClearBtn) {
    hotelClearBtn.addEventListener("click", () => {
      if ($("hotelCity")) $("hotelCity").value = "";

      const ci = $("hotelCheckin");
      const co = $("hotelCheckout");
      if (ci && co) {
        const today = toISODateLocal();
        ci.value = today;
        co.value = addDaysISO(today, 1);
      }

      if ($("hotelGuests")) $("hotelGuests").value = "2";
      if ($("hotelsResults")) $("hotelsResults").innerHTML = `<div class="pill">Search to see results.</div>`;
      showHotelStatus("", false);
    });
  }
})();
