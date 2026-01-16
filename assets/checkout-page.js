// assets/checkout-page.js
(() => {
  const PENDING_KEY = "flyloop_pending_flight";
  const ORDERS_KEY  = "flyloop_orders";
  const CREDITS_KEY = "flyloop_credits";

  // ✅ IMPORTANT: put your real orders page file here
  const ORDERS_PAGE = "my-orders.html"; // <-- change if yours is different

  const $ = (id) => document.getElementById(id);

  function showStatus(msg, show = true) {
    const el = $("status");
    if (!el) return;
    el.style.display = show ? "inline-flex" : "none";
    el.textContent = msg;
  }

  const pendingRaw = localStorage.getItem(PENDING_KEY);
  const pending = pendingRaw ? JSON.parse(pendingRaw) : null;

  if (!pending) {
    $("total").textContent = "—";
    $("bookBtn").disabled = true;
    showStatus("No flight selected. Go back and pick a flight first.");
    return;
  }

  // Fill UI
  const priceNum = typeof pending.price === "number" ? pending.price : null;

  let credits = Number(localStorage.getItem(CREDITS_KEY) || "500");
  $("credits").textContent = `CAD ${credits.toFixed(2)}`;
  $("total").textContent = pending.priceText || (priceNum ? `CAD ${priceNum.toFixed(2)}` : "CAD —");

  $("bookBtn").addEventListener("click", () => {
    try {
      // Load existing orders
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");

      // Create new order object
      const order = {
        ...pending,
        orderType: "flight",
        status: "Booked",
        bookedAt: new Date().toISOString(),
      };

      // Save at top
      orders.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

      // Debug helper (optional but useful)
      localStorage.setItem("flyloop_last_order_debug", JSON.stringify(order));

      // Deduct credits (demo)
      if ($("useCredits")?.checked && priceNum !== null) {
        credits = Math.max(0, credits - priceNum);
        localStorage.setItem(CREDITS_KEY, String(credits));
      }

      // Clear pending
      localStorage.removeItem(PENDING_KEY);

      showStatus("Booked ✅ Redirecting to My Orders…");

      // Redirect (fix 404 by matching filename)
      window.location.href = ORDERS_PAGE;
    } catch (err) {
      console.error(err);
      showStatus("Error saving order. Open console to see details.");
    }
  });
})();
