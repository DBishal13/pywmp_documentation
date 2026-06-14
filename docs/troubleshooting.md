# Troubleshooting

Common installation and runtime issues for PyWMP, with solutions for geospatial
and 2D modeling workflows.

---

## Quick diagnostics

Run this one-liner to verify your environment before digging deeper:

```python
import pywmp, rasterio, geopandas, fiona, pyproj, numba
print("pywmp    :", pywmp.__version__)
print("rasterio :", rasterio.__version__)
print("geopandas:", geopandas.__version__)
print("fiona    :", fiona.__version__)
print("pyproj   :", pyproj.__version__)
print("numba    :", numba.__version__)
```

If any import fails, jump to the relevant section below.

---

## Installation

### Upgrade packaging tools first

Before installing PyWMP, update pip, setuptools, and wheel:

```bash
python -m pip install --upgrade pip setuptools wheel
```

### Install the correct extras

=== "Geospatial workflows"

    ```bash
    pip install "pywmp[spatial]"
    ```

=== "Automated dataset downloads"

    ```bash
    pip install "pywmp[datasets]"
    ```

=== "Fast 2D solver (Numba)"

    ```bash
    pip install "pywmp[fast]"
    ```

=== "All extras"

    ```bash
    pip install "pywmp[spatial,datasets,fast]"
    ```

=== "Docs preview"

    ```bash
    pip install "pywmp[docs]"
    mkdocs serve
    ```

---

## Common errors

### `Could not find PROJ data file proj.db`

??? failure "Symptom"
    ```
    proj.db: no such file or directory
    pyproj.exceptions.DataDirError: Valid PROJ data directory not found.
    ```

The PROJ data directory is missing or `PROJ_LIB` points to the wrong location.

**Fix — force-reinstall pyproj:**

```bash
pip install pyproj --force-reinstall
```

**Fix — set PROJ_LIB manually:**

=== "Windows (permanent)"

    ```powershell
    setx PROJ_LIB "C:\Users\<you>\AppData\Local\Programs\Python\Python311\Lib\site-packages\pyproj\proj_dir\share\proj"
    ```

=== "macOS / Linux"

    ```bash
    export PROJ_LIB=$(python -c "import pyproj; print(pyproj.datadir.get_data_dir())")
    ```

**Fix — Conda environment:**

```bash
conda install -c conda-forge pyproj proj
```

---

### `ImportError: No module named 'fiona'` or `DLL load failed`

??? failure "Symptom"
    ```
    ImportError: No module named 'fiona'
    ImportError: DLL load failed while importing _fiona: ...
    ```

On Windows, binary wheels for geospatial packages can conflict when mixing
`pip` and `conda` installs.

**Recommended fix — clean virtual environment:**

```bash
pip install "pywmp[spatial]"
```

**If DLL errors persist on Windows, use conda-forge:**

```bash
conda create -n pywmp python=3.11
conda activate pywmp
conda install -c conda-forge rasterio geopandas fiona pyproj
pip install pywmp
```

!!! warning "Do not mix conda and pip for core GIS packages"
    Installing `rasterio` via conda and `fiona` via pip (or vice versa) frequently
    causes DLL conflicts on Windows. Use one source for the whole GIS stack.

---

### `numba.core.errors.TypingError` or solver runs at Python speed

??? failure "Symptom"
    ```
    numba.core.errors.TypingError: Failed in nopython mode pipeline execution
    ```
    Or the 2D solver runs, but with no JIT speedup.

**Check Numba is installed:**

```bash
python -c "import numba; print(numba.__version__)"
```

**Install the fast extra:**

```bash
pip install "pywmp[fast]"
```

**First-run JIT compilation is expected.** Numba compiles kernels on first call;
expect 10–30 s overhead on initial import. Subsequent runs are fast.

**NumPy version conflict after upgrade:**

```bash
pip install "numba>=0.59" "numpy>=1.24,<2.1"
```

---

### Dataset download failures

??? failure "Symptoms"
    - `requests.exceptions.ConnectionError`
    - `pywmp.datasets.DownloadError: server returned 503`
    - Download completes but output file is empty or corrupt

**Steps to resolve:**

1. Verify internet connectivity — the downloader contacts USGS, NOAA, USDA, and
   FEMA endpoints.

2. Reduce AOI size. Large bounding boxes time out on USGS TNM and SSURGO endpoints.
   Always pass the watershed polygon, not a bounding box:

    ```python
    dm = DatasetManager(aoi=watershed_gdf, output_dir="data/")
    dm.download("dem")          # clips to watershed polygon
    ```

3. Try a lower DEM resolution for initial testing:

    ```python
    dm.download("dem", resolution=10)   # 10 m instead of 1 m
    ```

4. Enable debug logging to see the raw request/response:

    ```python
    import logging
    logging.basicConfig(level=logging.DEBUG)
    dm.download("dem")
    ```

5. Set proxy if behind a corporate firewall:

    ```python
    import os
    os.environ["HTTPS_PROXY"] = "http://proxy.corp.example.com:8080"
    ```

---

### CRS and projection errors

??? failure "Symptoms"
    - `ValueError: CRS mismatch: inputs must be in the same CRS`
    - Misaligned raster/vector overlays after running the pipeline

All spatial inputs must share a common CRS. PyWMP expects AOI geometries in
WGS84 (`EPSG:4326`) and reprojects internally to a UTM zone for metric operations.

**Diagnose:**

```python
import geopandas as gpd
import rasterio

gdf = gpd.read_file("watershed.shp")
print(gdf.crs)                      # should be EPSG:4326

with rasterio.open("dem.tif") as src:
    print(src.crs)                  # e.g. EPSG:26917 (UTM 17N)
```

**Reproject to match:**

```python
gdf_utm = gdf.to_crs("EPSG:32617")   # UTM 17N — SE United States
```

---

### 2D simulation — out of memory or very slow

!!! info "Grid size reference"
    A 1 m DEM over a 5 km × 5 km domain has ~25 million cells.
    At `float32`, each state array is ~400 MB; the solver keeps several simultaneously.

**Reduce domain — clip to the hydraulically active floodplain:**

```python
from pywmp.terrain import clip_raster
clip_raster("dem_1m.tif", watershed_gdf.buffer(-50), "dem_clipped.tif")
```

**Use a coarser resolution for scoping runs:**

```python
dm.download("dem", resolution=3)    # 3 m is usually sufficient for 10–100 km²
```

**Enable Numba acceleration:**

```bash
pip install "pywmp[fast]"
```

**Enable CUDA backend (if GPU available):**

```python
from pywmp.solver import CascadeModel
model = CascadeModel(dem_path="dem.tif", backend="cuda")
```

**Monitor memory during a run:**

=== "Windows"

    ```powershell
    Get-Process python | Select-Object WorkingSet64
    ```

=== "Linux / macOS"

    ```bash
    watch -n2 "ps aux | grep python"
    ```

---

### HEC-HMS import / export errors

??? failure "Symptom"
    ```
    pywmp.hms.ParseError: unexpected token at line 42 of .basin file
    ```

PyWMP targets HEC-HMS 4.10+. Older `.basin` and `.met` formats may differ.

- Open the project in HEC-HMS 4.10+ and **Save As** to upgrade the file format.
- Verify the `.hms` control file references valid start/end dates.
- Path separators: manually edited HEC-HMS files on Windows sometimes use
  forward slashes, which HEC-HMS rejects. PyWMP normalises separators automatically,
  but double-check hand-edited files.

---

## Platform-specific notes

### Windows

- Use a **clean virtual environment** (`python -m venv .venv`).
- Prefer `conda-forge` for the GIS stack (`rasterio`, `gdal`, `fiona`,
  `pyproj`, `geopandas`) to avoid DLL conflicts.
- Do not mix `conda` and `pip` installs for the same package.
- If `GDAL_DATA` or `PROJ_LIB` are unset, add them via **System Properties →
  Environment Variables**.
- Enable long-path support if you get `FileNotFoundError` on deep nested paths:

    ```powershell
    # Run PowerShell as Administrator
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
      -Name LongPathsEnabled -Value 1
    ```

### macOS

- Apple Silicon (M-series): use `conda-forge` arm64 packages.
- If Fiona / GDAL fail: `brew install gdal`, then reinstall Fiona.

### Linux

- System GDAL may conflict with pip wheels. Use a virtualenv and either:
  - Build from source: `pip install rasterio --no-binary rasterio`
  - Or use `conda-forge` packages.

---

## Frequently asked questions

**Do I need a GPU to run PyWMP?**
No. The CPU + Numba path is the default and handles watersheds up to several
hundred km². GPU (CUDA) accelerates very large domains (> 500 km² at 1 m resolution).

**Which Python versions are supported?**
PyWMP is tested on Python 3.10, 3.11, and 3.12. Python 3.9 may work but is
not officially supported.

**Can I use PyWMP offline?**
Yes, if all spatial datasets are already on disk. Pass local file paths directly
to `DatasetManager` or the model constructors. Internet access is only required
for automated data acquisition via `download_all()`.

**I get `DeprecationWarning: Shapely 1.x geometry detected`.**
Upgrade Shapely:

```bash
pip install "shapely>=2.0"
```

**The docs preview shows missing CSS.**
Confirm you are running from the repo root and have the docs extras installed:

```bash
pip install "pywmp[docs]"
mkdocs serve
```

---

## Getting help

If the steps above do not resolve your issue:

1. Search [existing GitHub issues](https://github.com/mandalanil/PyWMP/issues) —
   your error may already have a fix.
2. Open a new issue and include:
    - PyWMP version: `python -c "import pywmp; print(pywmp.__version__)"`
    - Python version and OS
    - Full traceback
    - Minimal reproducible code snippet
3. For workflow or methodology questions, use the
   [Discussions tab](https://github.com/mandalanil/PyWMP/discussions).
