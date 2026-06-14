# Reference Overview

Quick navigation to all PyWMP v0.2.0 modules and entry points.

## Core simulation

| Module | Entry point | Purpose |
|--------|------------|---------|
| `pywmp.simulation` | `BasinModel`, `SimResults` | 1D basin model engine |
| `pywmp.workflow` | `DesignStormSimulation` | High-level 1D model builder |
| `pywmp.rom` | `ROMGrid`, `ROMSimulation`, `ROMResults` | 2D HLL shallow-water solver |
| `pywmp.hybrid` | `HybridSimulation`, `HybridExcessPrecipSimulation` | 1D-2D coupling |
| `pywmp.flood` | `HANDRaster`, `WatershedDelineator`, `FloodMapper` | Inundation mapping and HAND |
| `pywmp.coastal` | `SeawallGeometry`, `SeawallSLRSweep`, `CoastalFloodMap` | Coastal SLR assessment |

## Water quality and sediment

| Module | Entry point | Purpose |
|--------|------------|---------|
| `pywmp.sediment` | `SedimentParameters`, `SuspendedSedimentTransport`, `BedloadTransport` | RUSLE, suspended load, bedload, morphodynamics |
| `pywmp.wq` | `TSSModel`, `TPModel`, `WQTransport` | TSS and total phosphorus on the 2D mesh |

## Model quality

| Module | Entry point | Purpose |
|--------|------------|---------|
| `pywmp.calibration` | `CalibrationEngine`, `ParameterSet`, `ParameterBound` | Parameter optimisation |
| `pywmp.validation` | `HydroMetrics`, `ModelVsObserved`, `SpatialFloodValidation` | Performance metrics and spatial validation |

## Data and integration

| Module | Entry point | Purpose |
|--------|------------|---------|
| `pywmp.datasets` | `DatasetManager`, `download_for_aoi` | Automated 3DEP/WBD/NHD/NLCD/SSURGO/Atlas-14/FEMA download |
| `pywmp.cascade` | `parse_cascade_dat`, `CascadeSimulation` | SFWMD Cascade 2001 compatibility |
| `pywmp.api` | `pywmp.api.app` | Optional FastAPI/WebSocket server |

## Primitives

| Module | Export | Purpose |
|--------|--------|---------|
| `pywmp.units` | `UnitSystem`, `USC`, `SI` | Unit system enum and conversion |
| `pywmp.time_series` | `TimeSeries` | Universal time-series type |
| `pywmp.compute` | `available_backends`, `recommended_backend` | Backend selection |

## Hydrologic process modules

- `pywmp.meteorology` — precipitation, IDF, hyetographs
- `pywmp.losses` — InitialConstant, SCS-CN, Green-Ampt, SMA
- `pywmp.transform` — SCS UH, Clark UH, Snyder UH, User UH
- `pywmp.baseflow` — Recession, Constant, Linear Reservoir
- `pywmp.routing` — Muskingum, Muskingum-Cunge, Modified Puls, Lag
- `pywmp.reservoir` — Level-Pool
- `pywmp.gridded` — ModClark, GriddedCN

## Detailed documentation

- [Module Reference](modules.md) — class signatures and code examples for every module
- [Dataset Reference](datasets.md) — DatasetManager detailed usage
