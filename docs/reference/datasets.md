# Dataset Reference

`pywmp.datasets` provides automated downloaders for all spatial inputs required by a watershed model.

## DatasetManager

The `DatasetManager` controls the download order, caching, and summary of downloaded files.

### Basic usage

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-81.700, 27.850, -81.500, 27.950),
    output_dir="data/my_watershed",
)

dm.download_dem(resolution_m=10)
dm.download_watershed(huc_level=12)
dm.download_nhd()
dm.download_nlcd(year=2021)
dm.download_soils()
dm.download_cn()
dm.download_atlas14(lat=27.9, lon=-81.6)
dm.download_floodzone()
print(dm.summary())
```

## Datasets supported

- `download_dem()` — USGS 3DEP DEM data at selectable resolution
- `download_watershed()` — USGS Watershed Boundary Dataset (WBD)
- `download_nhd()` — NHD flowlines and catchment polygons
- `download_nlcd()` — NLCD land cover raster
- `download_soils()` — USDA SSURGO soil and HSG raster data
- `download_cn()` — derive a curve number raster from NLCD + SSURGO
- `download_atlas14()` — NOAA Atlas 14 IDF curves for a point location
- `download_floodzone()` — FEMA NFHL flood zone polygons

## Workflow notes

- Download the DEM first. Many other dataset downloaders use the DEM footprint or AOI geometry.
- Download NLCD and soils before calling `download_cn()`.
- `download_all()` runs all supported downloaders in a sensible sequence.

## Output files

The dataset manager writes files into `output_dir`. Typical outputs include:

- `dem.tif`
- `watershed.gpkg`
- `nhd_flowlines.gpkg`
- `nhd_catchments.gpkg`
- `nlcd.tif`
- `soils.tif`
- `cn.tif`
- `atlas14_idf.json`
- `floodzone.gpkg`

## Troubleshooting downloads

- If a dataset is not available for the AOI, try a nearby location or a larger AOI.
- If download requests fail, check internet access and firewall settings.
- For large AOIs, use coarser DEM resolution and download data incrementally.
