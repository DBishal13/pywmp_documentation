# Dataset Download Tutorial

PyWMP automates the acquisition of every geospatial input a watershed model needs — DEM, watershed boundaries, stream network, land cover, soils, curve numbers, IDF curves, and flood zones — all from freely accessible federal data services.

## Installation

```bash
pip install "pywmp[datasets]"
```

This installs the HyRiver suite (`py3dep`, `pynhd`, `pygeohydro`, `rioxarray`) plus `rasterio` and `geopandas`.

---

## Defining your area of interest

All downloads use a bounding box in WGS-84 decimal degrees:

```python
aoi = (minx, miny, maxx, maxy)
# example: west-central Florida
aoi = (-82.05, 28.02, -81.98, 28.07)
```

Pick coordinates that fully enclose your watershed with a small buffer (~0.01°). Use [bboxfinder.com](https://bboxfinder.com) to draw and copy a bounding box visually.

---

## `DatasetManager` — one manager for all downloads

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-82.05, 28.02, -81.98, 28.07),
    output_dir="data/my_watershed",
    cache=True,          # reuse existing files (default True)
)
```

---

## Dataset-by-dataset guide

### 1. Digital Elevation Model (DEM)

**Source:** USGS 3D Elevation Program (3DEP)  
**Output:** `dem.tif` — GeoTIFF raster in the native 3DEP CRS  
**Why you need it:** Everything downstream depends on the DEM — watershed delineation, HAND computation, 2D grid construction.

```python
dm.download_dem(resolution_m=10)   # 10 m lidar DEM
# options: resolution_m=1, 3, 10, 30
```

Download DEM **first**. All other datasets are clipped to the DEM's extent.

| `resolution_m` | Coverage | Recommended for |
|---|---|---|
| 1 | Urban / small watersheds (<5 mi²) | High-resolution flood mapping |
| 3 | Suburban / medium (5–50 mi²) | Detailed 2D ROM grids |
| 10 | Rural / large watersheds | Standard watershed modeling |
| 30 | Very large / national-scale | Regional screening only |

---

### 2. Watershed Boundaries (WBD)

**Source:** USGS National Hydrography Dataset — Watershed Boundary Dataset  
**Output:** `huc12.gpkg` — GeoPackage polygon of the HUC-12 unit  
**Why you need it:** Defines the drainage area; used to clip other datasets and compute basin area.

```python
dm.download_watershed(huc_level=12)
# options: huc_level=2, 4, 6, 8, 10, 12
```

HUC-12 (~10,000 acres) is the standard scale for site-scale watershed modeling.

---

### 3. Stream Network (NHD)

**Source:** USGS NHDPlus v2  
**Output:** `flowlines.gpkg` (streams) + `catchments.gpkg` (contributing areas)  
**Why you need it:** Defines reach connectivity for 1D routing; burned into DEM for hydrologically conditioned terrain analysis.

```python
dm.download_nhd()
```

The flowlines include reach attributes: stream order, GNIS name, length (km), and flow direction.

---

### 4. Land Cover (NLCD)

**Source:** Multi-Resolution Land Characteristics Consortium (MRLC)  
**Output:** `nlcd.tif` — 30 m raster of land cover codes  
**Why you need it:** Required to derive Curve Numbers; describes impervious area and land-use type.

```python
dm.download_nlcd(year=2021)
# available years: 2001, 2004, 2006, 2008, 2011, 2013, 2016, 2019, 2021
```

Use `year=2021` unless you are modeling a historical event.

**Land cover code reference (common classes):**

| Code | Label | Typical CN (B soils) |
|---|---|---|
| 11 | Open water | 100 |
| 21 | Developed, open space | 68 |
| 22 | Developed, low intensity | 79 |
| 23 | Developed, medium intensity | 86 |
| 24 | Developed, high intensity | 89 |
| 41 | Deciduous forest | 60 |
| 71 | Herbaceous grassland | 71 |
| 81 | Hay/pasture | 69 |
| 82 | Cultivated crops | 81 |

---

### 5. Soils / Hydrologic Soil Groups (SSURGO)

**Source:** USDA Web Soil Survey (SSURGO — Soil Survey Geographic Database)  
**Output:** `hsg.tif` — 30 m raster of HSG class (1=A, 2=B, 3=C, 4=D)  
**Why you need it:** HSG combined with land cover determines the Curve Number. B and C soils are the most common.

```python
dm.download_soils()
```

**HSG definitions:**

| Group | Infiltration | Typical soils | Runoff potential |
|---|---|---|---|
| A | High (>0.3 in/hr) | Sand, gravel | Low |
| B | Moderate (0.15–0.3 in/hr) | Sandy loam | Moderately low |
| C | Slow (0.05–0.15 in/hr) | Clay loam, silty loam | Moderately high |
| D | Very slow (<0.05 in/hr) | Clay, high water table | High |

---

### 6. Curve Number (CN) raster

**Source:** Derived from NLCD × SSURGO (NRCS TR-55 Table 2-2 lookup)  
**Output:** `cn.tif` — 30 m raster of composite CN values (integer 0–100)  
**Why you need it:** Direct input to `SCSCurveLoss`; used to compute the composite basin CN.

```python
dm.download_cn()   # requires NLCD and soils to be downloaded first
```

Use `pywmp.datasets.nlcd_summary(dm.nlcd_path)` to review the land cover breakdown and sanity-check the CN distribution.

---

### 7. NOAA Atlas 14 IDF Curves

**Source:** NOAA Hydrometeorological Design Studies Center (HDSC)  
**Output:** `atlas14.json` — IDF table for durations 5-min to 60-day and return periods 1–1000 years  
**Why you need it:** Defines the design storm depth for a given return period (e.g., 100-year 24-hour = X inches).

```python
dm.download_atlas14(lat=28.044, lon=-82.013)
```

Returns a structured JSON with point precipitation frequency estimates. Use with `IDFCurve` to build design storms:

```python
from pywmp.meteorology import IDFCurve

idf = IDFCurve("data/my_watershed/atlas14.json")
print(f"100-yr 24-hr depth: {idf.depth(24, 100):.2f} in")
print(f"25-yr  1-hr  depth: {idf.depth(1, 25):.2f} in")
```

---

### 8. FEMA Flood Zones (NFHL)

**Source:** FEMA National Flood Hazard Layer (NFHL) via ArcGIS REST  
**Output:** `fema_sfha.gpkg` — polygon layer of Special Flood Hazard Areas  
**Why you need it:** Baseline flood zone comparison; regulatory reference for the 100-year floodplain.

```python
dm.download_floodzone()
```

**FEMA zone codes:**

| Zone | Description |
|---|---|
| A / AE | 1% annual chance floodplain (100-year) |
| AH | Shallow flooding (1–3 ft ponding) |
| VE | Coastal high-hazard (wave action) |
| X (shaded) | 0.2% annual chance (500-year) |
| X (unshaded) | Minimal flood hazard |

---

## Download all at once

```python
dm.download_all(lat=28.044, lon=-82.013)
print(dm.summary())
```

`download_all()` runs everything in the correct dependency order. Output:

```
Dataset         Status    Path
-----------     ------    --------------------------------
dem             OK        data/my_watershed/dem.tif
huc12           OK        data/my_watershed/huc12.gpkg
flowlines       OK        data/my_watershed/flowlines.gpkg
catchments      OK        data/my_watershed/catchments.gpkg
nlcd            OK        data/my_watershed/nlcd.tif
hsg             OK        data/my_watershed/hsg.tif
cn              OK        data/my_watershed/cn.tif
atlas14         OK        data/my_watershed/atlas14.json
fema_sfha       OK        data/my_watershed/fema_sfha.gpkg
```

---

## Handling download failures

**Services go offline occasionally.** The downloaders use tiered fallbacks:

- `py3dep` → 3DEP ImageServer REST → error
- `pynhd` → NHDPlus REST endpoint → error
- `pygeohydro` → MRLC WCS → error

When a download fails:

1. Check internet connectivity and VPN status.
2. The cached file (if any) is reused automatically (`cache=True`).
3. Try a slightly larger AOI — some service tiles have sparse coverage at exact boundaries.
4. Re-run only the failed step individually:

```python
dm.download_nlcd(year=2019)  # try an older year if 2021 is unavailable
```

---

## Next steps

- [Full Pipeline Tutorial](full_pipeline.md) — use these datasets to run a complete simulation
- [Module Reference: datasets](../reference/datasets.md) — individual downloader API
- [Concepts](../concepts.md) — how each dataset feeds into the hydrologic model
