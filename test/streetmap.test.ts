import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StreetMapPort, haversineKm } from "../src/streetmap.js";
import type { FetchFn } from "../src/types.js";

const SEARCH = [
  { place_id: 1, osm_type: "relation", osm_id: 100, display_name: "San Francisco, California, United States", lat: "37.7749", lon: "-122.4194", type: "city", class: "place" },
];

function fakeFetch(payload: unknown, urls: string[]): FetchFn {
  return async (url) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) };
  };
}

describe("streetmap-port core", () => {
  it("geocode builds a Nominatim search URL and normalises results", async () => {
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch(SEARCH, urls));
    const places = await port.geocode("San Francisco", 3);
    assert.equal(places[0].latitude, 37.7749); assert.equal(places[0].longitude, -122.4194);
    assert.equal(places[0].category, "place"); assert.equal(places[0].osm_type, "relation");
    assert.ok(urls[0].includes("nominatim.openstreetmap.org/search"));
    assert.ok(urls[0].includes("limit=3")); assert.ok(urls[0].includes("q=San%20Francisco"));
  });
  it("geocode clamps the limit and requires a query", async () => {
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch([], urls));
    await port.geocode("x", 999);
    assert.ok(urls[0].includes("limit=50"));
    await assert.rejects(() => port.geocode(""), /query is required/);
  });
  it("searchPlaces uses the same search endpoint with its own default limit", async () => {
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch(SEARCH, urls));
    const places = await port.searchPlaces("coffee");
    assert.equal(places.length, 1); assert.ok(urls[0].includes("limit=10"));
  });
  it("a Nominatim error payload on search becomes a tool error", async () => {
    const port = new StreetMapPort(fakeFetch({ error: "Unable to geocode" }, []));
    await assert.rejects(() => port.geocode("???"), /Nominatim error: Unable to geocode/);
  });
  it("reverseGeocode hits /reverse and validates coordinate ranges first", async () => {
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch(SEARCH[0], urls));
    const place = await port.reverseGeocode(37.7749, -122.4194);
    assert.equal(place.display_name, SEARCH[0].display_name);
    assert.ok(urls[0].includes("/reverse"));
    await assert.rejects(() => port.reverseGeocode(91, 0), /latitude out of range/);
    await assert.rejects(() => port.reverseGeocode(0, -181), /longitude out of range/);
  });
  it("reverseGeocode surfaces the API's own error string", async () => {
    const port = new StreetMapPort(fakeFetch({ error: "Unable to geocode" }, []));
    await assert.rejects(() => port.reverseGeocode(0, 0), /Unable to geocode/);
  });
  it("getPlaceDetails maps osm_type to the Nominatim letter prefix", async () => {
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch(SEARCH, urls));
    await port.getPlaceDetails("way", 42);
    assert.ok(urls[0].includes("osm_ids=W42"));
    await assert.rejects(() => port.getPlaceDetails("planet", 1), /osm_type must be/);
  });
  it("getPlaceDetails reports a missing object honestly", async () => {
    const port = new StreetMapPort(fakeFetch([], []));
    await assert.rejects(() => port.getPlaceDetails("node", 999), /No OSM object found/);
  });
  it("findNearby builds an Overpass around query and maps elements", async () => {
    const payload = { elements: [{ type: "node", id: 7, lat: 37.775, lon: -122.419, tags: { name: "Blue Bottle", amenity: "cafe" } }] };
    const urls: string[] = []; const port = new StreetMapPort(fakeFetch(payload, urls));
    const near = await port.findNearby(37.7749, -122.4194, 500, "amenity", 5);
    assert.equal(near[0].name, "Blue Bottle"); assert.equal(near[0].category, "cafe");
    const decoded = decodeURIComponent(urls[0]);
    assert.ok(decoded.includes('node["amenity"](around:500,37.7749,-122.4194)'));
    assert.ok(urls[0].includes("overpass-api.de"));
  });
  it("findNearby rejects a category that could inject Overpass QL", async () => {
    const port = new StreetMapPort(fakeFetch({}, []));
    await assert.rejects(() => port.findNearby(0, 0, 100, 'amenity"];out;', 5), /bare OSM tag key/);
    await assert.rejects(() => port.findNearby(0, 0, 0), /radius must be > 0/);
  });
  it("an HTTP failure becomes a tool error naming the status", async () => {
    const failing: FetchFn = async () => ({ ok: false, status: 429, json: async () => ({}), text: async () => "rate limited" });
    const port = new StreetMapPort(failing);
    await assert.rejects(() => port.geocode("x"), /HTTP 429/);
  });
  it("distanceBetween is a local haversine with known reference values", async () => {
    const port = new StreetMapPort(fakeFetch(null, []));
    const sfOakland = await port.distanceBetween(37.7749, -122.4194, 37.8044, -122.2712);
    assert.ok(sfOakland.distance_km > 13 && sfOakland.distance_km < 14.5, `got ${sfOakland.distance_km}`);
    const same = await port.distanceBetween(10, 20, 10, 20);
    assert.equal(same.distance_km, 0);
    assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.195) < 0.01);
  });
});
