<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Flights – FlyLoop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="FlyLoop flight search concept page (UI + API-ready layout)." />

  <link rel="stylesheet" href="assets/flights.css" />
</head>

<body>
  <!-- Mobile top bar -->
  <header class="mobile-topbar" aria-label="Mobile header">
    <div class="mobile-topbar-inner">
      <button class="hamburger" id="openNavBtn" type="button"
              aria-label="Open menu" aria-controls="sidebarNav" aria-expanded="false">
        <span class="hamburger-icon" aria-hidden="true"><span></span></span>
        Menu
      </button>

      <div class="sidebar-logo" style="margin:0;">
        <img src="logo.png?v=2" alt="FlyLoop logo" />
        <span>FLYLOOP</span>
      </div>
    </div>
  </header>

  <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>

  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebarNav" aria-label="Dashboard navigation">
      <button class="sidebar-close" id="closeNavBtn" type="button" aria-label="Close menu">
        Close ✕
      </button>

      <div class="sidebar-logo">
        <img src="logo.png?v=2" alt="FlyLoop logo" />
        <span>FLYLOOP</span>
      </div>

      <div class="sidebar-title">Dashboard</div>

      <nav class="sidebar-nav" aria-label="Dashboard pages">
        <a class="sidebar-link" href="dashboard.html#overview">
          <span class="label">Overview</span>
          <small>Trips &amp; plan</small>
        </a>

        <a class="sidebar-link" href="dashboard.html#account">
          <span class="label">Account</span>
          <small>Profile &amp; billing</small>
        </a>

        <a class="sidebar-link active" href="flights.html" aria-current="page">
          <span class="label">Flights</span>
          <small>Live search</small>
        </a>

        <a class="sidebar-link" href="dashboard.html#settings">
          <span class="label">Settings</span>
          <small>Preferences</small>
        </a>
      </nav>

      <div class="sidebar-footer">
        Logged in as <strong>demo@flyloop.com</strong><br />
        <a href="login.html" class="logout-link">Log out</a>
      </div>
    </aside>

    <!-- Main content -->
    <main class="content">
      <div class="eyebrow">Flights</div>
      <h1>Live flight search</h1>

      <!-- Top tabs -->
      <div class="top-tabs" role="tablist" aria-label="Product tabs">
        <button class="tab-btn active" id="tabFlights" type="button" role="tab" aria-selected="true">
          ✈️ Flights
        </button>
        <button class="tab-btn" id="tabHotels" type="button" role="tab" aria-selected="false">
          🛏️ Hotels
        </button>
        <button class="tab-btn" id="tabCars" type="button" role="tab" aria-selected="false">
          🚗 Cars
        </button>
      </div>

      <div class="grid">
        <!-- Search -->
        <section class="card" aria-label="Flight search">
          <h3>Search</h3>

          <div class="mini-row">
            <select id="tripType" class="mini-select" aria-label="Trip type">
              <option value="oneway" selected>One way</option>
              <option value="roundtrip">Round trip (UI only)</option>
            </select>

            <select id="adults" class="mini-select" aria-label="Adults">
              <option value="1" selected>1 Adult</option>
              <option value="2">2 Adults</option>
              <option value="3">3 Adults</option>
              <option value="4">4 Adults</option>
            </select>

            <select id="cabin" class="mini-select" aria-label="Cabin">
              <option value="ECONOMY" selected>Economy</option>
              <option value="PREMIUM_ECONOMY">Premium</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>

          <form id="flightForm" novalidate>
            <!-- From / Swap / To -->
            <div class="swap-row">
              <div class="form-row">
                <label for="fromText">From</label>

                <div class="combo" data-combo="origin">
                  <input id="fromText" class="combo-input" type="text"
                         placeholder="Type city or IATA (YYZ)" autocomplete="off" />
                  <button class="combo-clear" id="fromClear" type="button" aria-label="Clear origin">✕</button>

                  <div class="combo-panel" role="listbox" aria-label="Origin airports">
                    <div class="combo-list"></div>
                    <div class="combo-empty">No matches.</div>
                  </div>
                </div>

                <input id="fromIata" type="hidden" value="YYZ" />
              </div>

              <button class="swap-btn" id="swapBtn" type="button" aria-label="Swap origin and destination">⇄</button>

              <div class="form-row">
                <label for="toText">To</label>

                <div class="combo" data-combo="destination">
                  <input id="toText" class="combo-input" type="text"
                         placeholder="Type city or IATA (MIA)" autocomplete="off" />
                  <button class="combo-clear" id="toClear" type="button" aria-label="Clear destination">✕</button>

                  <div class="combo-panel" role="listbox" aria-label="Destination airports">
                    <div class="combo-list"></div>
                    <div class="combo-empty">No matches.</div>
                  </div>
                </div>

                <input id="toIata" type="hidden" value="MIA" />
              </div>
            </div>

            <!-- Date + options -->
            <div class="row2">
              <div class="form-row depart-col">
                <label for="departDate">Departure date</label>
                <input id="departDate" type="date" value="2026-03-12" />
              </div>

              <div class="form-row options-col">
                <label>Options</label>
                <div class="checks">
                  <label class="check"><input id="nearbyFrom" type="checkbox"> Nearby airports</label>
                  <label class="check"><input id="addHotel" type="checkbox"> Add a hotel</label>
                </div>
              </div>
            </div>

            <div class="actions">
              <button class="btn-primary" type="submit">Search</button>
              <button class="btn-outline" id="clearBtn" type="button">Clear</button>
              <span id="statusPill" class="pill" style="display:none;"></span>
            </div>
          </form>
        </section>

        <!-- Results -->
        <section class="card" id="resultsCard" aria-label="Results">
          <div class="results-head">
            <h3 style="margin:0;">Results</h3>

            <div class="sort-inline">
              <label for="sortSelect" class="sort-label">Sort</label>
              <select id="sortSelect" class="mini-select">
                <option value="best" selected>Best</option>
                <option value="price">Cheapest</option>
                <option value="duration">Fastest</option>
                <option value="depart">Depart time</option>
              </select>
            </div>
          </div>

          <div class="summary-row" id="summaryRow" style="display:none;">
            <button class="summary-pill active" type="button" data-preset="best">Best <span id="bestMeta">—</span></button>
            <button class="summary-pill" type="button" data-preset="price">Cheapest <span id="cheapMeta">—</span></button>
            <button class="summary-pill" type="button" data-preset="duration">Fastest <span id="fastMeta">—</span></button>
          </div>

          <div class="results" id="flightResults">
            <div class="pill">Search to see results.</div>
          </div>
        </section>

        <!-- Package (optional) -->
        <section class="card" id="packageCard" style="display:none;" aria-label="Package">
          <h3>Package (+ Hotel)</h3>
          <div class="pill">UI placeholder — later: hotel search + combined price.</div>
          <div id="hotelResults" class="results" style="margin-top:10px;"></div>
        </section>
      </div>
    </main>
  </div>

  <!-- Scripts -->
  <script src="assets/airports.js"></script>
  <script src="assets/flights.js"></script>

  <!-- Date min guard -->
  <script>
    function toISODateLocal(d = new Date()) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    const departDate = document.getElementById("departDate");
    const today = toISODateLocal();

    departDate.min = today;

    if (departDate.value && departDate.value < today) {
      departDate.value = today;
    }
  </script>
</body>
</html>
