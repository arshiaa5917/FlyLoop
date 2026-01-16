(() => {
  const AIRPORTS = window.AIRPORTS || [];

  // helpers
  const $ = (id) => document.getElementById(id);
  const normalizeIata = (v) => String(v || "").trim().toUpperCase();
  const isIata3 = (v) => /^[A-Z]{3}$/.test(v);

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function setStatus(msg, show = true) {
    const pill = $("statusPill");
    if (!pill) return;
    pill.style.display = show ? "inline-flex" : "none";
    pill.textContent = msg || "";
  }

  function pickItems(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.offers)) return data.offers;
    if (Array.isArray(data.flights)) return data.flights;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  // ----- dropdown / combo -----
  function airportLabel(a) {
    return `${a.city} — ${a.name} (${a.code})`;
  }
  function airportMeta(a) {
    return `${a.country}`;
  }

  function filterAirports(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return AIRPORTS.slice(0, 80);
    return AIRPORTS
      .filter((a) =>
        `${a.code} ${a.city} ${a.name} ${a.country}`.toLowerCase().includes(s)
      )
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

    // if HTML doesn't include the panel structure, don't crash
    if (!panel || !list || !empty) return;

    let activeIndex = -1;
    let current = [];

    function open() {
      panel.classList.add("open");
      render(input.value);
    }
    function close() {
      panel.classList.remove("open");
      activeIndex = -1;
    }

    function choose(a) {
      hidden.value = a.code;            // real IATA for submit
      input.value = airportLabel(a);    // pretty label for user
      close();
      // keep focus nice
      input.focus({ preventScroll: true });
      input.setSelectionRange(0, input.value.length);
    }

    function render(q) {
      current = filterAirports(q);
      list.innerHTML = "";
      activeIndex = -1;

      if (!current.length) {
        empty.style.display = "block";
        return;
      }
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

        // IMPORTANT: use pointerdown so it beats document handlers
        div.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          choose(a);
        });

        list.appendChild(div);
      });
    }

    // stop clicks inside from closing it
    wrap.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });

    input.addEventListener("focus", () => {
      open();
      requestAnimationFrame(() => {
        input.setSelectionRange(0, input.value.length);
      });
    });

    // key fix: clear hidden when typing so we don't submit stale IATA
    input.addEventListener("input", () => {
      hidden.value = "";
      if (!panel.classList.contains("open")) open();
      render(input.value);
    });

    input.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll(".combo-item"));

      if (!panel.classList.contains("open") && (e.key === "ArrowDown" || e.key === "Enter")) {
        open();
        e.preventDefault();
        return;
      }
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && current[activeIndex]) {
          e.preventDefault();
          choose(current[activeIndex]);
        }
        return;
      } else if (e.key === "Escape") {
        close();
        return;
      } else {
        return;
      }

      items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      if (activeIndex >= 0) items[activeIndex].scrollIntoView({ block: "nearest" });
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      hidden.value = "";
      input.focus({ preventScroll: true });
      open();
    });

    // click outside closes it
    document.addEventListener("pointerdown", () => close());

    // init default
    hidden.value = defaultCode;
    const found = AIRPORTS.find((a) => a.code === defaultCode);
    input.value = found ? airportLabel(found) : defaultCode;
  }

  setupCombo({
    wrapSelector: '[data-combo="origin"]',
    inputId: "fromText",
    clearBtnId: "fromClear",
    hiddenId: "fromIata",
    defaultCode: "YYZ",
  });

  setupCombo({
    wrapSelector: '[data-combo="destination"]',
    inputId: "toText",
    clearBtnId: "toClear",
    hiddenId: "toIata",
    defaultCode: "MIA",
  });

  // swap
  $("swapBtn")?.addEventListener("click", () => {
    const fromI = $("fromIata");
    const toI = $("toIata");
    if (!fromI || !toI) return;

    const tmp = fromI.value;
    fromI.value = toI.value;
    toI.value = tmp;

    const f = AIRPORTS.find((a) => a.code === fromI.value);
    const t = AIRPORTS.find((a) => a.code === toI.value);

    const fromText = $("fromText");
    const toText = $("toText");
    if (fromText) fromText.value = f ? airportLabel(f) : fromI.value;
    if (toText) toText.value = t ? airportLabel(t) : toI.value;
  });

  // submit (REAL fetch)
  $("flightForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    let origin = normalizeIata($("fromIata")?.value);
    let destination = normalizeIata($("toIata")?.value);

    const typedFrom = normalizeIata($("fromText")?.value);
    const typedTo = normalizeIata($("toText")?.value);

    // allow typing IATA manually
    if (!isIata3(origin) && isIata3(typedFrom)) origin = typedFrom;
    if (!isIata3(destination) && isIata3(typedTo)) destination = typedTo;

    const date = String($("departDate")?.value || "").trim();
    const adults = String($("adults")?.value || "1").trim();
    const cabin = String($("cabin")?.value || "ECONOMY").trim();

    if (!isIata3(origin)) return setStatus("Pick a valid origin (IATA).", true);
    if (!isIata3(destination)) return setStatus("Pick a valid destination (IATA).", true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setStatus("Pick a valid date.", true);

    const resultsEl = $("flightResults");
    if (resultsEl) resultsEl.innerHTML = `<div class="pill">Loading…</div>`;

    setStatus(`Searching ${origin} → ${destination}…`, true);

    const url =
      `/api/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}` +
      `&date=${encodeURIComponent(date)}&adults=${encodeURIComponent(adults)}&cabin=${encodeURIComponent(cabin)}`;

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text };
      }

      if (!res.ok) {
        setStatus(data?.error || `API error (${res.status})`, true);
        if (resultsEl) resultsEl.innerHTML = `<div class="pill">No flights found.</div>`;
        return;
      }

      const items = pickItems(data);
      setStatus(`Found ${items.length} results`, true);

      // minimal display so you SEE it works even before fancy render
      if (resultsEl) {
        if (!items.length) resultsEl.innerHTML = `<div class="pill">No flights found.</div>`;
        else resultsEl.innerHTML = `<div class="pill">✅ API returned ${items.length} offers</div>`;
      }
    } catch (err) {
      console.error(err);
      setStatus("Network error calling /api/flights", true);
      if (resultsEl) resultsEl.innerHTML = `<div class="pill">Network error.</div>`;
    }
  });
})();
