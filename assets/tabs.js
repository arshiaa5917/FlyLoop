// assets/tabs.js
(() => {
  const $ = (id) => document.getElementById(id);

  const TABS = [
    { btn: "tabFlights",  panel: "panelFlights"  },
    { btn: "tabHotels",   panel: "panelHotels"   },
    { btn: "tabPackage",  panel: "panelPackage"  },
  ];

  function setActive(tabBtnId) {
    TABS.forEach(t => {
      const btn = $(t.btn);
      const panel = $(t.panel);
      const on = (t.btn === tabBtnId);

      if (btn) {
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
        btn.setAttribute("tabindex", on ? "0" : "-1");
      }
      if (panel) panel.hidden = !on;
    });

    // expose current tab for other scripts if needed
    window.FLYLOOP_ACTIVE_TAB = tabBtnId;
  }

  // expose so other files can switch tabs if they want
  window.FLYLOOP_SET_TAB = setActive;

  // wire clicks
  TABS.forEach(t => {
    const btn = $(t.btn);
    if (btn) btn.addEventListener("click", () => setActive(t.btn));
  });

  // keyboard support
  const tablist = document.querySelector(".top-tabs");
  if (tablist) {
    tablist.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const buttons = TABS.map(t => $(t.btn)).filter(Boolean);
      const idx = buttons.findIndex(b => b.getAttribute("aria-selected") === "true");
      if (idx < 0) return;

      const nextIdx = (e.key === "ArrowRight")
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;

      buttons[nextIdx].focus();
      buttons[nextIdx].click();
    });
  }

  // init
  setActive("tabFlights");
})();
