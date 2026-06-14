# Coastal Reference

`pywmp.coastal` provides 2D flood modeling for seawall-protected coastal basins under sea-level rise (SLR) scenarios. It builds on the ROM 2D shallow-water solver and automates seawall geometry extraction from GIS data.

## Typical use case

You have a coastal city block or neighborhood protected by a seawall. You want to know: at what sea level does the seawall overtop, and how much flooding occurs under various SLR projections?

## Quick start

```python
import geopandas as gpd
from pywmp.coastal import SeawallGeometry, SeawallSLRSweep
from pywmp.time_series import TimeSeries
import numpy as np

# Define a rainfall time series (e.g., design storm)
t = np.linspace(0, 6, 73)
rain_mm_hr = np.interp(t, [0, 2, 3, 6], [0, 12, 30, 0])
rain_ts = TimeSeries(t, rain_mm_hr, dt=0.083, units="mm/hr")

# Load GIS inputs
seawall_line  = gpd.read_file("data/seawall_centerline.gpkg")
basin_polygon = gpd.read_file("data/protected_basin.gpkg")

# Extract seawall geometry from DEM + GIS
geom = SeawallGeometry.from_gis(
    dem_path       = "data/coastal_dem.tif",
    wall_geometry  = seawall_line,
    basin_polygon  = basin_polygon,
)
print(f"Seawall crest elevation: {geom.crest_elev_ft:.1f} ft NAVD88")
print(f"Protected basin area:    {geom.basin_area_acres:.1f} acres")

# Sweep across SLR levels (ft above current MSL)
sweep = SeawallSLRSweep(
    geometry      = geom,
    slr_levels_ft = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.5],
    rain_ts       = rain_ts,
    ocean_edge    = "south",
    normal_tide_ft = 0.7,
)
results = sweep.run()
print(results.summary_df)
results.plot_summary("output/slr_sweep.png")
results.save_rasters("output/rasters/")
```

---

## `SeawallGeometry`

```python
SeawallGeometry.from_gis(dem_path, wall_geometry, basin_polygon)
```

| Parameter | Type | Description |
|---|---|---|
| `dem_path` | `str \| Path` | Lidar DEM GeoTIFF (NAVD88 elevations, ft or m) |
| `wall_geometry` | `GeoDataFrame` | LineString geometry of the seawall centerline |
| `basin_polygon` | `GeoDataFrame` | Polygon of the protected basin area |

**Computed attributes:**

| Attribute | Description |
|---|---|
| `.crest_elev_ft` | Mean seawall crest elevation (ft NAVD88) |
| `.crest_profile` | Array of crest elevations along wall length |
| `.basin_area_acres` | Area of protected basin |
| `.stage_storage` | Stage-storage curve (2D array) |
| `.tc_hr` | Estimated basin time of concentration (hours) |

---

## `SeawallSimulation2D`

Runs a single 2D ROM simulation for one SLR scenario.

```python
from pywmp.coastal import SeawallSimulation2D

single = SeawallSimulation2D(
    geometry       = geom,
    slr_ft         = 1.5,          # sea-level rise above current MSL
    rain_ts        = rain_ts,
    normal_tide_ft = 0.7,
    duration_hr    = 6,
)
flood_map = single.run()
print(f"Max depth: {flood_map.stats.max_depth_ft:.2f} ft")
flood_map.to_geotiff("output/slr_1ft5_depth.tif")
```

---

## `SeawallSLRSweep`

Sweeps `SeawallSimulation2D` across a list of SLR levels and aggregates results.

```python
SeawallSLRSweep(geometry, slr_levels_ft, rain_ts, ocean_edge, normal_tide_ft)
```

| Parameter | Description |
|---|---|
| `slr_levels_ft` | List of SLR values (ft above current MSL) to simulate |
| `ocean_edge` | Which domain edge represents the ocean: `"north"`, `"south"`, `"east"`, `"west"` |
| `normal_tide_ft` | Baseline tidal stage used as the ocean boundary condition |

### `SweepResults`

| Attribute / Method | Description |
|---|---|
| `.summary_df` | DataFrame: SLR level → flooded area, max depth, volume, overtop threshold |
| `.overtop_slr_ft` | SLR level at which seawall first overtops |
| `.flood_maps` | List of `CoastalFloodMap` (one per SLR level) |
| `.plot_summary(path)` | Multi-panel figure: flooded area vs. SLR + depth maps |
| `.save_rasters(dir)` | Save all depth GeoTIFFs to a directory |

---

## `CascadeSeawall` — detention routing with seawall

For sites using Cascade 2001 detention routing with a seawall structure:

```python
from pywmp.cascade import CascadeSeawall

wall = CascadeSeawall(
    crest_elev_ft   = 5.2,
    crest_length_ft = 380.0,
    weir_coeff      = 2.6,
    basin            = my_cascade_basin,
)
```

`CascadeSeawall` integrates with `CascadeSimulation` as a hydraulic structure. Stage rises in the basin until the seawall overtops; after overtopping, weir flow is computed using the standard broad-crested weir equation.

---

## Interpreting results

- **No SLR (0 ft):** Baseline flooding from rainfall alone. Validates the model against current conditions.
- **Overtopping threshold:** The `SweepResults.overtop_slr_ft` value is the critical planning threshold — below it, the seawall provides full protection; above it, flooding increases rapidly.
- **Depth maps:** Export as COG (`flood_map.to_cog()`) for sharing with GeoLibre or web GIS platforms.

```python
# Identify the first scenario where flooding exceeds 100 acres
for i, slr in enumerate(sweep.slr_levels_ft):
    if results.flood_maps[i].stats.flooded_area_acres > 100:
        print(f"Flooding exceeds 100 acres at SLR = {slr} ft")
        break
```
