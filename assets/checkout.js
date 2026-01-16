<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Checkout – FlyLoop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="assets/flights.css" />
</head>
<body>
  <div class="layout">
    <main class="content" style="padding-top:30px;">
      <div class="eyebrow">Checkout</div>
      <h1>Pay with FlyLoop credits</h1>

      <section class="card" aria-label="Checkout">
        <h3 style="margin-top:0;">Payment</h3>

        <div class="pill" id="checkoutSummary">—</div>

        <div class="mini-row" style="margin-top:12px;">
          <div class="pill" style="width:100%;">Available credits: <strong id="creditBalance">CAD 500.00</strong></div>
          <label class="check" style="width:100%; display:flex; align-items:center; gap:10px;">
            <input id="useCredits" type="checkbox" checked />
            Use credits for this booking
          </label>
        </div>

        <div class="actions" style="margin-top:16px;">
          <a class="btn-outline" href="flight-review.html">Back</a>
          <button class="btn-primary" id="bookBtn" type="button">Book now (Demo)</button>
          <span class="pill" id="status" style="display:none;"></span>
        </div>
      </section>
    </main>
  </div>

  <script>
    const PENDING_KEY = "flyloop_pending_flight";
    const ORDERS_KEY  = "flyloop_booked_flights";
    const CREDITS_KEY = "flyloop_credits";

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");

    let credits = Number(localStorage.getItem(CREDITS_KEY) || "500");
    const useCredits = document.getElementById("useCredits");
    const creditBalance = document.getElementById("creditBalance");
    const summary = document.getElementById("checkoutSummary");
    const status = document.getElementById("status");
    const bookBtn = document.getElementById("bookBtn");

    function showStatus(msg, show=true){
      status.style.display = show ? "inline-flex" : "none";
      status.textContent = msg;
    }

    function dueToday(price, use){
      if (!use) return price;
      return Math.max(0, price - credits);
    }

    function refresh(){
      creditBalance.textContent = `CAD ${credits.toFixed(2)}`;
      if (!pending) {
        summary.textContent = "No flight selected.";
        bookBtn.disabled = true;
        return;
      }
      const price = (typeof pending.price === "number") ? pending.price : null;
      if (!price) {
        summary.textContent = `Selected flight: ${pending.priceText} (demo)`;
        return;
      }
      const due = dueToday(price, useCredits.checked);
      summary.textContent = `Total: CAD ${price.toFixed(2)} • Due today: CAD ${due.toFixed(2)} • Credits used: ${useCredits.checked ? "Yes" : "No"}`;
    }

    useCredits.addEventListener("change", refresh);

    bookBtn.addEventListener("click", () => {
      if (!pending) return;

      // Save order
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      orders.unshift({ ...pending, status: "Booked", bookedAt: new Date().toISOString() });
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

      // Deduct credits if possible
      if (useCredits.checked && typeof pending.price === "number") {
        credits = Math.max(0, credits - pending.price);
        localStorage.setItem(CREDITS_KEY, String(credits));
      }

      // Clear pending
      localStorage.removeItem(PENDING_KEY);

      showStatus("Booked ✅ Added to My Booked Flights", true);

      // Go to booked flights page after booking
      window.location.href = "my-booked-flights.html";
    });

    refresh();
  </script>
</body>
</html>
