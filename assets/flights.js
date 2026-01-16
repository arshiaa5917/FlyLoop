/* assets/flights.js — Skyscanner-style rendering + working combo + submit */

(() => {
  const AIRPORTS = window.AIRPORTS || [];

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const normalizeIata = (v) => String(v || "").trim().toUpperCase();
  const isIata3 = (v) => /^[A-Z]{3}$/.test(v);

  function setStatus(msg, show = true) {
    const pill = $("statusPill");
    if (!pill) return;
    pill.style.display = show ? "inline-flex" : "none";
    pill.textContent = msg;
  }

  // ISO -> "7:55 PM"
  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function minsBetween(aIso, bIso) {
    try {
      const a = new Date(aIso);
      const b = new Date(bIso);
      const ms = b - a;
      if (!Number.isFinite(ms)) return null;
      return Math.max(0, Math.round(ms / 60000));
    } catch {
      return null;
    }
  }

  function fmtDuration(mins) {
    if (mins == null) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function fmtMoney(currency, total) {
    const n = Number(total);
    if (!Number.isFinite(n)) return `${currency} ${total}`;
    return `${currency} ${n.toFixed(2)}`;
  }

  function pickItems(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.offers)) return data.offers;
    if (Array.isArray(data.flights)) return data.flights;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function cryptoRandomId() {
    return `o_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  // ---------- normalize offers into consistent model ----------
  // Supports:
  //  A) demo: { airline, currency, total, stops, segments:[{from,to,departure/arrival,...}] }
  //  B) Amadeus-ish: { price:{total,currency}, itineraries:[{segments:[{departure:{iataCode,at}, arrival:{iataCode,at}, carrierCode, number}]}] }
  function normalizeOffer(raw) {
    const currency =
      raw.currency ||
      raw.price?.currency ||
      raw.price?.currencyCode ||
      raw.price?.currencyCode ||
      "CAD";

    const total =
      raw.total ??
      raw.price?.total ??
      raw.price?.grandTotal ??
      raw.amount ??
      raw.fare ??
      "—";

    let segments = [];

    // Shape A: your own segment shape
    if (Array.isArray(raw.segments) && raw.segments.length) {
      segments = raw.segments.map((s) => ({
        from: (s.from || s.origin || s.departureIata || s.departure?.iataCode || "").toUpperCase(),
        to: (s.to || s.destination || s.arrivalIata || s.arrival?.iataCode || "").toUpperCase(),
        departAt: s.departure || s.departureAt || s.departure?.at || s.departAt || "",
        arriveAt: s.arrival || s.arrivalAt || s.arrival?.at || s.arriveAt || "",
        carrier: s.carrier || s.carrierCode || s.marketingCarrier || raw.airline || "",
        flightNumber: s.flightNumber || s.number || s.flightNo || ""
      }));
    }

    // Shape B: Amadeus-ish
    if (!segments.length && Array.isArray(raw.itineraries) && raw.itineraries[0]?.segments) {
      segments = raw.itineraries[0].segments.map((s) => ({
        from: (s.departure?.iataCode || s.origin || "").toUpperCase(),
        to: (s.arrival?.iataCode || s.destination || "").toUpperCase(),
        departAt: s.departure?.at || s.departureAt || "",
        arriveAt: s.arrival?.at || s.arrivalAt || "",
        carrier: s.carrierCode || s.marketingCarrierCode || "",
        flightNumber: s.number || ""
      }));
    }

    const origin = segments[0]?.from || (raw.origin || raw.from || "").toUpperCase();
    const destination = segments[segments.length - 1]?.to || (raw.destination || raw.to || "").toUpperCase();

    const departAt = segments[0]?.departAt || raw.departure || raw.departureAt || "";
    const arriveAt = segments[segments.length - 1]?.arriveAt || raw.arrival || raw.arrivalAt || "";

    const durationMins = departAt && arriveAt ? minsBetween(departAt, arriveAt) : null;

    const stopsCount =
      raw.stops != null ? Number(raw.stops) : Math.max(0, segments.length - 1);

    const stopsLabel =
      stopsCount === 0 ? "Direct" : `${stopsCount} stop${stopsCount > 1 ? "s" : ""}`;

    const stopAirports =
      segments.length > 1 ? segments.slice(0, -1).map((s) => s.to).filter(Boolean) : [];

    const layovers = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i]?.arriveAt;
      const b = segments[i + 1]?.departAt;
      const mins = a && b ? minsBetween(a, b) : null;
      layovers.push({ at: segments[i]?.to || "—", mins });
    }

    const airline =
      raw.airline ||
      raw.validatingAirlineCodes?.[0] ||
      segments[0]?.carrier ||
      raw.carrier ||
      "—";

    const flightNums = segments
      .map((s) => (s.carrier && s.flightNumber) ? `${s.carrier}${s.flightNumber}` : "")
      .filter(Boolean);

    return {
      id: raw.id || raw.offerId || cryptoRandomId(),
      raw,
      currency,
      total,
      origin,
      destination,
      departAt,
      arriveAt,
      departTime: fmtTime(departAt),
      arriveTime: fmtTime(arriveAt),
      durationMins,
      duration: fmtDuration(durationMins),
      stopsCount,
      stopsLabel,
      stopAirports,
      layovers,
      airline,
      flightNums,
      segments
    };
  }

  // ---------- UI state ----------
  let currentOffers = [];
  let selectedOfferId = null;
  let preset = "best";     // best | price | duration
  let sortMode = "best";   // best | price | duration | depart

  function bestScore(o) {
    const p = Number(o.total);
    const price = Number.isFinite(p) ? p : 999999;
    const dur = o.durationMins ?? 999999;
    return price * 0.75 + dur * 0.35;
  }

  function applySort(items) {
    const arr = [...items];

    // preset pills base ordering
    if (preset === "price") arr.sort((a, b) => Number(a.total) - Number(b.total));
    else if (preset === "duration") arr.sort((a, b) => (a.durationMins ?? 999999) - (b.durationMins ?? 999999));
    else arr.sort((a, b) => bestScore(a) - bestScore(b));

    // dropdown override
    if (sortMode === "price") arr.sort((a, b) => Number(a.total) - Number(b.total));
    else if (sortMode === "duration") arr.sort((a, b) => (a.durationMins ?? 999999) - (b.durationMins ?? 999999));
    else if (sortMode === "depart") arr.sort((a, b) => String(a.departAt).localeCompare(String(b.departAt)));

    return arr;
  }

  function computeMeta(items) {
    const best = [...items].sort((a, b) => bestScore(a) - bestScore(b))[0];
    const cheap = [...items].sort((a, b) => Number(a.total) - Number(b.total))[0];
    const fast = [...items].sort((a, b) => (a.durationMins ?? 999999) - (b.durationMins ?? 999999))[0];

    $("summaryRow").style.display = "flex";
    $("bestMeta").textContent = best ? ` ${best.currency} ${Number(best.total).toFixed(2)}` : " —";
    $("cheapMeta").textContent = cheap ? ` ${cheap.currency} ${Number(cheap.total).toFixed(2)}` : " —";
    $("fastMeta").textContent = fast && fast.durationMins != null ? ` ${fast.duration}` : " —";
  }

  function renderDetailsHtml(o) {
    const segs = o.segments || [];
    if (!segs.length) return `<div class="pill">No segment details.</div>`;

    const rows = segs.map((s, idx) => {
      const dep = fmtTime(s.departAt);
      const arr = fmtTime(s.arriveAt);
      const code = (s.carrier && s.flightNumber) ? `${s.carrier}${s.flightNumber}` : "—";
      const from = s.from || "—";
      const to = s.to || "—";

      let lay = "";
      if (idx < segs.length - 1) {
        const layMins = minsBetween(s.arriveAt, segs[idx + 1]?.departAt);
        if (layMins != null && layMins > 0) {
          lay = `<div class="layover">Layover in <strong>${escapeHtml(to)}</strong>: ${escapeHtml(fmtDuration(layMins))}</div>`;
        }
      }

      return `
        <div class="seg-row">
          <div class="seg-code">${escapeHtml(code)}</div>
          <div class="seg-route">
            <div><strong>${escapeHtml(from)}</strong> ${escapeHtml(dep)} → <strong>${escapeHtml(to)}</strong> ${escapeHtml(arr)}</div>
          </div>
        </div>
        ${lay}
      `;
    }).join("");

    return `
      <div class="details-inner">
        <div class="details-title">Trip details</div>
        ${rows}
      </div>
    `;
  }

  function renderFlights(flights) {
    const flightResults = $("flightResults");
    flightResults.innerHTML = "";

    flights.forEach((o) => {
      const first = o.segments?.[0];
      const last  = o.segments?.[o.segments.length - 1];

      const origin = first?.from || o.origin || "—";
      const destination = last?.to || o.destination || "—";

      const airline = o.airline || "—";
      const flightNums = (o.flightNums && o.flightNums.length)
        ? o.flightNums.join(" · ")
        : (first?.carrier && first?.flightNumber ? `${first.carrier}${first.flightNumber}` : "—");

      const price = fmtMoney(o.currency, o.total);
      const selected = o.id === selectedOfferId;

      flightResults.innerHTML += `
        <div class="flight-row ${selected ? "is-selected" : ""}" data-offer-id="${escapeHtml(o.id)}">

          <div class="flight-left">
            <div class="airline">${escapeHtml(airline)}</div>
            <div class="flight-number">${escapeHtml(flightNums)}</div>
          </div>

          <div class="flight-middle">
            <div class="timeline">
              <div class="tblock">
                <div class="time">${escapeHtml(o.departTime)}</div>
                <div class="airport">${escapeHtml(origin)}</div>
              </div>

              <div class="midline">
                <div class="duration">${escapeHtml(o.duration)}</div>
                <div class="stops">${escapeHtml(o.stopsLabel)}</div>
                <div class="line"></div>
              </div>

              <div class="tblock">
                <div class="time">${escapeHtml(o.arriveTime)}</div>
                <div class="airport">${escapeHtml(destination)}</div>
              </div>
            </div>

            <div class="submeta">
              ${o.stopAirports?.length ? `<span>Via: ${escapeHtml(o.stopAirports.join(" · "))}</span>` : `<span>Nonstop</span>`}
              ${o.layovers?.some(x => x.mins != null) ? `<span>Layovers: ${escapeHtml(o.layovers.map(l => `${l.at} ${fmtDuration(l.mins)}`).join(" · "))}</span>` : ""}
            </div>
          </div>

          <div class="flight-right">
            <div class="price">${escapeHtml(price)}</div>
            <button class="select-btn" type="button" data-action="select">
              ${selected ? "Selected ✓" : "Select →"}
            </button>
            <button class="details-btn" type="button" data-action="details">Details</button>
          </div>

          <div class="details-panel" style="display:none;">
            ${renderDetailsHtml(o)}
          </div>

        </div>
      `;
    });
  }

  function renderWithSort() {
    renderFlights(applySort(currentOffers));
  }

  // event delegation for select/details
  $("flightResults")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const row = e.target.closest(".flight-row");
    if (!row) return;

    const id = row.getAttribute("data-offer-id");
    const offer = currentOffers.find(o => o.id === id);
    if (!offer) return;

    const action = btn.getAttribute("data-action");

    if (action === "select") {
      selectedOfferId = offer.id;
      renderWithSort();
      setStatus("Selected a flight ✓", true);
      return;
    }

    if (action === "details") {
      const panel = row.querySelector(".details-panel");
      const open = panel.style.display !== "none";
      panel.style.display = open ? "none" : "block";
      btn.textContent = open ? "Details" : "Hide details";
    }
  });

  // ---------- dropdown / combo ----------
  function airportLabel(a) { return `${a.city} — ${a.name} (${a.code})`; }
  function airportMeta(a) { return `${a.country}`; }

  function filterAirports(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return AIRPORTS.slice(0, 80);
    return AIRPORTS
      .filter((a) => (`${a.code} ${a.city} ${a.name} ${a.country}`).toLowerCase().includes(s))
      .slice(0, 80);
  }

  function setupCombo({ wrapSelector, inputId, clearBtnId, hiddenId, defaultCode }) {
    const wrap = document.querySelector(wrapSelector);
    const input = $(inputId);
    const clearBtn = $(clearBtnId);
    const hidden = $(hiddenId);
    if (!wrap || !input || !clearBtn || !hidden) return;

    const panel = wrap.querySelector(".combo-panel");
    const list = wrap.querySelector(".combo-list");
    const empty = wrap.querySelector(".combo-empty");
    if (!panel || !list || !empty) return;

    let activeIndex = -1;
    let current = [];

    function open() { panel.classList.add("open"); render(input.value); }
    function close() { panel.classList.remove("open"); activeIndex = -1; }

    function choose(a) {
      hidden.value = a.code;
      input.value = airportLabel(a);
      input.focus({ preventScroll: true });
      input.select();
      close();
    }

    function render(q) {
      current = filterAirports(q);
      list.innerHTML = "";
      activeIndex = -1;

      if (!current.length) { empty.style.display = "block"; return; }
      empty.style.display = "none";

      current.forEach((a) => {
        const div = document.createElement("div");
        div.className = "combo-item";
        div.innerHTML = `
          <div class="left">
            <div class="name">${escapeHtml(airportLabel(a))}</div>
            <div class="meta">${escapeHtml(airportMeta(a))}</div>
          </div>
          <div class="code">${escapeHtml(a.code)}</div>
        `;
        div.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
        list.appendChild(div);
      });
    }

    input.addEventListener("focus", () => {
      open();
      requestAnimationFrame(() => input.select());
    });

    // key fix: clear hidden when typing (prevents stale IATA)
    input.addEventListener("input", () => {
      hidden.value = "";
      if (!panel.classList.contains("open")) open();
      render(input.value);
    });

    input.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll(".combo-item"));
      if (!panel.classList.contains("open") && (e.key === "ArrowDown" || e.key === "Enter")) {
        open(); e.preventDefault(); return;
      }
      if (!items.length) return;

      if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); }
      else if (e.key === "Enter") {
        if (activeIndex >= 0 && current[activeIndex]) { e.preventDefault(); choose(current[activeIndex]); }
        return;
      } else if (e.key === "Escape") { close(); return; }
      else return;

      items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      if (activeIndex >= 0) items[activeIndex].scrollIntoView({ block: "nearest" });
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      hidden.value = "";
      input.focus({ preventScroll: true });
      open();
    });

    document.addEventListener("mousedown", (e) => {
      if (!wrap.contains(e.target)) close();
    });

    // init
    hidden.value = defaultCode;
    const found = AIRPORTS.find((a) => a.code === defaultCode);
    input.value = found ? airportLabel(found) : defaultCode;
  }

  setupCombo({ wrapSelector: '[data-combo="origin"]', inputId: "fromText", clearBtnId: "fromClear", hiddenId: "fromIata", defaultCode: "YYZ" });
  setupCombo({ wrapSelector: '[data-combo="destination"]', inputId: "toText", clearBtnId: "toClear", hiddenId: "toIata", defaultCode: "MIA" });

  // swap
  $("swapBtn")?.addEventListener("click", () => {
    const fromI = $("fromIata");
    const toI = $("toIata");
    const tmp = fromI.value; fromI.value = toI.value; toI.value = tmp;

    const f = AIRPORTS.find((a) => a.code === fromI.value);
    const t = AIRPORTS.find((a) => a.code === toI.value);
    $("fromText").value = f ? airportLabel(f) : fromI.value;
    $("toText").value = t ? airportLabel(t) : toI.value;
  });

  // tabs (UI only)
  function setTab(activeId) {
    ["tabFlights", "tabHotels", "tabCars"].forEach(id => {
      const el = $(id);
      if (!el) return;
      const isActive = id === activeId;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (activeId !== "tabFlights") setStatus("UI only: Flights is implemented. Hotels/Cars next.", true);
    else setStatus("", false);
  }
  $("tabFlights")?.addEventListener("click", () => setTab("tabFlights"));
  $("tabHotels")?.addEventListener("click", () => setTab("tabHotels"));
  $("tabCars")?.addEventListener("click", () => setTab("tabCars"));

  // summary pills
  document.querySelectorAll(".summary-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      preset = btn.getAttribute("data-preset") || "best";
      document.querySelectorAll(".summary-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderWithSort();
    });
  });

  // sort dropdown
  $("sortSelect")?.addEventListener("change", (e) => {
    sortMode = e.target.value;
    renderWithSort();
  });

  // ---------- submit -> call /api/flights ----------
  $("flightForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    selectedOfferId = null;

    let origin = normalizeIata($("fromIata")?.value);
    let destination = normalizeIata($("toIata")?.value);

    const typedFrom = normalizeIata($("fromText")?.value);
    const typedTo = normalizeIata($("toText")?.value);

    if (!isIata3(origin) && isIata3(typedFrom)) origin = typedFrom;
    if (!isIata3(destination) && isIata3(typedTo)) destination = typedTo;

    const date = String($("departDate")?.value || "").trim();
    const adults = String($("adults")?.value || "1").trim();
    const cabin = String($("cabin")?.value || "ECONOMY").trim();

    if (!isIata3(origin)) return setStatus("Pick a valid origin (IATA).", true);
    if (!isIata3(destination)) return setStatus("Pick a valid destination (IATA).", true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setStatus("Pick a valid date.", true);

    setStatus("Searching…", true);
    $("flightResults").innerHTML = `<div class="pill">Loading…</div>`;
    $("summaryRow").style.display = "none";

    try {
      // Backend accepts origin/destination (your serverless used that earlier)
      const url =
        `/api/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}&adults=${encodeURIComponent(adults)}&cabin=${encodeURIComponent(cabin)}`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });

      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch { data = { error: text }; }

      if (!res.ok) {
        setStatus(data?.error ? data.error : `API error (${res.status})`, true);
        $("flightResults").innerHTML = `<div class="pill">No flights found.</div>`;
        currentOffers = [];
        return;
      }

      const items = pickItems(data);
      if (!items.length) {
        setStatus("No flights found.", true);
        $("flightResults").innerHTML = `<div class="pill">No flights found.</div>`;
        currentOffers = [];
        return;
      }

      currentOffers = items.map(normalizeOffer);

      // default selection states
      preset = "best";
      sortMode = $("sortSelect")?.value || "best";
      document.querySelectorAll(".summary-pill").forEach(b => b.classList.remove("active"));
      document.querySelector('.summary-pill[data-preset="best"]')?.classList.add("active");

      computeMeta(currentOffers);
      setStatus(`Found ${currentOffers.length} results`, true);
      renderWithSort();

      $("resultsCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      setStatus("Network error calling /api/flights", true);
      $("flightResults").innerHTML = `<div class="pill">Network error.</div>`;
      currentOffers = [];
    }
  });

  // clear
  $("clearBtn")?.addEventListener("click", () => {
    setStatus("", false);
    $("summaryRow").style.display = "none";
    $("flightResults").innerHTML = `<div class="pill">Results cleared.</div>`;
    currentOffers = [];
    selectedOfferId = null;
  });

  // mobile sidebar (optional; safe)
  const sidebar = $("sidebarNav");
  const overlay = $("sidebarOverlay");
  const openBtn = $("openNavBtn");
  const closeBtn = $("closeNavBtn");

  function openNav() {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("nav-open");
    openBtn?.setAttribute("aria-expanded", "true");
    overlay?.setAttribute("aria-hidden", "false");
  }
  function closeNav() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("nav-open");
    openBtn?.setAttribute("aria-expanded", "false");
    overlay?.setAttribute("aria-hidden", "true");
  }
  openBtn?.addEventListener("click", openNav);
  closeBtn?.addEventListener("click", closeNav);
  overlay?.addEventListener("click", closeNav);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });
})();
