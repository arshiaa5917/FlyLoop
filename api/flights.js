// api/flights.js (Vercel Serverless Function - CommonJS)
const { interpretAmadeus } = require("./interpreter.js");

let cachedToken = null;
let cachedTokenExpMs = 0;

function send(res, status, data) {
  res.status(status).json(data);
}

function normalizeIata(v) {
  return String(v || "").trim().toUpperCase();
}

function isIata3(v) {
  return /^[A-Z]{3}$/.test(String(v || "").trim().toUpperCase());
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

function pickBaseUrl() {
  const env = (process.env.AMADEUS_ENV || "test").toLowerCase();
  return env === "prod" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";
}

function setCors(res) {
  // Safe default for your use (same-domain). This also allows testing from elsewhere.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function getAccessToken() {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;

  if (!key || !secret) {
    throw new Error("Missing AMADEUS_API_KEY or AMADEUS_API_SECRET env vars.");
  }

  const now = Date.now();
  // refresh 60s early (safer than 30s)
  if (cachedToken && cachedTokenExpMs - now > 60_000) return cachedToken;

  const base = pickBaseUrl();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: key,
    client_secret: secret,
  }).toString();

  const r = await fetch(`${base}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const t = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(t?.error_description || t?.error || `Failed to get access token (${r.status})`);
  }

  cachedToken = t.access_token;
  const expiresSec = Number(t.expires_in || 0);
  cachedTokenExpMs = Date.now() + (expiresSec > 0 ? expiresSec * 1000 : 15 * 60 * 1000); // fallback 15m
  return cachedToken;
}

module.exports = async (req, res) => {
  try {
    setCors(res);

    // Preflight support (good practice)
    if (req.method === "OPTIONS") {
      return send(res, 204, {});
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      return send(res, 405, { error: "Method not allowed. Use GET." });
    }

    const origin = normalizeIata(req.query.origin);
    const destination = normalizeIata(req.query.destination);
    const date = String(req.query.date || "").trim();

    const adults = Math.max(1, Math.min(9, parseInt(req.query.adults || "1", 10) || 1));
    const currency = String(req.query.currency || "CAD").trim().toUpperCase();

    // New: allow cabin + max
    const cabin = String(req.query.cabin || "").trim().toUpperCase(); // ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST
    const max = Math.max(1, Math.min(50, parseInt(req.query.max || "20", 10) || 20));

    if (!isIata3(origin)) {
      return send(res, 400, { error: "origin must be a 3-letter IATA code (e.g., YYZ)." });
    }

    if (!isIata3(destination)) {
      return send(res, 400, { error: "destination must be a 3-letter IATA code (e.g., MIA)." });
    }

    if (origin === destination) {
      return send(res, 400, { error: "origin and destination cannot be the same." });
    }

    if (!isIsoDate(date)) {
      return send(res, 400, { error: "date must be YYYY-MM-DD." });
    }

    // Build query for Amadeus
    const base = pickBaseUrl();
    const token = await getAccessToken();

    const qsObj = {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: date,
      adults: String(adults),
      currencyCode: currency,
      max: String(max),
    };

    // Amadeus expects travelClass values:
    // ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
    if (cabin && ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"].includes(cabin)) {
      qsObj.travelClass = cabin;
    }

    const qs = new URLSearchParams(qsObj).toString();

    const r = await fetch(`${base}/v2/shopping/flight-offers?${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const err = data?.errors?.[0];
      return send(res, r.status, {
        error:
          err?.detail ||
          err?.title ||
          err?.code ||
          `Flight search failed (${r.status})`,
        // keep raw for debugging, you can remove later:
        raw: data,
      });
    }

    // Convert Amadeus shape -> your frontend shape
    const offers = interpretAmadeus(data);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    return send(res, 200, {
      query: { origin, destination, date, adults, currency, cabin: cabin || null, max },
      offers,
    });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Server error" });
  }
};
