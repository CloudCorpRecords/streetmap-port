/**
 * streetmap-port MCP server. Tools: geocode_address,
 * reverse_geocode, search_places, find_nearby, get_place_details,
 * distance_between.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects two keys
 * that are not in this toolset's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file therefore serves tools/list with
 * the spec's exact input schemas, while zod still validates every
 * tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { StreetMapPort, VERSION } from "./streetmap.js";

const QueryArgs = z.object({ query: z.string(), limit: z.number().optional() });
const LatLonArgs = z.object({ latitude: z.number(), longitude: z.number() });
const NearbyArgs = z.object({ latitude: z.number(), longitude: z.number(), radius: z.number().optional(), category: z.string().optional(), limit: z.number().optional() });
const DetailsArgs = z.object({ osm_type: z.string(), osm_id: z.number() });
const DistanceArgs = z.object({ from_latitude: z.number(), from_longitude: z.number(), to_latitude: z.number(), to_longitude: z.number() });

const str = { type: "string" as const };
const num = { type: "number" as const };
const TOOLS = [
  { name: "geocode_address", description: "Geocode a free-form address or place name to coordinates via the OSM Nominatim API", inputSchema: { type: "object" as const, properties: { limit: { ...num, description: "Optional maximum number of geocoding results to return; defaults to 5 and is clamped to 1-50." }, query: { ...str, description: "Free-form address or place name to geocode to coordinates." } }, required: ["query"] } },
  { name: "reverse_geocode", description: "Reverse geocode coordinates to the nearest address via the OSM Nominatim API", inputSchema: { type: "object" as const, properties: { latitude: { ...num, description: "Latitude in decimal degrees, from -90 to 90, of the point to reverse geocode." }, longitude: { ...num, description: "Longitude in decimal degrees, from -180 to 180, of the point to reverse geocode." } }, required: ["latitude", "longitude"] } },
  { name: "search_places", description: "Search for places by name via the OSM Nominatim API", inputSchema: { type: "object" as const, properties: { limit: { ...num, description: "Optional maximum number of place results to return; defaults to 10 and is clamped to 1-50." }, query: { ...str, description: "Place name or search text to look up via Nominatim." } }, required: ["query"] } },
  { name: "find_nearby", description: "Find places of a category near coordinates via the OSM Overpass API", inputSchema: { type: "object" as const, properties: { category: { ...str, description: "Optional bare OpenStreetMap tag key (letters and underscores only, for example 'amenity') whose tagged nodes to find nearby; defaults to 'amenity'." }, latitude: { ...num, description: "Latitude in decimal degrees, from -90 to 90, of the centre point to search around." }, limit: { ...num, description: "Optional maximum number of nearby places to return; defaults to 20 and is clamped to 1-100." }, longitude: { ...num, description: "Longitude in decimal degrees, from -180 to 180, of the centre point to search around." }, radius: { ...num, description: "Optional search radius in metres around the coordinates; defaults to 1000 and must be greater than 0." } }, required: ["latitude", "longitude"] } },
  { name: "get_place_details", description: "Get details of one OSM object (node, way or relation) via the Nominatim lookup API", inputSchema: { type: "object" as const, properties: { osm_id: { ...num, description: "Numeric OpenStreetMap identifier of the object to look up; must be non-negative." }, osm_type: { ...str, description: "Type of OpenStreetMap object to look up: 'node', 'way', or 'relation'." } }, required: ["osm_type", "osm_id"] } },
  { name: "distance_between", description: "Compute the great-circle distance in kilometres between two coordinate pairs (local, no API call)", inputSchema: { type: "object" as const, properties: { from_latitude: { ...num, description: "Latitude in decimal degrees, from -90 to 90, of the starting point." }, from_longitude: { ...num, description: "Longitude in decimal degrees, from -180 to 180, of the starting point." }, to_latitude: { ...num, description: "Latitude in decimal degrees, from -90 to 90, of the destination point." }, to_longitude: { ...num, description: "Longitude in decimal degrees, from -180 to 180, of the destination point." } }, required: ["from_latitude", "from_longitude", "to_latitude", "to_longitude"] } },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const port = new StreetMapPort();
const server = new Server({ name: "streetmap-port", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "geocode_address": { const p = QueryArgs.parse(args ?? {}); return textResult(await port.geocode(p.query, p.limit)); }
      case "reverse_geocode": { const p = LatLonArgs.parse(args ?? {}); return textResult(await port.reverseGeocode(p.latitude, p.longitude)); }
      case "search_places": { const p = QueryArgs.parse(args ?? {}); return textResult(await port.searchPlaces(p.query, p.limit)); }
      case "find_nearby": { const p = NearbyArgs.parse(args ?? {}); return textResult(await port.findNearby(p.latitude, p.longitude, p.radius, p.category, p.limit)); }
      case "get_place_details": { const p = DetailsArgs.parse(args ?? {}); return textResult(await port.getPlaceDetails(p.osm_type, p.osm_id)); }
      case "distance_between": { const p = DistanceArgs.parse(args ?? {}); return textResult(await port.distanceBetween(p.from_latitude, p.from_longitude, p.to_latitude, p.to_longitude)); }
    }
  } catch (err) { return errorResult(err); }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> { await server.connect(new StdioServerTransport()); }
void main();
