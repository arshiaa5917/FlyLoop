// api/flights.js
// Vercel Serverless Function: /api/flights
// Uses Amadeus Self-Service APIs (OAuth2 + Flight Offers Search)
// Env vars required:
//   AMADEUS_API_KEY
//   AMADEUS_API_SECRET
// Optional:
//   AMADEUS_ENV = "test" (default) or "prod"

let cachedToken = null;
let cachedTokenExpMs = 0;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function normalizeIata(v) {
  return String(v || "").trim().toUpperCase();
}

function isIsoDate(v) {
  // Accept YYYY-MM-DD only (simple validation)
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

async function getAccessToken() {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;

  if (!key || !secret) {
    throw new Error("Missing AMADEUS_API_KEY or AMADEUS_API_SECRET env vars.");
  }

  // Reuse token if still valid (with 30s safety buffer)
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
    const msg = t?.error_description || t?.error || "Failed to get access token";
    throw new Error(msg);
  }

  cachedToken = t.access_token;
  cachedTokenExpMs = Date.now() + (Number(t.expires_in || 0) * 1000);
  return cachedToken;
}

export default async function handler(req, res) {
  try {
    // Only allow GET
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { error: "Method not allowed. Use GET." });
    }

    const origin = normalizeIata(req.query.origin);
    const destination = normalizeIata(req.query.destination);
    const date = String(req.query.date || "").trim();
    const adults = Math.max(1, Math.min(9, parseInt(req.query.adults || "1", 10) || 1));
    const currency = String(req.query.currency || "CAD").trim().toUpperCase();

    if (!origin || origin.length !== 3) {
      return json(res, 400, { error: "origin must be a 3-letter IATA code (e.g., YYZ)." });
    }
    if (!destination || destination.length !== 3) {
      return json(res, 400, { error: "destination must be a 3-letter IATA code (e.g., MIA)." });
    }
    if (!isIsoDate(date)) {
      return json(res, 400, { error: "date must be YYYY-MM-DD." });
    }

    const env = (process.env.AMADEUS_ENV || "test").toLowerCase();
    const base = env === "prod" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";

    const token = await getAccessToken();

    // Flight Offers Search (one-way)
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
      // Amadeus errors are usually in data.errors[]
      const err = data?.errors?.[0];
      return json(res, r.status, {
        error: err?.detail || err?.title || "Flight search failed",
        raw: data,
      });
    }

    // Convert Amadeus payload to a clean, frontend-friendly list
    const offers = (data.data || []).map((offer) => {
      const total = offer?.price?.total;
      const currencyOut = offer?.price?.currency;

      // Use first itinerary for one-way; each itinerary has segments
      const itinerary = offer?.itineraries?.[0];
      const segs = (itinerary?.segments || []).map((s) => ({
        from: s?.departure?.iataCode,
        to: s?.arrival?.iataCode,
        departure: s?.departure?.at,
        arrival: s?.arrival?.at,
        carrier: s?.carrierCode,
        flightNumber: s?.number,
        duration: s?.duration,
      }));

      // pick a "marketing" airline (first segment carrier)
      const airline = segs[0]?.carrier || offer?.validatingAirlineCodes?.[0] || "";

      return {
        id: offer?.id,
        total,
        currency: currencyOut,
        airline,
        segments: segs,
        stops: Math.max(0, segs.length - 1),
      };
    });

    // Helpful cache header (short)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    return json(res, 200, {
      query: { origin, destination, date, adults, currency },
      offers,
      meta: data?.meta || {},
    });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}
