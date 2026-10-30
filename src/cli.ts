#!/usr/bin/env node
/**
 * streetmap-port CLI.
 *
 *   streetmap-port mcp
 *   streetmap-port geocode <query...>
 *   streetmap-port reverse <lat> <lon>
 *   streetmap-port search <query...>
 *   streetmap-port nearby <lat> <lon> [category] [radius-m]
 *   streetmap-port distance <lat1> <lon1> <lat2> <lon2>
 *   streetmap-port --version
 *
 * Exit codes: 0 success, 1 API/validation error, 2 usage error.
 */
import { StreetMapPort, VERSION } from "./streetmap.js";

function usage(): never {
  console.error(`Usage:
  streetmap-port mcp
  streetmap-port geocode <query...>
  streetmap-port reverse <lat> <lon>
  streetmap-port search <query...>
  streetmap-port nearby <lat> <lon> [category] [radius-m]
  streetmap-port distance <lat1> <lon1> <lat2> <lon2>
  streetmap-port --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd) usage();
  try {
    const port = new StreetMapPort();
    if (cmd === "geocode") {
      const q = rest.join(" "); if (!q) usage();
      console.log(JSON.stringify(await port.geocode(q), null, 2));
    } else if (cmd === "search") {
      const q = rest.join(" "); if (!q) usage();
      console.log(JSON.stringify(await port.searchPlaces(q), null, 2));
    } else if (cmd === "reverse") {
      const [lat, lon] = rest; if (lat === undefined || lon === undefined) usage();
      console.log(JSON.stringify(await port.reverseGeocode(Number(lat), Number(lon)), null, 2));
    } else if (cmd === "nearby") {
      const [lat, lon, category, radius] = rest; if (lat === undefined || lon === undefined) usage();
      console.log(JSON.stringify(await port.findNearby(Number(lat), Number(lon), radius ? Number(radius) : undefined, category), null, 2));
    } else if (cmd === "distance") {
      const [a, b, c, d] = rest; if ([a, b, c, d].some((v) => v === undefined)) usage();
      console.log(JSON.stringify(await port.distanceBetween(Number(a), Number(b), Number(c), Number(d)), null, 2));
    } else usage();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
