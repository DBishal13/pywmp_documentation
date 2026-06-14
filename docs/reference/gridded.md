# Gridded Modeling Reference

`pywmp.gridded` implements distributed (grid-based) hydrologic modeling
methods. Each grid cell carries its own parameters; results are area-weighted
and aggregated to a basin-average hydrograph.

---

## `pywmp.gridded`

```python
from pywmp.gridded import ModClarkTransform, GriddedCN
```

| Class | Purpose | Reference |
|-------|---------|-----------|
| `ModClarkTransform` | Distributed Clark UH using per-cell travel times | HEC-HMS TRM §4.5 |
| `GriddedCN` | Spatially varying SCS Curve Number loss | HEC-HMS TRM §3.3.3 |

Both classes accept either a NumPy array (in-memory) or a raster file
path (via `.from_raster()`).

---

## ModClarkTransform

```python
class ModClarkTransform(
    travel_times, R, area,
    cell_area=None, Tc=None, dt=None, units='USC'
)
```

Grid-based extension of the Clark UH. Each cell has a pre-computed
travel time to the outlet; the time-area histogram is built from these
and routed through the Clark linear reservoir.

| Parameter | Type | Description |
|-----------|------|-------------|
| `travel_times` | array-like | Travel time (hr) from each cell to the basin outlet — shape (N,) or (rows, cols) |
| `R` | float | Clark linear reservoir storage coefficient (hr) |
| `area` | float | Total basin area (mi² or km²) |
| `cell_area` | float \| None | Area of each grid cell; inferred from `area / n_cells` if None |
| `Tc` | float \| None | Time of concentration (hr); defaults to `max(travel_times)` |
| `dt` | float \| None | Computational timestep (hr) |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Methods**

```python
ModClarkTransform.compute(effective_rainfall: TimeSeries) -> TimeSeries
ModClarkTransform.unit_hydrograph(dt_hr=None)            -> TimeSeries
ModClarkTransform.from_raster(travel_time_path, R, area, **kwargs)  # classmethod
```

**Example**

```python
import numpy as np
from pywmp.gridded import ModClarkTransform
from pywmp.time_series import TimeSeries

# Travel times pre-computed from DEM (e.g. via whitebox or pyflwdir)
tt = np.random.exponential(scale=2.0, size=(50, 50))   # hrs, 50×50 grid

mc = ModClarkTransform(travel_times=tt, R=3.0, area=1.8)

# From raster file
mc = ModClarkTransform.from_raster("travel_time.tif", R=3.0, area=1.8)

# Compute direct runoff
eff = TimeSeries(np.arange(0, 24, 0.5), pe_array, dt=0.5, units="in")
runoff = mc.compute(eff)
```

---

## GriddedCN

```python
class GriddedCN(cn_array, cell_area, ia_ratio=0.2, units='USC')
```

Applies the SCS Curve Number loss method independently to each grid cell,
then returns a basin-average effective rainfall time series for use with
any transform (ModClark, SCS UH, Clark).

| Parameter | Type | Description |
|-----------|------|-------------|
| `cn_array` | array-like | CN values (1–100) per grid cell; 1-D or 2-D |
| `cell_area` | float | Area of each grid cell (mi² or km²) |
| `ia_ratio` | float | Initial abstraction ratio Ia/S; default 0.2 |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Methods**

```python
GriddedCN.compute(rainfall: TimeSeries) -> tuple[TimeSeries, TimeSeries]
# returns (effective_avg, loss_avg)

GriddedCN.from_raster(cn_raster_path, ia_ratio=0.2, units='USC')  # classmethod
```

**Example**

```python
import numpy as np
from pywmp.gridded import GriddedCN

# Load from composite CN raster (NLCD + SSURGO HSG)
gcn = GriddedCN.from_raster("data/cn_composite.tif")

# Or build from array
cn_arr = np.full((100, 100), 75.0)
cn_arr[20:40, 20:40] = 90.0          # high-CN impervious patch
gcn = GriddedCN(cn_arr, cell_area=1e-4)

eff, loss = gcn.compute(rainfall_ts)
```
