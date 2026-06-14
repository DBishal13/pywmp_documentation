# AI Calibration Reference

`pywmp.calibrate_ai` accelerates parameter estimation in two complementary
ways:

1. **Parameter prediction** — ML inference from public spatial datasets
   (NLCD, SSURGO, USGS streamflow, SAR flood extents) replaces
   manual lookup-table defaults or expensive calibration loops.
2. **Calibration acceleration** — a Gaussian Process surrogate replaces
   each slow ROM run (~28 min) with a millisecond prediction, enabling
   full Bayesian inference in ~2 minutes.

The 2D shallow-water solver is never replaced — only the parameter
estimation upstream and the optimization loop are accelerated.

---

## `pywmp.calibrate_ai`

```python
from pywmp.calibrate_ai import (
    AICalibrator, AICalibrationResults, CalibrateAIConfig,
    GaugeObservation, SARObservation, diagnose,
    BasinNetwork, NetworkNode, NetworkEdge, muskingum_route,
    BasinFeatureExtractor, ParameterDatabase,
    RegionalizationModel, RegionalizationPrediction,
)
```

| Class / function | Purpose |
|-----------------|---------|
| `AICalibrator` | Main calibration engine — surrogate GP, particle filter, or EnKF |
| `AICalibrationResults` | Results container with posterior parameter distributions |
| `CalibrateAIConfig` | Configuration: method, priors, observation set, convergence |
| `GaugeObservation` | USGS NWIS gauge download and preprocessing |
| `SARObservation` | SAR flood-extent raster ingestion for spatial calibration |
| `diagnose` | Diagnostic advisor: detects parameter insensitivity and data conflicts |
| `BasinNetwork` | Directed graph of upstream/downstream basin connectivity |
| `NetworkNode` | Single basin node in the routing network |
| `NetworkEdge` | Link between basins with Muskingum routing parameters |
| `muskingum_route` | Network-level bulk Muskingum routing function |
| `BasinFeatureExtractor` | Extracts ML input features from basin spatial attributes |
| `ParameterDatabase` | Parameter lookup table for regionalization |
| `RegionalizationModel` | ML model predicting parameters from watershed attributes |
| `RegionalizationPrediction` | Predicted parameter set with uncertainty bounds |

---

## AICalibrator

```python
class AICalibrator(
    model, method, params, observations,
    config=None
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | ROMSimulation | The simulation model to calibrate |
| `method` | str | `'surrogate_gp'`, `'particle_filter'`, or `'enkf'` |
| `params` | ParameterSet | Parameter bounds from `pywmp.calibration` |
| `observations` | GaugeObservation \| SARObservation \| list | Calibration targets |
| `config` | CalibrateAIConfig \| None | Advanced settings; defaults auto-selected |

**Methods**

```python
AICalibrator.run() -> AICalibrationResults
AICalibrator.warm_start(checkpoint_path)      # resume from saved state
```

**Example**

```python
from pywmp.calibrate_ai import AICalibrator, GaugeObservation
from pywmp.calibration import ParameterSet

obs = GaugeObservation(site_id="02290500",
                        start="2020-01-01", end="2020-12-31")
obs.fetch()

params = ParameterSet([
    ("cn_shift",  -15, 15,  0),
    ("ia_ratio",  0.05, 0.30, 0.20),
])

calibrator = AICalibrator(
    model=sim,
    method="surrogate_gp",
    params=params,
    observations=obs,
)
results = calibrator.run()
print(results.summary())
```

---

## CalibrateAIConfig

```python
class CalibrateAIConfig(
    n_lhs_samples=200,
    gp_kernel='matern52',
    mcmc_chains=4,
    mcmc_samples=1000,
    convergence_r_hat=1.05,
    random_seed=42,
)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `n_lhs_samples` | 200 | Latin Hypercube Sampling runs for GP training |
| `gp_kernel` | `'matern52'` | GP kernel type: `'matern52'`, `'rbf'`, `'periodic'` |
| `mcmc_chains` | 4 | Number of MCMC chains for Bayesian posterior |
| `mcmc_samples` | 1000 | Samples per chain |
| `convergence_r_hat` | 1.05 | Gelman-Rubin convergence threshold |

---

## Observations

### GaugeObservation

```python
class GaugeObservation(site_id, start, end, param='00060')
```

Downloads and preprocesses USGS NWIS streamflow for use as calibration
targets.

| Parameter | Type | Description |
|-----------|------|-------------|
| `site_id` | str | USGS 8-digit station number (e.g. `"02290500"`) |
| `start`, `end` | str | Date strings `"YYYY-MM-DD"` |
| `param` | str | NWIS parameter code; `'00060'` = discharge (cfs) |

```python
obs = GaugeObservation("02290500", "2020-01-01", "2020-12-31")
obs.fetch()           # downloads from NWIS
obs.to_timeseries()   # returns TimeSeries
```

### SARObservation

```python
class SARObservation(flood_extent_path, event_date, dem_path)
```

Ingest a SAR-derived binary flood-extent raster for spatial Manning n
calibration via the particle filter method.

```python
sar = SARObservation(
    flood_extent_path="data/sar/flood_20200918.tif",
    event_date="2020-09-18",
    dem_path="data/dem/dem_10m.tif",
)
```

---

## Diagnostic advisor

```python
from pywmp.calibrate_ai import diagnose

report = diagnose(model=sim, params=params, observations=obs, n_samples=50)
print(report.sensitivity_ranking)     # parameter sensitivity indices
print(report.identifiability_issues)  # correlated or insensitive parameters
print(report.data_conflicts)          # gauge/SAR conflicts
```

---

## Basin network

```python
from pywmp.calibrate_ai import BasinNetwork, NetworkNode, NetworkEdge, muskingum_route

net = BasinNetwork()
net.add_node(NetworkNode("B1", area_mi2=2.5, cn=75))
net.add_node(NetworkNode("B2", area_mi2=1.8, cn=80))
net.add_edge(NetworkEdge(upstream="B1", downstream="Outlet",
                          K_hr=0.8, x=0.2))
net.add_edge(NetworkEdge(upstream="B2", downstream="Outlet",
                          K_hr=0.5, x=0.2))

routed = muskingum_route(net, inflow_dict, dt_hr=0.5)
```

---

## Regionalization

```python
from pywmp.calibrate_ai import (
    BasinFeatureExtractor, ParameterDatabase,
    RegionalizationModel, RegionalizationPrediction,
)

# Extract spatial features from a delineated watershed
extractor = BasinFeatureExtractor(
    dem_path="data/dem.tif",
    nlcd_path="data/nlcd.tif",
    ssurgo_path="data/ssurgo.gpkg",
    nhd_path="data/nhd.gpkg",
)
features = extractor.extract(watershed_polygon)

# Load national gauge database and train / load model
db    = ParameterDatabase.from_usgs_national()
model = RegionalizationModel(db)
model.fit()

# Predict parameters for ungauged watershed
pred: RegionalizationPrediction = model.predict(features)
print(pred.cn, pred.lag_hr, pred.confidence_interval("cn"))
```

---

## Methods summary

| Method | Backend | Best for |
|--------|---------|---------|
| `surrogate_gp` | Gaussian Process + MCMC | ROM calibration; expensive forward model |
| `particle_filter` | Sequential Monte Carlo | SAR spatial calibration; non-Gaussian posteriors |
| `enkf` | Ensemble Kalman Filter | Joint gauge + SAR assimilation; large parameter spaces |
