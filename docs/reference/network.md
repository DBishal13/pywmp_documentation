# Network Elements Reference

`pywmp.network` provides the basin model element classes that compose
multi-subbasin simulation networks. Elements are wired together in a
`BasinModel` (via `pywmp.workflow.DesignStormSimulation` or directly
through `pywmp.simulation.engine.BasinModel`).

---

## `pywmp.network`

```python
from pywmp.network import (
    SubbasinElement,
    ReachElement,
    JunctionElement,
    ReservoirElement,
    DiversionElement,
    ROMElement,
)
```

| Class | HEC-HMS equivalent | Purpose |
|-------|--------------------|---------|
| `SubbasinElement` | Subbasin | Loss + transform + baseflow → runoff |
| `ReachElement` | Reach | Channel routing (Muskingum, lag, …) |
| `JunctionElement` | Junction | Sum flows from multiple upstream elements |
| `ReservoirElement` | Reservoir | Storage routing via `LevelPoolReservoir` |
| `DiversionElement` | Diversion | Split flow by fraction or fixed rate |
| `ROMElement` | — | Wraps a 2D `ROMSimulation` as a network node |

---

## SubbasinElement

```python
class SubbasinElement(
    name, loss_model, transform_model,
    baseflow_model=None, units='USC'
)
```

Assembles a complete subbasin by composing any compatible loss, transform,
and optional baseflow model.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | str | Element identifier |
| `loss_model` | object | Any object with `.compute(precip) → (effective, loss)` |
| `transform_model` | object | Any object with `.compute(effective) → TimeSeries` |
| `baseflow_model` | object \| None | Optional; `.compute(times[, recharge]) → TimeSeries` |

**Methods**

```python
SubbasinElement.run(rainfall: TimeSeries) -> TimeSeries   # total runoff
```

**Example**

```python
from pywmp.network import SubbasinElement
from pywmp.losses import SCSCurveLoss
from pywmp.transform import SCSUnitHydrograph
from pywmp.baseflow import RecessionBaseflow

sb = SubbasinElement(
    name="B1",
    loss_model=SCSCurveLoss(CN=78, area_mi2=2.5),
    transform_model=SCSUnitHydrograph(lag_hr=1.2, area_mi2=2.5),
    baseflow_model=RecessionBaseflow(Q0=3.0, recession_k=0.9),
)
runoff_ts = sb.run(precip_ts)
```

---

## ReachElement

```python
class ReachElement(name, routing_model, units='USC')
```

Routes flow through a channel reach using any routing model.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | str | Element identifier |
| `routing_model` | object | Any object with `.compute(inflow) → TimeSeries` |

```python
from pywmp.network import ReachElement
from pywmp.routing import MuskingumRouting

reach = ReachElement("R1", MuskingumRouting(K_hr=0.8, x=0.2))
routed = reach.run(upstream_flow_ts)
```

---

## JunctionElement

```python
class JunctionElement(name, units='USC')
```

Sums two or more upstream flow `TimeSeries` at a confluence point.

```python
from pywmp.network import JunctionElement

j = JunctionElement("Outlet")
total = j.run([flow_b1, flow_b2, routed_r1])
```

---

## ReservoirElement

```python
class ReservoirElement(name, reservoir_model, units='USC')
```

Wraps a `LevelPoolReservoir` as a network node.

```python
from pywmp.network import ReservoirElement
from pywmp.reservoir import LevelPoolReservoir

res_elem = ReservoirElement("Pond1", LevelPoolReservoir(elev, stor, outlets))
outflow, elev_ts = res_elem.run(inflow_ts)
```

---

## DiversionElement

```python
class DiversionElement(name, fraction=None, fixed_rate=None, units='USC')
```

Splits inflow into a diverted portion and a main-channel continuation.
Supply either `fraction` (0–1) or `fixed_rate` (cfs or m³/s).

```python
from pywmp.network import DiversionElement

div = DiversionElement("Div1", fraction=0.30)   # 30 % diverted
main_flow, diverted_flow = div.run(inflow_ts)
```

---

## ROMElement

```python
class ROMElement(name, rom_simulation, units='USC')
```

Embeds a `ROMSimulation` (2D shallow-water) as a node in a 1D basin
network. Inflow from upstream elements is applied as a boundary condition
to the 2D domain; the outlet hydrograph is returned as the element output.

```python
from pywmp.network import ROMElement
from pywmp.rom import ROMSimulation

rom_elem = ROMElement("ROM_Cell_1", rom_sim)
outlet_ts = rom_elem.run(inflow_ts)
```
