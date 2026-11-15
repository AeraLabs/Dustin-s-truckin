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
