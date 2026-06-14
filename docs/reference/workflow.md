# Workflow Reference

`pywmp.workflow` provides high-level builders that wire together
meteorology, losses, transforms, routing, and the simulation engine.
Use these when you want a single entry point rather than composing
network elements manually.

---

## `pywmp.workflow`

```python
from pywmp.workflow import (
    DesignStormSimulation,
    estimate_scs_lag,
    estimate_muskingum_k_x,
    build_basin_model,
    build_subbasin_masks,
)
```

| Class / function | Purpose |
|-----------------|---------|
| `DesignStormSimulation` | Fluent multi-basin design storm builder |
| `estimate_scs_lag` | Estimate SCS lag time from watershed characteristics |
| `estimate_muskingum_k_x` | Estimate Muskingum K and X from channel geometry |
| `build_basin_model` | Assemble a `BasinModel` from a delineation GeoDataFrame |
| `build_subbasin_masks` | Generate per-subbasin DEM masks from a delineation |

---

## DesignStormSimulation

```python
class DesignStormSimulation(
    duration_hr, time_step_min,
    storm_type='SCS_II', total_rainfall_in=None,
    return_period_yr=None, lat=None, lon=None,
    units='USC'
)
```

Fluent builder for multi-basin design storm simulations. Subbasins,
reaches, junctions, and reservoirs are added incrementally; `run()`
solves the full routed network.

| Parameter | Type | Description |
|-----------|------|-------------|
| `duration_hr` | float | Storm duration (hr) |
| `time_step_min` | float | Simulation timestep (min) |
| `storm_type` | str | `'SCS_I'`, `'SCS_IA'`, `'SCS_II'`, `'SCS_III'`, `'balanced'` |
| `total_rainfall_in` | float \| None | Rainfall depth (in); omit to fetch from NOAA Atlas 14 |
| `return_period_yr` | int \| None | Return period for Atlas 14 lookup |
| `lat`, `lon` | float \| None | Coordinates for Atlas 14 fetch |

**Methods**

```python
sim.add_subbasin(name, area_mi2, cn, lag_hr=None,
                 loss='scs', transform='scs', baseflow=None)

sim.add_reach(name, upstream, K_hr, X=0.2,
              routing='muskingum')

sim.add_junction(name, upstream)          # upstream = list of element names

sim.add_reservoir(name, upstream,
                  elevation, storage, outlets)

sim.run() -> SimResults
```

**Example**

```python
from pywmp.workflow import DesignStormSimulation

sim = DesignStormSimulation(
    duration_hr=24, time_step_min=6,
    storm_type="SCS_II", total_rainfall_in=6.5,
)
sim.add_subbasin("B1", area_mi2=2.5, cn=75, lag_hr=1.2)
sim.add_subbasin("B2", area_mi2=1.8, cn=80, lag_hr=0.9)
sim.add_reach("R1", upstream="B1", K_hr=0.5, X=0.2)
sim.add_junction("Outlet", upstream=["R1", "B2"])

results = sim.run()
results.plot_hydrographs()
print(results.peak_flows())
```

---

## Delineation helpers

### estimate_scs_lag

```python
estimate_scs_lag(
    flow_length_ft, slope, cn,
    impervious_fraction=0.0
) -> float   # lag_hr
```

Estimates SCS lag time from watershed hydraulic length, average slope,
composite CN, and fraction impervious. Uses the SCS formula:

```
t_lag = (L^0.8 × (S+1)^0.7) / (1900 × Y^0.5)
```

where L = hydraulic length (ft), S = (1000/CN) − 10, Y = average slope (%).

### estimate_muskingum_k_x

```python
estimate_muskingum_k_x(
    length_ft, velocity_fps,
    discharge_cfs, top_width_ft
) -> tuple[float, float]   # (K_hr, X)
```

Estimates Muskingum K (travel time, hr) and X (weighting factor) from
channel geometry using the Cunge approximation.

### build_basin_model

```python
build_basin_model(
    delineation_gdf,
    cn_raster_path,
    dem_path,
    storm_type='SCS_II',
    total_rainfall_in=None,
    units='USC'
) -> DesignStormSimulation
```

Assembles a `DesignStormSimulation` directly from a watershed delineation
`GeoDataFrame` (output of `pywmp.datasets.download_watershed` or a custom
delineation). Reads CN from a raster and estimates lag/routing parameters
from the DEM.

### build_subbasin_masks

```python
build_subbasin_masks(
    delineation_gdf,
    dem_path
) -> dict[str, ndarray]   # {subbasin_id: bool_mask}
```

Returns a dict of boolean NumPy masks (one per subbasin) aligned to the
DEM raster coordinate system. Used to extract per-subbasin DEM tiles for
gridded CN or ModClark.
