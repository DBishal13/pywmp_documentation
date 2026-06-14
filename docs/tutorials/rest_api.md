# REST API Tutorial

PyWMP includes an optional FastAPI server that lets you submit simulations remotely, stream progress in real time, and retrieve results — all over HTTP and WebSocket. This enables integration into web applications, cloud workflows, and CI pipelines.

## Installation

```bash
pip install "pywmp[api]"
```

## Starting the server

```bash
uvicorn pywmp.api.app:app --host 0.0.0.0 --port 8000
```

For development with auto-reload:

```bash
uvicorn pywmp.api.app:app --reload
```

With Docker:

```bash
docker compose up
```

The server is available at `http://localhost:8000`. Interactive API docs are at `http://localhost:8000/docs`.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/simulate/hms` | Submit an HMS simulation |
| `POST` | `/simulate/cascade` | Submit a Cascade 2001 simulation |
| `GET` | `/results/{run_id}` | Poll for results |
| `GET` | `/runs` | List all in-memory runs |
| `POST` | `/upload/dat` | Upload a `.dat` file |
| `WS` | `/ws/{run_id}` | Stream progress events |

---

## POST `/simulate/hms` — Submit an HMS simulation

Accepts a JSON body describing the basin model and returns a `run_id` immediately. The simulation runs in a background thread.

### Request body

```json
{
  "basin_name": "Hillsborough",
  "units": "USC",
  "subbasins": [
    {
      "name": "Upper",
      "area_mi2": 2.5,
      "loss_method": "scs",
      "loss_params": {
        "curve_number": 78,
        "initial_abstraction": 0.0,
        "amc": 2
      },
      "transform_method": "clark",
      "transform_params": {
        "time_of_concentration_hr": 1.8,
        "storage_coefficient_hr": 1.4
      }
    },
    {
      "name": "Lower",
      "area_mi2": 1.8,
      "loss_method": "scs",
      "loss_params": {"curve_number": 68},
      "transform_method": "scs",
      "transform_params": {"lag_hr": 1.1}
    }
  ],
  "reaches": [
    {
      "name": "R1",
      "routing_method": "muskingum",
      "routing_params": {"K_hr": 0.8, "x": 0.2, "steps": 3}
    }
  ],
  "junctions": [],
  "connections": [
    {"upstream": "Upper",  "downstream": "R1"},
    {"upstream": "R1",     "downstream": "Lower"}
  ],
  "rainfall": {
    "Upper": {
      "times":  [0.0, 6.0, 10.0, 12.0, 18.0, 24.0],
      "values": [0.0, 0.3,  0.9,  1.2,  0.6,  0.0],
      "dt": 0.1,
      "units": "in/hr"
    },
    "Lower": {
      "times":  [0.0, 6.0, 10.0, 12.0, 18.0, 24.0],
      "values": [0.0, 0.3,  0.9,  1.2,  0.6,  0.0],
      "dt": 0.1,
      "units": "in/hr"
    }
  }
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `basin_name` | `string` | Label for the simulation |
| `units` | `"USC"` \| `"SI"` | Unit system (default `"USC"`) |
| `subbasins` | `array` | List of subbasin specs (see below) |
| `reaches` | `array` | List of reach specs |
| `junctions` | `array` | List of junction names `[{"name": "J1"}, ...]` |
| `connections` | `array` | Upstream/downstream pairs |
| `rainfall` | `object` | Time-series per subbasin name |

**Subbasin spec:**

| Field | Type | Options |
|---|---|---|
| `loss_method` | `string` | `"scs"`, `"green_ampt"`, `"initial_constant"`, `"sma"` |
| `transform_method` | `string` | `"scs"`, `"clark"`, `"snyder"`, `"user"` |

### Response

```json
{"run_id": "a3f2c1b0-4e5d-4a6f-b7c8-9d0e1f2a3b4c"}
```

---

## POST `/simulate/cascade` — Submit a Cascade 2001 simulation

```json
{
  "dat_path": "/data/my_project.dat"
}
```

The `.dat` file must be accessible on the server filesystem. Use `POST /upload/dat` to upload one first. Returns `{"run_id": "..."}`.

---

## GET `/results/{run_id}` — Poll for results

```bash
curl http://localhost:8000/results/a3f2c1b0-4e5d-4a6f-b7c8-9d0e1f2a3b4c
```

**While running:**
```json
{"run_id": "a3f2...", "status": "running", "result": null}
```

**When complete:**
```json
{
  "run_id": "a3f2...",
  "status": "done",
  "outflows": {
    "Upper": {
      "times": [0.0, 0.1, 0.2, ...],
      "values": [0.0, 0.0, 0.3, ...],
      "dt": 0.1,
      "units": "cfs"
    },
    "Lower": {
      "times": [0.0, 0.1, 0.2, ...],
      "values": [0.0, 0.0, 0.1, ...],
      "dt": 0.1,
      "units": "cfs"
    }
  }
}
```

**On error:**
```json
{"run_id": "a3f2...", "status": "error", "error": "ValueError: negative C0 ..."}
```

---

## GET `/runs` — List all runs

```bash
curl http://localhost:8000/runs
```

```json
[
  {"run_id": "a3f2...", "status": "done",    "created_at": 1720000100},
  {"run_id": "b9e1...", "status": "running", "created_at": 1720000142},
  {"run_id": "c4d3...", "status": "error",   "created_at": 1720000088}
]
```

---

## POST `/upload/dat` — Upload a Cascade `.dat` file

```bash
curl -X POST http://localhost:8000/upload/dat \
  -F "file=@my_project.dat"
```

Response:
```json
{"server_path": "/data/my_project.dat"}
```

Use the returned `server_path` as the `dat_path` in a `/simulate/cascade` request.

---

## WS `/ws/{run_id}` — Real-time progress stream

Connect to the WebSocket after submitting a run to receive live progress events.

**Event types:**

| `event` | Fields | Description |
|---|---|---|
| `"progress"` | `pct`, `element` | Percentage complete + element being processed |
| `"done"` | `pct=100` | Simulation finished |
| `"error"` | `msg` | Error message |

**Example messages:**

```json
{"event": "progress", "run_id": "a3f2...", "pct": 15.0, "element": "Upper"}
{"event": "progress", "run_id": "a3f2...", "pct": 52.5, "element": "R1"}
{"event": "progress", "run_id": "a3f2...", "pct": 87.0, "element": "Lower"}
{"event": "done",     "run_id": "a3f2...", "pct": 100.0}
```

---

## Python client example

Full submit-and-poll client with WebSocket progress tracking:

```python
import asyncio
import json
import requests
import websockets

BASE = "http://localhost:8000"

payload = {
    "basin_name": "Demo",
    "units": "USC",
    "subbasins": [
        {
            "name": "A",
            "area_mi2": 1.5,
            "loss_method": "scs",
            "loss_params": {"curve_number": 75},
            "transform_method": "scs",
            "transform_params": {"lag_hr": 0.9},
        }
    ],
    "reaches": [],
    "junctions": [],
    "connections": [],
    "rainfall": {
        "A": {
            "times": [0.0, 12.0, 24.0],
            "values": [0.0, 0.8, 0.0],
            "dt": 0.1,
            "units": "in/hr",
        }
    },
}

# Submit
resp = requests.post(f"{BASE}/simulate/hms", json=payload)
resp.raise_for_status()
run_id = resp.json()["run_id"]
print(f"Submitted: {run_id}")


# Stream progress via WebSocket
async def stream_progress(run_id: str):
    uri = f"ws://localhost:8000/ws/{run_id}"
    async with websockets.connect(uri) as ws:
        async for raw in ws:
            msg = json.loads(raw)
            event = msg.get("event")
            if event == "progress":
                print(f"  {msg['pct']:5.1f}%  {msg.get('element', '')}")
            elif event == "done":
                print("  Done!")
                break
            elif event == "error":
                print(f"  Error: {msg['msg']}")
                break

asyncio.run(stream_progress(run_id))

# Retrieve results
result = requests.get(f"{BASE}/results/{run_id}").json()
for name, ts in result["outflows"].items():
    peak = max(ts["values"])
    print(f"{name}: peak = {peak:.1f} cfs")
```

---

## Async client example

For production integrations, use `httpx` with an async HTTP client:

```python
import asyncio
import httpx
import websockets
import json

async def run_simulation(payload: dict) -> dict:
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        r = await client.post("/simulate/hms", json=payload, timeout=10)
        r.raise_for_status()
        run_id = r.json()["run_id"]

        # wait for completion via WebSocket
        async with websockets.connect(f"ws://localhost:8000/ws/{run_id}") as ws:
            async for raw in ws:
                msg = json.loads(raw)
                if msg["event"] in ("done", "error"):
                    break

        r2 = await client.get(f"/results/{run_id}")
        return r2.json()

result = asyncio.run(run_simulation(payload))
```

---

## Docker deployment

A `Dockerfile` and `docker-compose.yml` are included in the repo root.

```bash
# Start the API server in a container
docker compose up

# The API is available at http://localhost:8000
# Mount a local data directory for .dat files and GIS outputs:
#   volumes:
#     - ./data:/data
```

The container sets `PYWMP_DATA_DIR=/data` so uploaded `.dat` files and GIS outputs are persisted to the mounted volume.

**Production deployment notes:**
- Add a reverse proxy (nginx, Caddy) in front of uvicorn for TLS and rate limiting.
- Scale workers with `--workers N` for multi-process concurrency: `uvicorn pywmp.api.app:app --workers 4`.
- The in-memory run store is per-process — use a Redis backend for multi-worker setups.

---

## Error handling

| HTTP status | Cause | Action |
|---|---|---|
| 422 | Invalid request body (Pydantic validation) | Check field names and types against the schema above |
| 404 | `run_id` not found | Verify the run_id; runs are in-memory and lost on server restart |
| 500 | Simulation error | Check `/results/{run_id}` for the `error` field |

Timeout note: `/simulate/hms` returns immediately with a `run_id`. Long simulations should use the WebSocket stream rather than polling `/results/{run_id}` on a tight loop.
