# Visualizing PyWMP Results with GeoLibre

[GeoLibre](https://geolibre.app) is a lightweight, cloud-native GIS platform with a Python API for Jupyter notebooks. It can load GeoTIFF rasters, GeoParquet vectors, and cloud-optimized formats directly in the browser — making it a natural companion for exploring pywmp simulation outputs interactively without leaving Python.

## Installation

```bash
pip install geolibre
# GeoLibre also bundles a full web GIS app — no browser extension needed
```

---

## Quickest path — flood depth map in 3 lines

```python
from geolibre import GeoLibre
from pywmp.flood import FloodMapper

# Run simulation, export COG
flood_map.to_cog("output/flood_depth_100yr_cog.tif")

# Load in GeoLibre Jupyter widget
m = GeoLibre()
m.add_cog("output/flood_depth_100yr_cog.tif", name="100-yr Flood Depth")
m   # renders interactive map in the notebook cell
```

The map auto-zooms to the COG extent, applies a sequential color ramp, and lets you click any pixel to read the depth value.

---

## Why GeoLibre for pywmp outputs?

| pywmp output | GeoLibre feature | How to load |
|---|---|---|
| Flood depth map (`.tif`) | COG viewer + styling | `m.add_cog(path)` |
| Watershed boundaries (`.gpkg`) | Vector layer | `m.add_geojson(gdf)` |
| NHD flowlines (`.gpkg`) | Vector layer | `m.add_geojson(gdf)` |
| FEMA flood zones (`.gpkg`) | Vector layer | `m.add_geojson(gdf)` |
| Simulation results table | DuckDB SQL workspace | Export to GeoParquet, query in GeoLibre UI |
| SLR sweep outputs | Time-series animation | Temporal slider plugin |
| Calibration dotty plots | Static images | Display alongside map |

---

## Step-by-step: full post-processing visualization

### 1. Export pywmp outputs

```python
from pathlib import Path
import geopandas as gpd

out = Path("output/viz")
out.mkdir(parents=True, exist_ok=True)

# Flood depth as Cloud Optimized GeoTIFF
flood_map.to_cog(out / "depth_100yr.tif")

# Watershed vector layers
wbd   = gpd.read_file("data/my_watershed/huc12.gpkg")
nhd   = gpd.read_file("data/my_watershed/flowlines.gpkg")
fema  = gpd.read_file("data/my_watershed/fema_sfha.gpkg")

# Validation comparison (simulated flood extent vs FEMA)
sim_extent = flood_map.to_geodataframe(depth_threshold_ft=0.5)  # wet cells as polygons
```

### 2. Build the GeoLibre map

```python
from geolibre import GeoLibre

m = GeoLibre()

# Basemap (satellite imagery)
m.set_basemap("satellite")

# Flood depth raster (semi-transparent overlay)
m.add_cog(
    out / "depth_100yr.tif",
    name    = "100-yr Flood Depth (ft)",
    opacity = 0.75,
    colormap = "Blues",
)

# FEMA flood zones (dashed red outline)
m.add_geojson(fema, name="FEMA SFHA", style={"color": "red", "fillOpacity": 0.1})

# Simulated flood extent
m.add_geojson(sim_extent, name="Simulated Flood", style={"color": "blue", "fillOpacity": 0.15})

# NHD streams
m.add_geojson(nhd, name="NHD Flowlines", style={"color": "steelblue", "weight": 1.5})

# Watershed boundary
m.add_geojson(wbd, name="HUC-12 Boundary", style={"color": "black", "fillOpacity": 0})

m   # render
```

### 3. Compare multiple SLR scenarios (SeawallSLRSweep)

```python
from pywmp.coastal import SeawallSLRSweep

# After running the sweep...
for slr, fm in zip(sweep.slr_levels_ft, results.flood_maps):
    fm.to_cog(out / f"depth_slr_{slr:.1f}ft.tif")

# Load all scenarios into GeoLibre
m = GeoLibre()
for slr in sweep.slr_levels_ft:
    m.add_cog(
        out / f"depth_slr_{slr:.1f}ft.tif",
        name    = f"SLR = {slr:.1f} ft",
        visible = (slr == 0.0),   # show baseline only initially
    )
m
```

Toggle SLR scenarios on/off using the layer panel in the GeoLibre UI.

---

## Export to GeoParquet for DuckDB spatial queries

GeoLibre includes a DuckDB Spatial SQL workspace. Export your results as GeoParquet to query them directly:

```python
import geopandas as gpd

# Export flood depth grid as point GeoDataFrame → GeoParquet
flood_points = flood_map.to_geodataframe(as_points=True)   # centroid of each wet cell
flood_points.to_parquet(out / "flood_depth_points.parquet")
```

In the GeoLibre UI → SQL Workspace, you can then run queries like:

```sql
-- Load from file and query
SELECT
    ST_X(geometry) AS lon,
    ST_Y(geometry) AS lat,
    depth_ft,
    CASE WHEN depth_ft > 2 THEN 'Major' WHEN depth_ft > 0.5 THEN 'Minor' ELSE 'Trace' END AS flood_class
FROM read_parquet('output/viz/flood_depth_points.parquet')
WHERE depth_ft > 0
ORDER BY depth_ft DESC
LIMIT 1000;
```

---

## Sharing your map

GeoLibre projects save as `.geolibre.json` files. Share a link or embed the map:

```python
# Save project
m.save("output/flood_analysis.geolibre.json")

# Load project later
m2 = GeoLibre.load("output/flood_analysis.geolibre.json")

# Generate a shareable URL (if hosting GeoLibre app)
print(m.share_url(layout="compact"))   # compact layout for embedding
```

---

## Terrain visualization (DEM hillshade)

Use GeoLibre's built-in raster tools to generate a hillshade from the DEM — useful as a base layer under flood depth:

```python
# In the GeoLibre UI: Raster Tools → Hillshade → select dem.tif
# Or programmatically:
m.add_cog(
    "data/my_watershed/dem.tif",
    name      = "DEM Hillshade",
    raster_op = "hillshade",   # applies hillshade styling automatically
    opacity   = 0.4,
)
```

---

## Complete example notebook

The file `examples/visualization_geolibre.ipynb` in the repo combines the full pipeline:

1. Download watershed inputs
2. Run 100-year hybrid simulation
3. Export all outputs (COG, GeoPackage, GeoParquet)
4. Build a GeoLibre map with all layers
5. Run DuckDB spatial query on results

---

## References

- [GeoLibre documentation](https://geolibre.app)
- [GeoLibre Python API](https://github.com/opengeos/GeoLibre)
- `pywmp.flood.FloodMap.to_cog()` — Cloud Optimized GeoTIFF export
- `pywmp.flood.FloodMap.to_geodataframe()` — convert depth raster to vector
