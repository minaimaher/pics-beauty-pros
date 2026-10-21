// Launch-market cities with centre coordinates, used for location and radius search.
export const CITIES = {
  EG: {
    Cairo: [30.0444, 31.2357],
    Giza: [30.0131, 31.2089],
    'New Cairo': [30.0074, 31.4913],
    'Sheikh Zayed': [30.0444, 30.9758],
    Alexandria: [31.2001, 29.9187],
    Mansoura: [31.0409, 31.3785],
    Hurghada: [27.2579, 33.8116]
  },
  SA: {
    Riyadh: [24.7136, 46.6753],
    Jeddah: [21.4858, 39.1925],
    Mecca: [21.3891, 39.8579],
    Medina: [24.5247, 39.5692],
    Dammam: [26.4207, 50.0888],
    Khobar: [26.2172, 50.1971]
  }
};

export const CURRENCY = { EG: 'EGP', SA: 'SAR' };
export const CATEGORIES = ['photographer', 'videographer', 'makeup', 'hair'];

export function cityCoords(country, city) {
  return CITIES[country]?.[city] || null;
}

export function distanceKm([lat1, lng1], [lat2, lng2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
