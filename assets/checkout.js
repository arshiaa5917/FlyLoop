// assets/checkout.js
(() => {
  const PENDING_KEY = "flyloop_pending_flight";
  const $ = (id) => document.getElementById(id);

  const resultsRoot = $("flightResults");
  const floatingBtn = $("floatingContinue");

  if (!resultsRoot || !floatingBtn) return;

  function normalize(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }

  function extractFlightFromCard(card) {
    const text = (card?.innerText || "").replace(/\s+/g, " ").trim();

    // price (CAD 123.45 / $123.45)
    const priceMatch = text.match(/\bCAD\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i) || text.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
    const price = priceMatch ? Number(priceMatch[1]) : null;

    // IATA codes
    const iatas = [...text.matchAll(/\b[A-Z]{3}\b/g)].map(m => m[0]);
    const origin = iatas[0] || "";
    const destination = iatas[1] || "";

    const departDate = $("#departDate")?.value || "";
    const cabin = $("#cabin")?.value || "ECONOMY";
    const adults = Number($("#adults")?.value || "1");

    return {
      id: "FL-" + Math.random().toString(16).slice(2, 10).toUpperCase(),
      createdAt: new Date().toISOString(),
      origin,
      destination,
      departDate,
      cabin,
      adults,
      price,
      priceText: typeof price === "number" ? `CAD ${price.toFixed(2)}` : "CAD —",
      rawSummary: text.slice(0, 600)
    };
  }

  // Track “selected” UI so we can show Continue only after selection
  let hasSelection = false;

  function showContinue(show) {
    floatingBtn.hidden = !show;
    floatingBtn.disabled = !show;
    hasSelection = !!show;
  }

  // Default: hidden
  showContinue(false);

  // When user clicks Apply/Select on a flight
  resultsRoot.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const label = normalize(btn.textContent);
    const isSelect =
      label.includes("apply") ||
      label.includes("select") ||
      label.includes("selected");

    if (!isSelect) return;

    // Try to find the whole flight “card”
    const card =
      btn.closest(".flight-card") ||
      btn.closest(".result-item") ||
      btn.closest(".result") ||
      btn.closest("article") ||
      btn.closest("section") ||
      btn.closest("div");

    // Save selected flight
    const pending = extractFlightFromCard(card);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

    // ✅ Show Continue bottom-right
    showContinue(true);

    // OPTIONAL: you can also visually highlight the card if needed
    // (only if your flight cards share a class like .flight-card)
    document.querySelectorAll(".flight-card.selected").forEach(el => el.classList.remove("selected"));
    if (card && card.classList) card.classList.add("selected");
  }, true);

  // Continue → go to review page
  floatingBtn.addEventListener("click", () => {
    if (!hasSelection) return;
    window.location.href = "flight-review.html";
  });
})();
