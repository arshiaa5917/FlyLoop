export function interpretAmadeus(amadeus) {
  return (amadeus.data || []).map(offer => {
    const itin = offer.itineraries[0];
    const segments = itin.segments;

    const dep = segments[0].departure;
    const arr = segments[segments.length - 1].arrival;

    return {
      id: offer.id,

      airline: segments[0].carrierCode,
      price: offer.price.grandTotal,

      departureTime: dep.at,
      arrivalTime: arr.at,

      duration: itin.duration,
      stops: segments.length - 1,

      from: dep.iataCode,
      to: arr.iataCode
    };
  });
}
