# streetmap-port

OpenStreetMap geography as a CLI and a stdio MCP server in one
bin: geocode a name to coordinates, reverse geocode coordinates to
an address, search places, look up an OSM object by type and id,
find places of a category near a point, and compute great-circle
distances locally.

Geocoding, reverse geocoding and lookup use the public Nominatim
API (with the descriptive User-Agent its usage policy requires);
nearby search uses the public Overpass API. All requests go through
an injectable fetch function, coordinates are validated before any
request is built, and API error payloads are surfaced as errors —
never replaced with invented places. `distance_between` is a pure
local haversine computation and makes no API call.

## Install

```bash
npx -y @reneturcios/streetmap-port mcp
```

## CLI

```bash
streetmap-port mcp
streetmap-port geocode <query...>
streetmap-port reverse <lat> <lon>
streetmap-port search <query...>
streetmap-port nearby <lat> <lon> [category] [radius-m]
streetmap-port distance <lat1> <lon1> <lat2> <lon2>
streetmap-port --version
```

Exit codes: 0 success, 1 API/validation error, 2 usage error.

## MCP tools

| Tool | Purpose |
|---|---|
| `geocode_address` | Geocode a free-form address or place name to coordinates via the OSM Nominatim API |
| `reverse_geocode` | Reverse geocode coordinates to the nearest address via the OSM Nominatim API |
| `search_places` | Search for places by name via the OSM Nominatim API |
| `find_nearby` | Find places of a category near coordinates via the OSM Overpass API |
| `get_place_details` | Get details of one OSM object (node, way or relation) via the Nominatim lookup API |
| `distance_between` | Compute the great-circle distance in kilometres between two coordinate pairs (local, no API call) |

MCP client config:

```json
{
  "mcpServers": {
    "streetmap-port": {
      "command": "npx",
      "args": ["-y", "@reneturcios/streetmap-port", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/streetmap-port          # MCP server
docker run --rm ghcr.io/cloudcorprecords/streetmap-port --version
```

## Development

```bash
npm install
npm run build
npm test
```

Data © OpenStreetMap contributors (ODbL). MIT license for the code.
