# Validation and Calibration Module Reference

`pywmp.validation` and `pywmp.calibration` provide tools for comparing model output
against gauge and spatial observations, and for automated parameter estimation.

---

## HydroMetrics

```python
class HydroMetrics(obs, sim)
```

Computes standard hydrologic performance metrics given observed and simulated time series.

| Parameter | Type | Description |
|-----------|------|-------------|
| `obs` | array-like | Observed discharge or stage series |
| `sim` | array-like | Simulated series aligned to `obs` |

### Metrics returned

| Metric | Symbol | Formula | Reference |
|--------|--------|---------|-----------|
| Nash-Sutcliffe Efficiency | NSE | 1 − Σ(obs−sim)² / Σ(obs−obs_mean)² | Nash & Sutcliffe, 1970 |
| Kling-Gupta Efficiency | KGE | 1 − √[(r−1)² + (α−1)² + (β−1)²] | Gupta et al., 2009 |
| KGE revised | KGE' | Modified α component (CV ratio) | Kling et al., 2012 |
| Root Mean Square Error | RMSE | √(mean[(obs−sim)²]) | — |
| Percent Bias | PBIAS | 100 × Σ(sim−obs)/Σobs | Moriasi et al., 2007 |
| Peak flow error | ΔQp | (sim_peak − obs_peak)/obs_peak | — |
| Peak timing error | Δtp | time(sim_peak) − time(obs_peak) | — |

KGE decomposes performance into three components:
- r — Pearson correlation coefficient
- α — variability ratio (σ_sim / σ_obs, or CV_sim / CV_obs for KGE')
- β — bias ratio (μ_sim / μ_obs)

### Performance ratings (Moriasi et al., 2007)

| Rating | NSE | KGE | |PBIAS| |
|--------|-----|-----|---------|
| Very Good | > 0.75 | ≥ 0.75 | < 10% |
| Good | 0.65–0.75 | 0.65–0.75 | 10–15% |
| Satisfactory | 0.50–0.65 | 0.50–0.65 | 15–25% |
| Unsatisfactory | < 0.50 | < 0.50 | > 25% |

### Methods

```python
HydroMetrics.nse()        -> float
HydroMetrics.kge()        -> float
HydroMetrics.kge_prime()  -> float
HydroMetrics.kge_components() -> KGEComponents
HydroMetrics.rmse()       -> float
HydroMetrics.pbias()      -> float
HydroMetrics.summary()    -> dict
HydroMetrics.rating()     -> str   # "Very Good" | "Good" | "Satisfactory" | "Unsatisfactory"
```

### KGEComponents

```python
@dataclass
class KGEComponents:
    kge:   float
    r:     float
    alpha: float
    beta:  float
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

## ModelVsObserved

```python
class ModelVsObserved(station, sim_series, variable='Q')
```

Pairs simulated output with a USGS NWIS gauge record and computes all HydroMetrics.

| Parameter | Description |
|-----------|-------------|
| `station` | `GaugeStation` instance (site number + date range) |
| `sim_series` | `TimeSeries` from `SimResults` |
| `variable` | `'Q'` (discharge) or `'H'` (stage) |

```python
# Download, pair, score
mv = ModelVsObserved(GaugeStation("02290000", start="2021-06-01", end="2021-09-30"), sim_q)
m = mv.metrics()
print(m.nse(), m.kge(), m.rating())
```

Gauge data is downloaded via USGS Water Services REST API (USGS, 2023c), using the
same HyRiver infrastructure as `pywmp.datasets`.

---

## SpatialFloodValidation

```python
class SpatialFloodValidation(sim_depth, ref_mask, valid_mask=None, depth_threshold=0.1)
```

Compares a simulated depth raster against a binary reference flood extent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `sim_depth` | ndarray | Simulated max depth (ft or m) |
| `ref_mask` | ndarray[bool] | Reference flood extent (True = flooded) |
| `valid_mask` | ndarray[bool] | Optional AOI mask; only cells within AOI are scored |
| `depth_threshold` | float | Depth above which a cell is considered flooded; default 0.1 ft |

### Contingency table metrics

| Metric | Definition | Reference |
|--------|-----------|-----------|
| CSI (Critical Success Index) | TP / (TP + FP + FN) | Schaefer, 1990 |
| Hit Rate (HR) | TP / (TP + FN) | Wing et al., 2017 |
| False Alarm Ratio (FAR) | FP / (TP + FP) | Wing et al., 2017 |
| F1 Score | 2TP / (2TP + FP + FN) | — |

Validation against FEMA NFHL AE zones (FEMA, 2023) typically yields CSI ≈ 0.25–0.55
for bathtub-style simulations in flat coastal terrain, consistent with the findings
of Wing et al. (2017) for 30m national-scale models.

For high-resolution (1–10m) HLL simulations, CSI > 0.6 indicates good agreement
with SAR-derived extents, following the benchmarks in Bates et al. (2010).

### Methods

```python
SpatialFloodValidation.metrics() -> dict   # CSI, HR, FAR, F1, TP, FP, FN, TN
SpatialFloodValidation.plot_contingency(ax=None)
SpatialFloodValidation.export_geotiff(path)   # TP/FP/FN/TN raster
```

---

## CalibrationEngine

```python
class CalibrationEngine(model_fn, observed, params, objective='NSE',
                         method='differential_evolution', **solver_kwargs)
```

Optimises `params` by minimising/maximising the objective function computed from
`model_fn` output vs. `observed`.

| Parameter | Description |
|-----------|-------------|
| `model_fn` | Callable that maps `ParameterSet → TimeSeries`; runs the simulation |
| `observed` | Observed `TimeSeries` |
| `params` | List of `ParameterBound` instances |
| `objective` | `'NSE'`, `'KGE'`, `'KGE_prime'`, `'RMSE'`, or `'PBIAS'` |
| `method` | `'differential_evolution'` (default), `'sce_ua'`, or `'nelder_mead'` |

### Solver choices

| Method | Class | Reference | Notes |
|--------|-------|-----------|-------|
| Differential evolution | `CalibrationEngine` default | Storn & Price, 1997 | Global; recommended for >3 parameters |
| SCE-UA | `method='sce_ua'` | Duan et al., 1992 | Classic hydrology calibration; 3–15 parameters |
| Nelder-Mead simplex | `method='nelder_mead'` | Nelder & Mead, 1965 | Local; use for final refinement near optimum |

Differential evolution (Storn & Price, 1997) is recommended as the default because
it requires no gradient information and is robust to multi-modal response surfaces,
which are common in lumped hydrologic parameter spaces (Duan et al., 1992).

### Methods

```python
CalibrationEngine.run(max_iter=500, popsize=15, tol=1e-4) -> CalibrationResults
CalibrationEngine.run_parallel(n_workers=4, ...)           -> CalibrationResults
```

---

## ParameterBound

```python
@dataclass
class ParameterBound(name, lo, hi, initial=None, log_scale=False)
```

Defines search bounds for a single calibration parameter.

| Field | Description |
|-------|-------------|
| `name` | Parameter name string (must match `model_fn` kwarg) |
| `lo`, `hi` | Lower and upper bounds |
| `initial` | Starting point; if `None`, midpoint of [lo, hi] |
| `log_scale` | If `True`, search on log₁₀ space (useful for orders-of-magnitude parameters such as Ks) |

---

## ParameterSet

```python
@dataclass
class ParameterSet:
    values: dict[str, float]   # {name: optimised_value}
    objective_value: float     # final NSE / KGE / RMSE
    n_evaluations: int
    converged: bool
```

---

## CalibrationResults

```python
@dataclass
class CalibrationResults:
    best: ParameterSet
    all_trials: list[ParameterSet]   # full population history
    convergence_curve: ndarray        # objective per iteration
    runtime_s: float
```

---

## GaugeStation

```python
@dataclass
class GaugeStation(site_no, start, end, variable='Q')
```

Thin wrapper for a USGS NWIS gauge record. Lazy-loads data from USGS Water Services
REST API (USGS, 2023c) on first access.

---

## Download helpers

```python
download_streamflow(site_no, start, end) -> TimeSeries
download_stage(site_no, start, end)      -> TimeSeries
download_ssc(site_no, start, end)        -> TimeSeries   # suspended sediment
```

---

## Usage example

```python
from pywmp.calibration import CalibrationEngine, ParameterBound, ParameterSet
from pywmp.validation import HydroMetrics, ModelVsObserved, GaugeStation

# --- Define parameter search space ---
params = [
    ParameterBound("cn",        lo=70, hi=98,   initial=85),    # SCS Curve Number
    ParameterBound("initial_k", lo=0.10, hi=0.60, initial=0.30),  # Manning k (lag)
    ParameterBound("lag_hr",    lo=1.0, hi=8.0,  initial=4.0),
]

# --- Calibrate against USGS gauge ---
def run_model(cn, initial_k, lag_hr):
    # ... build and run simulation, return TimeSeries
    ...

engine = CalibrationEngine(
    model_fn=run_model,
    observed=download_streamflow("02290000", "2019-01-01", "2020-12-31"),
    params=params,
    objective="KGE",                      # Gupta et al. (2009)
    method="differential_evolution",      # Storn & Price (1997)
)
results = engine.run(max_iter=400)
print(f"Best KGE: {results.best.objective_value:.3f}")
print(f"Rating:   {HydroMetrics(...).rating()}")  # Moriasi et al. (2007)
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
