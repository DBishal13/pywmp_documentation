# Sediment and Water Quality Tutorial

This tutorial demonstrates a coupled 2D ROM + sediment transport + water quality
simulation. It continues from the flood simulation in the full pipeline tutorial.

---

## Overview

PyWMP couples the sediment and water quality modules to the HLL shallow-water solver
(Harten et al., 1983) by sharing the same depth and velocity fields. Sediment transport
is solved on the same grid and time step as the hydrodynamic simulation.

---

## Step 1 — Set up sediment parameters

```python
from pywmp.sediment import (
    SedimentParameters, BedloadTransport,
    KronePartheniades, SuspendedSedimentTransport,
)

# RUSLE parameters (Renard et al., 1997)
# K = soil erodibility from SSURGO (Wischmeier & Smith, 1978)
# C = cover-management factor from NLCD (Homer et al., 2020)
params = SedimentParameters(
    K=0.28,       # silt-loam (SSURGO kffact)
    C=0.12,       # low-density residential + grass (NLCD class 21)
    D50_mm=0.05,  # fine silt (SSURGO sand/silt/clay texture)
    P=0.80,       # partial grass swale practice
)
```

RUSLE K-values should be read from SSURGO `kffact` attribute via `download_soils()`.
RUSLE C-factors are indexed to NLCD class using the built-in lookup table (Homer et al.,
2020; Renard et al., 1997).

---

## Step 2 — Configure transport models

```python
import numpy as np
from pywmp.rom import ROMGrid

grid = ROMGrid.from_tif("data/dem/dem_10m.tif")

# Bedload: Wong-Parker (2006) correction of Meyer-Peter & Müller (1948)
bedload = BedloadTransport(
    params,
    Sx=grid.dzdx,              # slope arrays from ROMGrid (dz/dx, dz/dy)
    Sy=grid.dzdy,
    dx=grid.cell_size,
    theta_cr=0.0495,          # corrected critical Shields parameter (Wong & Parker, 2006)
    use_wong_parker=True,
)

# Cohesive fine sediment: Krone (1962) deposition + Partheniades (1965) erosion
cohesive = KronePartheniades(
    tau_cd=0.07,    # critical deposition shear stress (Pa)
    tau_ce=0.15,    # critical erosion shear stress (Pa); Partheniades (1965)
    M=2.0e-4,       # erosion rate constant (kg/m²/s); Krone (1962)
)
```

The default critical Shields parameter τ*_cr = 0.0495 follows the reanalysis of
Wong and Parker (2006), which corrects the original value of 0.047 used by
Meyer-Peter and Müller (1948). For gravel-bed channels, τ*_cr may be higher
(0.06–0.08; Shields, 1936).

---

## Step 3 — Run coupled simulation

```python
from pywmp.rom import (
    ROMSimulation, ManningField, UniformPrecipitation,
    DeficitConstantInfiltration, NormalDepthOutlet,
)

# Load pre-computed rain time series (NOAA Atlas 14; Perica et al., 2013)
rain = load_rain_ts("data/atlas14/rain_100yr_24hr_scsII.csv")

sim = ROMSimulation(
    grid=grid,
    precipitation=UniformPrecipitation(rain, grid_shape=grid.shape, units="USC"),
    infiltration=DeficitConstantInfiltration(1.5, 0.10, units="USC",
                                              grid_shape=grid.shape),
    manning=ManningField(np.full(grid.shape, 0.06)),
    boundary_conditions=[NormalDepthOutlet(edge="south")],
    duration_hr=24.0,
    backend="auto",
    sediment=SuspendedSedimentTransport(
        params=params,
        grid=grid,
        bedload=bedload,
    ),
)

results = sim.run()
sed_results = results.sediment     # SedimentResults; None if no sediment attached
print(f"Total suspended load exported: {sed_results.total_load_kg:.1f} kg")
print(f"Peak deposition:               {sed_results.deposition.max()*1000:.1f} mm")
```

The suspended sediment advection uses a first-order upwind scheme (Fischer et al.,
1979) with RUSLE gross erosion (Renard et al., 1997) as the source and particle
settling (Ferguson & Church, 2004) as the sink.

---

## Step 4 — Water quality (total phosphorus)

```python
from pywmp.wq import TPModel, EMC_TP_BY_NLCD

# Load NLCD raster for spatially variable EMC-TP loading
# EMC approach: Driver & Tasker (1990); U.S. Environmental Protection Agency (1983)
nlcd = load_array("data/nlcd/nlcd_2021_10m.tif")
emc_tp = np.vectorize(EMC_TP_BY_NLCD.get)(nlcd, 0.3)   # mg/L per NLCD class

tp_model = TPModel(
    shape=grid.shape,
    dx=grid.cell_size,
    emc_tp_mg_L=emc_tp,     # Driver & Tasker (1990); USEPA NURP (1983)
    k_settle=3e-5,           # settling rate (m/s) — total phosphorus
    D=0.1,                   # diffusivity (m²/s; Fischer et al., 1979)
    Kp=100.0,                # L/kg — P partitioning coefficient
)

# TPModel is stepped at each ROM time step via .advance(dt, h, qx, qy, precip_rate)
# or driven from snapshots for post-processing:
import numpy as np
for t_idx in range(results.h_snapshots.shape[0]):
    h_snap = np.array(results.h_snapshots[t_idx])
    C_tp = tp_model.advance(dt=results.output_interval_hr * 3600,
                             h=h_snap, qx=np.zeros_like(h_snap),
                             qy=np.zeros_like(h_snap),
                             precip_rate=np.zeros_like(h_snap))

peak_tp = float(C_tp[np.isfinite(C_tp)].max())
print(f"Peak TP concentration: {peak_tp:.2f} mg/L")
```

The EMC-TP (Event Mean Concentration) approach loads total phosphorus proportional
to runoff volume by land use class, consistent with the Nationwide Urban Runoff
Program methodology (U.S. Environmental Protection Agency, 1983) and the regression
equations of Driver and Tasker (1990). Longitudinal and transverse mixing follows
Fischer et al. (1979).

---

## Step 5 — Export results

```python
import rasterio
from rasterio.transform import from_bounds

# Save sediment deposition map
with rasterio.open("outputs/sediment/deposition_100yr.tif", "w",
                   driver="GTiff", height=grid.nrows, width=grid.ncols,
                   count=1, dtype="float32", crs="EPSG:2881",
                   transform=grid.transform) as dst:
    dst.write(sed_results.deposition.astype("float32"), 1)

# Save TP peak concentration map
with rasterio.open("outputs/wq/tp_peak_100yr.tif", "w",
                   driver="GTiff", height=grid.nrows, width=grid.ncols,
                   count=1, dtype="float32", crs="EPSG:2881",
                   transform=grid.transform) as dst:
    dst.write(tp_results.peak_concentration.astype("float32"), 1)
```

---

## References

Driver, N. E., & Tasker, G. D. (1990). *Techniques for estimation of storm-runoff
  loads, volumes, and selected constituent concentrations in urban watersheds in
  the United States* (Water-Supply Paper 2363). U.S. Geological Survey.
  [PDF ↗](https://pubs.usgs.gov/wsp/2363/report.pdf)

Ferguson, R. I., & Church, M. (2004). A simple universal equation for grain settling
  velocity. *Journal of Sedimentary Research*, *74*(6), 933–937.
  [DOI ↗](https://doi.org/10.1306/051204740933)

Fischer, H. B., List, E. J., Koh, R. C. Y., Imberger, J., & Brooks, N. H. (1979).
  *Mixing in inland and coastal waters*. Academic Press.
  [Publisher ↗](https://www.elsevier.com/books/mixing-in-inland-and-coastal-waters/fischer/978-0-12-258150-6)

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

Krone, R. B. (1962). *Flume studies of the transport of sediment in estuarial
  shoaling processes: Final report*. University of California, Berkeley.
  [DTIC ↗](https://apps.dtic.mil/sti/citations/AD0293875)

Meyer-Peter, E., & Müller, R. (1948). Formulas for bed-load transport. In
  *Proceedings of the 2nd Meeting of the International Association for Hydraulic
  Structures Research* (pp. 39–64). IAHR.
  [TU Delft ↗](https://repository.tudelft.nl/record/uuid:4fda9b61-be28-4703-ab06-43cdc2a21bd7)

Partheniades, E. (1965). Erosion and deposition of cohesive soils. *Journal of the
  Hydraulics Division*, *91*(1), 105–139.
  [DOI ↗](https://doi.org/10.1061/JYCEAJ.0001197)

Perica, S., Pavlovic, S., St. Laurent, M., Trypaluk, C., Unruh, D., Martin, D., &
  Wilhite, O. (2013). *NOAA Atlas 14: Precipitation-frequency atlas of the United
  States, Volume 9: Southeastern States, Version 3* (NOAA Atlas 14, Vol. 9). NOAA.
  [DOI ↗](https://doi.org/10.25923/xnb4-5613)

Renard, K. G., Foster, G. R., Weesies, G. A., McCool, D. K., & Yoder, D. C. (1997).
  *Predicting soil erosion by water: A guide to conservation planning with the Revised
  Universal Soil Loss Equation (RUSLE)* (Agriculture Handbook No. 703). U.S.
  Department of Agriculture.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=16945)


U.S. Environmental Protection Agency. (1983). *Results of the nationwide urban
  runoff program: Final report* (USEPA 400/3-83-16). USEPA.
  [EPA ↗](https://www.epa.gov/npdes/urban-runoff-national-stormwater-program)

Wischmeier, W. H., & Smith, D. D. (1978). *Predicting rainfall erosion losses: A
  guide to conservation planning* (Agriculture Handbook No. 537). U.S. Department
  of Agriculture.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=90921)

Wong, M., & Parker, G. (2006). Reanalysis and correction of bed-load relation of
  Meyer-Peter and Müller using their own database. *Journal of Hydraulic Engineering*,
  *132*(11), 1159–1168.
  [DOI ↗](https://doi.org/10.1061/(ASCE)0733-9429(2006)132:11(1159))
