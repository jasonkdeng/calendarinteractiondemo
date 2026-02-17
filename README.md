# Calendar Bandwidth Awareness Engine (Demo)

Minimal full-stack Node.js demo using:

- Node.js
- Express
- Manual multi-day schedule input only

## 1) Configure environment variables

Only one variable is needed for local demos:

- `PORT` (optional, defaults to `3000`)

Create a `.env` file in the project root:

```env
PORT=3000
```

## 2) Install + run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Endpoint

### `POST /analyze-manual`

Accepts a calendar-style `events` array and runs the bandwidth engine.

Optional switch:

- `advancedResponse` (boolean, default `false`):
	- `false`: returns a trimmed, pitch-friendly response.
	- `true`: includes full diagnostics (e.g., `penaltyBreakdown`, type-minute internals).

Example request body:

```json
{
	"date": "2026-02-17",
	"timeZone": "America/New_York",
	"advancedResponse": false,
	"events": [
		{
			"status": "confirmed",
			"start": { "dateTime": "2026-02-17T14:00:00.000Z" },
			"end": { "dateTime": "2026-02-17T15:00:00.000Z" }
		}
	]
}
```

The response includes date-level availability slots, bandwidth scoring, and daily load.

### `POST /analyze-manual-multiday`

Accepts multi-day schedules and returns per-day analysis for each selected day.

Optional switch:

- `advancedResponse` (boolean, default `false`) with the same behavior as above.

Example request body:

```json
{
	"timeZone": "America/New_York",
	"advancedResponse": false,
	"schedules": [
		{
			"date": "2026-02-17",
			"events": [
				{
					"status": "confirmed",
					"start": { "dateTime": "2026-02-17T14:00:00.000Z" },
					"end": { "dateTime": "2026-02-17T15:00:00.000Z" }
				}
			]
		},
		{
			"date": "2026-02-18",
			"events": []
		}
	]
}
```

## Manual UI flow

1. Open `http://localhost:3000`.
2. Pick a persona and choose a meeting type to paint: `investors`, `candidates`, or `customers`.
3. Pick a start date and number of days.
4. Click/drag cells in the multi-day grid (09:00–17:00) to mark busy slots.
5. Different meeting types are color-coded and shown in the legend next to the type selector.
6. Click **Run Manual Analysis** to get per-day structured availability + bandwidth JSON.
7. Enable **Advanced diagnostics** if you want detailed internals in the response.

## Notes

- This version is manual-only with no external data connections.
- The app is intentionally kept simple and readable (not production-hardened).
