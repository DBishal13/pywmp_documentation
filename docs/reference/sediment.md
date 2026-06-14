# Sediment Reference

`pywmp.sediment` provides physics-based sediment transport models that can be coupled to any PyWMP 2D simulation. It covers bedload, cohesive (fine-grained) sediment, advection-dispersion, erosion, settling, and morphodynamic bed evolution.

## Quick start

```python
import numpy as np
from pywmp.sediment import BedloadTransport, CohesiveSediment, MorphodynamicBed

shape = (100, 80)   # grid dimensions (ny, nx)
dx    = 10.0        # cell size (m)
dt    = 60.0        # timestep (s)

# --- Bedload transport (non-cohesive sand) ---
bedload = BedloadTransport(
    d50_mm   = 0.35,    # median grain diameter
    rho_s    = 2650.0,  # sediment density (kg/m³)
    formula  = "mpm",   # Meyer-Peter & Müller (default)
)

# --- Cohesive sediment (fine-grained) ---
cohesive = CohesiveSediment(
    tau_ce    = 0.05,   # critical erosion shear stress (Pa)
    M_e       = 1e-4,   # erosion rate parameter (kg/m²/s/Pa)
    ws        = 2e-4,   # settling velocity (m/s)
    tau_cd    = 0.02,   # critical deposition shear stress (Pa)
)

# --- Simulation loop (called once per hydraulic timestep) ---
for step in range(n_steps):
    h  = get_depth(step)    # water depth (m)
    u  = get_u(step)        # x-velocity (m/s)
    v  = get_v(step)        # y-velocity (m/s)

    qbx, qby = bedload.flux(h, u, v)           # bedload flux (m³/s/m)
    E, D     = cohesive.exchange(h, u, v)       # erosion and deposition rates (kg/m²/s)
```

---

## Bedload transport

### `BedloadTransport`

```python
BedloadTransport(d50_mm, rho_s=2650.0, formula="mpm", porosity=0.4)
```

| Parameter | Description |
|---|---|
| `d50_mm` | Median grain diameter (mm) |
| `rho_s` | Sediment density (kg/m³; default 2650 for quartz) |
| `formula` | Transport formula (see table below) |
| `porosity` | Bed porosity (0–1; default 0.4) |

**Transport formulas:**

| `formula` | Name | Best for |
|---|---|---|
| `"mpm"` | Meyer-Peter & Müller (1948) | Gravel-bed rivers |
| `"engelund_hansen"` | Engelund & Hansen (1967) | Sand-bed rivers |
| `"van_rijn"` | van Rijn (1984) | Fine to medium sand |

**Method:**

```python
qbx, qby = bedload.flux(h, u, v)
# Returns x and y bedload flux arrays (m³/s/m)
```

---

## Cohesive sediment

### `CohesiveSediment`

```python
CohesiveSediment(tau_ce, M_e, ws, tau_cd, C_init=0.0)
```

| Parameter | Description |
|---|---|
| `tau_ce` | Critical erosion shear stress (Pa). Below this, no erosion. |
| `M_e` | Erosion rate coefficient (kg/m²/s/Pa) |
| `ws` | Settling velocity (m/s). Use Stokes law for d < 0.1 mm. |
| `tau_cd` | Critical deposition shear stress (Pa). Above this, no deposition. |

**Typical values (Krishnappan & Droppo 2011):**

| Sediment type | τ_ce (Pa) | M_e | ws (m/s) |
|---|---|---|---|
| Loose fine silt | 0.02–0.05 | 1e-4 | 2–5e-4 |
| Consolidated clay | 0.10–0.50 | 5e-5 | 0.5–2e-4 |
| Flocculated | 0.05–0.15 | 1e-4 | 1e-3 |

---

## Advection-dispersion transport

### `SedimentAdvection`

First-order explicit upwind advection for any scalar concentration field:

```python
from pywmp.sediment import SedimentAdvection

adv = SedimentAdvection(shape=(100, 80), dx=10.0)
C_new = adv.step(C, h, u, v, dt, source=E_dep)
```

---

## Morphodynamic bed evolution

### `MorphodynamicBed`

Updates the DEM elevation based on net bedload divergence and cohesive exchange:

```python
from pywmp.sediment import MorphodynamicBed

bed = MorphodynamicBed(dem, dx=10.0, porosity=0.4)

# After each timestep:
bed.update(qbx, qby, E_dep, dt)

# Access updated DEM:
updated_dem = bed.dem
```

Morphodynamic feedback is significant for long simulations (multi-day storm sequences or decadal analysis). For short design storms, morphodynamics is typically disabled.

---

## Settling velocity

```python
from pywmp.sediment import settling_velocity_stokes, settling_velocity_van_rijn

ws = settling_velocity_stokes(d_mm=0.05, T_celsius=20.0)
print(f"Stokes settling velocity: {ws*1000:.2f} mm/s")
```

---

## References

- Meyer-Peter & Müller (1948) — bedload formula
- Engelund & Hansen (1967) — total load formula  
- van Rijn (1984) — bedload + suspended load
- Partheniades (1965) — cohesive erosion law
- Krone (1962) — cohesive deposition law
