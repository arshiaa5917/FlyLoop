// api/interpreter.js (CommonJS)

function parseIsoDuration(iso) {
  if (!iso || typeof iso !== "string") return "";
  const h = (iso.match(/(\d+)H/) || [])[1];
  const m = (iso.match(/(\d+)M/) || [])[1];
  const parts = [];
  if (h) parts.push(`${Number(h)}h`);
  if (m) parts.push(`${Number(m)}m`);
  return parts.join(" ") || iso;
}

function safeTime(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return String(isoDateTime);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function interpretItinerary(itinerary) {
  const segments = itinerary?.segments || [];
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];

  const from = first?.departure?.iataCode || "";
  const to = last?.arrival?.iataCode || "";

  const departAt = first?.departure?.at || "";
  const arriveAt = last?.arrival?.at || "";

  const stops = Math.max(0, segments.length - 1);
  const stopAirports = segments.slice(0, -1).map(s => s?.arrival?.iataCode).filter(Boolean);

  const airlines = [...new Set(segments.map(s => s?.carrierCode).filter(Boolean))];

  return {
    from,
    to,
    departAt,
    arriveAt,
    departTime: safeTime(departAt),
    arriveTime: safeTime(arriveAt),

    duration: itinerary?.duration || "",
    durationLabel: parseIsoDuration(itinerary?.duration || ""),

    stops,
    stopAirports,
    airlines,

    segments: segments.map((s) => ({
      from: s?.departure?.iataCode || "",
      to: s?.arrival?.iataCode || "",
      departureAt: s?.departure?.at || "",
      arrivalAt: s?.arrival?.at || "",
      departureTime: safeTime(s?.departure?.at),
      arrivalTime: safeTime(s?.arrival?.at),
      carrier: s?.carrierCode || "",
      flightNumber: s?.number || "",
      duration: s?.duration || "",
      durationLabel: parseIsoDuration(s?.duration || ""),
    })),
  };
}

function interpretAmadeus(amadeusPayload) {
  const data = amadeusPayload?.data || [];

  return data.map((offer) => {
    const itineraries = offer?.itineraries || [];
    const outbound = interpretItinerary(itineraries[0]);
    const inbound = itineraries[1] ? interpretItinerary(itineraries[1]) : null;

    const airline =
      outbound?.airlines?.[0] ||
      offer?.validatingAirlineCodes?.[0] ||
      "";

    return {
      id: offer?.id || "",
      airline,

      // price fields Amadeus returns
      total: offer?.price?.grandTotal ?? offer?.price?.total ?? null,
      currency: offer?.price?.currency ?? "USD",

      outbound,
      inbound,
      stops: outbound?.stops ?? 0,

      // for debugging if needed (keep OFF in prod)
      // raw: offer,
    };
  });
}

module.exports = { interpretAmadeus };
