# Water Quality Reference

`pywmp.wq` adds advection-dispersion transport of dissolved and particulate water quality constituents (TSS, TP, TN, and custom scalars) to any PyWMP 2D simulation.

## Physics

| Process | Method |
|---|---|
| Advection | First-order explicit upwind (delegates to `pywmp.sediment.advection`) |
| Dispersion | Fickian — explicit central difference (Elder 1959) |
| Precipitation loading | Event Mean Concentration (EMC) — EPA NSQD 2004 |
| Decay | First-order (settling, sorption, biological uptake) |

## Quick start

```python
import numpy as np
from pywmp.wq import TSSModel, TPModel, WQResults

shape = (100, 80)
dx    = 10.0   # cell size (m)
dt    = 60.0   # timestep (s)

# TSS model (Total Suspended Solids)
tss = TSSModel(
    shape        = shape,
    dx           = dx,
    D            = 0.5,            # dispersion coefficient (m²/s)
    init_conc_mg_L = 5.0,          # initial ambient concentration
)

# TP model (Total Phosphorus)
tp = TPModel(
    shape        = shape,
    dx           = dx,
    emc_tp_mg_L  = 0.40,           # event mean concentration for TP loading
)

# In the hydraulic time-stepping loop:
tss_results = WQResults("TSS", "mg/L", dx=dx)
tp_results  = WQResults("TP",  "mg/L", dx=dx)

for step in range(n_steps):
    h  = get_depth(step)
    qx = get_qx(step)
    qy = get_qy(step)
    Dr = get_erosion_rate(step)    # deposition rate from sediment module
    Df = get_deposition_rate(step)
    precip = get_precip_rate(step)  # m/s

    C_tss = tss.advance(dt, h, qx, qy, Dr, Df)
    C_tp  = tp.advance(dt, h, qx, qy, precip_rate=precip, tss_mg_L=C_tss)

    if step % 60 == 0:  # record every hour
        tss_results.record(C_tss, t_sec=step * dt)
        tp_results.record(C_tp,  t_sec=step * dt)

print(tss_results.summary())
print(tp_results.summary())
```

---

## `TSSModel`

```python
TSSModel(shape, dx, D=0.5, init_conc_mg_L=0.0, k_decay=0.0)
```

| Parameter | Description |
|---|---|
| `shape` | Grid dimensions `(ny, nx)` |
| `dx` | Cell size (m) |
| `D` | Fickian dispersion coefficient (m²/s). Typical: 0.1–2.0 for shallow urban flow |
| `init_conc_mg_L` | Initial TSS concentration (mg/L; background) |
| `k_decay` | First-order decay rate (1/s; 0 = conservative tracer) |

**Method:**

```python
C_new = tss.advance(dt, h, qx, qy, erosion_rate, deposition_rate)
```

Returns updated concentration array (mg/L).

---

## `TPModel`

```python
TPModel(shape, dx, emc_tp_mg_L=0.30, D=0.3, k_decay=1e-5)
```

| Parameter | Description |
|---|---|
| `emc_tp_mg_L` | Event Mean Concentration for TP in stormwater runoff (mg/L) |
| `k_decay` | First-order decay/uptake rate (1/s) |

**Typical EMC values (EPA NSQD 2004):**

| Land use | TP EMC (mg/L) | TSS EMC (mg/L) |
|---|---|---|
| Residential | 0.30–0.50 | 80–150 |
| Commercial | 0.40–0.70 | 100–200 |
| Industrial | 0.30–0.60 | 100–300 |
| Freeway/highway | 0.20–0.40 | 100–250 |
| Open/park | 0.05–0.20 | 20–80 |

**Method:**

```python
C_new = tp.advance(dt, h, qx, qy, precip_rate, tss_mg_L=C_tss)
```

TP transport includes a particulate-sorbed fraction (coupled to TSS) and a dissolved fraction.

---

## `WQResults`

```python
WQResults(constituent_name, units, dx)
```

Records spatial snapshots and computes summary statistics.

| Method | Description |
|---|---|
| `.record(C, t_sec)` | Store a concentration snapshot at time `t_sec` |
| `.summary()` | Print peak concentration, spatial mean, and mass balance |
| `.plot_snapshot(t_sec, path)` | Map of concentration at a given time |
| `.plot_time_series(row, col, path)` | Concentration vs. time at a grid cell |
| `.to_csv(path)` | Export snapshot table to CSV |

**Summary output:**
```
WQ Summary — TSS (mg/L)
-----------------------------------
Peak concentration : 145.3 mg/L
Domain mean        :  18.6 mg/L
Mass at t=6hr      :  4.2 kg
Mass at t=12hr     :  1.8 kg (decay)
```

---

## `EMC_TP_BY_NLCD`

Pre-built EMC lookup table for TP by NLCD land cover code:

```python
from pywmp.wq import EMC_TP_BY_NLCD

tp_emc = EMC_TP_BY_NLCD[23]   # NLCD code 23 = Developed, medium intensity
print(f"TP EMC for medium-density development: {tp_emc:.2f} mg/L")
```

---

## References

- Elder (1959) *J. Fluid Mech.* 5:544 — dispersion coefficient
- Fischer et al. (1979) *Mixing in Inland and Coastal Waters* — longitudinal dispersion
- Chapra (1997) *Surface Water Quality Modeling* — first-order decay
- EPA NSQD (2004) — event mean concentration database
