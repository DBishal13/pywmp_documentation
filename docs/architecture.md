# Architecture

PyWMP is built as a modular Python package with clear separation between modeling, data, and interface layers. The architecture is designed to support reproducible workflows, extensible backend selection, and portable geospatial data processing.

## Core layers

### 1. Simulation and workflow

- `pywmp.workflow` — high-level workflow builders for design storms, basin models, and automated model assembly
- `pywmp.simulation` — the engine that executes basin models and collects results
- `pywmp.time_series` — a unified time series data format for model inputs and outputs

### 2. Hydrologic modules

- `pywmp.meteorology` — precipitation sources, hyetographs, and NOAA Atlas 14 IDF curves
- `pywmp.losses` — infiltration and runoff generation methods
- `pywmp.transform` — unit hydrograph methods for storm runoff timing
- `pywmp.baseflow` — groundwater and recession flow models
- `pywmp.routing` — channel routing schemes and reach hydraulics
- `pywmp.reservoir` — level-pool storage and outlet structure models
- `pywmp.gridded` — spatially distributed methods, such as ModClark and gridded curve number

### 3. 2D modeling and hybrid coupling

- `pywmp.rom` — 2D rain-on-mesh solver for shallow-water simulation
- `pywmp.hybrid` — one-way 1D to 2D coupling and excess precipitation distribution
- `pywmp.flood` — flood mapping, HAND analysis, and inundation tools

### 4. Datasets and external integration

- `pywmp.datasets` — automated downloaders for DEM, watershed boundaries, hydrography, land cover, soils, rainfall, and flood zones
- `pywmp.api` — optional REST API and WebSocket server for remote simulation control
- `pywmp.cascade` — Cascade 2001 project parser and detention routing compatibility

## Design principles

### Unified data model

PyWMP relies on common types such as `TimeSeries`, `UnitSystem`, and `SimResults` to ensure that components can interoperate cleanly across modules.

### Extensible backend selection

- CPU acceleration through `numba`
- GPU acceleration through CUDA when available
- Optional WhiteboxTools support for large DEM workflows

### Modular optional dependencies

The package separates optional features to reduce install burden:

- `spatial` for GIS I/O
- `datasets` for automated downloads
- `fast` for `numba` acceleration
- `api` for REST integration
- `dss` for HEC-DSS I/O

## Typical workflow

1. **Prepare data** using `pywmp.datasets` or external sources
2. **Build a model** using `pywmp.workflow` and selected hydrologic methods
3. **Run simulation** with `pywmp.simulation` or `pywmp.rom`
4. **Inspect results** using `SimResults` and export options
5. **Optionally couple** 1D and 2D domains with `pywmp.hybrid`

## Deployment and integration

PyWMP can be used as:

- a Python library in notebooks and scripts
- a reproducible workflow engine for batch simulations
- a remote service via the optional REST API
- a research platform for hybrid model comparison
