# Validation Reference

`pywmp.validation` provides tools to quantify how well your model matches observed data — both for streamflow hydrographs (gauge comparison) and for flood maps (spatial accuracy).

## Installation

```bash
pip install pywmp   # no extra needed
# For USGS gauge downloads:
pip install "pywmp[datasets]"
```

---

## Streamflow validation

### Download observed data from USGS

```python
from pywmp.validation import download_streamflow, GaugeStation

# Find a nearby USGS gauge
station = GaugeStation(site_no="02301500", name="Hillsborough River near Zephyrhills")

# Download instantaneous Q (15-min) for a storm event
q_obs = download_streamflow(
    site_no="02301500",
    start="2023-08-27",
    end="2023-08-29",
    freq="iv",      # "iv" = instantaneous; "dv" = daily
    units="cfs",
)
print(f"Downloaded {len(q_obs)} observations")
```

### `ModelVsObserved` — align, score, and plot

```python
from pywmp.validation import ModelVsObserved
import numpy as np

validator = ModelVsObserved(
    simulated = sim_results.outflows["Outlet"].values,
    observed  = q_obs,
    dt        = 0.25,       # 15-minute timestep (hours)
    label     = "Hurricane Idalia — Aug 2023",
)

# Print all metrics
metrics = validator.metrics()
print(metrics.summary())
```

Expected output:
```
Metric                  Value       Rating
--------------------    --------    ----------
NSE                     0.81        Very good
KGE                     0.78        Very good
|PBIAS|                 6.2 %       Very good
RMSE                    87.3 cfs    —
Peak flow error         +4.1 %      —
Peak timing error       +0.5 hr     —
Volume error            -3.8 %      Very good
```

```python
# Plot
validator.plot("output/validation_plot.png")
```

---

## `HydroMetrics` — standalone metric functions

All functions accept two numpy arrays: `simulated` and `observed`.

```python
from pywmp.validation import nse, kge, pbias, rmse, peak_flow_error, volume_error

sim = sim_results.outflows["A"].values
obs = q_observed

print(f"NSE   = {nse(sim, obs):.3f}")
print(f"KGE   = {kge(sim, obs).kge:.3f}")
print(f"PBIAS = {pbias(sim, obs):+.1f}%")
print(f"RMSE  = {rmse(sim, obs):.1f} cfs")
```

### KGE components

`kge()` returns a `KGEComponents` named tuple:

```python
from pywmp.validation import kge

result = kge(sim, obs)
print(f"KGE   = {result.kge:.3f}")
print(f"r     = {result.r:.3f}")      # correlation
print(f"alpha = {result.alpha:.3f}")  # flow variability ratio
print(f"beta  = {result.beta:.3f}")   # bias ratio
```

### Performance rating table

| Rating | NSE | \|PBIAS\| | KGE |
|---|---|---|---|
| Very good | ≥ 0.75 | < 10% | ≥ 0.75 |
| Good | 0.65–0.75 | 10–15% | 0.65–0.75 |
| Satisfactory | 0.50–0.65 | 15–25% | 0.50–0.65 |
| Unsatisfactory | < 0.50 | > 25% | < 0.50 |

*Source: Moriasi et al. (2007), Trans. ASABE 50:885*

---

## Spatial flood validation

Compare a simulated flood depth map against a reference (FEMA NFHL, observed HWM survey, or a benchmark simulation).

### `SpatialFloodValidation`

```python
from pywmp.validation import SpatialFloodValidation
import geopandas as gpd

fema = gpd.read_file("data/fema_sfha.gpkg")

validator = SpatialFloodValidation(
    simulated_depth_tif = "output/flood_depth_100yr.tif",
    reference           = fema,              # GeoDataFrame or binary raster path
    depth_threshold_ft  = 0.5,               # cells shallower than this = "dry"
)

metrics = validator.compute()
print(metrics.summary())
```

Expected output:
```
Spatial Flood Accuracy Metrics
--------------------------------
Critical Success Index (CSI)  : 0.72    (0 = worst, 1 = perfect)
Hit Rate (HR)                 : 0.84    (simulated flooded / observed flooded)
False Alarm Ratio (FAR)       : 0.18    (simulated flooded / not observed)
F1 Score                      : 0.79
Area Bias                     : +8.4 %  (simulated > observed area)
Mean Depth Error              : +0.3 ft (where both agree flooded)
```

### `SpatialMetrics` — what the numbers mean

| Metric | Formula | Ideal | Interpretation |
|---|---|---|---|
| CSI | TP / (TP+FP+FN) | 1.0 | Overall flood map accuracy |
| HR (Hit Rate) | TP / (TP+FN) | 1.0 | Fraction of observed flood cells captured |
| FAR | FP / (TP+FP) | 0.0 | Fraction of simulated cells that are false alarms |
| F1 | 2·TP / (2·TP+FP+FN) | 1.0 | Balanced precision/recall |
| Area Bias | (sim − obs) / obs | 0% | Positive = over-predicts extent |

*TP = True Positive (both flooded), FP = False Positive (only sim flooded), FN = False Negative (only obs flooded)*

```python
# Plot agreement map
validator.plot("output/flood_validation_map.png")
# Green = TP, Blue = FN (missed), Red = FP (false alarm)
```

---

## Suspended sediment rating curve

```python
from pywmp.validation import download_ssc, fit_rating_curve, estimate_annual_load_rating

# Download observed SSC from USGS
ssc = download_ssc("02301500", start="2020-01-01", end="2023-12-31")
q   = download_streamflow("02301500", start="2020-01-01", end="2023-12-31")

# Fit log-linear rating curve: SSC = a × Q^b
curve = fit_rating_curve(q=q, ssc=ssc)
print(f"Rating curve: SSC = {curve.a:.3f} × Q^{curve.b:.3f}")

# Estimate mean annual sediment load
load = estimate_annual_load_rating(q_annual=q, rating_curve=curve)
print(f"Mean annual sediment load: {load:.1f} tons/yr")
```

---

## References

- Nash & Sutcliffe (1970) *J. Hydrol.* 10:282 — NSE definition
- Kling et al. (2012) *J. Hydrol.* 424:264 — KGE derivation
- Moriasi et al. (2007) *Trans. ASABE* 50:885 — performance rating thresholds
- Legates & McCabe (1999) *WRR* 35:233 — model evaluation guidelines
