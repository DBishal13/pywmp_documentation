# Hybrid Coupling Tutorial

PyWMP supports one-way coupling from a 1D hydrologic network into a 2D floodplain model. This lets you combine the routing accuracy of HEC-HMS–style event modeling with the spatial detail of a rain-on-mesh 2D shallow-water solver.

## Why hybrid coupling?

| Approach | Strength | Limitation |
|---|---|---|
| 1D only | Fast, well-calibrated for gauged reaches | No floodplain spatial distribution |
| 2D only | Full spatial flood extent | No channel network; rain-on-mesh requires fine DEM conditioning |
| Hybrid | Channel hydrology from 1D + floodplain from 2D | One-way: 2D does not feed back to 1D |

Hybrid coupling is the right choice when you need both a reliable outlet hydrograph **and** a spatially accurate inundation map — for example, a FEMA hydraulic study or a stormwater master plan.

---

## Two coupling modes

PyWMP implements two distinct hybrid strategies. Choosing the wrong one for your use case is the most common mistake.

### Mode A — Outlet-to-inflow-BC (`HybridSimulation`)

**How it works:** The 1D network runs first. The outflow hydrograph from a designated reach element is then injected as a time-varying inflow boundary condition into the 2D domain at a specific grid location.

**Use when:**
- The watershed drains through a defined channel into a separate floodplain.
- You want the 1D network to handle all rainfall-runoff generation and routing.
- The 2D domain represents the receiving water body or floodplain downstream of the 1D outlet.

```
         Rainfall
            │
     ┌──────▼──────┐
     │  1D Network │  (SubbasinA → SubbasinB → Reach → outlet)
     └──────┬──────┘
            │  outflow hydrograph
            ▼
     ┌──────────────────┐
     │  2D ROM Domain   │  receives inflow at outlet cell
     │  (flood routing) │
     └──────────────────┘
```

### Mode B — Excess-precip distribution (`HybridExcessPrecipSimulation`)

**How it works:** The 1D network computes per-subbasin rainfall losses (excess precipitation). The excess rain from each subbasin is then spatially distributed onto the corresponding set of 2D grid cells through subbasin masks, and the 2D solver handles all the routing.

**Use when:**
- Rainfall-on-mesh modeling is needed — rain falls everywhere, not just at one inflow point.
- You have good NLCD/SSURGO data and want spatially distributed CN losses.
- The domain is a detention pond system or a flat coastal watershed where 1D channel routing is not meaningful.

```
         Rainfall
            │
     ┌──────▼──────┐
     │  1D Network │  computes excess precip per subbasin
     └──────┬──────┘
            │  per-subbasin excess (TimeSeries per subbasin)
            ▼
     ┌────────────────────────────────┐
     │  SubbasinMaskSpec              │
     │  (maps subbasins → grid cells) │
     └──────────────┬─────────────────┘
                    │  GriddedPrecipitation
                    ▼
     ┌──────────────────┐
     │  2D ROM Domain   │  routes spatially distributed excess
     └──────────────────┘
```

---

## Mode A walkthrough — `HybridSimulation`

### 1. Build the 1D model

```python
from pywmp.workflow.design_storm import DesignStormSimulation

sim = DesignStormSimulation(
    storm_type="SCS_II",
    total_depth_in=8.5,
    duration_hr=24,
    dt_hr=0.1,
)
sim.add_subbasin(
    name="Upper",
    area_mi2=3.2,
    loss_method="SCS_CN",
    loss_params={"CN": 75, "ia_ratio": 0.2, "amc": 2},
    transform_method="Clark",
    transform_params={"Tc": 2.0, "R": 1.6},
)
sim.add_subbasin(
    name="Lower",
    area_mi2=2.1,
    loss_method="SCS_CN",
    loss_params={"CN": 68, "ia_ratio": 0.2, "amc": 2},
    transform_method="SCS",
    transform_params={"lag_hr": 0.9},
)
sim.add_reach("Upper", "Lower", method="Muskingum",
              params={"K_hr": 0.6, "x": 0.2, "steps": 2})
```

### 2. Load the 2D grid

```python
from pywmp.rom import ROMGrid

grid = ROMGrid.from_tif("data/dem.tif", resolution_m=10)
```

### 3. Locate the outlet in grid coordinates

The outlet cell is where the 1D channel enters the 2D domain. Use the helper to convert geographic coordinates:

```python
row, col = grid.coord_to_pixel(lon=-82.012, lat=28.041)
print(f"Outlet grid cell: row={row}, col={col}")
```

### 4. Run the hybrid simulation

```python
from pywmp.hybrid.coupler import HybridSimulation, OutletBCSpec

hybrid = HybridSimulation(
    upstream_model=sim,
    rom_grid=grid,
    outlet_specs=[
        OutletBCSpec(element_name="Lower", row=row, col=col)
    ],
    duration_hr=36,
)
results = hybrid.run()
```

### 5. Inspect results

```python
print(results.summary())
# → Peak 2D depth: 4.2 ft | Flooded area: 38.5 acres | Volume: 61.3 ac-ft

fm = results.flood_map
fm.plot(cmap="Blues")
fm.to_geotiff("output/hybrid_a_depth.tif")
```

---

## Mode B walkthrough — `HybridExcessPrecipSimulation`

Mode B requires subbasin masks — a mapping from each 1D subbasin name to the set of 2D grid cells that represent it spatially.

### 1. Build subbasin masks automatically from delineation

```python
from pywmp.flood import WatershedDelineator
from pywmp.hybrid import SubbasinMaskSpec

delineator = WatershedDelineator("data/dem.tif", stream_threshold=500)
delineator.delineate()

# Build masks: each delineated catchment → set of grid cells
mask_spec = SubbasinMaskSpec.from_delineation(delineator, grid)
print(f"Mask covers {mask_spec.n_subbasins} subbasins, "
      f"{mask_spec.total_cells} total cells")
```

### 2. Build the 1D model with matching subbasin names

The subbasin names in `sim` must match the reach/catchment IDs in `mask_spec`:

```python
sim = DesignStormSimulation(
    storm_type="SCS_II",
    total_depth_in=8.5,
    duration_hr=24,
    dt_hr=0.1,
)
for reach_id, props in delineator.reach_properties.iterrows():
    sim.add_subbasin(
        name=str(reach_id),
        area_mi2=props["area_mi2"],
        loss_method="SCS_CN",
        loss_params={"CN": float(props["mean_cn"])},
        transform_method="SCS",
        transform_params={"lag_hr": float(props["lag_hr"])},
    )
```

### 3. Run excess-precip hybrid

```python
from pywmp.hybrid.coupler import HybridExcessPrecipSimulation

excess = HybridExcessPrecipSimulation(
    upstream_model=sim,
    rom_grid=grid,
    mask_spec=mask_spec,
    duration_hr=36,
)
results = excess.run()
print(results.summary())
```

---

## Comparing Mode A vs Mode B

Run both modes on the same domain to understand their differences:

```python
# Mode A result
results_a = HybridSimulation(...).run()

# Mode B result  
results_b = HybridExcessPrecipSimulation(...).run()

# Compare peak depth maps
import numpy as np
diff = results_a.flood_map.depth - results_b.flood_map.depth
print(f"Mean depth difference: {np.nanmean(np.abs(diff)):.3f} m")
print(f"Mode A peak: {results_a.flood_map.stats.max_depth_ft:.2f} ft")
print(f"Mode B peak: {results_b.flood_map.stats.max_depth_ft:.2f} ft")
```

**Expected behavior:**
- Mode B typically produces more spatially distributed flooding (rain everywhere) vs. Mode A (concentrated at one inlet).
- Mode A peak at the outlet matches the 1D result more closely.
- Mode B is more appropriate for flat terrain; Mode A for channelized watersheds.

---

## Best practices

**CRS consistency:** The 1D model uses geographic coordinates (decimal degrees); the 2D grid uses a projected CRS (e.g., UTM). Use `grid.coord_to_pixel()` to convert outlet coordinates, never hard-code pixel indices.

**Timestep matching:** Mode B requires that the 1D and 2D timesteps be compatible. The default `dt_hr=0.1` in `DesignStormSimulation` matches a 2D `dt_s=360` (6 minutes). Mismatched timesteps cause incorrect inflow totals.

**SubbasinMaskSpec completeness:** Every cell in the 2D grid must be assigned to exactly one subbasin mask in Mode B. `mask_spec.check_coverage(grid)` reports any uncovered or double-assigned cells.

**Recession period:** Set `duration_hr` to at least `storm_duration + 0.5 × Tc` to capture the full recession limb in the 2D domain.

---

## Next steps

- [Full Pipeline Tutorial](full_pipeline.md) — end-to-end example using both 1D and hybrid
- [Module Reference: hybrid](../reference/modules.md) — full API
- [Module Reference: flood](../reference/modules.md) — `WatershedDelineator` and `FloodMapper`
