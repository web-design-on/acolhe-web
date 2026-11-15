/** Link do Google Maps para um endereço ou coordenadas ("lat,lng"). */
export function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
