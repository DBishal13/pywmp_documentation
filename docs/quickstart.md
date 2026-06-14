# Quick Start

This quick start covers a complete PyWMP workflow from installation through simulation and API deployment.

## Overview

- install PyWMP with dataset and API extras
- download watershed inputs automatically
- construct a 1D hydrologic simulation
- connect a 1D model to a 2D ROM grid
- launch the optional REST API server

## Prerequisites

Install the full workflow package:

```bash
pip install "pywmp[datasets,api]"
```

If you only need dataset acquisition, install:

```bash
pip install "pywmp[datasets]"
```

## 1. Download watershed inputs

`DatasetManager` retrieves and caches the spatial inputs required for watershed modeling.

```python
from pywmp.datasets import DatasetManager

dm = DatasetManager(
    aoi=(-81.70, 27.85, -81.50, 27.95),
    output_dir="data/my_watershed/",
)

dm.download_all(lat=27.9, lon=-81.6)
print(dm.summary())
```

This step prepares:

- USGS 3DEP DEM
- watershed boundaries from USGS WBD
- NHD flowlines and catchments
- NLCD land cover and SSURGO soils
- curve number raster and watershed parameters
- NOAA Atlas 14 IDF values
- FEMA NFHL flood zone data

## 2. Build a 1D hydrologic model

Use the PyWMP workflow API to define subbasins, loss methods, transforms, and routing.

```python
from pywmp.workflow.design_storm import DesignStormSimulation

sim = DesignStormSimulation(
    storm_type="SCS_II",
    total_depth_in=5.0,
    duration_hr=24,
    dt_hr=0.1,
)

sim.add_subbasin(
    name="Upper",
    area_mi2=2.5,
    loss_method="SCS_CN",
    loss_params={"CN": 75},
    transform_method="SCS",
    transform_params={"lag_hr": 1.2},
)

sim.add_subbasin(
    name="Lower",
    area_mi2=1.8,
    loss_method="Green_Ampt",
    loss_params={"Ks": 0.13, "psi": 3.5, "theta_i": 0.20, "eta": 0.463},
    transform_method="Clark",
    transform_params={"Tc": 2.0, "R": 1.5},
)

sim.add_reach(
    "Upper",
    "Lower",
    method="Muskingum",
    params={"K_hr": 0.5, "x": 0.2, "steps": 3},
)

results = sim.run()
print(results.summary())
```

## 3. Add 2D ROM coupling

Connect the 1D model to a 2D ROM grid for floodplain response.

```python
from pywmp.hybrid.coupler import HybridSimulation

hybrid = HybridSimulation(
    upstream_model=sim,
    rom_grid="data/my_watershed/2d_grid.tif",
    boundary_spec="outlet",
)

hybrid_results = hybrid.run()
print(hybrid_results.summary())
```

## 4. Start the REST API server

Install the API extra if needed:

```bash
pip install "pywmp[api]"
```

Then launch the server:

```bash
python -m pywmp.api.app
```

Use the [REST API Tutorial](tutorials/rest_api.md) for endpoint examples and client integration.

## Practical guidance

- keep your 1D and 2D inputs in the same CRS
- choose DEM resolution to balance accuracy and runtime
- enable the `fast` extra for better performance when available

## Next steps

- [Full Pipeline Tutorial](tutorials/full_pipeline.md)
- [Dataset Download Tutorial](tutorials/dataset_download.md)
- [Hybrid Coupling Tutorial](tutorials/hybrid_coupling.md)
- [REST API Tutorial](tutorials/rest_api.md)
