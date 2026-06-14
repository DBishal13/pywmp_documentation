# Dataset Reference

`pywmp.datasets` automates download and caching of eight open-access spatial datasets
required for watershed modelling. All downloads are performed over HTTPS from public
agency APIs; no API keys are required.

## DatasetManager

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-81.70, 27.85, -81.50, 27.95),   # (minx, miny, maxx, maxy) in WGS-84
    output_dir="data/watershed/",
    cache=True,                            # default True
)
```

**AOI formats accepted**: `(minx, miny, maxx, maxy)` tuple, `shapely.Geometry`,
`geopandas.GeoDataFrame`, or `geopandas.GeoSeries`. All are normalised to WGS-84.

## Individual download methods

### `download_dem(resolution_m=10)`

Downloads a USGS 3DEP elevation raster for the AOI via the TNM REST API.

| Parameter | Default | Notes |
|-----------|---------|-------|
| `resolution_m` | 10 | 1 m (LiDAR), 10 m, or 30 m available depending on coverage |

Output: `{output_dir}/dem.tif`

Use 1 m resolution for site-level RUSLE/LS factor calculations and asset elevation extraction.
Use 10 m or 30 m for watershed-scale simulations to reduce grid size.

### `download_watershed(huc_level=12)`

Downloads HUC watershed boundary polygons from the USGS WBD service.

Output: `{output_dir}/watershed.gpkg`

### `download_nhd()`

Downloads NHDPlus HR flowlines and catchment polygons via ArcGIS feature service
with automatic paging for large AOIs.

Outputs: `{output_dir}/nhd_flowlines.gpkg`, `{output_dir}/nhd_catchments.gpkg`

### `download_nlcd(year=2021)`

Downloads the NLCD land cover raster via MRLC WCS. For large AOIs, the downloader
automatically tiles the request into a 2x2 grid and merges the results with rasterio.
Two coverage IDs are attempted in sequence to account for MRLC server changes.

| Parameter | Default | Valid years |
|-----------|---------|------------|
| `year` | 2021 | 2001, 2004, 2006, 2008, 2011, 2013, 2016, 2019, 2021 |

Output: `{output_dir}/nlcd.tif`

### `download_soils()`

Downloads SSURGO soil data and derives a Hydrologic Soil Group (HSG) raster from
the USDA Soil Data Access REST service.

Output: `{output_dir}/soils.tif`

### `download_cn()`

Derives a Curve Number raster by cross-referencing NLCD land-cover classes with
SSURGO HSG assignments using the NRCS TR-55 lookup table.

**Requires**: NLCD and soils datasets downloaded first.

Output: `{output_dir}/cn.tif`

### `download_atlas14(lat, lon)`

Retrieves NOAA Atlas 14 IDF values from the HDSC REST API for the watershed centroid.
Returns depth-frequency pairs for durations of 5 min to 60 days and return periods
of 1 to 1000 years.

Output: `{output_dir}/atlas14_idf.json`

### `download_floodzone()`

Downloads FEMA National Flood Hazard Layer (NFHL) flood zone polygons. AE, AO, VE,
and X zones are included. Paged queries handle large AOIs.

Output: `{output_dir}/floodzone.gpkg`

## Convenience functions

```python
from pywmp.datasets import download_for_aoi

# Runs all eight downloaders in sequence
download_for_aoi(
    aoi=(-81.70, 27.85, -81.50, 27.95),
    output_dir="data/watershed/",
    lat=27.9, lon=-81.6,
)
```

## PROJ environment

On Windows, `DatasetManager` calls `ensure_proj_env()` at import time to locate
`proj.db` and set `PROJ_LIB` automatically. If PROJ cannot be located, a
`RuntimeError` is raised with diagnostic information. Install `pyproj` via pip or
conda-forge to resolve this.

## Troubleshooting downloads

- **AOI outside coverage** — Some 3DEP 1 m tiles are not available outside the
  continental US. Fall back to `resolution_m=10`.
- **NLCD WCS timeout** — The MRLC server occasionally times out for large AOIs.
  The downloader retries with 2x2 tiling automatically.
- **NHD empty response** — Verify the AOI intersects US territory. Use `huc_level=8`
  for larger polygons if `huc_level=12` returns no features.
- **Atlas 14 rate limit** — The HDSC API enforces a rate limit. A 30-second wait
  between calls is sufficient in batch scripts.
