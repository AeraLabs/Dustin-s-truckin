# Dustin's Trucking

A private, mobile-first route weather companion designed around Dustin's long-haul driving workflow.

## Run locally
Serve this folder over HTTP (geolocation and service workers require HTTPS or localhost):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## First build
- Dark, driver-focused responsive interface.
- Origin and destination geocoding.
- Driving route geometry and distance / duration through the public OSRM demo routing endpoint.
- Weather checkpoints distributed along the route.
- Current and estimated arrival-time weather using Open-Meteo.
- Wind, gust, visibility, precipitation, temperature and condition-based risk flags.
- Google Maps handoff for navigation.
- Installable PWA shell and basic offline caching.

## Data services and limitations
- **Open-Meteo** supplies forecasts and geocoding. Review its current terms and usage requirements before broader or commercial deployment.
- **OSRM demo server** is a public demonstration service, not a production SLA. For sustained use, select a hosted routing provider or self-host.
- **OpenStreetMap** data is displayed through the community tile service. Follow its tile usage policy; the public tile server is not an unlimited production CDN.
- **Google Maps** handoff uses ordinary car navigation. It does not verify truck height, weight, length, axle, or hazmat restrictions.
- Weather risk flags are heuristic estimates, not official road-condition reports. They do not establish whether a road is open or safe for a specific truck.
- The initial forecast request covers up to two forecast days. Longer trips need a follow-up forecast-window implementation before their full journey can be assessed.
- Always follow posted restrictions and official state DOT / 511 advisories.

## Deployment
This is a static site and can be hosted on GitHub Pages or another static HTTPS host. A GitHub Actions Pages workflow is included; enable Pages in repository settings with GitHub Actions as the deployment source. Do not add API keys or private driver data to this repository.

## Next build priorities
1. Add official NWS alerts and state DOT / 511 links for route states.
2. Add elevation and mountain-pass awareness.
3. Extend forecast retrieval for multi-day routes and improve arrival-time interpolation.
4. Add a truck profile and verified truck-routing integration before presenting any route as truck-safe.
5. Add forecast refresh controls, data timestamps, and resilient offline trip summaries.
