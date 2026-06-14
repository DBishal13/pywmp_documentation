# Calibration and Validation Tutorial

This tutorial walks through automated parameter calibration against a USGS gauge
record and spatial flood validation against FEMA NFHL data.

---

## Overview

PyWMP's calibration module (`pywmp.calibration`) implements three optimisation
algorithms. The default is differential evolution (Storn & Price, 1997), which is
recommended for problems with 3–15 parameters because it is gradient-free and
robust to multi-modal response surfaces (Duan et al., 1992).

Performance is evaluated using Nash-Sutcliffe Efficiency (NSE; Nash & Sutcliffe,
1970) or Kling-Gupta Efficiency (KGE; Gupta et al., 2009). Ratings follow the
guidelines of Moriasi et al. (2007).

---

## Part 1 — Streamflow calibration

### Step 1 — Download observed gauge data

```python
from pywmp.validation import download_streamflow, GaugeStation

obs = download_streamflow("02290000", start="2019-01-01", end="2020-12-31")
# Returns TimeSeries via USGS NWIS REST API
```

### Step 2 — Define parameter search space

```python
from pywmp.calibration import ParameterBound

params = [
    ParameterBound("cn",         lo=70,   hi=98,   initial=85),
    ParameterBound("initial_abs",lo=0.10, hi=0.60, initial=0.30),
    ParameterBound("lag_hr",     lo=1.0,  hi=8.0,  initial=4.0),
    ParameterBound("k_mann",     lo=0.02, hi=0.15, initial=0.06),
]
```

Log-scale search (`log_scale=True`) is recommended for parameters that span more
than one order of magnitude, such as saturated hydraulic conductivity Ks (Green &
Ampt, 1911).

### Step 3 — Run differential evolution

```python
from pywmp.calibration import CalibrationEngine

def run_model(cn, initial_abs, lag_hr, k_mann):
    """Thin wrapper that runs PyWMP and returns a TimeSeries."""
    ...
    return sim_q

engine = CalibrationEngine(
    model_fn=run_model,
    observed=obs,
    params=params,
    objective="KGE",                     # Gupta et al. (2009)
    method="differential_evolution",     # Storn & Price (1997)
)
results = engine.run(max_iter=400, popsize=15, tol=1e-4)
```

Differential evolution (Storn & Price, 1997) runs a population of candidate
parameter vectors and evolves them via mutation and crossover. The population
size (`popsize`) should be at least 5 × number of parameters. For 4 parameters,
`popsize=15` provides a good balance between exploration and convergence speed.

### Step 4 — Evaluate and rate performance

```python
from pywmp.validation import HydroMetrics

best_sim = run_model(**results.best.values)
m = HydroMetrics(obs=obs.values, sim=best_sim.values)

print(f"NSE  = {m.nse():.3f}")   # Nash & Sutcliffe (1970)
print(f"KGE  = {m.kge():.3f}")   # Gupta et al. (2009); Kling et al. (2012)
print(f"PBIAS= {m.pbias():.1f}%")
print(f"Rating: {m.rating()}")   # Moriasi et al. (2007) rating thresholds

# Performance criteria (Moriasi et al., 2007):
# NSE > 0.75 and |PBIAS| < 10% → Very Good
# NSE > 0.65 and |PBIAS| < 15% → Good
# NSE > 0.50 and |PBIAS| < 25% → Satisfactory
```

### Step 5 — Convergence plot

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(8, 3))
plt.plot(results.convergence_curve)
plt.xlabel("Iteration")
plt.ylabel("KGE")
plt.title("Differential evolution convergence")
plt.tight_layout()
plt.savefig("outputs/figures/calibration_convergence.png", dpi=150)
```

---

## Part 2 — Local refinement with Nelder-Mead

After a global search, Nelder-Mead simplex (Nelder & Mead, 1965) can refine the
solution near the differential evolution optimum:

```python
from pywmp.calibration import ParameterBound

# Tighten bounds around the DE optimum
refined_params = [
    ParameterBound("cn",     lo=results.best.values["cn"] - 3,
                              hi=results.best.values["cn"] + 3,
                              initial=results.best.values["cn"]),
    ...
]

engine_nm = CalibrationEngine(
    model_fn=run_model,
    observed=obs,
    params=refined_params,
    objective="KGE",
    method="nelder_mead",       # Nelder & Mead (1965)
)
refined = engine_nm.run(max_iter=200)
print(f"Refined KGE: {refined.best.objective_value:.4f}")
```

---

## Part 3 — Spatial flood validation

Spatial validation compares the simulated flood extent against a reference
binary flood mask, using the Critical Success Index (CSI; Schaefer, 1990).

```python
from pywmp.validation import SpatialFloodValidation
import rasterio
import numpy as np
import geopandas as gpd

# Load simulated depth raster
with rasterio.open("outputs/inundation/rain_100yr_depth.tif") as src:
    depth = src.read(1)
    transform = src.transform
    crs = src.crs

# Load FEMA AE zone (FEMA, 2023) as binary reference
fema_ae = gpd.read_file("data/fema/nfhl.gpkg").query("FLD_ZONE == 'AE'")
fema_mask = rasterize_to_array(fema_ae, transform, depth.shape, crs)

# Validate
val = SpatialFloodValidation(
    sim_depth=depth,
    ref_mask=fema_mask.astype(bool),
    depth_threshold=0.1,    # ft — cells shallower than this are treated as dry
)
m = val.metrics()

print(f"CSI = {m['CSI']:.3f}")   # Schaefer (1990)
print(f"HR  = {m['HR']:.3f}")   # Wing et al. (2017)
print(f"FAR = {m['FAR']:.3f}")  # Wing et al. (2017)
print(f"F1  = {m['F1']:.3f}")
```

CSI (Critical Success Index; Schaefer, 1990) is preferred over accuracy for
flood validation because it ignores true negatives (the large area of dry land that
inflates accuracy). Target CSI thresholds: ≥ 0.50 for HLL simulations at 10m
resolution, consistent with Bates et al. (2010) and Wing et al. (2017).

### Export contingency raster

```python
val.export_geotiff("outputs/qaqc/spatial_validation_100yr.tif")
# Pixel values: 1=TP, 2=FP, 3=FN, 4=TN
```

---

## Part 4 — Paired gauge + spatial report

```python
from pywmp.validation import ModelVsObserved

mv = ModelVsObserved(
    station=GaugeStation("02290000", start="2019-01-01", end="2020-12-31"),
    sim_series=best_sim,
)
report = mv.report()   # dict with metrics + rating + recommendation text
print(report["summary"])
```

---

## References

Bates, P. D., Horritt, M. S., & Fewtrell, T. J. (2010). A simple inertial
  formulation of the shallow water equations for efficient two-dimensional flood
  inundation modelling. *Journal of Hydrology*, *387*(1–2), 33–45.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2010.03.027)

Duan, Q., Sorooshian, S., & Gupta, V. K. (1992). Effective and efficient global
  optimization for conceptual rainfall-runoff models. *Water Resources Research*,
  *28*(4), 1015–1031.
  [DOI ↗](https://doi.org/10.1029/91WR02985)

Federal Emergency Management Agency. (2023). *National Flood Hazard Layer (NFHL)*.
  [FEMA MSC ↗](https://msc.fema.gov)

Green, W. H., & Ampt, G. A. (1911). Studies on soil physics. *Journal of
  Agricultural Science*, *4*(1), 1–24.
  [DOI ↗](https://doi.org/10.1017/S0021859600001441)

Gupta, H. V., Kling, H., Yilmaz, K. K., & Martinez, G. F. (2009). Decomposition
  of the mean squared error and NSE performance criteria: Implications for improving
  hydrological modelling. *Journal of Hydrology*, *377*(1–2), 80–91.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2009.08.003)

Kling, H., Fuchs, M., & Paulin, M. (2012). Runoff conditions in the upper Danube
  basin under an ensemble of climate change scenarios. *Journal of Hydrology*,
  *424–425*, 264–277.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2012.01.011)

Moriasi, D. N., Arnold, J. G., Van Liew, M. W., Bingner, R. L., Harmel, R. D., &
  Veith, T. L. (2007). Model evaluation guidelines for systematic quantification of
  accuracy in watershed simulations. *Transactions of the ASABE*, *50*(3), 885–900.
  [DOI ↗](https://doi.org/10.13031/2013.23153)

Nash, J. E., & Sutcliffe, J. V. (1970). River flow forecasting through conceptual
  models. Part I — A discussion of principles. *Journal of Hydrology*, *10*(3),
  282–290.
  [DOI ↗](https://doi.org/10.1016/0022-1694(70)90255-6)

Nelder, J. A., & Mead, R. (1965). A simplex method for function minimization.
  *The Computer Journal*, *7*(4), 308–313.
  [DOI ↗](https://doi.org/10.1093/comjnl/7.4.308)

Schaefer, J. T. (1990). The critical success index as an indicator of warning skill.
  *Weather and Forecasting*, *5*(4), 570–575.
  [DOI ↗](https://doi.org/10.1175/1520-0434(1990)005<0570:TCSIAA>2.0.CO;2)

Storn, R., & Price, K. (1997). Differential evolution — A simple and efficient
  heuristic for global optimization over continuous spaces. *Journal of Global
  Optimization*, *11*(4), 341–359.
  [DOI ↗](https://doi.org/10.1023/A:1008202821328)

U.S. Geological Survey. (2023c). *National Water Information System (NWIS): USGS
  water data for the nation*.
  [NWIS ↗](https://waterdata.usgs.gov)

Wing, O. E. J., Bates, P. D., Sampson, C. C., Smith, A. M., Johnson, K. A., &
  Erickson, T. A. (2017). Validation of a 30 m resolution flood hazard model of
  the conterminous United States. *Water Resources Research*, *53*(9), 7968–7986.
  [DOI ↗](https://doi.org/10.1002/2017WR020917)
