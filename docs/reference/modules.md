# Module Reference

Complete API reference for all PyWMP modules. Each section covers the key classes, their parameters, method-selection guidance, and a runnable example.

---

## `pywmp.datasets` — Automated Data Downloaders

Downloads and caches all geospatial inputs for a watershed model from open-access federal data sources.

### `DatasetManager`

```python
DatasetManager(aoi, output_dir, cache=True)
```

| Parameter | Type | Description |
|---|---|---|
| `aoi` | `tuple[float,float,float,float]` | Bounding box `(minx, miny, maxx, maxy)` in WGS-84 decimal degrees |
| `output_dir` | `str \| Path` | Directory where downloaded files are saved |
| `cache` | `bool` | Reuse existing files rather than re-downloading (default `True`) |

**Methods:**

| Method | What it downloads | Output file |
|---|---|---|
| `download_dem(resolution_m=10)` | USGS 3DEP lidar DEM | `dem.tif` |
| `download_watershed(huc_level=12)` | USGS NHD WBD boundaries | `huc12.gpkg` |
| `download_nhd()` | NHDPlus flowlines + catchments | `flowlines.gpkg`, `catchments.gpkg` |
| `download_nlcd(year=2021)` | NLCD 30 m land cover | `nlcd.tif` |
| `download_soils()` | USDA SSURGO hydrologic soil groups | `hsg.tif` |
| `download_cn()` | SCS Curve Number raster (NLCD × HSG) | `cn.tif` |
| `download_atlas14(lat, lon)` | NOAA Atlas 14 IDF curves | `atlas14.json` |
| `download_floodzone()` | FEMA NFHL flood hazard areas | `fema_sfha.gpkg` |
| `download_all(lat, lon)` | All of the above in dependency order | — |
| `summary()` | Print download status table | — |

**Example:**

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-82.05, 28.02, -81.98, 28.07),  # west-central Florida
    output_dir="data/my_watershed",
)
dm.download_all(lat=28.044, lon=-82.013)
print(dm.summary())
```

**Dependency order:** DEM → watershed → NHD → NLCD + soils → CN → Atlas 14 + flood zones.  
`download_cn()` requires both NLCD and soils to already be present.

### `download_for_aoi()` — one-call shortcut

```python
from pywmp.datasets import download_for_aoi

dm = download_for_aoi(
    aoi=(-82.05, 28.02, -81.98, 28.07),
    output_dir="data/my_watershed",
    lat=28.044,
    lon=-82.013,
)
```

---

## `pywmp.losses` — Rainfall Loss Methods

All loss classes share the interface `.compute(rainfall_ts) → (excess_ts, loss_ts)`.

### Method comparison

| Method | Best for | Key parameters | Notes |
|---|---|---|---|
| `InitialConstantLoss` | Simple event models, minimal data | `Ia`, `fc` | Fast; no soil-layer bookkeeping |
| `SCSCurveLoss` | NRCS-based design hydrology | `CN`, `ia_ratio`, `amc` | Industry standard; CN from SSURGO or NLCD |
| `GreenAmptLoss` | Physically based soil infiltration | `Ks`, `psi`, `theta_i`, `eta` | Best when soil texture data is available |
| `SMALoss` | Long continuous simulations | many (canopy, surface, soil, percolation layers) | Most complex; needed for multi-event continuous modeling |

### `InitialConstantLoss`

```python
InitialConstantLoss(Ia_in, fc_in_hr, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `Ia_in` | `float` | Initial abstraction depth (inches) |
| `fc_in_hr` | `float` | Constant infiltration rate after Ia is satisfied (in/hr) |

### `SCSCurveLoss`

```python
SCSCurveLoss(CN, ia_ratio=0.2, amc=2, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `CN` | `float` | SCS Curve Number (0–100); higher = more runoff |
| `ia_ratio` | `float` | Fraction of S used as initial abstraction (default 0.2) |
| `amc` | `int` | Antecedent Moisture Condition: 1 (dry), 2 (normal), 3 (wet) |

**Theory:**

$$S = \frac{1000}{\text{CN}} - 10 \quad I_a = 0.2S \quad Q_{cum} = \frac{(P_{cum}-I_a)^2}{P_{cum}-I_a+S}$$

**When to use:** Standard design hydrology. CN = 78 is a typical composite for mixed residential/suburban catchments. Use AMC III for pre-wetted conditions or consecutive storms.

### `GreenAmptLoss`

```python
GreenAmptLoss(Ks, psi, theta_i, eta, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `Ks` | `float` | Saturated hydraulic conductivity (in/hr) |
| `psi` | `float` | Wetting-front suction head (in) |
| `theta_i` | `float` | Initial volumetric moisture content (0–1) |
| `eta` | `float` | Soil porosity (0–1) |

**Theory:** Green & Ampt equation (HEC-HMS TRM §3.4):

$$f(t) = K_s \left(1 + \frac{\psi \cdot \Delta\theta}{F(t)}\right)$$

Solved implicitly via Newton-Raphson per timestep.

**Typical soil values (Rawls et al., 1983):**

| Texture | Ks (in/hr) | ψ (in) | η |
|---|---|---|---|
| Sand | 4.74 | 1.95 | 0.437 |
| Sandy loam | 1.09 | 4.33 | 0.453 |
| Loam | 0.52 | 3.50 | 0.463 |
| Clay loam | 0.10 | 8.22 | 0.464 |
| Clay | 0.03 | 12.45 | 0.475 |

### `SMALoss`

Soil Moisture Accounting (HEC-HMS TRM §3.7). Suitable for long-duration continuous simulations where soil-layer storage dynamics matter. Requires canopy, surface depression, soil tension zone, and percolation parameters. See HEC-HMS documentation for full parameter guidance.

**Example:**

```python
from pywmp.losses import SCSCurveLoss
from pywmp.time_series import TimeSeries
import numpy as np

# 24-hour SCS Type II storm at 0.1-hr intervals
t = np.arange(0, 24.1, 0.1)
rain = np.zeros_like(t)
rain[60:180] = 0.15  # peak burst (in/hr)

rainfall_ts = TimeSeries(t, rain, dt=0.1, units="in/hr")
loss = SCSCurveLoss(CN=78, ia_ratio=0.2, amc=2)
excess_ts, loss_ts = loss.compute(rainfall_ts)
print(f"Total excess: {excess_ts.values.sum() * 0.1:.2f} in")
```

---

## `pywmp.transform` — Unit Hydrograph Methods

All transform classes share the interface `.ordinates() → np.ndarray` and can convolve with an excess rainfall time series.

### Method comparison

| Method | Best for | Key parameters | Calibration difficulty |
|---|---|---|---|
| `SCSUnitHydrograph` | Ungauged basins, NRCS design | `lag_hr`, `area` | Low — lag estimated from geometry |
| `ClarkUH` | Gauged or well-characterized basins | `Tc`, `R`, `area` | Medium — requires calibration of R |
| `SnyderUH` | Regional studies with historical coefficients | `Ct`, `Cp`, `Lc`, `Lca` | Medium — regional coefficients required |
| `UserUH` | Directly observed unit hydrograph | `ordinates` | N/A — used as-is |

### `SCSUnitHydrograph`

```python
SCSUnitHydrograph(lag_hr, area, dt=0.1, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `lag_hr` | `float` | Basin lag time (hours); estimated as 0.6 × Tc |
| `area` | `float` | Basin area (mi² for USC, km² for SI) |
| `dt` | `float` | Computational timestep (hours) |

**Lag estimation:** `lag_hr ≈ 0.6 × Tc`, where `Tc` can be estimated from the TR-55 Velocity Method or `estimate_scs_lag()` in `pywmp.workflow`.

### `ClarkUH`

```python
ClarkUH(Tc, R, area, dt=0.1, time_area_curve=None, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `Tc` | `float` | Time of concentration (hours) |
| `R` | `float` | Linear reservoir storage coefficient (hours). Controls recession limb flatness. |
| `area` | `float` | Basin area |
| `time_area_curve` | `array-like \| None` | Custom time-area table `[[t_ratio, area_ratio],...]`; uses synthetic ellipse if `None` |

**Theory:** Translation hydrograph routed through a linear reservoir:

$$O(t+\Delta t) = C_1 \cdot \bar{I}(t,t+\Delta t) + C_2 \cdot O(t)$$

where $C_1 = \Delta t/(R + 0.5\Delta t)$ and $C_2 = 1 - C_1$.

Larger R → flatter, longer recession. Typical R ≈ 0.5–2.0 × Tc.

### `SnyderUH`

```python
SnyderUH(Ct, Cp, Lc, Lca, dt=0.1, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `Ct` | `float` | Timing coefficient (0.4–2.2 for US basins) |
| `Cp` | `float` | Peaking coefficient (0.4–0.8) |
| `Lc` | `float` | Length of main channel (miles) |
| `Lca` | `float` | Length from centroid to outlet along channel (miles) |

### `UserUH`

```python
UserUH(ordinates, dt, area, units=UnitSystem.USC)
```

Provide observed unit hydrograph ordinates directly (cfs/in or m³/s per mm). Use when you have a measured UH from a gauged storm.

**Example:**

```python
from pywmp.transform import ClarkUH

uh = ClarkUH(Tc=2.0, R=1.5, area=3.2, dt=0.1)
# convolve with a 1-inch excess rainfall pulse
ordinates = uh.ordinates()
print(f"Peak: {ordinates.max():.1f} cfs/in at t={ordinates.argmax()*0.1:.1f} hr")
```

---

## `pywmp.routing` — Channel Routing Methods

All routing classes share the interface `.route(inflow_ts) → outflow_ts`.

### Method comparison

| Method | Best for | Key parameters | Notes |
|---|---|---|---|
| `MuskingumRouting` | Natural channels, simple reach | `K`, `X`, `steps` | Standard; requires K·2X < Δt < 2K(1-X) |
| `MuskingumCungeRouting` | Variable discharge, kinematic wave | `length`, `slope`, `n`, `width` | Automatically computes K and X from Manning's |
| `ModifiedPulsRouting` | Reservoirs, detention ponds | `storage_curve` | Requires storage-discharge relationship |
| `LagRouting` | Pure translation (e.g., storm drains) | `lag_hr` | No attenuation — flow shifted in time only |

### `MuskingumRouting`

```python
MuskingumRouting(K_hr, X, steps=1, units=UnitSystem.USC)
```

| Parameter | Type | Description |
|---|---|---|
| `K_hr` | `float` | Travel time through reach (hours). Roughly equal to reach length ÷ wave celerity. |
| `X` | `float` | Weighting factor (0 to 0.5). X=0 → pure storage (reservoir-like); X=0.5 → pure translation (no attenuation). Typical: 0.1–0.3 |
| `steps` | `int` | Number of sub-reaches (increases numerical stability for short timesteps) |

**Theory (HEC-HMS TRM §7.2):**

$$O_{j+1} = C_0 I_{j+1} + C_1 I_j + C_2 O_j \quad \text{where} \quad C_0+C_1+C_2 = 1$$

**Stability:** Negative C₀ means parameters are unstable — increase `steps` or reduce `K_hr`.

### `MuskingumCungeRouting`

```python
MuskingumCungeRouting(length_ft, slope, n, width_ft, units=UnitSystem.USC)
```

Automatically derives K and X from the hydraulic properties at mean discharge. Best for reaches where channel geometry is known but routing parameters are not calibrated.

### `ModifiedPulsRouting`

```python
ModifiedPulsRouting(storage_curve, units=UnitSystem.USC)
```

`storage_curve` is a 2D array `[[storage_af, discharge_cfs],...]` (storage in acre-feet, discharge in cfs for USC). Use for detention basins with outlet structures.

### `LagRouting`

```python
LagRouting(lag_hr, units=UnitSystem.USC)
```

Shifts the inflow hydrograph forward by `lag_hr` with no attenuation. Use for short piped reaches or conveyance channels where travel time dominates.

**Example:**

```python
from pywmp.routing import MuskingumRouting
from pywmp.time_series import TimeSeries
import numpy as np

t = np.linspace(0, 24, 241)
# triangular inflow hydrograph peaking at 300 cfs at hour 10
inflow = np.interp(t, [0, 10, 24], [0, 300, 0])
inflow_ts = TimeSeries(t, inflow, dt=0.1, units="cfs")

router = MuskingumRouting(K_hr=1.5, X=0.2, steps=3)
outflow_ts = router.route(inflow_ts)
print(f"Peak attenuation: {inflow.max() - outflow_ts.values.max():.1f} cfs")
```

---

## `pywmp.meteorology` — Precipitation & Design Storms

### `DesignStorm`

```python
DesignStorm(storm_type, total_depth_in, duration_hr, dt_hr=0.1)
```

| `storm_type` | Description |
|---|---|
| `"SCS_I"` | SCS Type I — Pacific coast, gentle slopes |
| `"SCS_IA"` | SCS Type IA — Pacific Northwest |
| `"SCS_II"` | SCS Type II — most of eastern/central US (default for humid regions) |
| `"SCS_III"` | SCS Type III — Gulf Coast, humid subtropics |
| `"SFWMD_24hr"` | South Florida Water Management District 24-hour |
| `"SFWMD_72hr"` | SFWMD 72-hour |
| `"SFWMD_120hr"` | SFWMD 120-hour (5-day) |

### `IDFCurve`

```python
IDFCurve(atlas14_json_path)  # load from downloaded Atlas 14 file
```

| Method | Returns |
|---|---|
| `.intensity(duration_hr, return_period_yr)` | Rainfall intensity (in/hr) |
| `.depth(duration_hr, return_period_yr)` | Rainfall depth (in) |
| `.plot()` | Matplotlib figure of intensity-duration-frequency curves |

**Return periods available:** 1, 2, 5, 10, 25, 50, 100, 200, 500, 1000 years.

**Example:**

```python
from pywmp.meteorology import IDFCurve

idf = IDFCurve("data/my_watershed/atlas14.json")
depth_100yr_24hr = idf.depth(24, 100)
print(f"100-year 24-hour depth: {depth_100yr_24hr:.2f} in")
```

---

## `pywmp.simulation` — Basin Model Engine

### `BasinModel`

```python
BasinModel(name)
```

Directed-acyclic-graph engine that runs a network of hydrologic elements in topological order.

**Methods:**

| Method | Description |
|---|---|
| `add_element(el)` | Add a `SubbasinElement`, `ReachElement`, `JunctionElement`, `ReservoirElement`, or `ROMElement` |
| `connect(upstream, downstream)` | Wire two elements together by name |
| `run(rainfall_dict, dt=None)` | Execute the model; returns `SimResults` |

### `SimResults`

| Attribute / Method | Description |
|---|---|
| `.outflows` | `dict[name, TimeSeries]` — outflow hydrograph at each element |
| `.peak_flow(name)` | Peak discharge (cfs or m³/s) at element `name` |
| `.total_volume(name)` | Total runoff volume at element `name` |
| `.summary()` | Print peak flow + volume table for all elements |
| `.to_dict()` | JSON-serializable representation |
| `.plot(names=None)` | Matplotlib figure of selected hydrographs |

---

## `pywmp.rom` / `pywmp.sim2d` — 2D Rain-on-Mesh Solver

### `ROMGrid`

```python
ROMGrid.from_tif(path, resolution_m=None, crs=None)
ROMGrid.from_tif_bbox(path, bbox, resolution_m=None)
```

| Parameter | Description |
|---|---|
| `path` | Path to a GeoTIFF DEM |
| `resolution_m` | Resample to this cell size (meters). `None` preserves native resolution. |
| `bbox` | `(minx, miny, maxx, maxy)` in the DEM's CRS |

**Attributes:**

| Attribute | Description |
|---|---|
| `.dem` | Numpy array of elevations (m or ft) |
| `.nx`, `.ny` | Grid dimensions |
| `.dx`, `.dy` | Cell size |
| `.crs` | Coordinate reference system |
| `.summary()` | Print grid metadata |

### `ROMSimulation`

```python
ROMSimulation(
    grid,
    precipitation,
    infiltration=None,
    boundary_conditions=None,
    roughness=None,
    duration_hr=24,
    dt_s=None,
    backend="auto",
)
```

| Parameter | Description |
|---|---|
| `grid` | `ROMGrid` object |
| `precipitation` | `UniformPrecipitation` or `GriddedPrecipitation` |
| `infiltration` | Loss method object (optional; default = no infiltration) |
| `boundary_conditions` | List of BC objects (outlet, stage, inflow, etc.) |
| `roughness` | `ManningField` or scalar n value (default 0.035) |
| `duration_hr` | Total simulation time (hours) |
| `backend` | `"auto"`, `"cuda"`, `"numba"`, or `"numpy"` |

**Backends:** `auto` selects the fastest available. Use `pywmp.available_backends()` to see what's installed.

### Boundary conditions

| Class | When to use |
|---|---|
| `NormalDepthOutlet()` | Standard open outfall at domain edge |
| `FixedStageBC(ts)` | Prescribed tailwater stage (TimeSeries) |
| `InflowBC(cells, ts)` | Prescribed point inflow hydrograph |
| `InternalInflowBC(cells, ts)` | Distributed inflow across interior cells (used in hybrid coupling) |

**Example:**

```python
from pywmp.rom import ROMGrid, ROMSimulation, UniformPrecipitation, NormalDepthOutlet
from pywmp.meteorology import DesignStorm

grid = ROMGrid.from_tif("data/my_watershed/dem.tif", resolution_m=10)
storm = DesignStorm("SCS_II", total_depth_in=5.0, duration_hr=24, dt_hr=0.1)
precip = UniformPrecipitation(storm.hyetograph())

sim = ROMSimulation(
    grid=grid,
    precipitation=precip,
    boundary_conditions=[NormalDepthOutlet()],
    duration_hr=24,
)
results = sim.run()
print(results.summary())
print(f"Peak depth: {results.max_depth:.2f} m")
```

---

## `pywmp.hybrid` — One-Way 1D→2D Coupling

### Two coupling modes

**Mode A — Outlet-to-inflow BC (`HybridSimulation`):**  
The 1D reach outlet hydrograph is injected as a boundary inflow into the 2D domain. Use when the watershed drains into a 2D floodplain at a known channel location.

**Mode B — Excess-precip distribution (`HybridExcessPrecipSimulation`):**  
The 1D network computes per-subbasin losses; excess precipitation is spatially distributed onto the 2D mesh through subbasin masks. Use when rainfall-on-mesh with spatially varying losses is needed.

### `HybridSimulation`

```python
HybridSimulation(upstream_model, rom_grid, outlet_specs)
```

| Parameter | Description |
|---|---|
| `upstream_model` | A configured `DesignStormSimulation` or `BasinModel` |
| `rom_grid` | `ROMGrid` for the 2D domain |
| `outlet_specs` | List of `OutletBCSpec` objects mapping 1D element names to 2D mesh edge cells |

### `HybridExcessPrecipSimulation`

```python
HybridExcessPrecipSimulation(upstream_model, rom_grid, mask_spec)
```

| Parameter | Description |
|---|---|
| `mask_spec` | `SubbasinMaskSpec` — maps each 1D subbasin name to a set of 2D grid cells |

### `SubbasinMaskSpec`

```python
SubbasinMaskSpec.from_delineation(delineator, grid)
```

Automatically builds masks from a `WatershedDelineator` result and a `ROMGrid`. Each subbasin's catchment polygon is rasterized onto the 2D grid.

### `HybridResults`

Extends `ROMResults` with:

| Attribute | Description |
|---|---|
| `.inflow_hydrograph` | Combined 1D inflow injected into 2D domain |
| `.flood_map` | `FloodMap` with peak depth raster |
| `.compare_1d_2d()` | Comparison metrics between 1D outlet and 2D outlet hydrographs |

---

## `pywmp.flood` — HAND Terrain Analysis & Flood Mapping

### `HANDRaster`

```python
HANDRaster(dem_path, stream_threshold=500)
```

| Parameter | Description |
|---|---|
| `dem_path` | Path to a conditioned DEM (GeoTIFF) |
| `stream_threshold` | Flow accumulation cells needed to define a stream (default 500) |

**Methods:**

| Method | Description |
|---|---|
| `.compute()` | Fill sinks → D8 flow direction → flow accumulation → HAND |
| `.hand` | HAND raster array (height above nearest drainage) |
| `.streams` | Binary stream network raster |
| `.snap_to_stream(x, y)` | Snap a coordinate to the nearest stream cell |

### `WatershedDelineator`

```python
WatershedDelineator(dem_path, stream_threshold=500)
```

**Methods:**

| Method | Description |
|---|---|
| `.delineate()` | Run full delineation; returns reach network |
| `.reach_properties` | DataFrame: `[reach_id, length_ft, slope, area_mi2, ...]` |
| `.rating_curves(n=0.035)` | Per-reach Manning's normal-depth rating curves |
| `.catchment_polygons` | GeoDataFrame of delineated catchment polygons |

### `FloodMapper`

```python
FloodMapper(hand_raster, delineator)
```

**Method:**

```python
flood_map = FloodMapper.map(sim_results, method="hand_uniform")
```

| `method` | Description |
|---|---|
| `"hand_uniform"` | HAND-uniform (one depth per reach from rating curve) — fastest |
| `"bathtub"` | Simple bathtub (all cells ≤ WSE flooded) |
| `"connected_bathtub"` | BFS-connected bathtub (flood must be contiguous from seed) |
| `"hand_spatial"` | Spatially varying HAND depth — highest accuracy |

### `FloodMap`

| Attribute | Description |
|---|---|
| `.depth` | Depth raster array (ft or m) |
| `.stats.flooded_area_acres` | Total inundated area |
| `.stats.max_depth_ft` | Maximum water depth |
| `.stats.volume_acre_ft` | Total flood volume |
| `.plot()` | Matplotlib depth map |
| `.to_cog(path)` | Export as Cloud Optimized GeoTIFF |

---

## `pywmp.cascade` — Cascade 2001 Detention Routing

### `CascadeSimulation`

```python
CascadeSimulation(basins, links, rainfall, dt_min=5)
```

Runs the Cascade 2001 iterative stage-routing algorithm over a network of detention basins and hydraulic structures.

### `parse_cascade_dat(path)`

Parse an official Cascade 2001 `.dat` project file and return a configured `CascadeSimulation`.

```python
from pywmp.cascade import parse_cascade_dat

sim = parse_cascade_dat("project.dat")
results = sim.run()
results.to_csv("output/")
```

### Hydraulic structures

| Class | Models |
|---|---|
| `CascadeGravityStructure` | Weir + bleeder pipe + principal spillway composite |
| `CascadeGatedSpillway` | Gate-controlled spillway with 4 flow regimes |
| `CascadePumpStation` | On/off pump with hysteresis levels |
| `CascadeDropInlet` | Drop-inlet riser + barrel pipe |
| `CascadeSeawall` | Coastal seawall overtopping (new in v0.2.0) |

### Runoff methods

| Class | Method |
|---|---|
| `SBUHRunoff` | Santa Barbara Urban Hydrograph (time-step Green-Ampt) |
| `GDCUHRunoff` | General Dimensionless Curvilinear Unit Hydrograph |

---

## `pywmp.api` — REST API Server

### Start the server

```bash
pip install "pywmp[api]"
uvicorn pywmp.api.app:app --host 0.0.0.0 --port 8000 --reload
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/simulate/hms` | Submit an HMS simulation job |
| `POST` | `/simulate/cascade` | Submit a Cascade 2001 job |
| `GET` | `/results/{run_id}` | Retrieve results (status + hydrographs) |
| `GET` | `/runs` | List all in-memory runs |
| `POST` | `/upload/dat` | Upload a `.dat` file to the server |
| `GET` | `/health` | Server health check |
| `WS` | `/ws/{run_id}` | WebSocket progress stream |

See the [REST API Tutorial](../tutorials/rest_api.md) for full request/response schemas and a working Python client.

---

## `pywmp.time_series` — Universal Data Carrier

### `TimeSeries`

```python
TimeSeries(times, values, dt=None, label="", units="")
```

| Parameter | Description |
|---|---|
| `times` | 1-D array of time values (hours) |
| `values` | 1-D array of data values |
| `dt` | Uniform timestep (hours); inferred if None |
| `label` | Human-readable label |
| `units` | Unit string (e.g. `"cfs"`, `"in/hr"`, `"m"`) |

**Arithmetic:** `+`, `-`, `*`, `/`, `**` all work element-wise with broadcasting.

**Methods:**

| Method | Description |
|---|---|
| `.interpolate(t)` | Linear interpolation at arbitrary time(s) |
| `.resample(new_dt)` | Change timestep (linear interpolation) |
| `.to_dict()` | JSON-serializable representation |
| `TimeSeries.from_dict(d)` | Reconstruct from dict |

---

## `pywmp.units` — Unit System

```python
from pywmp.units import UnitSystem, USC, SI

# USC — US customary (ft, in, mi, cfs, acres, ...)
# SI  — metric (m, mm, km, m³/s, ha, ...)
```

Pass `units=USC` or `units=SI` to any class that accepts it. Most classes default to USC.
