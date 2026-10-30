/**
 * streetmap-port core: six OpenStreetMap tools.
 *
 * Five map onto the public OSM APIs - Nominatim /search for
 * geocoding and place search, /reverse for reverse geocoding,
 * /lookup for object details, and an Overpass QL around-query for
 * nearby places of a category - and one (distance_between) is a
 * pure local haversine computation that makes no API call.
 *
 * The default fetch is the global fetch with a descriptive
 * User-Agent (required by the Nominatim usage policy). Coordinates
 * are validated to their legal ranges before any request is built,
 * API error payloads (Nominatim returns {error: ...} objects) are
 * surfaced as tool errors, and Overpass's category is whitelisted
 * to bare tag keys so a category string can never inject extra QL.
 */
import type { FetchFn, NearbyPlace, PlaceResult } from "./types.js";

export const VERSION = "0.1.0";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "streetmap-port/0.1.0 (MCP Rebuild 100)";

const defaultFetch: FetchFn = async (url, init) => {
  const res = await fetch(url, init as RequestInit);
  return { ok: res.ok, status: res.status, json: () => res.json(), text: () => res.text() };
};

function checkLatLon(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`latitude out of range: ${lat}`);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error(`longitude out of range: ${lon}`);
}

function toPlace(raw: Record<string, unknown>): PlaceResult {
  return {
    place_id: typeof raw.place_id === "number" ? raw.place_id : null,
    osm_type: typeof raw.osm_type === "string" ? raw.osm_type : null,
    osm_id: typeof raw.osm_id === "number" ? raw.osm_id : null,
    display_name: String(raw.display_name ?? ""),
    latitude: Number(raw.lat),
    longitude: Number(raw.lon),
    type: typeof raw.type === "string" ? raw.type : null,
    category: typeof raw.class === "string" ? raw.class : (typeof raw.category === "string" ? raw.category : null),
  };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export class StreetMapPort {
  private readonly fetchFn: FetchFn;
  constructor(fetchFn: FetchFn = defaultFetch) { this.fetchFn = fetchFn; }

  private async getJson(url: string): Promise<unknown> {
    const res = await this.fetchFn(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!res.ok) throw new Error(`OSM API request failed with HTTP ${res.status}: ${url.split("?")[0]}`);
    return res.json();
  }

  private async nominatimSearch(query: string, limit: number): Promise<PlaceResult[]> {
    const url = `${NOMINATIM}/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`;
    const data = await this.getJson(url);
    if (!Array.isArray(data)) {
      const msg = (data as { error?: unknown })?.error;
      throw new Error(`Nominatim error: ${typeof msg === "string" ? msg : "unexpected response"}`);
    }
    return data.map((entry) => toPlace(entry as Record<string, unknown>));
  }

  async geocode(query: string, limit = 5): Promise<PlaceResult[]> {
    if (!query) throw new Error("query is required");
    return this.nominatimSearch(query, Math.min(Math.max(limit, 1), 50));
  }

  async searchPlaces(query: string, limit = 10): Promise<PlaceResult[]> {
    if (!query) throw new Error("query is required");
    return this.nominatimSearch(query, Math.min(Math.max(limit, 1), 50));
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<PlaceResult> {
    checkLatLon(latitude, longitude);
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
    const data = (await this.getJson(url)) as Record<string, unknown>;
    if (typeof data.error === "string") throw new Error(`Nominatim error: ${data.error}`);
    return toPlace(data);
  }

  async getPlaceDetails(osmType: string, osmId: number): Promise<PlaceResult> {
    const prefix = { node: "N", way: "W", relation: "R" }[osmType];
    if (!prefix) throw new Error(`osm_type must be node, way or relation, got: ${osmType}`);
    if (!Number.isFinite(osmId) || osmId < 0) throw new Error(`osm_id must be a non-negative number, got: ${osmId}`);
    const url = `${NOMINATIM}/lookup?format=jsonv2&osm_ids=${prefix}${osmId}`;
    const data = await this.getJson(url);
    if (!Array.isArray(data) || data.length === 0) throw new Error(`No OSM object found for ${osmType} ${osmId}`);
    return toPlace(data[0] as Record<string, unknown>);
  }

  async findNearby(latitude: number, longitude: number, radius = 1000, category = "amenity", limit = 20): Promise<NearbyPlace[]> {
    checkLatLon(latitude, longitude);
    if (radius <= 0) throw new Error("radius must be > 0");
    if (!/^[a-z_]+$/.test(category)) throw new Error(`category must be a bare OSM tag key (letters/underscore), got: ${category}`);
    const ql = `[out:json][timeout:25];node["${category}"](around:${radius},${latitude},${longitude});out body ${Math.min(Math.max(limit, 1), 100)};`;
    const url = `${OVERPASS}?data=${encodeURIComponent(ql)}`;
    const data = (await this.getJson(url)) as { elements?: Array<Record<string, unknown>> };
    const elements = data.elements ?? [];
    return elements.map((el) => {
      const tags = (el.tags ?? {}) as Record<string, unknown>;
      return {
        osm_type: String(el.type ?? "node"),
        osm_id: Number(el.id),
        name: typeof tags.name === "string" ? tags.name : null,
        category: typeof tags[category] === "string" ? (tags[category] as string) : category,
        latitude: Number(el.lat),
        longitude: Number(el.lon),
      };
    });
  }

  async distanceBetween(fromLat: number, fromLon: number, toLat: number, toLon: number): Promise<{ distance_km: number }> {
    checkLatLon(fromLat, fromLon); checkLatLon(toLat, toLon);
    return { distance_km: Math.round(haversineKm(fromLat, fromLon, toLat, toLon) * 1000) / 1000 };
  }
}
