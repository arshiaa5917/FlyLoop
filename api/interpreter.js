// api/interpreter.js (CommonJS)
// Converts Amadeus Flight Offers Search response into a simple structure
// that your frontend can render (segments with departure/arrival times).

function isoDurationToMinutes(iso) {
  // e.g. "PT5H28M"
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^P(T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i);
  if (!m) return null;
  const hours = parseInt(m[2] || "0", 10);
  const mins = parseInt(m[3] || "0", 10);
  const secs = parseInt(m[4] || "0", 10);
  return hours * 60 + mins + Math.round(secs / 60);
}

function safeStr(x) {
  return (x == null) ? "" : String(x);
}

function pickCarrierName(code, dictionaries) {
  const carriers = dictionaries?.carriers || {};
  return carriers[code] || code; // fallback to code
}

function interpretAmadeus(amadeusResponse) {
  const offersRaw = amadeusResponse?.data;
  if (!Array.isArray(offersRaw)) return [];

  const dictionaries = amadeusResponse?.dictionaries || {};
  const out = [];

  for (const offer of offersRaw) {
    const currency =
      offer?.price?.currency ||
      offer?.price?.currencyCode ||
      "CAD";

    const total =
      offer?.price?.grandTotal ||
      offer?.price?.total ||
      offer?.price?.base ||
      "—";

    // We’ll use validating airline code as “airline”
    const validating = Array.isArray(offer?.validatingAirlineCodes)
      ? offer.validatingAirlineCodes[0]
      : "";

    // Best display: name if available, else code
    const airlineCode = safeStr(validating || offer?.itineraries?.[0]?.segments?.[0]?.carrierCode || "");
    const airline = pickCarrierName(airlineCode, dictionaries);

    // Flatten first itinerary segments (one-way)
    const itin = offer?.itineraries?.[0];
    const segs = Array.isArray(itin?.segments) ? itin.segments : [];

    const segments = segs.map((s) => {
      const from = safeStr(s?.departure?.iataCode).toUpperCase();
      const to = safeStr(s?.arrival?.iataCode).toUpperCase();
      const departure = safeStr(s?.departure?.at); // ISO timestamp
      const arrival = safeStr(s?.arrival?.at);     // ISO timestamp
      const carrier = safeStr(s?.carrierCode || airlineCode).toUpperCase();
      const flightNumber = safeStr(s?.number);

      return { from, to, departure, arrival, carrier, flightNumber };
    }).filter(s => s.from && s.to && s.departure && s.arrival);

    // stops
    const stops = Math.max(0, segments.length - 1);

    // duration (Amadeus provides itinerary duration as ISO)
    const durationMins = isoDurationToMinutes(itin?.duration);
    const duration = (durationMins != null)
      ? `${Math.floor(durationMins / 60)}h ${String(durationMins % 60).padStart(2, "0")}m`
      : null;

    out.push({
      id: offer?.id || undefined,
      currency,
      total,
      airline: airlineCode || "—", // keep code for compact UI (PD/AC/WS)
      airlineName: airline,        // full name available if you want later
      stops,
      durationMins,
      duration,
      segments,
      // useful extras (optional)
      raw: undefined, // set to offer if you want debugging (careful: huge)
    });
  }

  return out;
}

module.exports = { interpretAmadeus };
