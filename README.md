# Dustin's Trucking

A personal, mobile-first route weather companion for Dustin.

## Run locally
Serve over HTTPS or localhost (location and service workers require a secure context). For local testing: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Features
- Dark, responsive mobile dashboard with larger touch targets and safe-area spacing.
- Origin / destination search, route map, distance and a planning-time estimate based on the configurable average speed.
- Open-Meteo weather checkpoints with up to 16 days of hourly forecast data.
- National Weather Service active alerts queried at sampled route points (U.S. only).
- Elevation samples to identify high terrain along sampled route points.
- State-by-state weather summaries and state DOT / 511 links for identified states along the route.
- Route segments are color-coded from forecast-derived weather risk (lower risk / caution / high risk); colors are not official pavement-condition reports.
- Requests up to three route alternatives when the public routing service returns them.
- Saved trips, wind threshold, temperature units, planning speed, truck profile, share, refresh, and optional screen wake lock. Preferences are stored locally on the device.
- Installable PWA shell and basic offline caching.

## Services and safety limits
- Open-Meteo provides forecasts, geocoding and elevation. Review its current terms and usage limits.
- NWS alerts are queried for sampled points only; this may miss alerts elsewhere in an alert polygon or between samples.
- OSRM public demo routing is not a production service. OpenStreetMap community tiles have usage policies.
- The route is an ordinary car-driving route, not a truck route. Google Maps handoff is not height, weight, length, axle or hazmat validated.
- Elevation samples identify terrain only; they do not identify named mountain passes, chain-control status or road closures.
- Direct state 511 event integrations are available for Alaska, Arizona, Georgia, Idaho, Louisiana, Nevada and Wisconsin. These official feeds return crashes/incidents, roadwork and closures where published; each state requires its own developer key. Keys are stored in browser local storage and are not sent to this repository.
- Other state DOT / 511 links remain official shortcuts, not live road-condition integrations in this build. A national third-party normalizer exists, but it requires a separate provider key and commercial terms; it is not silently enabled.
- Forecasts are limited to the service's returned 16-day window. Trips arriving beyond it show forecast data as unavailable rather than extrapolating.
- Weather risk levels are heuristic indicators, not safety determinations. Check official DOT / 511 advisories, posted signs and dispatch guidance.

## Deployment
Static HTTPS hosting such as GitHub Pages. Enable repository Pages with GitHub Actions as the deployment source. Do not commit API secrets or private driver information.


### Interactive map coverage
- The map is the primary screen, edge-to-edge and near full-screen on phones, with a larger desktop viewport. Route planning is optional; drivers can explore roads without entering a trip.
- At zoom level 11 and closer, the app may overlay selected nearby roads with colors derived from weather samples (lower weather risk / caution / high weather risk), when public road geometry is available. Wider views stay fast by showing the standard road-map tiles and available NWS / 511 markers without requesting state-sized road geometry. These are weather estimates, not observed pavement conditions or verified traffic speeds. Tap a road to inspect point weather, NWS alerts and available state 511 incident data.
- The road map uses CARTO's OpenStreetMap-based raster tiles. Selecting a state zooms to its boundary immediately; roads render progressively as map tiles arrive, and additional local streets appear as the driver zooms in. This avoids downloading and drawing an entire state's road geometry from Overpass before the map becomes usable. Tile detail and coverage depend on the underlying OpenStreetMap data and zoom level.
- Statewide weather sampling uses up to 25 in-state points from Open-Meteo. Weather sample markers show forecast-derived risk; they are not pavement sensing or live traffic speeds.
- Statewide active National Weather Service alerts are queried by state and their available alert polygons are drawn over the map. Clicking a road also checks point-specific NWS alerts and current weather.
- When a supported 511 feed is configured, geolocated crashes, closures, work zones and other reported events are plotted as map markers and listed in the state panel.
- Live traffic incidents, crashes, work zones and closures are only returned by direct 511 integrations for Alaska, Arizona, Georgia, Idaho, Louisiana, Nevada and Wisconsin when the user supplies that state's developer key. Other states show the official 511/DOT shortcut but do not yet have a direct event feed. OpenStreetMap road geometry is never represented as live traffic data.

## Map-first cockpit (November 2026)
- The map remains on screen with top navigation for Places, Trips, Weather and official 511 sources. Trip details now open in a collapsible map drawer instead of requiring a full-page scroll.
- The bottom map search accepts cities or place names and offers a Route here handoff to the existing trip planner. Location search uses Photon with existing geocoder fallback.
- Truck stops, truck parking, fuel, rest areas and weigh station filters show available OpenStreetMap community POIs from bounded Overpass requests when zoomed into a local area. These are directory entries, **not verified truck access, parking-space availability, diesel price, shower ratings, or discounts**. Data can be incomplete or temporarily unavailable.
- Map route alternatives still come from the public OSRM **car** routing service. They are **not height, weight, bridge, hazmat, or truck-entrance verified** and must not be used as truck-safe turn-by-turn navigation.
- Traffic cameras, shared driver reports, verified fuel prices, real-time truck parking counts, and truck-safe commercial navigation are **not integrated**. Their presence in a reference screenshot should not be interpreted as available functionality in Dustin's app.
- The new `map-first.css` and `map-first.js` complement the existing static GitHub Pages implementation. If you update either asset, bump its query version in `index.html` and the offline cache in `sw.js`.

## Roadside usability (November 2026)
- **Check here** inspects the map center with available forecast, NWS and optionally configured 511 data. It does not establish verified pavement conditions or truck restrictions.
- **Last trip** pre-fills the latest saved trip. It does not reroute automatically; check the weather again before departure.
- **Large controls** are enabled by default, with larger tap targets, higher legibility and a saved on/off preference.
- **Compact trip summary** keeps basic risk, distance and ETA estimates visible on the map with a Compare routes shortcut.
- **Optional pre-trip audio briefing** reads an existing route-weather summary in browsers with speech synthesis. Playback is manually started and is not hands-free navigation.
- **Dismissible panels** clear the map after inspecting state and local road data.
- Prepare and review a route while safely parked; the app is not meant to be interacted with while a vehicle is moving. Weather and alerts can be stale, partial or unavailable.
- road-ease.js and road-ease.css extend the existing app; bump versioned assets in index.html and sw.js after future changes.

## Simplified road-tap experience (November 2026)
- Default map controls are reduced to search, Saved Trip, More and the locate button. States, location filters, route planner, weather controls and optional map overlays are still available inside More.
- Tap an area of the map to open a compact card. Weather (Open-Meteo), active NWS alerts and supported official state 511 event checks resolve independently, so one slow feed does not hold up the others. The display is **nearby point weather**, not a sensor reading from that road surface.
- Clickable OSM road geometry with its mapped name can be loaded as an **optional** weather-colored overlay from More when zoomed in. This is a weather heuristic and may fail when the Overpass service is busy. Map taps still work with the overlay disabled.
- A map location at a broad zoom is not a particular roadway; zoom closer and inspect more precisely. No tap proves a road is passable, free of closures, or safe for truck height, axle, weight or hazmat.
- Route alternatives (when returned by public car routing) can be displayed in the Trips drawer and previewed on the map without a new weather request. A separate explicit action checks weather for the alternative; this does not validate commercial-truck restrictions.
- The app remembers its last map center and zoom on the device.
- Saving a trip now stores an approximate downsampled route line, distance, estimated time, last checked date, weather-risk summary and sampled NWS alert-count summary in localStorage. Saved Trip can display these **without network access**. Older saved trips have endpoints only and cannot show a historical route.
- A saved trip panel always identifies itself as **CACHED — NOT LIVE** and warns that prior conditions and road events may be outdated. Cached snapshots never mean a road is clear. Cached data does **not** include a full 511 event set.
- Tap checks retain a bounded local cache of recent weather points for offline review. Browser storage clearing removes those snapshots. The core PWA shell is cached, but an offline background map is not guaranteed: external map tiles and Leaflet libraries are subject to browser caching and provider policies. There is no map-area predownload.
- The map and lookup interface is intended for pre-trip planning and safely parked checks, not operating the app while moving.

### Appearance and startup improvements

- Header Light/Dark button; Settings → Appearance also offers the device theme. The choice persists locally and applies before first paint.
- Direct Plan trip, Saved trip, and More controls, readable phone layouts, and search status shown next to search.
- Fixed the missing map-dock ID that prevented road-focus and road-ease controls from initializing.
- Versioned app files and the bundled Leaflet 1.9.4 library load from the service-worker cache on repeat visits. Leaflet's original BSD license is in `vendor/leaflet/LICENSE`. Map tiles still require a connection unless the browser already has them cached; this is not an offline map download feature.
- Restores the map view before requesting tiles, uses fewer offscreen tiles, shares concurrent JSON lookups, caches place searches for five minutes, and cancels superseded point weather/alert requests. Weather and alerts are never served from the place cache.

Validation: `node --test tests/performance.test.cjs` covers shared requests, cancellation, cache freshness boundaries, failed requests, cached startup, and matching asset versions. Browser checks covered desktop and a 390 × 844 phone frame, light/dark switching and persistence, trip planner, settings, and point-condition feedback. NWS responded in the test environment; the forecast endpoint returned an upstream timeout, so successful live forecast retrieval was not verified there.

When changing a cached application asset, update its URL version in `index.html` and `sw.js`, and bump the service-worker cache name. The next visit installs the new cache; an already-open tab may need reopening to use the new app files.
