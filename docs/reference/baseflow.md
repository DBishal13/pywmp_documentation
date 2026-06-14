# Baseflow Reference

`pywmp.baseflow` provides three baseflow separation methods compatible with
the HEC-HMS TRM conventions. Each model returns a `TimeSeries` that is
added to the direct runoff hydrograph produced by the transform.

---

## `pywmp.baseflow`

```python
from pywmp.baseflow import (
    ConstantBaseflow,
    RecessionBaseflow,
    LinearReservoirBaseflow,
)
```

| Class | Key parameters | Reference |
|-------|----------------|-----------|
| `ConstantBaseflow` | `flow_rate` (float or 12-month list) | HEC-HMS TRM §5.2 |
| `RecessionBaseflow` | `Q0`, `recession_k`, `threshold` | HEC-HMS TRM §5.3 |
| `LinearReservoirBaseflow` | `GQ0`, `k`, `area` | HEC-HMS TRM §5.4 |

All classes share the same call pattern:

```python
bf_ts = model.compute(times)          # returns TimeSeries (cfs or m³/s)
```

---

## ConstantBaseflow

```python
class ConstantBaseflow(flow_rate, units='USC')
```

Adds a fixed baseflow to every simulation timestep. A list of 12 values
enables monthly variation (Jan = index 0).

| Parameter | Type | Description |
|-----------|------|-------------|
| `flow_rate` | float or list[float] | Constant flow (cfs or m³/s), or 12 monthly values |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Methods**

```python
ConstantBaseflow.compute(times, months=None) -> TimeSeries
```

`months` — integer month array (1–12) per timestep, required only when
`flow_rate` is a 12-element list.

**Example**

```python
from pywmp.baseflow import ConstantBaseflow
import numpy as np

bf = ConstantBaseflow(flow_rate=2.5)          # 2.5 cfs constant
t  = np.arange(0, 25, 0.5)                    # 0–24 hr at 30-min steps
ts = bf.compute(t)
print(ts.values[:5])                           # [2.5, 2.5, 2.5, 2.5, 2.5]
```

---

## RecessionBaseflow

```python
class RecessionBaseflow(Q0, recession_k, threshold=0.0, units='USC')
```

Exponential recession: `Q(t) = Q0 × k^t`. Flow is held at `threshold`
once it falls below that value.

| Parameter | Type | Description |
|-----------|------|-------------|
| `Q0` | float | Initial baseflow at t = 0 (cfs or m³/s) |
| `recession_k` | float | Dimensionless recession constant per hour (0 < k < 1) |
| `threshold` | float | Minimum baseflow floor; default 0.0 |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Methods**

```python
RecessionBaseflow.compute(times) -> TimeSeries
```

**Example**

```python
from pywmp.baseflow import RecessionBaseflow
import numpy as np

bf = RecessionBaseflow(Q0=10.0, recession_k=0.85, threshold=0.5)
ts = bf.compute(np.arange(0, 48, 1.0))        # 48-hr recession
```

---

## LinearReservoirBaseflow

```python
class LinearReservoirBaseflow(GQ0, k, area, units='USC')
```

Groundwater storage `G` is replenished by deep percolation and drained
at rate `k`. Optionally accepts a recharge `TimeSeries` (incremental
depths per timestep) to couple with the loss model output.

| Parameter | Type | Description |
|-----------|------|-------------|
| `GQ0` | float | Initial groundwater discharge at t = 0 (cfs or m³/s) |
| `k` | float | Linear reservoir recession coefficient (hr⁻¹) |
| `area` | float | Drainage area (mi² for USC, km² for SI) |
| `units` | UnitSystem | `'USC'` or `'SI'` |

**Methods**

```python
LinearReservoirBaseflow.compute(times, recharge=None) -> TimeSeries
```

`recharge` — `TimeSeries` of incremental groundwater recharge depths
(in or mm) per timestep from the loss model. If `None`, the reservoir
drains freely from `GQ0`.

**Example**

```python
from pywmp.baseflow import LinearReservoirBaseflow
import numpy as np

bf = LinearReservoirBaseflow(GQ0=5.0, k=0.05, area=4.2)
t  = np.arange(0, 24, 0.5)
ts = bf.compute(t)                             # free drain from GQ0

# With recharge from a loss model:
# ts = bf.compute(t, recharge=loss_ts)
```
