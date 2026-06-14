# Architecture

PyWMP v0.2.0 is organised into three broad layers — physics, data, and interfaces —
each implemented as a separate Python sub-package. The design prioritises module
independence (each sub-package can be imported alone), a shared set of primitive
types (TimeSeries, UnitSystem, ROMGrid), and graduated optional dependencies so
that a researcher with only NumPy can still run 1D simulations.

## Module map

```
pywmp/
├── units.py               UnitSystem (USC / SI), convert(), unit_label()
├── time_series.py         TimeSeries — universal in/out for all modules
├── compute.py             available_backends(), recommended_backend()
├── schema.py              Pydantic v2 I/O schemas  [api extra]
│
├── meteorology/           DesignStorm, IDFCurve, SCS/balanced hyetographs,
│                          NOAA Atlas 14 (offline + live HDSC API)
├── losses/                InitialConstant, SCS-CN, Green-Ampt, SMA
├── transform/             SCS UH, Clark UH, Snyder UH, User UH
├── baseflow/              Recession, Constant Monthly, Linear Reservoir
├── routing/               Muskingum, Muskingum-Cunge, Modified Puls, Lag
├── reservoir/             Level-Pool (weir_flow, orifice_flow)
├── gridded/               ModClark, GriddedCN
├── network/               SubbasinElement, ReachElement, JunctionElement,
│                          ReservoirElement, DiversionElement, ROMElement
├── simulation/            BasinModel engine, SimResults
├── workflow/              DesignStormSimulation, build_basin_model,
│                          build_subbasin_masks, parameter-estimation helpers
│
├── rom/                   ROMGrid, ManningField, boundary conditions,
│                          UniformPrecipitation, GriddedPrecipitation,
│                          DeficitConstantInfiltration, GriddedGreenAmpt,
│                          GriddedSCS, FiniteVolumeSolver, ROMSimulation,
│                          ROMResults
├── hybrid/                HybridSimulation, HybridExcessPrecipSimulation,
│                          SubbasinMaskSpec, HybridResults
├── flood/                 read_tif / write_tif, HANDRaster,
│                          WatershedDelineator, FloodMapper,
│                          connected_bathtub, compute_stats
│
├── sediment/              SedimentParameters, RUSLEErosion,
│                          SuspendedSedimentTransport, BedloadTransport,
│                          KronePartheniades, MorphodynamicsModel,
│                          UpwindAdvection, LS-factor tools, SedimentResults
├── wq/                    WQConstituent, TSSModel, TPModel, WQTransport,
│                          WQResults  (EMC_TP_BY_NLCD lookup table)
├── coastal/               SeawallGeometry, SeawallSimulation2D,
│                          SeawallSLRSweep, CoastalFloodMap, SweepResults
│
├── calibration/           ParameterBound, ParameterSet, CalibrationEngine,
│                          CalibrationResults, ObjectiveFunction
├── validation/            HydroMetrics, KGEComponents, ModelVsObserved,
│                          GaugeStation, SpatialFloodValidation,
│                          download_streamflow / download_stage / download_ssc,
│                          nse / kge / rmse / pbias / peak_flow_error
│
├── datasets/              DatasetManager, individual downloaders:
│                          dem, watershed, nhd, landuse, soils, rainfall,
│                          floodzone  — PROJ auto-detection, tiling,
│                          fetch_with_retry, split_bbox_tiles
│
├── cascade/               parse_cascade_dat, CascadeSimulation,
│                          structure types, CascadeResults, DSS I/O
└── api/                   FastAPI app, HTTP endpoints, WebSocket stream
```

## Design principles

### Primitive types as shared interfaces

`TimeSeries`, `UnitSystem`, `ROMGrid`, and `SedimentParameters` cross module
boundaries. All physics modules accept and return these primitives, making it
straightforward to wire, say, a 2D ROM result directly into the sediment
transport solver or a calibration engine.

### Graduated optional dependencies

The core package (`pip install pywmp`) requires only NumPy, SciPy, pandas,
matplotlib, and networkx. Geospatial I/O (rasterio, geopandas, fiona, pyproj)
is an optional extra (`[spatial]`). Dataset downloaders, GPU acceleration, and
the REST API each require their own extras.

### Backend selection

| Backend | Requirement | Typical use |
|---------|------------|-------------|
| `numpy` | always available | development, small grids |
| `numba` | `[fast]` extra | production CPU runs (10–30x speedup) |
| `cuda` | CUDA toolkit + `[fast]` | GPU runs on NVIDIA hardware |

`recommended_backend(n_cells)` selects the fastest available option for the
given grid size.

### PROJ auto-detection

`pywmp.datasets._utils.ensure_proj_env()` scans a ranked list of candidate
paths (environment variables, conda prefix, system GDAL, ArcGIS Pro) for
`proj.db` and sets `PROJ_LIB` automatically. This resolves the most common
Windows install failure without requiring manual environment configuration.

## Typical end-to-end workflow

1. **Prepare data** — `DatasetManager.download_all()` retrieves DEM,
   watershed boundaries, NHD, NLCD, soils, Atlas 14 IDF curves, and FEMA
   flood zones.
2. **Build the domain** — `ROMGrid.from_tif()` for 2D or
   `DesignStormSimulation` for 1D.
3. **Run simulation** — `ROMSimulation.run()` or `BasinModel.run()`.
4. **Couple domains** — `HybridSimulation` or `HybridExcessPrecipSimulation`.
5. **Add sediment or WQ** — attach `SuspendedSedimentTransport` or `TSSModel`
   to `ROMSimulation` via the `sediment=` keyword argument.
6. **Validate** — `ModelVsObserved` against USGS gauges;
   `SpatialFloodValidation` against FEMA NFHL or SAR flood maps.
7. **Calibrate** — `CalibrationEngine` with NSE, KGE, or a custom objective.
