# streetmap-port — Build Report

MCP Rebuild 100, Wave 1 Batch 5 (final Tier A batch). Clean-room
rebuild of the "openstreetmap" target: the tool spec was defined
for this program from the public OpenStreetMap APIs (Nominatim and
Overpass) and is labelled as such in the fixture. Local build only
— nothing pushed or published.

Identity: repo `streetmap-port`, npm `@reneturcios/streetmap-port`,
MCP name `io.github.CloudCorpRecords/streetmap-port`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `streetmap-port: dist/cli.js`, `mcpName` set
- `server.json` — description = **83 chars** (≤100 ✓, verified
  programmatically); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/streetmap-port:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/streetmap-port"`
- `tsconfig.json`, `.gitignore`, `LICENSE` (MIT), `README.md`,
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/streetmap.ts` (core + injectable fetch)
- `test/streetmap.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Implementation notes

- Six MCP tools over the public OSM APIs: `geocode_address`,
  `reverse_geocode`, `search_places` (Nominatim),
  `get_place_details` (Nominatim lookup), `find_nearby` (Overpass
  around-query), `distance_between` (local haversine — no network).
- **Low-level Server API** with explicit inputSchema literals (not
  McpServer+zod — standing rule). Zod validates `tools/call` args.
- HTTP goes through an injectable `FetchFn`; unit tests use fake
  fetches only. Coordinates are range-validated; the Overpass
  category is whitelisted with `^[a-z_]+$` as a QL-injection guard;
  upstream error payloads are surfaced, not swallowed. The
  haversine test pins San Francisco–Oakland at ≈13–14.5 km.

## Verification (exact outputs)

- Build: `tsc` exit 0; canonical `dist/` present with `.d.ts` /
  `.js.map`.
- Tests: `tsx --test` → tests 12, pass 12, fail 0.
- CLI smoke: `node dist/cli.js --version` → `0.1.0`.
- Parity: verdict **PASS**, parity_pct **100.0**, identical_tools
  **6/6**, schema_diffs {} (`parity-out/parity.json`, generated
  2026-10-26T16:52:31Z). Original side: tools-file fixture
  `harness/fixtures/openstreetmap-tools-original.json`
  (program-defined spec from the public OSM APIs, labelled in its
  `_source`).

## Lockfile status

`package-lock.json` copied from pdfport with identity fields edited
(top-level `name`, root package `name`, bin key). Clean lockfile
regeneration is REQUIRED before publish — Blocker 3 in
SCOREBOARD.md. `node_modules` is a local `cp -a` copy; gitignored.

## Blockers / honest gaps

- **No live OSM call was made or claimed** (VM egress blocked,
  Blockers 1–2). Request construction and response parsing are
  proven against fake fetches only; Nominatim/Overpass response
  shape drift is unverified until the publish wave can smoke live.
- The spec is program-defined from the public APIs, not probed
  from an original server; parity proves match to the defined spec.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run — publish
  wave scope, not claimed here.

## Publish-gate remediation (2026-10-27)

Recorded under Rene's 2026-10-27 decision ("Remediate the 6: add param
descriptions + capability-class vet policy, then re-gate") and
`publish/GATE-POLICY.md`, following the standing Wave 2 remediation
pattern. This is an authorized deviation from the parity-faithful
state: descriptions were added to every tool parameter that lacked
one, in the `src/mcp.ts` schema literals only — parameter names,
types and required lists are unchanged.

- Descriptions added: 17 insertion points, covering 17 served
  parameter occurrences. Honest counting note: the pre-remediation
  `src/mcp.ts` served every property through two shared type consts
  (`str` / `num`), so a description on a shared const could not
  describe distinct parameters; each property now carries its own
  literal (`{ ...str, description: ... }` / `{ ...num, description:
  ... }`), i.e. exactly one insertion point per served occurrence,
  with the shared consts retained for the type only. Insertion
  points: `geocode_address` parameters `limit`, `query`;
  `reverse_geocode` parameters `latitude`, `longitude`;
  `search_places` parameters `limit`, `query`; `find_nearby`
  parameters `category`, `latitude`, `limit`, `longitude`, `radius`;
  `get_place_details` parameters `osm_id`, `osm_type`; and
  `distance_between` parameters `from_latitude`, `from_longitude`,
  `to_latitude`, `to_longitude`.
- Rebuild: `npm run build` exit 0; `tsc --noEmit` exit 0; full
  test suite 12/12 pass (tests 12, pass 12, fail 0).
- Parity harness re-run, verbatim: **PARTIAL, parity_pct 50.0** —
  original_tools=6 rebuild_tools=6 missing=[] extra=[]
  schema_diffs=['distance_between', 'find_nearby',
  'geocode_address', 'get_place_details', 'reverse_geocode',
  'search_places']. Every one of the 17 schema diffs is a
  description addition
  (`*.description: present in rebuild but not in original`); 0
  structural diffs. Structural parity proven independently:
  stripping `description` keys from BOTH the pre- and
  post-remediation tools/list deep-equals (strip-proof RESULT: PASS;
  every description present in PRE is byte-identical in POST, and
  the only additions are at inputSchema property paths — 17
  additions, 0 removals). Adjudication: the description-only diff
  is the authorized remediation itself; structural parity is
  unchanged. Full record:
  `publish/parity-remediation/streetmap-port/parity.json` and
  `publish/parity-remediation/streetmap-port/strip-proof.txt`.
- No publish gate was run in this remediation (no mcpaudit/mcpvet),
  and nothing was published.
