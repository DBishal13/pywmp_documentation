# Cascade Routing Reference

`pywmp.cascade` implements the South Florida Water Management District
**Cascade 2001** storage routing framework: stage-storage basin routing,
structure-controlled interbasin transfers, and flexible multi-scenario
experimentation.

---

## `pywmp.cascade`

```python
from pywmp.cascade import (
    # Core simulation
    CascadeSimulation, CascadeBasin, CascadeLink, CascadeResults,
    # Stage-storage
    StageStorageCalculator, StageStorageCurve, LandLakeSubArea,
    # Runoff
    SBUHRunoff, GDCUHRunoff,
    # Structures
    CascadeGravityStructure, CascadeGatedSpillway,
    CascadePumpStation, CascadeDropInlet,
    # Boundary
    OffsiteReceivingBody,
    # Rainfall
    cascade_distribution_hyetograph, convert_rainfall_depth,
    # Flex routing
    BasinConfig, RainfallOverride, run_flex,
    # Experiments
    ExperimentMatrix, Scenario,
    # Seawall
    SeawallModel, SeawallScenario, SeawallSystem,
    # Parser and DSS
    parse_cascade_dat,
    read_dss_timeseries, write_dss_timeseries, list_dss_pathnames,
)
```

---

## Core simulation

### CascadeSimulation

```python
class CascadeSimulation(basins, links, boundary, dt_hr=0.5, units='USC')
```

Main solver. Iterates stage-storage routing for a network of `CascadeBasin`
objects connected by `CascadeLink` routing links.

| Parameter | Type | Description |
|-----------|------|-------------|
| `basins` | list[CascadeBasin] | Basin objects with stage-storage curves |
| `links` | list[CascadeLink] | Interbasin routing connections |
| `boundary` | OffsiteReceivingBody | Downstream stage boundary |
| `dt_hr` | float | Routing timestep (hr); default 0.5 |

**Methods**

```python
CascadeSimulation.run(rainfall_ts, duration_hr) -> CascadeResults
```

### CascadeBasin

```python
class CascadeBasin(
    name, stage_storage, runoff_model,
    initial_stage=None, area_acres=None
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | str | Basin identifier |
| `stage_storage` | StageStorageCurve | Stage ↔ storage lookup |
| `runoff_model` | SBUHRunoff \| GDCUHRunoff | Runoff generation |
| `initial_stage` | float \| None | Starting water surface elevation |
| `area_acres` | float \| None | Basin area (acres) |

### CascadeLink

```python
class CascadeLink(
    name, upstream, downstream,
    structures, invert_elev=0.0
)
```

Routing link connecting two basins via one or more outlet structures.

### CascadeResults

Container returned by `CascadeSimulation.run()`.

```python
results.stage(basin_name)    -> TimeSeries   # water surface elevation (ft)
results.outflow(link_name)   -> TimeSeries   # flow through link (cfs)
results.storage(basin_name)  -> TimeSeries   # storage (ac·ft)
results.peak_stage()         -> dict         # {basin: peak_stage_ft}
results.to_dataframe()       -> pd.DataFrame
results.plot()
```

---

## Stage-storage

### StageStorageCurve

Lookup table mapping elevation (ft NGVD) to cumulative storage (ac·ft).

```python
curve = StageStorageCurve(
    elevations=[0, 2, 4, 6, 8],
    storages=[0, 12, 35, 72, 130],
)
stor = curve.storage_at(5.2)    # → interpolated ac·ft
elev = curve.elevation_at(50.0) # → interpolated ft
```

### StageStorageCalculator

```python
class StageStorageCalculator(dem, cell_size_ft, basin_mask=None)
```

Derives a stage-storage curve directly from a DEM by computing the
volume of water that would fill the basin from the lowest cell upward.

```python
calc  = StageStorageCalculator(dem_array, cell_size_ft=3.28)
curve = calc.compute(min_elev=5.0, max_elev=12.0, n_steps=50)
```

### LandLakeSubArea

Defines a sub-area storage zone within a basin (e.g. a lake cell or
depression that fills before overflowing into the surrounding land cells).

```python
zone = LandLakeSubArea(
    name="Lake_1",
    stage_storage=curve,
    area_acres=120.0,
    connection_elev=8.0,   # elevation at which zone connects to main basin
)
```

---

## Runoff models

### SBUHRunoff

Standard Basin Unit Hydrograph runoff generation using SCS CN.

```python
class SBUHRunoff(cn, area_acres, lag_hr, dt_hr=0.5)

sb = SBUHRunoff(cn=75, area_acres=500, lag_hr=1.8)
runoff_ts = sb.compute(rainfall_ts)
```

### GDCUHRunoff

Green-Duan-Chieu UH runoff — a modified unit hydrograph with Green-Ampt
infiltration for continuous simulation.

```python
class GDCUHRunoff(cn, area_acres, lag_hr, Ks, psi, theta_i, dt_hr=0.5)

gd = GDCUHRunoff(cn=75, area_acres=500, lag_hr=1.8,
                 Ks=0.5, psi=3.5, theta_i=0.3)
runoff_ts = gd.compute(rainfall_ts)
```

---

## Outlet structures

All structures are passed as a list to `CascadeLink`.

| Class | Formula | Key parameters |
|-------|---------|----------------|
| `CascadeGravityStructure` | Broad-crested weir | `crest_elev`, `L`, `Cw` |
| `CascadeGatedSpillway` | Orifice or gate | `invert_elev`, `area`, `Cd`, `gate_open` |
| `CascadePumpStation` | Constant flow when above intake | `intake_elev`, `capacity_cfs`, `on_elev`, `off_elev` |
| `CascadeDropInlet` | Weir + orifice combined | `crest_elev`, `L`, `invert_elev`, `area` |

```python
from pywmp.cascade import CascadeGravityStructure, CascadePumpStation

structures = [
    CascadeGravityStructure(crest_elev=7.0, L=30.0),
    CascadePumpStation(intake_elev=2.0, capacity_cfs=15.0,
                       on_elev=5.5, off_elev=4.0),
]
link = CascadeLink("L1", upstream="Basin_A", downstream="Basin_B",
                   structures=structures)
```

---

## Boundary condition

### OffsiteReceivingBody

```python
class OffsiteReceivingBody(name, stage_ts=None, fixed_stage=None)
```

Downstream stage boundary for the Cascade network. Supply either a
`TimeSeries` of stage or a constant `fixed_stage` (ft NGVD).

---

## Rainfall helpers

```python
from pywmp.cascade import cascade_distribution_hyetograph, convert_rainfall_depth

# Cascade 2001-style triangular hyetograph
rain_ts = cascade_distribution_hyetograph(
    total_depth_in=5.0, duration_hr=24, dt_hr=0.5,
    peak_ratio=0.375                               # SCS Type II peak at 37.5 %
)

# Unit conversion
depth_mm = convert_rainfall_depth(depth_in=5.0, from_units="in", to_units="mm")
```

---

## Flex routing

`run_flex` executes a routing run from a `BasinConfig` specification,
allowing runtime overrides of rainfall without rebuilding the full model.

```python
from pywmp.cascade import BasinConfig, RainfallOverride, run_flex

cfg = BasinConfig.from_dat("project.dat")
override = RainfallOverride(basin_names=["B1", "B2"], scale_factor=1.25)
results  = run_flex(cfg, override=override)
```

---

## Experiments

```python
from pywmp.cascade import ExperimentMatrix, Scenario

matrix = ExperimentMatrix(
    base_config=cfg,
    scenarios=[
        Scenario("5yr_existing",  rainfall_scale=1.0, cn_delta=0),
        Scenario("100yr_existing",rainfall_scale=2.1, cn_delta=0),
        Scenario("100yr_future",  rainfall_scale=2.1, cn_delta=+5),
    ],
)
all_results = matrix.run()
```

---

## Seawall integration

```python
from pywmp.cascade import SeawallModel, SeawallScenario, SeawallSystem

seawall = SeawallModel(crest_elev=8.5, length_ft=2400.0, Cw=3.33)
slr_scenario = SeawallScenario(slr_ft=1.5, return_period_yr=100)
system = SeawallSystem(seawall, basin=cascade_basin, scenario=slr_scenario)
results = system.run(rainfall_ts)
```

---

## Project file parser

```python
from pywmp.cascade import parse_cascade_dat

cfg = parse_cascade_dat("project/BuckCreek.dat")
# cfg.basins, cfg.links, cfg.rainfall, cfg.simulation_control
```

---

## HEC-DSS I/O

```python
from pywmp.cascade import read_dss_timeseries, write_dss_timeseries, list_dss_pathnames

paths = list_dss_pathnames("output.dss")
ts    = read_dss_timeseries("output.dss", "/BASIN_A/FLOW//1HOUR/RUN1/")
write_dss_timeseries("output.dss", "/BASIN_B/STAGE//1HOUR/RUN1/", stage_ts)
```
