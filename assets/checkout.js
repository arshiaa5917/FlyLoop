// assets/checkout.js
(() => {
  const $ = (id) => document.getElementById(id);

  let selectedFlight = null;
  let creditBalance = 500.00;

  function show(el, on) {
    if (!el) return;
    el.style.display = on ? "block" : "none";
  }

  function showPill(el, msg, on = true) {
    if (!el) return;
    el.style.display = on ? "inline-flex" : "none";
    el.textContent = msg;
  }

  function moneyToNumber(s) {
    const m = String(s || "").match(/([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? Number(m[1]) : NaN;
  }

  // Elements
  const floatingContinue = $("floatingContinue");
  const reviewCard = $("flightReviewCard");
  const checkoutCard = $("flightCheckoutCard");

  const reviewSummary = $("reviewSummary");
  const checkoutSummary = $("checkoutSummary");

  const reviewBackBtn = $("reviewBackBtn");
  const reviewToCheckoutBtn = $("reviewToCheckoutBtn");
  const checkoutBackBtn = $("checkoutBackBtn");
  const placeOrderBtn = $("placeOrderBtn");
  const checkoutStatus = $("checkoutStatus");

  const useCredits = $("useCredits");
  const creditBalanceEl = $("creditBalance");

  function setFloatingVisible(on) {
    if (!floatingContinue) return;
    floatingContinue.hidden = !on;
  }

  function updateCheckoutSummary() {
    if (!selectedFlight || !checkoutSummary) return;

    const price = moneyToNumber(selectedFlight.priceText);
    const use = !!useCredits?.checked;

    if (!isFinite(price)) {
      checkoutSummary.textContent = `Flight total: ${selectedFlight.priceText} (demo)`;
      if (creditBalanceEl) creditBalanceEl.textContent = `CAD ${creditBalance.toFixed(2)}`;
      return;
    }

    const due = use ? Math.max(0, price - creditBalance) : price;
    const remaining = use ? Math.max(0, creditBalance - price) : creditBalance;

    checkoutSummary.textContent =
      `Flight total: CAD ${price.toFixed(2)} • Credits used: ${use ? "Yes" : "No"} • Due today: CAD ${due.toFixed(2)}`;

    if (creditBalanceEl) creditBalanceEl.textContent = `CAD ${remaining.toFixed(2)}`;
  }

  // Listen for "Select / Selected" clicks inside results (works with dynamic rendering)
  (function wireSelection() {
    const resultsRoot = $("flightResults");
    if (!resultsRoot) return;

    resultsRoot.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const label = (btn.textContent || "").toLowerCase();
      if (!label.includes("select")) return;

      const card = btn.closest(".result, .result-item, article, .flight-card, .flight-result") || btn.closest("div");
      if (!card) return;

      const text = (card.innerText || "").replace(/\s+/g, " ").trim();
      const priceMatch = text.match(/CAD\s*[0-9]+(?:\.[0-9]{1,2})?/i);
      const priceText = priceMatch ? priceMatch[0].replace(/\s+/g, " ") : "CAD —";

      selectedFlight = { summaryText: text.slice(0, 220), priceText };

      // show floating continue, hide review/checkout until user presses continue
      setFloatingVisible(true);
      show(reviewCard, false);
      show(checkoutCard, false);
      showPill(checkoutStatus, "", false);
    }, true);
  })();

  // Floating Continue → Review
  if (floatingContinue) {
    floatingContinue.addEventListener("click", () => {
      if (!selectedFlight) return;

      // Ensure we're on Flights tab (uses tabs.js)
      if (typeof window.FLYLOOP_SET_TAB === "function") window.FLYLOOP_SET_TAB("tabFlights");

      show(reviewCard, true);
      show(checkoutCard, false);

      if (reviewSummary) {
        reviewSummary.textContent =
          `Selected flight: ${selectedFlight.priceText} • ${selectedFlight.summaryText}`;
      }

      window.scrollTo({ top: reviewCard.offsetTop - 14, behavior: "smooth" });
    });
  }

  // Review back
  if (reviewBackBtn) {
    reviewBackBtn.addEventListener("click", () => {
      show(reviewCard, false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Review → Checkout
  if (reviewToCheckoutBtn) {
    reviewToCheckoutBtn.addEventListener("click", () => {
      if (!selectedFlight) return;

      show(reviewCard, false);
      show(checkoutCard, true);

      updateCheckoutSummary();
      showPill(checkoutStatus, "", false);

      window.scrollTo({ top: checkoutCard.offsetTop - 14, behavior: "smooth" });
    });
  }

  if (useCredits) {
    useCredits.addEventListener("change", updateCheckoutSummary);
  }

  // Checkout back
  if (checkoutBackBtn) {
    checkoutBackBtn.addEventListener("click", () => {
      show(checkoutCard, false);
      show(reviewCard, true);
      window.scrollTo({ top: reviewCard.offsetTop - 14, behavior: "smooth" });
    });
  }

  // Place booking (Demo)
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", () => {
      if (!selectedFlight) return;

      const price = moneyToNumber(selectedFlight.priceText);
      const use = !!useCredits?.checked;

      if (isFinite(price) && use) {
        creditBalance = Math.max(0, creditBalance - price);
      }

      updateCheckoutSummary();
      showPill(checkoutStatus, "Booked (Demo) ✅", true);
    });
  }
})();
