# Reservoir Routing Reference

`pywmp.reservoir` implements level pool (storage-indication) routing for
detention and retention basins.

---

## `pywmp.reservoir`

```python
from pywmp.reservoir import LevelPoolReservoir
```

---

## LevelPoolReservoir

```python
class LevelPoolReservoir(
    elevation, storage, outlets,
    initial_elevation=None, units='USC'
)
```

Routes an inflow hydrograph through a detention/retention basin using the
storage-indication method. The pool elevation is tracked at each timestep
and outflow is computed from the combined outlet structures.

| Parameter | Type | Description |
|-----------|------|-------------|
| `elevation` | array-like | Elevation values (ft or m) |
| `storage` | array-like | Cumulative storage at each elevation (ac·ft or m³) |
| `outlets` | list[dict] | Outlet structure definitions (see below) |
| `initial_elevation` | float \| None | Pool elevation at t = 0; defaults to `elevation[0]` |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Outlet structure types**

Each entry in `outlets` is a dict with a `"type"` key:

| Type | Required keys | Formula |
|------|--------------|---------|
| `"weir"` | `crest_elev`, `L`, `Cw` (default 3.33) | Q = Cw × L × H^1.5 |
| `"orifice"` | `invert_elev`, `area`, `Cd` (default 0.6) | Q = Cd × A × √(2gH) |
| `"rating"` | `elevations`, `flows` | interpolated lookup |
| `"pump"` | `intake_elev`, `flow` | constant Q when pool ≥ intake |

Multiple outlets are allowed; total outflow = sum of all structures.

**Methods**

```python
LevelPoolReservoir.compute(inflow: TimeSeries) -> tuple[TimeSeries, TimeSeries]
# returns (outflow, elevation_ts)
```

**Example**

```python
import numpy as np
from pywmp.reservoir import LevelPoolReservoir
from pywmp.time_series import TimeSeries

elev    = [0, 2, 4, 6, 8, 10]          # ft NGVD
storage = [0, 5, 15, 32, 56, 90]       # ac·ft

outlets = [
    {"type": "weir",    "crest_elev": 6.0,  "L": 40.0},
    {"type": "orifice", "invert_elev": 2.0, "area": 0.785, "Cd": 0.6},
    {"type": "pump",    "intake_elev": 1.0, "flow": 2.5},
]

res = LevelPoolReservoir(elev, storage, outlets, initial_elevation=4.0)

t       = np.arange(0, 24, 0.5)
inflow  = TimeSeries(t, inflow_array, dt=0.5, units="cfs")
outflow, elev_ts = res.compute(inflow)

print(f"Peak outflow: {outflow.values.max():.1f} cfs")
print(f"Max pool elevation: {elev_ts.values.max():.2f} ft")
```
