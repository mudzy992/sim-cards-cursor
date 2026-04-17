type OsmEmbedParams = {
  readonly latitude: number
  readonly longitude: number
  readonly radiusMeters?: number
}

const DEFAULT_RADIUS_METERS = 50

const clampLatitude = (latitude: number) => Math.max(-90, Math.min(90, latitude))

const clampLongitude = (longitude: number) => {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180
  return normalized
}

const degreesPerMeterLatitude = 1 / 111_320

export const buildOsmEmbedUrl = ({ latitude, longitude, radiusMeters }: OsmEmbedParams) => {
  const safeLatitude = clampLatitude(latitude)
  const safeLongitude = clampLongitude(longitude)
  const r = radiusMeters ?? DEFAULT_RADIUS_METERS

  const deltaLat = r * degreesPerMeterLatitude
  const latRad = (safeLatitude * Math.PI) / 180
  const cosLat = Math.max(0.000001, Math.abs(Math.cos(latRad)))
  const deltaLon = deltaLat / cosLat

  const left = safeLongitude - deltaLon
  const bottom = safeLatitude - deltaLat
  const right = safeLongitude + deltaLon
  const top = safeLatitude + deltaLat

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${safeLatitude},${safeLongitude}`
}
