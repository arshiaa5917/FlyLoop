// api/flights.js (Vercel Serverless Function - CommonJS)

let cachedToken = null;
let cachedTokenExpMs = 0;

function send(res, status, data) {
  res.status(status).json(data);
}

function normalizeIata(v) {
  return String(v || "").trim().toUpperCase();
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

async function getAccessToken() {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;

  if (!key || !secret) {
    throw new Error("Missing AMADEUS_API_KEY or AMADEUS_API_SECRET env vars.");
  }

  const now = Date.now();
  if (cachedToken && cachedTokenExpMs - now > 30_000) return cachedToken;

  const env = (process.env.AMADEUS_ENV || "test").toLowerCase();
  const base = env === "prod" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";

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
    throw new Error(t?.error_description || t?.error || "Failed to get access token");
  }

  cachedToken = t.access_token;
  cachedTokenExpMs = Date.now() + (Number(t.expires_in || 0) * 1000);
  return cachedToken;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { error: "Method not allowed. Use GET." });
    }

    const origin = normalizeIata(req.query.origin);
    const destination = normalizeIata(req.query.destination);
    const date = String(req.query.date || "").trim();
    const adults = Math.max(1, Math.min(9, parseInt(req.query.adults || "1", 10) || 1));
    const currency = String(req.query.currency || "CAD").trim().toUpperCase();

    if (!origin || origin.length !== 3) return send(res, 400, { error: "origin must be a 3-letter IATA code (e.g., YYZ)." });
    if (!destination || destination.length !== 3) return send(res, 400, { error: "destination must be a 3-letter IATA code (e.g., MIA)." });
    if (!isIsoDate(date)) return send(res, 400, { error: "date must be YYYY-MM-DD." });

    const env = (process.env.AMADEUS_ENV || "test").toLowerCase();
    const base = env === "prod" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";

    const token = await getAccessToken();

    const qs = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: date,
      adults: String(adults),
      currencyCode: currency,
      max: "10",
    }).toString();

    const r = await fetch(`${base}/v2/shopping/flight-offers?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = data?.errors?.[0];
      return send(res, r.status, { error: err?.detail || err?.title || "Flight search failed", raw: data });
    }

    const offers = (data.data || []).map((offer) => {
      const itinerary = offer?.itineraries?.[0];
      const segs = (itinerary?.segments || []).map((s) => ({
        from: s?.departure?.iataCode,
        to: s?.arrival?.iataCode,
        departure: s?.departure?.at,
        arrival: s?.arrival?.at,
        carrier: s?.carrierCode,
        flightNumber: s?.number,
      }));

      return {
        id: offer?.id,
        total: offer?.price?.total,
        currency: offer?.price?.currency,
        airline: segs[0]?.carrier || offer?.validatingAirlineCodes?.[0] || "",
        segments: segs,
        stops: Math.max(0, segs.length - 1),
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return send(res, 200, { query: { origin, destination, date, adults, currency }, offers });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Server error" });
  }
};
