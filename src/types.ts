/**
 * streetmap-port types.
 *
 * All network access goes through an injectable FetchFn (the same
 * shape as the global fetch used here), so the OSM API mapping is
 * fully testable with fake responses and no live call.
 */

/** Minimal fetch signature the core needs. */
export type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/** One place result, normalised from a Nominatim response entry. */
export interface PlaceResult {
  place_id: number | null;
  osm_type: string | null;
  osm_id: number | null;
  display_name: string;
  latitude: number;
  longitude: number;
  type: string | null;
  category: string | null;
}

/** A nearby place from an Overpass response element. */
export interface NearbyPlace {
  osm_type: string;
  osm_id: number;
  name: string | null;
  category: string | null;
  latitude: number;
  longitude: number;
}
