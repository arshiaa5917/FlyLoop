// assets/review.js
(() => {
  const PENDING_KEY = "flyloop_pending_flight";
  const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");

  const $ = (id) => document.getElementById(id);

  if (!pending) {
    $("route").textContent = "No flight selected";
    $("meta").textContent = "Go back and select a flight.";
    $("toCheckoutBtn").disabled = true;
    return;
  }

  $("route").textContent = `${pending.origin || "—"} → ${pending.destination || "—"}`;
  $("meta").textContent = `${pending.departDate || "—"} • ${pending.cabin || "ECONOMY"} • ${pending.adults || 1} passenger(s)`;

  $("departTime").textContent = pending.departTime || "—";
  $("arriveTime").textContent = pending.arriveTime || "—";
  $("price").textContent = pending.priceText || "CAD —";

  $("toCheckoutBtn").addEventListener("click", () => {
    // IMPORTANT: this must match the real filename you create below
    window.location.href = "flight-checkout.html";
  });
})();
