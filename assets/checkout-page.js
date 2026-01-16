// assets/checkout-page.js
(() => {
  const PENDING_KEY = "flyloop_pending_flight";
  const ORDERS_KEY  = "flyloop_orders";
  const CREDITS_KEY = "flyloop_credits";

  const $ = (id) => document.getElementById(id);

  const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
  let credits = Number(localStorage.getItem(CREDITS_KEY) || "500");

  function showStatus(msg, show=true){
    const el = $("status");
    if (!el) return;
    el.style.display = show ? "inline-flex" : "none";
    el.textContent = msg;
  }

  if (!pending) {
    $("total").textContent = "—";
    $("bookBtn").disabled = true;
    showStatus("No flight selected.", true);
    return;
  }

  $("credits").textContent = `CAD ${credits.toFixed(2)}`;
  $("total").textContent = pending.priceText || "CAD —";

  $("bookBtn").addEventListener("click", () => {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    orders.unshift({ ...pending, status: "Booked", bookedAt: new Date().toISOString() });
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    // Deduct credits (demo)
    if ($("useCredits")?.checked && typeof pending.price === "number") {
      credits = Math.max(0, credits - pending.price);
      localStorage.setItem(CREDITS_KEY, String(credits));
    }

    localStorage.removeItem(PENDING_KEY);
    showStatus("Booked ✅ Added to My Orders", true);

    window.location.href = "my-orders.html";
  });
})();
