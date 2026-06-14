# Flood Mapping Reference

`pywmp.flood` converts 1D peak flows from a channel reach into 2D spatial
flood depth rasters using the **Height Above Nearest Drainage (HAND)**
method (Nobre et al., 2011). The same DEM used for watershed delineation
drives the inundation mapping — no additional 2D mesh is required.

---

## Pipeline

```
DEM → HANDRaster (terrain analysis)
    → ReachRatingCurve (Q → normal depth per reach)
    → FloodMapper → FloodMap (depth raster + statistics)
```

---

## `pywmp.flood`

```python
from pywmp.flood import (
    HANDRaster, ReachRatingCurve,
    FloodMapper, FloodMap,
    WatershedDelineator,
    read_tif, write_tif, to_cog,
    inundate, inundate_bathtub,
    inundate_connected_bathtub,
    inundate_spatial_hand,
    compute_stats, FloodStats,
    snap_to_stream,
    estimate_dem_memory_mb,
)
```

| Class / function | Purpose |
|-----------------|---------|
| `HANDRaster` | DEM analysis: fill sinks, D8 flow direction, flow accumulation, HAND grid |
| `ReachRatingCurve` | Manning's normal-depth Q → depth rating curve for a reach cross-section |
| `FloodMapper` | Combines HAND + rating curves + peak flows → `FloodMap` |
| `FloodMap` | Result container: depth raster, statistics, export helpers |
| `WatershedDelineator` | Delineate contributing area from DEM and pour point |
| `inundate` | Low-level: flood array given HAND and depth threshold |
| `inundate_bathtub` | Simple bathtub fill (no connectivity check) |
| `inundate_connected_bathtub` | Connectivity-enforced bathtub fill |
| `inundate_spatial_hand` | Per-reach HAND-based inundation |
| `compute_stats` | Compute `FloodStats` from a depth array |
| `read_tif` / `write_tif` | GeoTIFF I/O |
| `to_cog` | Convert GeoTIFF to Cloud Optimized GeoTIFF |

---

## HANDRaster

```python
class HANDRaster(dem, cell_size_ft, nodata=-9999.0)
```

Computes the HAND raster (height of each DEM cell above its nearest
stream cell) and the associated stream network.

| Parameter | Type | Description |
|-----------|------|-------------|
| `dem` | ndarray | 2D elevation array (ft or m) |
| `cell_size_ft` | float | Cell resolution in feet (or metres for SI) |
| `nodata` | float | No-data sentinel value |

**Methods**

```python
HANDRaster.compute(stream_threshold=500)
# stream_threshold: minimum upstream cell count to define a stream cell

HANDRaster.hand          # ndarray — HAND values
HANDRaster.fdir          # ndarray — D8 flow direction
HANDRaster.facc          # ndarray — flow accumulation
HANDRaster.stream_mask   # ndarray[bool] — True where stream cells
HANDRaster.reach_ids     # ndarray — reach ID assigned to each cell
```

**Example**

```python
import numpy as np
from pywmp.flood import HANDRaster, read_tif

dem, meta = read_tif("data/dem/dem_10m.tif")
hand = HANDRaster(dem, cell_size_ft=32.8)   # 10-m DEM → 32.8 ft
hand.compute(stream_threshold=500)
```

---

## ReachRatingCurve

```python
class ReachRatingCurve(
    n, slope, shape='trapezoidal',
    bottom_width=None, side_slope=None,
    diameter=None, units='USC'
)
```

Computes a Manning's normal-depth rating curve (Q → water depth) for a
channel cross-section. Used by `FloodMapper` to convert simulated peak
flow to flood depth at a reach.

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | float | Manning's roughness coefficient |
| `slope` | float | Channel longitudinal slope (ft/ft) |
| `shape` | str | `'trapezoidal'`, `'rectangular'`, or `'circular'` |
| `bottom_width` | float | Channel bottom width (ft or m) |
| `side_slope` | float | Horizontal:vertical side slope ratio (trapezoidal) |
| `diameter` | float | Pipe diameter (ft or m); `shape='circular'` only |

**Methods**

```python
ReachRatingCurve.depth_for_flow(Q) -> float     # single flow → normal depth
ReachRatingCurve.rating_table(Q_max, n_points=100) -> tuple[ndarray, ndarray]
```

---

## FloodMapper

```python
class FloodMapper(hand_raster, rating_curves, reach_outlets)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `hand_raster` | HANDRaster | Pre-computed HAND raster |
| `rating_curves` | dict[str, ReachRatingCurve] | Reach name → rating curve |
| `reach_outlets` | dict[str, tuple[int,int]] | Reach name → outlet pixel (row, col) |

**Methods**

```python
FloodMapper.map_peak(sim_results, reach_names=None)   -> FloodMap
FloodMapper.map_hydrograph(sim_results, time_indices)  -> list[FloodMap]
```

---

## FloodMap

Returned by `FloodMapper`. Contains the spatial flood depth array and
summary statistics.

```python
flood.depth          # ndarray — flood depth per cell (ft or m)
flood.stats          # FloodStats — flooded_area_acres, max_depth_ft, volume_acft
flood.plot()         # quick matplotlib visualisation
flood.to_tif(path)   # save depth raster as GeoTIFF
flood.to_csv(path)   # tabular reach-level summary
```

---

## WatershedDelineator

```python
class WatershedDelineator(dem, cell_size_ft, units='USC')
```

Delineates a contributing watershed from a DEM and pour point.

**Methods**

```python
WatershedDelineator.delineate(pour_point_rowcol) -> ndarray[bool]
WatershedDelineator.area_acres()                 -> float
```

---

## GeoTIFF I/O

```python
from pywmp.flood import read_tif, write_tif, to_cog

array, meta = read_tif("dem.tif")
write_tif("hand.tif", hand_array, meta)
to_cog("hand.tif", "hand_cog.tif")          # Cloud Optimized GeoTIFF

# Windowed read (large DEMs)
from pywmp.flood import read_tif_window, read_tif_bbox
tile, tile_meta = read_tif_window("dem.tif", row_off=0, col_off=0, height=512, width=512)
clip, clip_meta = read_tif_bbox("dem.tif", west=-80.5, south=26.0, east=-80.0, north=26.5)
```

---

## Inundation helpers

```python
from pywmp.flood import (
    inundate, inundate_bathtub,
    inundate_connected_bathtub,
    inundate_spatial_hand,
    compute_stats, FloodStats,
)

depth = inundate(hand_arr, depth_threshold=4.5)
depth = inundate_bathtub(dem_arr, wse=12.0)
depth = inundate_connected_bathtub(dem_arr, wse=12.0, seed_row=220, seed_col=310)
stats = compute_stats(depth, cell_area_acres=0.0025)
print(stats.flooded_area_acres, stats.max_depth_ft, stats.volume_acft)
```

---

## Quick-start example

```python
from pywmp.flood import HANDRaster, ReachRatingCurve, FloodMapper, read_tif

dem, meta = read_tif("data/dem/dem_10m.tif")

hand = HANDRaster(dem, cell_size_ft=32.8)
hand.compute(stream_threshold=500)

curves = {
    "R1": ReachRatingCurve(n=0.035, slope=0.002,
                           shape="trapezoidal",
                           bottom_width=15.0, side_slope=2.0),
}
reach_outlets = {"R1": (220, 310)}

mapper = FloodMapper(hand, curves, reach_outlets)
flood  = mapper.map_peak(sim_results, reach_names=["R1"])

flood.to_tif("outputs/flood_peak_100yr.tif")
print(f"Flooded area: {flood.stats.flooded_area_acres:.1f} acres")
```

---

## References

Nobre, A. D., Cuartas, L. A., Hodnett, M., Rennó, C. D., Rodrigues, G.,
  Silveira, A., Waterloo, M., & Saleska, S. (2011). Height Above the Nearest
  Drainage — a hydrologically relevant new terrain model. *Journal of
  Hydrology*, *404*(1–2), 13–29.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2011.03.051)

Johnson, J. M., Munasinghe, D., Eyelade, D., & Cohen, S. (2019). An
  integrated evaluation of the National Water Model–Height Above Nearest
  Drainage (HAND) flood mapping methodology. *Natural Hazards and Earth
  System Sciences*, *19*, 2405–2420.
  [DOI ↗](https://doi.org/10.5194/nhess-19-2405-2019)
