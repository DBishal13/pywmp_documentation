# Full Pipeline Tutorial

This tutorial walks through a complete watershed modeling workflow: downloading all geospatial inputs, building a calibrated 1D hydrologic model, adding a 2D floodplain domain, running a hybrid simulation, and analyzing the results.

**Watershed:** A ~4 mi² mixed-use catchment in west-central Florida  
**Storm:** 100-year, 24-hour SCS Type II design storm  
**Goal:** Peak discharge at the watershed outlet + flood inundation depth map

---

## Prerequisites

```bash
pip install "pywmp[datasets,spatial,fast]"
```

---

## Step 1 — Download watershed inputs

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-82.05, 28.02, -81.98, 28.07),
    output_dir="data/hillsborough",
    cache=True,
)
dm.download_all(lat=28.044, lon=-82.013)
print(dm.summary())
```

Expected output:
```
Dataset         Status    Path
-----------     ------    ------------------------------------
dem             OK        data/hillsborough/dem.tif
huc12           OK        data/hillsborough/huc12.gpkg
flowlines       OK        data/hillsborough/flowlines.gpkg
catchments      OK        data/hillsborough/catchments.gpkg
nlcd            OK        data/hillsborough/nlcd.tif
hsg             OK        data/hillsborough/hsg.tif
cn              OK        data/hillsborough/cn.tif
atlas14         OK        data/hillsborough/atlas14.json
fema_sfha       OK        data/hillsborough/fema_sfha.gpkg
```

Read the 100-year 24-hour design storm depth from the downloaded Atlas 14 data:

```python
from pywmp.meteorology import IDFCurve

idf = IDFCurve("data/hillsborough/atlas14.json")
depth_100yr = idf.depth(duration_hr=24, return_period_yr=100)
print(f"100-year 24-hour depth: {depth_100yr:.2f} in")
# → 100-year 24-hour depth: 10.14 in  (typical south-central FL value)
```

---

## Step 2 — Watershed delineation

```python
from pywmp.flood.watershed import WatershedDelineator

wd = WatershedDelineator("data/hillsborough/dem.tif")
wd.fill_sinks()               # Priority-flood algorithm
wd.compute_d8_flow()          # D8 flow direction
wd.compute_flow_accumulation()
wd.delineate(outlet_coords=(-82.013, 28.044), area_threshold_ac=200)
subbasins = wd.save("outputs/subbasins.gpkg")
```

---

## Step 3 — Build the 1D hydrologic model

We use `build_basin_model()` to automatically assemble a basin model from the
delineated subbasin polygons and raster inputs, then use `DesignStormSimulation`
for the storm event.

```python
from pywmp.workflow.delineation_builder import build_basin_model
from pywmp.workflow.design_storm import DesignStormSimulation
from pywmp.losses import SCSCurveLoss
from pywmp.transform import ClarkUH        # Clark (1945)
from pywmp.routing import MuskingumCungeRouting   # Cunge (1969)
from pywmp.simulation.engine import BasinModel

model = build_basin_model("outputs/subbasins.gpkg", nlcd="data/hillsborough/nlcd.tif",
                           soils="data/hillsborough/hsg.tif")
# Override with Clark UH transform (Clark, 1945) and Muskingum-Cunge routing (Cunge, 1969)
for sb in model.subbasins:
    sb.loss = SCSCurveLoss.from_landuse_and_soils(sb.nlcd_stats, sb.hsg_stats)
    sb.transform = ClarkUH(tc_hr=sb.tc_kirpich(), R=0.6)

for reach in model.reaches:
    reach.routing = MuskingumCungeRouting.from_geometry(reach)
```

Alternatively, build subbasins manually:

```python
sim = DesignStormSimulation(
    storm_type="SCS_II",      # SCS Type II distribution — correct for central Florida
    total_depth_in=depth_100yr,
    duration_hr=24,
    dt_hr=0.1,                # 6-minute timestep — standard for design events
)

# Upper subbasin: mixed residential, B/C soils → composite CN = 78
sim.add_subbasin(
    name="Upper",
    area_mi2=2.5,
    loss_method="SCS_CN",
    loss_params={
        "CN": 78,         # Composite from NLCD/SSURGO — moderate impervious cover
        "ia_ratio": 0.2,  # NRCS standard initial abstraction ratio
        "amc": 2,         # AMC-II: normal antecedent conditions
    },
    transform_method="Clark",
    transform_params={
        "Tc": 1.8,   # Time of concentration (hr) — estimated from TR-55 velocity method
        "R": 1.4,    # Storage coefficient ≈ 0.8 × Tc for low-relief Florida terrain
    },
)

# Lower subbasin: denser canopy, sandy loam soils → lower CN = 65
sim.add_subbasin(
    name="Lower",
    area_mi2=1.8,
    loss_method="Green_Ampt",
    loss_params={
        "Ks": 0.52,       # Sandy loam: moderate saturated conductivity (Rawls 1983)
        "psi": 3.50,      # Wetting-front suction head (in)
        "theta_i": 0.15,  # Initial moisture content — dry antecedent conditions
        "eta": 0.453,     # Sandy loam porosity
    },
    transform_method="SCS",
    transform_params={
        "lag_hr": 1.1,    # Estimated as 0.6 × Tc; Tc from hydraulic geometry
    },
)

sim.add_reach(
    upstream="Upper",
    downstream="Lower",
    method="Muskingum",
    params={
        "K_hr": 0.8,    # Travel time ≈ reach length / wave celerity
        "x": 0.2,       # Attenuation factor; 0.2 is typical for natural channels
        "steps": 3,     # Sub-reaches for numerical stability
    },
)

results_1d = sim.run()
print(results_1d.summary())
```

Expected output:
```
Element     Peak Flow (cfs)    Volume (ac-ft)    Time to Peak (hr)
---------   ---------------    --------------    -----------------
Upper             842.3              95.4               11.2
Lower (routed)    721.6              93.1               12.0
```

---

## Step 4 — Prepare the 2D grid

Load the downloaded DEM and resample to a workable resolution:

```python
from pywmp.rom import ROMGrid

grid = ROMGrid.from_tif(
    "data/hillsborough/dem.tif",
    resolution_m=10,     # 10 m cells — good balance of accuracy and speed
)
print(grid.summary())
```

Expected output:
```
ROMGrid: 712 × 584 cells, dx=10.0 m, dy=10.0 m
DEM range: 4.2 – 48.7 m  |  CRS: EPSG:26917
Estimated memory: ~3.2 MB
```

!!! tip "Performance"
    For domains larger than ~20 mi², increase cell size to 20–30 m or install `pywmp[fast]` for Numba-accelerated computation.

---

## Step 5 — Run a hybrid simulation

`HybridSimulation` injects the 1D outlet hydrograph from Step 3 as a boundary inflow into the 2D domain:

```python
from pywmp.hybrid.coupler import HybridSimulation, OutletBCSpec

hybrid = HybridSimulation(
    upstream_model=sim,
    rom_grid=grid,
    outlet_specs=[
        OutletBCSpec(
            element_name="Lower",   # which 1D element's outflow to inject
            row=355, col=280,       # approximate grid cell at watershed outlet
        )
    ],
    duration_hr=36,      # simulate 12 hours past the end of rainfall for recession
)

hybrid_results = hybrid.run()
```

!!! note "CRS consistency"
    The `OutletBCSpec` row/col is in grid coordinates. Use `grid.coord_to_pixel(lon, lat)` to convert a geographic coordinate to grid indices if you know the outlet location.

---

## Step 6 — Analyze results

### Outlet hydrograph

```python
import matplotlib.pyplot as plt

# 1D outlet vs. 2D domain outlet
fig, ax = plt.subplots(figsize=(10, 5))
t = hybrid_results.inflow_hydrograph.times
ax.plot(t, hybrid_results.inflow_hydrograph.values, label="1D outlet (inflow to 2D)", lw=2)
ax.plot(t, hybrid_results.outlet_hydrograph.values, label="2D outlet", lw=2, linestyle="--")
ax.set_xlabel("Time (hr)")
ax.set_ylabel("Discharge (cfs)")
ax.set_title("100-Year 24-Hour Hybrid Simulation — Hillsborough County")
ax.legend()
plt.tight_layout()
plt.savefig("output/outlet_hydrograph.png", dpi=150)
```

### Flood map statistics

```python
fm = hybrid_results.flood_map
print(f"Peak flood depth:   {fm.stats.max_depth_ft:.2f} ft")
print(f"Flooded area:       {fm.stats.flooded_area_acres:.1f} acres")
print(f"Total flood volume: {fm.stats.volume_acre_ft:.1f} acre-ft")
```

Expected output:
```
Peak flood depth:   6.3 ft
Flooded area:       47.8 acres
Total flood volume: 89.2 acre-ft
```

### Depth map

```python
fm.plot(cmap="Blues", title="Peak Flood Depth — 100-yr 24-hr")
plt.savefig("output/flood_depth_map.png", dpi=150)
```

### Export to GeoTIFF for GIS review

```python
fm.to_geotiff("output/flood_depth_100yr.tif")
fm.to_cog("output/flood_depth_100yr_cog.tif")   # Cloud Optimized GeoTIFF for web sharing
```

### Cross-validate against FEMA

```python
import geopandas as gpd

fema = gpd.read_file("data/hillsborough/fema_sfha.gpkg")
comparison = hybrid_results.flood_map.compare_fema(fema)
print(f"FEMA agreement (CSI): {comparison.csi:.2f}")
print(f"Area bias:            {comparison.area_bias:+.1f}%")
```

### Serialize results

```python
# Save 1D results to JSON
results_1d.to_json("output/results_1d.json")

# Save full hybrid results summary
hybrid_results.to_csv("output/")
```

---

## Summary of outputs

| File | Description |
|---|---|
| `output/outlet_hydrograph.png` | 1D vs. 2D outlet comparison plot |
| `output/flood_depth_map.png` | Peak depth map |
| `output/flood_depth_100yr.tif` | Depth raster (GeoTIFF) |
| `output/flood_depth_100yr_cog.tif` | Cloud Optimized GeoTIFF for sharing |
| `output/results_1d.json` | 1D peak flows + volumes |
| `output/` | Per-element CSV hydrographs |

---

## Next steps

- [Hybrid Coupling Tutorial](hybrid_coupling.md) — deep dive on coupling modes and parameters
- [REST API Tutorial](rest_api.md) — run these simulations remotely via HTTP
- [Module Reference](../reference/modules.md) — full API for all classes used here

---

## References

Bates, P. D., & De Roo, A. P. J. (2000). A simple raster-based model for flood
  inundation simulation. *Journal of Hydrology*, *236*(1–2), 54–77.
  [DOI ↗](https://doi.org/10.1016/S0022-1694(00)00278-X)

Bates, P. D., Horritt, M. S., & Fewtrell, T. J. (2010). A simple inertial
  formulation of the shallow water equations for efficient two-dimensional flood
  inundation modelling. *Journal of Hydrology*, *387*(1–2), 33–45.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2010.03.027)

Clark, C. O. (1945). Storage and the unit hydrograph. *Transactions of the American
  Society of Civil Engineers*, *110*(1), 1419–1446.
  [DOI ↗](https://doi.org/10.1061/TACEAT.0005791)

Cunge, J. A. (1969). On the subject of a flood propagation computation method
  (Muskingum method). *Journal of Hydraulic Research*, *7*(2), 205–230.
  [DOI ↗](https://doi.org/10.1080/00221686909500264)

Federal Emergency Management Agency. (2023). *National Flood Hazard Layer (NFHL)*.
  [FEMA MSC ↗](https://msc.fema.gov)

Harten, A., Lax, P. D., & van Leer, B. (1983). On upstream differencing and
  Godunov-type schemes for hyperbolic conservation laws. *SIAM Review*, *25*(1),
  35–61.
  [DOI ↗](https://doi.org/10.1137/1025002)

Homer, C., Dewitz, J., Jin, S., Xian, G., Costello, C., Danielson, P., Gass, L.,
  Funk, M., Wickham, J., Stehman, S., Auch, R., & Riitters, K. (2020). Conterminous
  United States land cover change patterns 2001–2016 from the 2016 National Land
  Cover Database. *ISPRS Journal of Photogrammetry and Remote Sensing*, *162*,
  184–199.
  [DOI ↗](https://doi.org/10.1016/j.isprsjprs.2020.02.019)

Moore, I. D., & Burch, G. J. (1986). Physical basis of the length-slope factor in
  the Universal Soil Loss Equation. *Soil Science Society of America Journal*,
  *50*(5), 1294–1298.
  [DOI ↗](https://doi.org/10.2136/sssaj1986.03615995005000050042x)

Natural Resources Conservation Service. (2004). *National Engineering Handbook,
  Part 630: Hydrology*. U.S. Department of Agriculture.
  [USDA NAL ↗](https://handle.nal.usda.gov/10113/32494)

Perica, S., Pavlovic, S., St. Laurent, M., Trypaluk, C., Unruh, D., Martin, D., &
  Wilhite, O. (2013). *NOAA Atlas 14: Precipitation-frequency atlas of the United
  States, Volume 9: Southeastern States, Version 3* (NOAA Atlas 14, Vol. 9). NOAA.
  [DOI ↗](https://doi.org/10.25923/xnb4-5613)

Schaefer, J. T. (1990). The critical success index as an indicator of warning skill.
  *Weather and Forecasting*, *5*(4), 570–575.
  [DOI ↗](https://doi.org/10.1175/1520-0434(1990)005<0570:TCSIAA>2.0.CO;2)

Soil Survey Staff. (2023). *Web Soil Survey*. USDA Natural Resources Conservation
  Service.
  [Web Soil Survey ↗](https://websoilsurvey.nrcs.usda.gov)

U.S. Geological Survey. (2024). *3D Elevation Program (3DEP)*.
  [USGS ↗](https://www.usgs.gov/3dep)

Wing, O. E. J., Bates, P. D., Sampson, C. C., Smith, A. M., Johnson, K. A., &
  Erickson, T. A. (2017). Validation of a 30 m resolution flood hazard model of
  the conterminous United States. *Water Resources Research*, *53*(9), 7968–7986.
  [DOI ↗](https://doi.org/10.1002/2017WR020917)
