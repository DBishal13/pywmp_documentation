# Sediment Module Reference

`pywmp.sediment` implements rainfall-driven erosion, overland transport, bedload
transport, and cohesive sediment dynamics coupled to the 2D shallow-water solver.
All classes operate on the same structured grid as `ROMSimulation`.

---

## SedimentParameters

```python
class SedimentParameters(K, C, D50_mm, P=1.0, shape='square')
```

Stores the soil and sediment properties shared across transport sub-models.

| Parameter | Type | Units | Description |
|-----------|------|-------|-------------|
| `K` | float or ndarray | US customary | Soil erodibility factor (Wischmeier & Smith, 1978; Renard et al., 1997) |
| `C` | float or ndarray | dimensionless | Cover-management factor (Renard et al., 1997) |
| `D50_mm` | float | mm | Median grain diameter; governs Shields parameter and settling velocity |
| `P` | float or ndarray | dimensionless | Support-practice factor; default 1.0 (no conservation practice) |
| `shape` | str | — | Grid cell shape: `'square'` or `'hex'` |

**Settling velocity** is computed internally via the Ferguson-Church (2004) universal
equation, which performs well across the silt-to-gravel range (0.001–100 mm) without
requiring a separate regime selection.

---

## RUSLEErosion

```python
class RUSLEErosion(params, R, LS, grid)
```

Computes gross erosion from the Revised Universal Soil Loss Equation (RUSLE;
Renard et al., 1997):

```
A = R × K × LS × C × P
```

where R is the rainfall erosivity factor (MJ mm ha⁻¹ hr⁻¹ yr⁻¹). Event-scale R
values can be derived from NOAA Atlas 14 IDF data (Perica et al., 2013) using the
EI₃₀ approximation. K is set via `SedimentParameters`. The LS factor combines the
slope-length factor L and slope steepness factor S.

### LS factor computation

Two LS methods are available:

- **Moore-Burch** (`ls_method='moore_burch'`, default) — unit stream power approach
  using local slope and upstream contributing area (Moore & Burch, 1986):
  ```
  LS = (A_s / 22.13)^0.4 × (sin θ / 0.0896)^1.3
  ```
- **Desmet-Govers** (`ls_method='desmet_govers'`) — GIS-compatible formulation
  that accounts for flow divergence and convergence (Desmet & Govers, 1996).

For site-scale applications (watershed area < 20 km²), Moore-Burch is recommended;
Desmet-Govers is preferred for complex topography with converging hillslopes.

### Methods

```python
RUSLEErosion.compute() -> ndarray   # gross erosion rate (ton/ha/hr)
RUSLEErosion.annual()   -> ndarray  # annualised (ton/ha/yr) from event total
```

---

## SuspendedSedimentTransport

```python
class SuspendedSedimentTransport(params, grid, erosion=None, bedload=None)
```

Advects depth-averaged suspended sediment concentration (SSC) using a first-order
upwind scheme driven by the 2D ROM velocity field (Fischer et al., 1979).

### Governing equation

```
∂(hC)/∂t + ∂(uhC)/∂x + ∂(vhC)/∂y = E − D
```

where `E` = RUSLE erosion source (kg m⁻² s⁻¹), `D` = settling sink = w_s × C (h > 0).
Settling velocity w_s is computed from D50 via Ferguson and Church (2004).

### Methods

```python
SuspendedSedimentTransport.step(h, u, v, dt) -> ndarray   # concentration field
SuspendedSedimentTransport.total_load_kg()   -> float
SuspendedSedimentTransport.deposition_map()  -> ndarray
```

---

## BedloadTransport

```python
class BedloadTransport(params, Sx, Sy, dx, theta_cr=0.0495, use_wong_parker=True)
```

Computes volumetric bedload flux per unit width using the Wong-Parker (2006)
correction of the Meyer-Peter and Müller (1948) formula:

```
q_b* = 3.97 (τ* − τ*_cr)^1.5    [Wong-Parker, 2006]
```

The original Meyer-Peter and Müller (1948) formula used τ*_cr = 0.047 and a
coefficient of 8.0; Wong and Parker (2006) re-analysed MPM's original dataset
and corrected the coefficient to 3.97 and τ*_cr = 0.0495.

The dimensionless Shields stress τ* is computed from the local boundary shear stress
and the grain properties (Shields, 1936):

```
τ* = τ_b / [(ρ_s − ρ) g D50]
```

| Parameter | Description |
|-----------|-------------|
| `params` | `SedimentParameters` instance |
| `Sx, Sy` | Bed slope arrays (dimensionless) |
| `dx` | Grid resolution (m) |
| `theta_cr` | Critical Shields parameter; default 0.0495 (Wong-Parker) |
| `use_wong_parker` | If `False`, use original MPM (1948) with coeff=8.0, theta_cr=0.047 |

### Methods

```python
BedloadTransport.flux(h, u, v) -> tuple[ndarray, ndarray]   # (qbx, qby) m²/s
BedloadTransport.magnitude()   -> ndarray
```

---

## KronePartheniades

```python
class KronePartheniades(tau_cd, tau_ce, M, w_s=None)
```

Implements the Krone (1962) deposition and Partheniades (1965) erosion framework
for cohesive (fine-grained) sediment. The bed shear stress is compared to critical
thresholds to determine net flux:

**Deposition** (Krone, 1962):
```
D = w_s × C × (1 − τ_b / τ_cd)    when τ_b < τ_cd
```

**Erosion** (Partheniades, 1965):
```
E = M × (τ_b / τ_ce − 1)           when τ_b > τ_ce
```

where M is the erosion rate constant (kg m⁻² s⁻¹).

| Parameter | Description |
|-----------|-------------|
| `tau_cd` | Critical deposition shear stress (Pa) |
| `tau_ce` | Critical erosion shear stress (Pa) |
| `M` | Partheniades erosion constant (kg m⁻² s⁻¹) |
| `w_s` | Settling velocity (m/s); if `None`, computed from D50 via Ferguson-Church (2004) |

### Typical parameters for cohesive sediment types

The following values are representative starting points (Krishnappan & Droppo, 2011):

| Sediment type | τ_ce (Pa) | M (kg/m²/s/Pa) | ws (m/s) |
|---|---|---|---|
| Loose fine silt | 0.02–0.05 | 1e-4 | 2–5e-4 |
| Consolidated clay | 0.10–0.50 | 5e-5 | 0.5–2e-4 |
| Flocculated | 0.05–0.15 | 1e-4 | 1e-3 |

### Methods

```python
KronePartheniades.net_flux(h, u, v, C) -> ndarray   # deposition(+) or erosion(-) kg/m²/s
KronePartheniades.step(h, u, v, C, dt) -> ndarray   # updated concentration
```

---

## MorphodynamicsModel

```python
class MorphodynamicsModel(grid, bedload_transport, dt_morph=1.0)
```

Updates the DEM bed elevation from bedload flux divergence:

```
∂z/∂t = −(1 / (1 − λ)) × (∂q_bx/∂x + ∂q_by/∂y)
```

where λ is the bed porosity (default 0.4) and q_bx, q_by are the horizontal
bedload flux components from `BedloadTransport.flux()`. This formulation follows
the Exner equation as applied by Toro (2001).

| Parameter | Description |
|-----------|-------------|
| `dt_morph` | Morphological acceleration factor (1 = real time; 10 = 10× bed evolution) |

### Methods

```python
MorphodynamicsModel.update(qbx, qby) -> ndarray   # delta-z (m) per time step
MorphodynamicsModel.cumulative_z()   -> ndarray   # total bed change (m)
```

---

## SedimentResults

Returned by coupled `ROMSimulation(..., sediment=...)` runs.

```python
@dataclass
class SedimentResults:
    ssc_final:        ndarray   # final suspended concentration (kg/m³)
    bedload_total:    ndarray   # cumulative bedload flux magnitude (m²)
    deposition:       ndarray   # total deposition depth (mm)
    erosion:          ndarray   # total erosion depth (mm)
    bed_elevation:    ndarray   # final DEM after morphodynamics (m)
    total_load_kg:    float     # total suspended load exported (kg)
```

---

## Usage example

```python
import numpy as np
from pywmp.sediment import (
    SedimentParameters, BedloadTransport,
    KronePartheniades, SuspendedSedimentTransport, SedimentResults,
)
from pywmp.rom import ROMGrid, ROMSimulation, ManningField, UniformPrecipitation

grid = ROMGrid.from_tif("data/dem_10m.tif")
params = SedimentParameters(K=0.28, C=0.12, D50_mm=0.08, P=0.8)

bedload = BedloadTransport(
    params, Sx=grid.slope_x, Sy=grid.slope_y, dx=grid.dx,
    theta_cr=0.0495, use_wong_parker=True,         # Wong-Parker (2006)
)
cohesive = KronePartheniades(
    tau_cd=0.07, tau_ce=0.15, M=2e-4,             # Krone (1962); Partheniades (1965)
)

sim = ROMSimulation(
    grid=grid,
    precipitation=UniformPrecipitation(...),
    manning=ManningField(np.full(grid.shape, 0.06)),
    sediment={"params": params, "bedload": bedload, "cohesive": cohesive},
)
results, sed_results = sim.run()
print(f"Total load exported: {sed_results.total_load_kg:.1f} kg")
```

---

## References

Desmet, P. J. J., & Govers, G. (1996). A GIS procedure for automatically
  calculating the USLE LS factor on topographically complex landscape units.
  *Journal of Soil and Water Conservation*, *51*(5), 427–433.
  [JSWC ↗](https://www.jswconline.org/content/51/5/427)

Ferguson, R. I., & Church, M. (2004). A simple universal equation for grain
  settling velocity. *Journal of Sedimentary Research*, *74*(6), 933–937.
  [DOI ↗](https://doi.org/10.1306/051204740933)

Fischer, H. B., List, E. J., Koh, R. C. Y., Imberger, J., & Brooks, N. H. (1979).
  *Mixing in inland and coastal waters*. Academic Press.
  [Publisher ↗](https://www.elsevier.com/books/mixing-in-inland-and-coastal-waters/fischer/978-0-12-258150-6)

Krishnappan, B. G., & Droppo, I. G. (2011). Some aspects of physical and chemical
  characteristics of fine sediments in the Athabasca River watershed. *Journal of
  Soils and Sediments*, *11*(7), 1293–1307.
  [DOI ↗](https://doi.org/10.1007/s11368-011-0394-3)

Krone, R. B. (1962). *Flume studies of the transport of sediment in estuarial
  shoaling processes: Final report*. University of California, Berkeley.
  [DTIC ↗](https://apps.dtic.mil/sti/citations/AD0293875)

Meyer-Peter, E., & Müller, R. (1948). Formulas for bed-load transport. In
  *Proceedings of the 2nd Meeting of the International Association for Hydraulic
  Structures Research* (pp. 39–64). IAHR.
  [TU Delft ↗](https://repository.tudelft.nl/record/uuid:4fda9b61-be28-4703-ab06-43cdc2a21bd7)

Moore, I. D., & Burch, G. J. (1986). Physical basis of the length-slope factor in
  the Universal Soil Loss Equation. *Soil Science Society of America Journal*,
  *50*(5), 1294–1298.
  [DOI ↗](https://doi.org/10.2136/sssaj1986.03615995005000050042x)

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


Toro, E. F. (2001). *Shock-capturing methods for free-surface shallow flows*. Wiley.
  [Publisher ↗](https://www.wiley.com/en-us/9780471987666)

Wischmeier, W. H., & Smith, D. D. (1978). *Predicting rainfall erosion losses: A
  guide to conservation planning* (Agriculture Handbook No. 537). U.S. Department
  of Agriculture.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=90921)

Wong, M., & Parker, G. (2006). Reanalysis and correction of bed-load relation of
  Meyer-Peter and Müller using their own database. *Journal of Hydraulic Engineering*,
  *132*(11), 1159–1168.
  [DOI ↗](https://doi.org/10.1061/(ASCE)0733-9429(2006)132:11(1159))
