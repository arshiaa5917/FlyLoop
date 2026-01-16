// assets/checkout.js
(() => {
  const PENDING_KEY = "flyloop_pending_flight";
  const $ = (id) => document.getElementById(id);

  const resultsRoot = $("flightResults");
  const floatingBtn = $("floatingContinue"); // if you use the bottom-right continue button

  if (!resultsRoot) return;

  function text(el) {
    return String(el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractPrice(textBlob) {
    // Prefer "CAD 240.68"
    const m1 = textBlob.match(/\bCAD\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i);
    if (m1) return Number(m1[1]);
    // Fallback "$240.68"
    const m2 = textBlob.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
    if (m2) return Number(m2[1]);
    return null;
  }

  function extractTimesFromCard(card) {
    // If your card contains times like "9:40 AM" and "1:09 PM"
    const blob = text(card);
    const times = blob.match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/gi) || [];
    return {
      departTime: times[0] || "",
      arriveTime: times[1] || ""
    };
  }

  let hasSelection = false;

  function showContinue(show) {
    hasSelection = !!show;
    if (!floatingBtn) return;
    floatingBtn.hidden = !show;
    floatingBtn.disabled = !show;
  }

  showContinue(false);

  resultsRoot.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const label = text(btn).toLowerCase();
    const isSelect = label.includes("select") || label.includes("apply") || label.includes("selected");
    if (!isSelect) return;

    const card =
      btn.closest(".flight-card") ||
      btn.closest(".result-item") ||
      btn.closest(".result") ||
      btn.closest("article") ||
      btn.closest("section") ||
      btn.closest("div");

    const origin = ($("fromIata")?.value || "").trim().toUpperCase();
    const destination = ($("toIata")?.value || "").trim().toUpperCase();
    const departDate = $("departDate")?.value || "";
    const cabin = $("cabin")?.value || "ECONOMY";
    const adults = Number($("adults")?.value || "1");

    const blob = text(card);
    const price = extractPrice(blob);
    const times = extractTimesFromCard(card);

    const pending = {
      id: "FL-" + Math.random().toString(16).slice(2, 10).toUpperCase(),
      createdAt: new Date().toISOString(),
      origin,
      destination,
      departDate,
      cabin,
      adults,
      price,
      priceText: typeof price === "number" ? `CAD ${price.toFixed(2)}` : "CAD —",
      ...times
    };

    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

    // Optional: highlight selected card
    document.querySelectorAll(".flight-card.selected").forEach(el => el.classList.remove("selected"));
    if (card?.classList) card.classList.add("selected");

    // Show bottom-right continue if you use it
    showContinue(true);

    // If you want to go immediately without floating button, uncomment:
    // window.location.href = "flight-review.html";
  }, true);

  if (floatingBtn) {
    floatingBtn.addEventListener("click", () => {
      if (!hasSelection) return;
      window.location.href = "flight-review.html";
    });
  }
})();
