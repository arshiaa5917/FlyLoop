(() => {
  const AIRPORTS = window.AIRPORTS || [];

  // ---------- utils ----------
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const normalizeIata = (v) => String(v || "").trim().toUpperCase();
  const isIata3 = (v) => /^[A-Z]{3}$/.test(v);

  function pickItems(data){
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.flights)) return data.flights;
    if (Array.isArray(data.offers)) return data.offers;
    return [];
  }

  function toTime(iso){
    if (!iso) return "—";
    const t = String(iso);
    const hhmm = t.slice(11,16);
    return hhmm || "—";
  }

  function mapToCardModel(item){
    const currency = item.currency || "CAD";
    const total = item.total ?? item.price ?? item.amount ?? item.fare ?? "—";
    const airline = item.airline || item.carrier || item.airlineName || "Airline";

    let dep = item.departure || "";
    let arr = item.arrival || "";
    let badge = item.badge || "";

    if (Array.isArray(item.segments) && item.segments.length){
      const first = item.segments[0];
      const last = item.segments[item.segments.length - 1];
      const from = (first.from || first.origin || item.origin || "").toUpperCase();
      const to = (last.to || last.destination || item.destination || "").toUpperCase();
      const depT = first.departure || first.departureAt || "";
      const arrT = last.arrival || last.arrivalAt || "";
      dep = dep || `${from} ${toTime(depT)}`.trim();
      arr = arr || `${to} ${toTime(arrT)}`.trim();
      const stops = (item.stops != null) ? Number(item.stops) : Math.max(0, item.segments.length - 1);
      badge = badge || (stops === 0 ? "Nonstop" : `${stops} stop${stops>1?"s":""}`);
    } else {
      badge = badge || (item.stops === 0 ? "Nonstop" : (item.stops ? `${item.stops} stops` : "Offer"));
    }

    return { airline, currency, total, dep: dep || "—", arr: arr || "—", badge };
  }

  // ---------- UI: status + results ----------
  function setStatus(msg, show=true){
    const pill = $("statusPill");
    pill.style.display = show ? "inline-flex" : "none";
    pill.textContent = msg;
  }

  function renderFlights(items){
    const wrap = $("flightResults");
    wrap.innerHTML = "";

    if (!items || items.length === 0){
      wrap.innerHTML = `<div class="pill">No flights found.</div>`;
      return;
    }

    items.slice(0, 30).forEach(raw => {
      const f = mapToCardModel(raw);
      wrap.innerHTML += `
        <div class="flight-card">
          <div class="flight-top">
            <div style="font-weight:900;">${escapeHtml(f.airline)}</div>
            <div class="flight-price">${escapeHtml(f.currency)} ${escapeHtml(f.total)}</div>
          </div>
          <div class="flight-meta">
            <div><span>Depart:</span> ${escapeHtml(f.dep)}</div>
            <div><span>Arrive:</span> ${escapeHtml(f.arr)}</div>
          </div>
          <div class="flight-badge">${escapeHtml(f.badge || "Offer")}</div>
        </div>
      `;
    });
  }

  // ---------- Summary pills ----------
  let preset = "best";     // best | price | duration
  let sortMode = "best";   // best | price | duration | depart
  let currentOffers = [];

  function scoreBest(o){
    const total = Number(o.total);
    return (Number.isFinite(total) ? total : 999999);
  }

  function computeMeta(items){
    // lightweight meta text
    const cheapest = [...items].sort((a,b)=>Number(a.total)-Number(b.total))[0];
    const best = [...items].sort((a,b)=>scoreBest(a)-scoreBest(b))[0];

    $("bestMeta").textContent = best ? `${best.currency} ${best.total}` : "—";
    $("cheapMeta").textContent = cheapest ? `${cheapest.currency} ${cheapest.total}` : "—";
    $("fastMeta").textContent = "—"; // you can compute duration when your API returns it
  }

  function applySort(items){
    const arr = [...items];

    // preset
    if (preset === "price") arr.sort((a,b)=>Number(a.total)-Number(b.total));
    else if (preset === "duration") { /* no duration yet */ }
    else arr.sort((a,b)=>scoreBest(a)-scoreBest(b));

    // sort dropdown overrides
    if (sortMode === "price") arr.sort((a,b)=>Number(a.total)-Number(b.total));
    else if (sortMode === "depart") { /* optional when you have times */ }

    return arr;
  }

  function renderWithSort(){
    const sorted = applySort(currentOffers);
    renderFlights(sorted);
  }

  // ---------- Combobox ----------
  function airportLabel(a){ return `${a.city} — ${a.name} (${a.code})`; }
  function airportMeta(a){ return `${a.country}`; }

  function filterAirports(q){
    const s = String(q || "").trim().toLowerCase();
    if (!s) return AIRPORTS.slice(0, 60);
    return AIRPORTS.filter(a => (`${a.code} ${a.city} ${a.name} ${a.country}`).toLowerCase().includes(s)).slice(0, 60);
  }

  function setupCombo({ wrapSelector, inputId, clearBtnId, hiddenId, defaultCode }){
    const wrap = document.querySelector(wrapSelector);
    const input = $(inputId);
    const clearBtn = $(clearBtnId);
    const hidden = $(hiddenId);
    const panel = wrap.querySelector(".combo-panel");
    const list = wrap.querySelector(".combo-list");
    const empty = wrap.querySelector(".combo-empty");

    let activeIndex = -1;
    let current = [];

    function open(){ panel.classList.add("open"); render(input.value); }
    function close(){ panel.classList.remove("open"); activeIndex = -1; }
    function choose(a){
      hidden.value = a.code;
      input.value = airportLabel(a);
      input.focus({ preventScroll:true });
      input.select(); // ✅ easy change
      close();
    }

    function render(q){
      current = filterAirports(q);
      list.innerHTML = "";
      activeIndex = -1;

      if (!current.length){
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
        div.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
        list.appendChild(div);
      });
    }

    input.addEventListener("focus", () => {
      open();
      requestAnimationFrame(()=>input.select());
    });

    input.addEventListener("input", () => {
      if (!panel.classList.contains("open")) open();
      render(input.value);
    });

    input.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll(".combo-item"));
      if (!panel.classList.contains("open") && (e.key === "ArrowDown" || e.key === "Enter")){
        open(); e.preventDefault(); return;
      }
      if (!items.length) return;

      if (e.key === "ArrowDown"){ e.preventDefault(); activeIndex = Math.min(activeIndex+1, items.length-1); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); }
      else if (e.key === "Enter"){
        if (activeIndex >= 0 && current[activeIndex]){ e.preventDefault(); choose(current[activeIndex]); }
        return;
      } else if (e.key === "Escape"){ close(); return; }
      else return;

      items.forEach((el,i)=>el.classList.toggle("active", i===activeIndex));
      if (activeIndex >= 0) items[activeIndex].scrollIntoView({ block:"nearest" });
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      hidden.value = "";
      input.focus({ preventScroll:true });
      open();
    });

    document.addEventListener("mousedown", (e) => {
      if (!wrap.contains(e.target)) close();
    });

    // init
    hidden.value = defaultCode;
    const found = AIRPORTS.find(a => a.code === defaultCode);
    input.value = found ? airportLabel(found) : defaultCode;
  }

  setupCombo({ wrapSelector:'[data-combo="origin"]', inputId:"fromText", clearBtnId:"fromClear", hiddenId:"fromIata", defaultCode:"YYZ" });
  setupCombo({ wrapSelector:'[data-combo="destination"]', inputId:"toText", clearBtnId:"toClear", hiddenId:"toIata", defaultCode:"MIA" });

  // ---------- swap ----------
  $("swapBtn").addEventListener("click", () => {
    const fromI = $("fromIata"), toI = $("toIata");
    const tmp = fromI.value; fromI.value = toI.value; toI.value = tmp;

    const f = AIRPORTS.find(a => a.code === fromI.value);
    const t = AIRPORTS.find(a => a.code === toI.value);
    $("fromText").value = f ? airportLabel(f) : fromI.value;
    $("toText").value = t ? airportLabel(t) : toI.value;

    $("fromText").focus({ preventScroll:true });
    $("fromText").select();
  });

  // ---------- summary preset pills ----------
  document.querySelectorAll(".summary-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      preset = btn.getAttribute("data-preset") || "best";
      document.querySelectorAll(".summary-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderWithSort();
    });
  });

  // ---------- sort dropdown ----------
  $("sortSelect").addEventListener("change", (e) => {
    sortMode = e.target.value;
    renderWithSort();
  });

  // ---------- tabs (UI only right now) ----------
  function setTab(activeId){
    const tabs = ["tabFlights","tabHotels","tabCars"];
    tabs.forEach(id => {
      const el = $(id);
      const isActive = id === activeId;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // For now: only Flights works
    if (activeId !== "tabFlights"){
      setStatus("UI only: flights tab is implemented. Hotels/Cars later.", true);
    } else {
      setStatus("", false);
    }
  }
  $("tabFlights").addEventListener("click", ()=>setTab("tabFlights"));
  $("tabHotels").addEventListener("click", ()=>setTab("tabHotels"));
  $("tabCars").addEventListener("click", ()=>setTab("tabCars"));

  // ---------- submit -> API ----------
  $("flightForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const origin = normalizeIata($("fromIata").value);
    const destination = normalizeIata($("toIata").value);
    const date = String($("departDate").value || "").trim();
    const adults = String($("adults").value || "1").trim();
    const cabin = String($("cabin").value || "ECONOMY").trim();

    if (!isIata3(origin)) { setStatus("Pick a valid origin airport (IATA)."); return; }
    if (!isIata3(destination)) { setStatus("Pick a valid destination airport (IATA)."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setStatus("Pick a valid date."); return; }

    setStatus("Searching…", true);
    $("flightResults").innerHTML = `<div class="pill">Loading…</div>`;

    // Package card (future)
    const addHotel = $("addHotel").checked;
    $("packageCard").style.display = addHotel ? "block" : "none";
    if (addHotel) {
      $("hotelResults").innerHTML = `<div class="pill">Hotel search UI placeholder — will connect later.</div>`;
    }

    try{
      const url = `/api/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}&adults=${encodeURIComponent(adults)}&cabin=${encodeURIComponent(cabin)}`;
      const res = await fetch(url, { headers: { "Accept":"application/json" } });
      const data = await res.json().catch(()=> ({}));

      if (!res.ok){
        setStatus(data && data.error ? data.error : `API error (${res.status})`, true);
        $("flightResults").innerHTML = `<div class="pill">No flights found.</div>`;
        return;
      }

      const items = pickItems(data);
      if (!items.length){
        setStatus("No flights found.", true);
        $("flightResults").innerHTML = `<div class="pill">No flights found.</div>`;
        return;
      }

      // Normalize into something sortable (best/price at least)
      currentOffers = items.map(mapToCardModel);

      // show summary row
      $("summaryRow").style.display = "flex";
      computeMeta(currentOffers);

      // default selection
      preset = "best";
      sortMode = $("sortSelect").value || "best";
      document.querySelectorAll(".summary-pill").forEach(b=>b.classList.remove("active"));
      document.querySelector('.summary-pill[data-preset="best"]')?.classList.add("active");

      setStatus(`Found ${currentOffers.length} results`, true);
      renderWithSort();

      // scroll to results
      $("resultsCard").scrollIntoView({ behavior:"smooth", block:"start" });
    } catch(err){
      setStatus("Network error calling /api/flights", true);
      $("flightResults").innerHTML = `<div class="pill">Network error.</div>`;
    }
  });

  // ---------- clear ----------
  $("clearBtn").addEventListener("click", () => {
    setStatus("", false);
    $("summaryRow").style.display = "none";
    $("flightResults").innerHTML = `<div class="pill">Results cleared.</div>`;
    $("packageCard").style.display = "none";
    currentOffers = [];
  });

  // ---------- mobile sidebar ----------
  const sidebar = $('sidebarNav');
  const overlay = $('sidebarOverlay');
  const openBtn = $('openNavBtn');
  const closeBtn = $('closeNavBtn');

  function openNav(){
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('nav-open');
    if(openBtn) openBtn.setAttribute('aria-expanded','true');
    overlay.setAttribute('aria-hidden','false');
  }
  function closeNav(){
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('nav-open');
    if(openBtn) openBtn.setAttribute('aria-expanded','false');
    overlay.setAttribute('aria-hidden','true');
  }
  if(openBtn) openBtn.addEventListener('click', openNav);
  if(closeBtn) closeBtn.addEventListener('click', closeNav);
  if(overlay) overlay.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeNav(); });
})();
