# Module Reference

Complete API summary for all PyWMP v0.2.0 modules. For conceptual background see
[Concepts](../concepts.md); for end-to-end examples see the [Tutorials](../tutorials/full_pipeline.md).

---

## `pywmp.units` and `pywmp.time_series`

Every PyWMP module accepts and returns these two primitives.

```python
from pywmp.units import UnitSystem, USC, SI
from pywmp.time_series import TimeSeries

ts = TimeSeries(times=t_array, values=v_array, units="USC")
```

**`UnitSystem`**: `USC` (US Customary, ft-cfs-in) or `SI` (metres-m3/s-mm).

**`TimeSeries`**: `times` (hr), `values` (units depend on context), `units` string.

---

## `pywmp.meteorology`

Precipitation sources and storm definitions.

| Class / function | Purpose |
|-----------------|---------|
| `DesignStorm` | Wrapper around a hyetograph array |
| `IDFCurve` | IDF data with `depth(duration, return_period)` |
| `scs_type_hyetograph(storm_type, duration_hr, dt_hr, total_in, units)` | SCS Type I / IA / II / III |
| `balanced_storm_hyetograph(depth, dt)` | NOAA balanced-storm distribution |
| `read_netcdf_precipitation(path)` | Gridded NetCDF precipitation |
| `read_mrms_grib2(path)` | MRMS GRIB2 precipitation |

IDF/Atlas 14 functions live in `pywmp.meteorology.noaa_atlas14`:

```python
from pywmp.meteorology.noaa_atlas14 import get_idf_offline, fetch_idf_online

idf = get_idf_offline(region="SE")             # bundled Southeast US Atlas 14 data
idf = fetch_idf_online(lat=26.08, lon=-80.33)  # live NOAA HDSC API call
depth_100yr = idf.depth(duration_hr=24, return_period_yr=100)
```

---

## `pywmp.losses`

| Class | Method | Key parameters | Reference |
|-------|--------|----------------|-----------|
| `InitialConstantLoss` | `compute(precip_ts)` | `ia` (in), `fc` (in/hr) | USACE, 2023 |
| `SCSCurveLoss` | `compute(precip_ts)` | `CN`, `amc` (I/II/III) | NRCS, 2004; USDA SCS, 1986 |
| `GreenAmptLoss` | `compute(precip_ts)` | `Ks`, `psi`, `theta_i`, `eta` | Green & Ampt, 1911 |
| `SMALoss` | `compute(precip_ts, pe_ts)` | six storage-zone parameters | Bennett, 1998 |

---

## `pywmp.transform`

| Class | Key parameters | Reference |
|-------|----------------|-----------|
| `SCSUnitHydrograph` | `lag_hr`, `area_mi2` | NRCS, 2004; Mockus, 1957 |
| `ClarkUH` | `Tc` (hr), `R` (hr), time-area curve | Clark, 1945 |
| `SnyderUH` | `Cp`, `Ct`, `tp` | Snyder, 1938 |
| `UserUH` | tabular UH array | — |

---

## `pywmp.routing`

| Class | Key parameters | Reference |
|-------|----------------|-----------|
| `MuskingumRouting` | `K_hr`, `x`, `steps` | McCarthy, 1938 |
| `MuskingumCungeRouting` | channel geometry, Manning's n | Cunge, 1969 |
| `ModifiedPulsRouting` | storage-outflow relationship | Puls, 1928 |
| `LagRouting` | `lag_hr` | — |

---

## `pywmp.workflow`

High-level model builders.

```python
from pywmp.workflow.design_storm import DesignStormSimulation

sim = DesignStormSimulation(
    storm_type="SCS_II",
    total_depth_in=13.7,
    duration_hr=24,
    dt_hr=0.1,
)
sim.add_subbasin("Sub1", area_mi2=2.5,
                 loss_method="SCS_CN", loss_params={"CN": 80},
                 transform_method="SCS", transform_params={"lag_hr": 1.2})
sim.add_reach("Sub1", "Outlet",
              method="Muskingum", params={"K_hr": 0.5, "x": 0.2, "steps": 3})
results = sim.run()
print(results.summary())
```

Helper functions: `build_basin_model()`, `build_subbasin_masks()`,
`estimate_scs_lag()`, `estimate_muskingum_k_x()`.

---

## `pywmp.rom`

2D rain-on-mesh finite-volume solver.

### ROMGrid

```python
from pywmp.rom.mesh import ROMGrid
grid = ROMGrid.from_tif("dem.tif", units="USC")
# grid.shape -> (nrows, ncols)
# grid.dx_ft, grid.dy_ft  (cell size)
```

### ROMSimulation

```python
from pywmp.rom.simulation import ROMSimulation

sim = ROMSimulation(
    grid=grid,
    precipitation=precip,       # UniformPrecipitation or GriddedPrecipitation
    infiltration=infilt,        # DeficitConstantInfiltration, GriddedGreenAmpt, GriddedSCS, or None
    manning=manning,            # ManningField
    boundary_conditions=[bc],   # list of boundary condition objects
    duration_hr=24.0,
    output_interval_hr=1.0,
    backend="auto",             # "numpy", "numba", "cuda"
    solver=None,                # optional FiniteVolumeSolver with custom h_dry / cfl / max_dt_sec
    sediment=None,              # attach SuspendedSedimentTransport here
    units="USC",
    # Solver uses first-order HLL (Harten et al., 1983) finite-volume scheme;
    # wetting/drying follows Bates & De Roo (2000); CFL stability (Courant et al., 1928)
)
results = sim.run()
results.save_max_depth_tif("depth.tif")
```

### Boundary conditions

| Class | Usage |
|-------|-------|
| `NormalDepthOutlet(edge)` | Free outfall at domain edge ("north"/"south"/"east"/"west") |
| `FixedStageBC(edge, stage_ts)` | Time-varying water surface elevation at domain edge |
| `InflowBC(cell_row, cell_col, q_ts)` | Point inflow (1D hydrograph coupling) |
| `InternalInflowBC(mask, q_ts)` | Distributed inflow over a cell mask |

### Infiltration

| Class | Key parameters |
|-------|----------------|
| `DeficitConstantInfiltration(initial_loss, fc, units, grid_shape)` | SCS-equivalent |
| `GriddedGreenAmptInfiltration(Ks, psi, theta_i, eta)` | spatially distributed |
| `GriddedSCSInfiltration(cn_array)` | CN from raster |

---

## `pywmp.hybrid`

```python
from pywmp.hybrid.coupler import HybridSimulation, HybridExcessPrecipSimulation

# Outlet-to-inflow mode
hybrid = HybridSimulation(
    upstream_model=sim_1d,
    rom_grid=grid,
    boundary_spec="outlet",
)
h_results = hybrid.run()

# Excess-precipitation mode
excess = HybridExcessPrecipSimulation(
    upstream_model=sim_1d,
    rom_grid=grid,
    mask_spec=subbasin_masks,   # SubbasinMaskSpec
)
e_results = excess.run()
```

---

## `pywmp.sediment`

```python
import numpy as np
from pywmp.sediment import (
    SedimentParameters, RUSLEErosion,
    SuspendedSedimentTransport, BedloadTransport, SedimentResults
)
from pywmp.sediment.ls_factor import compute_ls_from_tif

# Build parameter grid
params = SedimentParameters(
    K=0.28 * np.ones(grid.shape),   # RUSLE K (Wischmeier & Smith, 1978; Renard et al., 1997)
    C=0.15 * np.ones(grid.shape),   # cover-management factor (Renard et al., 1997)
    D50_mm=0.25 * np.ones(grid.shape),  # median grain size
    P=1.0,                          # support-practice factor
)

# Derive LS from DEM slope arrays (returned by rom grid or computed separately)
Sx, Sy = ...   # slope arrays from DEM, same shape as grid
erosion = RUSLEErosion(params, Sx, Sy)

sst = SuspendedSedimentTransport(
    params=params,
    grid=grid,
    erosion=erosion,
)

# Attach to ROMSimulation
sim = ROMSimulation(..., sediment=sst)
results = sim.run()

sed_results = results.sediment    # SedimentResults
print(sed_results.total_erosion_tons, sed_results.total_deposition_tons)
```

**LS factor helpers**:

```python
from pywmp.sediment.ls_factor import compute_ls_from_tif, compute_ls_single_cell
ls = compute_ls_from_tif("dem.tif")   # returns LS raster array
```

**Bedload (gravel channels)**:

```python
bl = BedloadTransport(
    params, Sx, Sy, dx=grid.dx_ft,
    theta_cr=0.0495,      # Wong & Parker (2006) corrected Shields criterion
    use_wong_parker=True,  # corrects MPM (1948) coefficient from 8.0 to 3.97
)
sst = SuspendedSedimentTransport(params, grid, erosion=erosion, bedload=bl)
```

---

## `pywmp.wq`

```python
from pywmp.wq import TSSModel, TPModel, WQTransport, EMC_TP_BY_NLCD

tss = TSSModel(
    shape=grid.shape,
    dx=grid.dx_ft,
    D=0.5,              # diffusion coefficient (ft2/s)
    init_conc_mg_L=5.0,
)

tp = TPModel(
    shape=grid.shape,
    dx=grid.dx_ft,
    emc_tp_mg_L=0.3,    # EMC approach: USEPA (1983); Driver & Tasker (1990)
    k_settle=1e-5,      # settling rate (m/s)
)

# Step both models at each ROM time step using depth/velocity arrays
tss.step(h, u, v, dt)
tp.step(h, u, v, dt)

# Retrieve load at outlet
print(tss.outlet_load_kg, tp.outlet_load_kg)
```

`EMC_TP_BY_NLCD` is a dict mapping NLCD integer class to TP event mean concentration (mg/L).

---

## `pywmp.coastal`

```python
from pywmp.coastal import SeawallSLRSweep, SeawallGeometry

# SeawallGeometry is typically built from a DEM and seawall mask via a helper
# (see the coastal simulation module for the from_dem constructor)
sweep = SeawallSLRSweep(
    geometry=geom,
    slr_levels_ft=[0.0, 0.5, 1.0, 1.5, 2.5],
    rain_ts=rain_ts,             # optional TimeSeries for compound event
    normal_tide_ft=0.52,         # MHHW baseline
    ocean_edge="south",
    duration_hr=24.0,
    backend="auto",
)
sweep_results = sweep.run()
print(sweep_results.summary())   # peak stage, flooded area, overtopping per SLR level
```

---

## `pywmp.calibration`

```python
from pywmp.calibration import CalibrationEngine, ParameterSet, ParameterBound

def run_model(params: dict) -> np.ndarray:
    # build and run your model; return simulated array
    ...

ps = ParameterSet([
    ParameterBound("CN",    lo=60.0, hi=98.0, initial=80.0),
    ParameterBound("lag_hr", lo=0.3, hi=4.0,  initial=1.2),
])

engine = CalibrationEngine(
    model_fn=run_model,
    observed=obs_array,
    params=ps,
    objective="kge",       # "nse", "kge", "rmse", "volume_error", or Callable
    verbose=True,
)

# Run differential evolution global search (Storn & Price, 1997)
results = engine.run_differential_evolution(maxiter=300, popsize=15)
print(results.summary())
# results.best_params   -> dict of parameter name -> value
# results.best_objective -> float (NSE/KGE; Nash & Sutcliffe, 1970 / Gupta et al., 2009)
# results.history       -> list of CalibrationRecord
```

---

## `pywmp.validation`

```python
from pywmp.validation import (
    HydroMetrics, ModelVsObserved, GaugeStation,
    SpatialFloodValidation,
    download_streamflow, download_stage,
    nse, kge, rmse, pbias, peak_flow_error
)

# Scalar metrics from arrays
# NSE: Nash & Sutcliffe (1970); KGE: Gupta et al. (2009); Kling et al. (2012)
m = HydroMetrics(obs=obs_array, sim=sim_array)
print(m.nse, m.kge.r, m.kge.alpha, m.kge.beta, m.rmse, m.pbias)

# USGS NWIS gauge comparison
gauge = GaugeStation("02298202", name="Peace River at Arcadia",
                     lat=27.21, lon=-81.87, da_mi2=1367.0)
obs_df = download_streamflow("02298202", start="2020-09-01", end="2020-09-30")
comparison = ModelVsObserved(obs_df["q_cfs"], sim_series, gauge=gauge)
print(comparison.metrics())

# Spatial flood extent comparison (vs FEMA NFHL or SAR)
sv = SpatialFloodValidation(
    sim_depth=depth_array,     # float array, ft
    ref_mask=fema_ae_mask,     # bool array (True = flooded in reference; FEMA, 2023)
    valid_mask=domain_mask,    # bool array (True = valid domain cells)
    depth_threshold=0.1,
)
# CSI: Schaefer (1990); HR/FAR: Wing et al. (2017); performance: Bates et al. (2010)
print(sv.csi, sv.hit_rate, sv.far, sv.f1)
```

Standalone functions: `nse(obs, sim)`, `kge(obs, sim) -> KGEComponents`,
`rmse(obs, sim)`, `pbias(obs, sim)`, `peak_flow_error(obs, sim)`,
`peak_timing_error(obs, sim)`.

---

## `pywmp.datasets`

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-81.70, 27.85, -81.50, 27.95),   # (minx, miny, maxx, maxy) WGS-84
    output_dir="data/watershed/",
    cache=True,                            # skip re-download if file exists
)

dm.download_dem(resolution_m=10)
dm.download_watershed(huc_level=12)
dm.download_nhd()
dm.download_nlcd(year=2021)
dm.download_soils()
dm.download_cn()                          # requires NLCD and soils
dm.download_atlas14(lat=27.9, lon=-81.6)
dm.download_floodzone()
print(dm.summary())
```

Standalone helper: `download_for_aoi(aoi, output_dir, lat, lon)` runs all
eight downloaders in sequence.

---

## `pywmp.flood`

```python
from pywmp.flood.dem_io import read_tif, write_tif
from pywmp.flood.watershed import WatershedDelineator
from pywmp.flood.hand import HANDRaster
from pywmp.flood.inundation import compute_stats

# DEM I/O
dem, cell_size_ft, nodata, transform, crs = read_tif("dem.tif")

# HAND raster
hand = HANDRaster.from_tif("dem.tif")
hand.compute()  # fills sinks, D8 flow, flow accumulation, HAND

# Inundation statistics
stats = compute_stats(depth_array, cell_size=cell_size_ft)
print(stats.flooded_area_acres, stats.mean_depth_ft, stats.max_depth_ft)
```

---

## `pywmp.cascade`

SFWMD Cascade 2001 project parser and detention routing engine.

```python
from pywmp.cascade import parse_cascade_dat, CascadeSimulation

# Parse an official .dat project file
project = parse_cascade_dat("my_project.dat")

# Run the simulation
sim = CascadeSimulation(project)
results = sim.run()
results.to_json("cascade_results.json")
```

Structure types: `CascadeGravityStructure`, `CascadeGatedSpillway`,
`CascadePumpStation`, `CascadeDropInlet`.

---

## `pywmp.api`

Optional REST API server for remote simulation control.

```bash
pip install "pywmp[api]"
python -m pywmp.api.app
```

See [REST API Tutorial](../tutorials/rest_api.md) for endpoint examples.

---

## References

Full citations for all methods referenced in this page. See also the
[master bibliography](../references.md).

Bates, P. D., & De Roo, A. P. J. (2000). *Journal of Hydrology*, *236*(1–2), 54–77.
  [DOI ↗](https://doi.org/10.1016/S0022-1694(00)00278-X)

Bates, P. D., Horritt, M. S., & Fewtrell, T. J. (2010). *Journal of Hydrology*,
  *387*(1–2), 33–45.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2010.03.027)


Clark, C. O. (1945). *Transactions ASCE*, *110*(1), 1419–1446.
  [DOI ↗](https://doi.org/10.1061/TACEAT.0005791)


Cunge, J. A. (1969). *Journal of Hydraulic Research*, *7*(2), 205–230.
  [DOI ↗](https://doi.org/10.1080/00221686909500264)

Driver, N. E., & Tasker, G. D. (1990). USGS Water-Supply Paper 2363.
  [PDF ↗](https://pubs.usgs.gov/wsp/2363/report.pdf)

Federal Emergency Management Agency. (2023). *National Flood Hazard Layer (NFHL)*.
  [FEMA MSC ↗](https://msc.fema.gov)

Green, W. H., & Ampt, G. A. (1911). *Journal of Agricultural Science*, *4*(1), 1–24.
  [DOI ↗](https://doi.org/10.1017/S0021859600001441)

Gupta, H. V., Kling, H., Yilmaz, K. K., & Martinez, G. F. (2009). *Journal of
  Hydrology*, *377*(1–2), 80–91.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2009.08.003)

Harten, A., Lax, P. D., & van Leer, B. (1983). *SIAM Review*, *25*(1), 35–61.
  [DOI ↗](https://doi.org/10.1137/1025002)

Kling, H., Fuchs, M., & Paulin, M. (2012). *Journal of Hydrology*, *424–425*, 264–277.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2012.01.011)


Meyer-Peter, E., & Müller, R. (1948). *Proceedings 2nd IAHSR Meeting*, pp. 39–64.
  [TU Delft ↗](https://repository.tudelft.nl/record/uuid:4fda9b61-be28-4703-ab06-43cdc2a21bd7)

Mockus, V. (1957). *Use of storm and watershed characteristics in synthetic hydrograph
  analysis and application*. American Geophysical Union.
  [USDA NAL ↗](https://handle.nal.usda.gov/10113/IND43966827)

Nash, J. E., & Sutcliffe, J. V. (1970). *Journal of Hydrology*, *10*(3), 282–290.
  [DOI ↗](https://doi.org/10.1016/0022-1694(70)90255-6)

Natural Resources Conservation Service. (2004). *National Engineering Handbook,
  Part 630: Hydrology*. USDA.
  [USDA NAL ↗](https://handle.nal.usda.gov/10113/32494)

Puls, L. G. (1928). *Flood regulation of the Tennessee River*. USACE.
  [HathiTrust ↗](https://catalog.hathitrust.org/Record/001697457)

Renard, K. G., et al. (1997). *RUSLE* (Agriculture Handbook 703). USDA.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=16945)

Schaefer, J. T. (1990). *Weather and Forecasting*, *5*(4), 570–575.
  [DOI ↗](https://doi.org/10.1175/1520-0434(1990)005<0570:TCSIAA>2.0.CO;2)

Snyder, F. F. (1938). *Transactions AGU*, *19*(1), 447–454.
  [DOI ↗](https://doi.org/10.1029/TR019i001p00447)

Storn, R., & Price, K. (1997). *Journal of Global Optimization*, *11*(4), 341–359.
  [DOI ↗](https://doi.org/10.1023/A:1008202821328)

U.S. Environmental Protection Agency. (1983). *Results of the NURP* (USEPA 400/3-83-16).
  [EPA ↗](https://www.epa.gov/npdes/urban-runoff-national-stormwater-program)

Wing, O. E. J., et al. (2017). *Water Resources Research*, *53*(9), 7968–7986.
  [DOI ↗](https://doi.org/10.1002/2017WR020917)

Wischmeier, W. H., & Smith, D. D. (1978). *Agriculture Handbook 537*. USDA.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=90921)

Wong, M., & Parker, G. (2006). *Journal of Hydraulic Engineering*, *132*(11), 1159–1168.
  [DOI ↗](https://doi.org/10.1061/(ASCE)0733-9429(2006)132:11(1159))
