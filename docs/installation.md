# Installation

This page explains how to install PyWMP for core use, geospatial workflows, and optional extensions. The package is organized with modular extras so you can install only the capabilities you need.

## Supported environments

- Python 3.10 or later
- Windows, macOS, and Linux
- `pip` package manager (virtualenv or conda environments recommended)

> For geospatial workflows, use a clean Python environment and avoid mixing package managers. On Windows, Miniconda or the official Python installer are the most reliable starting points.

## Install the core package

The core package includes the simulation engine, workflow API, and basic hydrologic methods.

```bash
pip install pywmp
```

## Optional extras

Use optional dependency groups to install only the features you require.

| Extra | Purpose |
|-------|---------|
| `spatial` | GIS raster/vector I/O with `rasterio`, `geopandas`, `fiona`, `pyproj` |
| `datasets` | Automated watershed dataset downloads and HyRiver integration |
| `fast` | `numba` acceleration for CPU performance |
| `ultra` | `whitebox` support for large DEM preprocessing |
| `noaa` | NOAA Atlas 14 IDF retrieval |
| `dss` | HEC-DSS binary time-series I/O |
| `api` | FastAPI / WebSocket server |
| `docs` | MkDocs site building and local preview |

## Recommended install bundles

### Minimal install

For basic hydrologic modeling without GIS I/O:

```bash
pip install pywmp
```

### Geospatial modeling and dataset download

For end-to-end watershed setup and spatial workflows:

```bash
pip install "pywmp[datasets]"
```

### Full install

For the complete PyWMP experience, including datasets, API support, and documentation:

```bash
pip install "pywmp[all]"
```

## Installation strategy

### 1. Upgrade packaging tools

```bash
python -m pip install --upgrade pip setuptools wheel
```

### 2. Install the selected extras

```bash
pip install "pywmp[datasets]"
```

### 3. Verify the package install

```bash
python -c "import pywmp; print(pywmp.__version__)"
```

### 4. Install docs dependencies (optional)

```bash
pip install "pywmp[docs]"
```

## Recommended environment setup

### Windows

- Use a fresh virtual environment.
- Prefer Miniconda or the official Python installer.
- Avoid mixing `conda` and `pip` installs for core geospatial packages.
- If `proj.db` is not found, set `PROJ_LIB` to the directory containing that file:

```powershell
setx PROJ_LIB "C:\path\to\proj\share\proj"
```

### macOS / Linux

- Use `python -m venv` or `conda create`.
- If geospatial wheel installation fails, use the `conda-forge` channel:

```bash
conda install -c conda-forge rasterio geopandas fiona pyproj
```

## Common installation issues

### `ImportError: cannot import name 'rasterio'`

Install the spatial extra:

```bash
pip install "pywmp[spatial]"
```

### `proj.db` not found

Check the PyProj data directory:

```bash
python -c "import pyproj; print(pyproj.datadir.get_data_dir())"
```

If needed, set `PROJ_LIB` to the folder containing `proj.db`.

### Build or wheel errors

Update packaging tools and retry:

```bash
python -m pip install --upgrade pip setuptools wheel
```

## Verify the environment

Run this command to confirm the package and key geospatial dependencies are installed:

```bash
python -c "import pywmp, rasterio, geopandas, pyproj, fiona; print('OK')"
```

If the command returns `OK`, your environment is ready for PyWMP spatial workflows.
