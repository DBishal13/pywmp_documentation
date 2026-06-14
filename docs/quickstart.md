# Quick Start

Install the dataset and spatial extras for the full experience:

```bash
pip install "pywmp[datasets]"
```

---

## 2D ROM flood simulation (30 lines)

```python
import numpy as np
import pandas as pd
from pywmp.rom.mesh import ROMGrid
from pywmp.rom.simulation import ROMSimulation
from pywmp.rom.manning import ManningField
from pywmp.rom.precipitation import UniformPrecipitation
from pywmp.rom.infiltration import DeficitConstantInfiltration
from pywmp.rom.boundary import NormalDepthOutlet
from pywmp.time_series import TimeSeries

grid = ROMGrid.from_tif("data/dem.tif")
manning = ManningField(np.full(grid.shape, 0.06, dtype=np.float32))
infilt = DeficitConstantInfiltration(1.5, 0.1, units="USC", grid_shape=grid.shape)

df = pd.read_csv("data/rain_100yr_24hr_scsII.csv")
rain_ts = TimeSeries(df["time_hr"].values, df["intensity_in_hr"].values, units="USC")
precip = UniformPrecipitation(rain_ts, grid_shape=grid.shape, units="USC")

sim = ROMSimulation(
    grid=grid, precipitation=precip, infiltration=infilt, manning=manning,
    boundary_conditions=[NormalDepthOutlet(edge="south")],
    duration_hr=24.0, output_interval_hr=1.0, backend="auto",
)
results = sim.run()
results.save_max_depth_tif("outputs/depth.tif")
print(f"Max depth: {results.max_depth:.2f} ft")
```

---

## 1D design storm simulation

```python
from pywmp.workflow.design_storm import DesignStormSimulation

sim = DesignStormSimulation(storm_type="SCS_II", total_depth_in=13.7,
                            duration_hr=24, dt_hr=0.1)
sim.add_subbasin("Sub1", area_mi2=2.5,
                 loss_method="SCS_CN", loss_params={"CN": 80},
                 transform_method="SCS", transform_params={"lag_hr": 1.2})
sim.add_reach("Sub1", "Outlet",
              method="Muskingum", params={"K_hr": 0.5, "x": 0.2, "steps": 3})
print(sim.run().summary())
```

---

## Download all watershed inputs

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(aoi=(-81.70, 27.85, -81.50, 27.95), output_dir="data/")
dm.download_all(lat=27.9, lon=-81.6)
print(dm.summary())
```

---

## Calibrate against a USGS gauge

```python
import numpy as np
from pywmp.calibration import CalibrationEngine, ParameterSet, ParameterBound
from pywmp.validation import download_streamflow

obs_df = download_streamflow("02298202", start="2020-09-01", end="2020-09-30")

def run_model(p):
    # build sim with p["CN"] ... return np.ndarray of simulated flow
    ...

ps = ParameterSet([ParameterBound("CN", lo=60.0, hi=98.0, initial=80.0)])
engine = CalibrationEngine(run_model, obs_df["q_cfs"].values, ps, objective="kge")
r = engine.run_differential_evolution(maxiter=200, popsize=12)
print(r.summary())
```

---

## Validate flood extent against FEMA NFHL

```python
from pywmp.validation import SpatialFloodValidation
import numpy as np

sv = SpatialFloodValidation(
    sim_depth=depth_array,   # from results.save_max_depth_tif
    ref_mask=fema_ae_mask,   # rasterised FEMA AE zone
    valid_mask=domain_mask,
    depth_threshold=0.1,
)
print(f"CSI {sv.csi:.3f}  Hit rate {sv.hit_rate:.3f}  FAR {sv.far:.3f}")
```

---

## Next steps

- [Full Pipeline Tutorial](tutorials/full_pipeline.md) — datasets through calibration
- [Sediment and WQ Tutorial](tutorials/sediment_wq.md)
- [Calibration and Validation Tutorial](tutorials/calibration_validation.md)
- [Module Reference](reference/modules.md)
