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
