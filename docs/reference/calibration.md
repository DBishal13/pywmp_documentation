# Calibration Reference

`pywmp.calibration` provides a universal parameter calibration framework that works with any PyWMP simulation module. You wrap your simulation as a Python callable, declare parameter bounds, choose an objective function and algorithm, and the engine finds the optimal parameter set.

## Installation

```bash
pip install pywmp   # no extra needed — calibration uses scipy
```

---

## Quick start

```python
from pywmp.calibration import CalibrationEngine, ParameterSet
from pywmp.workflow.design_storm import DesignStormSimulation
import numpy as np

# --- Define your model function ---
def run_model(p):
    sim = DesignStormSimulation(
        storm_type="SCS_II",
        total_depth_in=8.5,
        duration_hr=24,
        dt_hr=0.1,
    )
    sim.add_subbasin(
        name="A",
        area_mi2=3.2,
        loss_method="SCS_CN",
        loss_params={"CN": p["cn"], "ia_ratio": 0.2, "amc": 2},
        transform_method="Clark",
        transform_params={"Tc": p["tc"], "R": p["R"]},
    )
    results = sim.run()
    return results.outflows["A"].values   # numpy array

# --- Declare parameters: (name, lo, hi, initial) ---
params = ParameterSet([
    ("cn",  55.0, 90.0, 75.0),   # SCS Curve Number
    ("tc",   0.5,  4.0,  2.0),   # Time of concentration (hr)
    ("R",    0.5,  4.0,  1.5),   # Clark storage coefficient (hr)
])

# --- Observed hydrograph (from gauge) ---
observed = np.loadtxt("data/observed_q.csv", delimiter=",")

# --- Run calibration ---
engine = CalibrationEngine(
    model_fn  = run_model,
    observed  = observed,
    params    = params,
    objective = "nse",
)
results = engine.run_differential_evolution(maxiter=100)
print(results.summary())
```

Expected output:
```
========================================================
  PyWMP Calibration Results
========================================================
  Algorithm     : differential_evolution
  Objective     : nse (maximize)
  Evaluations   : 1847
  Converged     : True
  Optimal NSE   : 0.923
  --------------------------------------------------------
  Parameter     : Optimal       Range
  cn            : 81.4          [55.0 – 90.0]
  tc            :  1.7          [0.5  –  4.0]
  R             :  2.1          [0.5  –  4.0]
========================================================
```

---

## `ParameterSet`

```python
ParameterSet(bounds: list[tuple[str, float, float, float]])
```

Each entry is `(name, lower_bound, upper_bound, initial_value)`.

```python
from pywmp.calibration import ParameterSet

params = ParameterSet([
    ("CN",        55.0,  90.0, 75.0),
    ("manning_n",  0.01,  0.15, 0.035),
    ("lag_hr",     0.3,   3.0,  1.0),
])
```

The `ParameterSet` is passed to `CalibrationEngine` and controls which values are varied during optimization. Access results as a dict: `p["CN"]`, `p["manning_n"]`.

---

## `ParameterBound`

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

```python
from pywmp.calibration import ParameterBound

# Example: hydraulic conductivity spans orders of magnitude — use log scale
ParameterBound("Ks", lo=1e-6, hi=1e-2, initial=1e-4, log_scale=True)
```

---

## `CalibrationEngine`

```python
CalibrationEngine(model_fn, observed, params, objective="nse", dt=None)
```

| Parameter | Type | Description |
|---|---|---|
| `model_fn` | `callable` | A function `f(p: dict) → np.ndarray` that runs the simulation and returns the simulated hydrograph |
| `observed` | `np.ndarray` | Observed streamflow time series (same length as model output) |
| `params` | `ParameterSet` | Parameter bounds and initial values |
| `objective` | `str \| callable` | Objective function (see table below) |
| `dt` | `float \| None` | Timestep for time-alignment checks (hours) |

### Objective functions

| Name | Full name | Direction | Notes |
|---|---|---|---|
| `"nse"` | Nash-Sutcliffe Efficiency | Maximize | Range (−∞, 1]; ≥0.65 = satisfactory |
| `"kge"` | Kling-Gupta Efficiency | Maximize | Range (−∞, 1]; ≥0.65 = satisfactory |
| `"nse_log"` | Log-NSE | Maximize | Emphasizes low flows; useful for baseflow |
| `"pbias"` | −\|Percent Bias\| | Maximize (less bias = higher) | ±10% = very good |
| `"rmse"` | Root Mean Square Error | Minimize | Units match observed |
| `"peak_flow"` | Peak flow error (%) | Minimize | Good for flood design |
| `"volume"` | Volume error (%) | Minimize | Good for water balance |

**Custom objective:**
```python
def my_obj(simulated, observed):
    # return a scalar — engine maximizes by default
    peak_err = abs(simulated.max() - observed.max()) / observed.max()
    vol_err  = abs(simulated.sum() - observed.sum()) / observed.sum()
    return -(0.7 * peak_err + 0.3 * vol_err)   # negative = minimize

engine = CalibrationEngine(model_fn, observed, params, objective=my_obj)
```

### `.run_differential_evolution(**kwargs)`

Global search using differential evolution (Storn & Price, 1997). Recommended as
the default for any problem with more than 3 parameters or a multi-modal response
surface.

```python
results = engine.run_differential_evolution(maxiter=200, popsize=15)
```

### `.run(algorithm, **kwargs)`

Generic entry-point supporting multiple algorithms:

| Algorithm | Best for | Speed | `kwargs` |
|---|---|---|---|
| `"differential_evolution"` | Any problem; most robust (default) | Slow | `maxiter`, `popsize`, `tol` |
| `"sce_ua"` | Classic hydrology calibration; 3–15 parameters | Medium | `maxiter`, `n_complexes` |
| `"nelder_mead"` | Smooth 2–4 param surfaces | Fast | `maxiter`, `xatol`, `fatol` |
| `"dual_annealing"` | Multi-modal, many parameters | Medium | `maxiter`, `initial_temp` |
| `"lhs"` | Space-filling sensitivity survey | Very fast | `n_samples` |
| `"grid"` | Exhaustive sweep (≤3 params only) | Variable | `n_steps` |

```python
results = engine.run("differential_evolution", maxiter=200, popsize=15)
results = engine.run("sce_ua", maxiter=500, n_complexes=5)   # Duan et al. (1992)
results = engine.run("lhs", n_samples=500)                   # fast parameter space survey
```

### `.run_parallel(n_workers=4, **kwargs)`

Parallel variant of differential evolution that distributes model evaluations across
multiple CPU workers. Useful when each model evaluation is expensive (>1 s).

```python
results = engine.run_parallel(n_workers=8, maxiter=200, popsize=15)
```

---

## `CalibrationResults`

| Attribute | Description |
|---|---|
| `.optimal_params` | `dict[str, float]` — best parameter values found |
| `.optimal_value` | Objective function value at the optimum |
| `.n_evaluations` | Total number of model function calls |
| `.algorithm` | Algorithm used |
| `.converged` | Whether the algorithm reported convergence |
| `.history` | List of `CalibrationRecord` (one per evaluation) |

### Methods

| Method | Description |
|---|---|
| `.summary()` | Print parameter table + objective value |
| `.plot_convergence(path)` | Objective value vs. evaluation number |
| `.plot_dotty_plots(path)` | Parameter sensitivity scatter plots |
| `.to_csv(path)` | Save full evaluation history to CSV |
| `.to_json(path)` | Save results to JSON |

```python
# After calibration: extract and apply optimal parameters
best = results.optimal_params
print(f"Best CN={best['cn']:.1f}, Tc={best['tc']:.2f} hr, R={best['R']:.2f} hr")
print(f"NSE = {results.optimal_value:.3f}")

results.plot_convergence("output/convergence.png")
results.plot_dotty_plots("output/dotty_plots.png")
results.to_csv("output/calibration_history.csv")
```

---

## Sensitivity analysis

Use Latin Hypercube Sampling (`"lhs"`) for a fast parameter sensitivity survey before running a full optimization:

```python
# Step 1: LHS survey (fast — just samples the space)
survey = engine.run("lhs", n_samples=300)
survey.plot_dotty_plots("output/sensitivity_survey.png")

# Step 2: Focused optimization using survey results to set tighter bounds
focused_params = ParameterSet([
    ("cn",  70.0, 88.0, survey.optimal_params["cn"]),
    ("tc",   1.0,  3.0, survey.optimal_params["tc"]),
    ("R",    1.0,  3.0, survey.optimal_params["R"]),
])
engine2 = CalibrationEngine(run_model, observed, focused_params, objective="nse")
final = engine2.run_differential_evolution(maxiter=200)
print(final.summary())
```

---

## Validation after calibration

After calibration, always validate on a separate storm event:

```python
from pywmp.validation import ModelVsObserved

# Re-run model with optimal parameters on a validation event
best = results.optimal_params
val_sim = run_model_on_validation_event(best)

validator = ModelVsObserved(
    simulated=val_sim,
    observed=validation_observed,
    dt=0.1,
    label="Calibration validation — Feb 2024 storm",
)
print(validator.metrics().summary())
validator.plot("output/validation_plot.png")
```

See [Validation Reference](validation.md) for full details.

---

## Tips for good calibration

**Parameter identifiability:** The more parameters you calibrate simultaneously, the harder it is to find a unique solution. Start with 2–3 most sensitive parameters (usually CN/Ks, Tc or lag, and routing K).

**Objective function selection:** NSE emphasizes high flows (peaks); log-NSE emphasizes low flows (recession). For flood design, use `"nse"` or `"peak_flow"`. For water balance, use `"pbias"` or `"volume"`.

**Avoid over-fitting:** A high NSE on the calibration storm but poor performance on the validation storm means over-fitting. Use at least 2 calibration storms and validate on 1–2 independent events.

**Performance ratings (Moriasi et al. 2007):**

| Rating | NSE | \|PBIAS\| |
|---|---|---|
| Very good | ≥ 0.75 | < 10% |
| Good | 0.65–0.75 | 10–15% |
| Satisfactory | 0.50–0.65 | 15–25% |
| Unsatisfactory | < 0.50 | > 25% |
