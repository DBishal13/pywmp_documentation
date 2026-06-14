# Concepts

This page explains the modelling concepts implemented in PyWMP and the rationale
for key numerical and scientific choices in v0.2.0.

## 1D watershed modelling

PyWMP implements the process chain described in the U.S. Army Corps of Engineers
HEC-HMS Technical Reference Manual (USACE, 2023): rainfall excess → transform →
baseflow addition → routing. Each step is an independent, composable object.

### Loss methods

Loss methods determine how much rainfall contributes to surface runoff.

| Method | Class | Key parameters | Origin |
|--------|-------|----------------|--------|
| Initial-and-constant | `InitialConstantLoss` | initial abstraction (in), constant rate (in/hr) | USACE, 2023 |
| SCS Curve Number | `SCSCurveLoss` | CN, AMC class | NRCS, 2004; USDA SCS, 1986 |
| Green-Ampt | `GreenAmptLoss` | Ks (in/hr), psi (in), theta_i, eta | Green & Ampt, 1911; Mein & Larson, 1973 |
| Soil Moisture Accounting | `SMALoss` | multi-layer storage, PE series | Bennett, 1998; USACE, 2023 |

The **SCS Curve Number** method (USDA SCS, 1986; NRCS, 2004) derives runoff
from a tabular CN that combines hydrologic soil group (A–D) with land use class.
CN is adjustable for antecedent moisture condition (AMC I–III).

The **Green-Ampt** equation (Green & Ampt, 1911) models infiltration as a sharp
wetting front advancing into a uniformly wetted soil column. Mein and Larson (1973)
extended it to handle ponding onset under a steady rainfall rate.

### Transform methods

Transform methods convert excess rainfall to a hydrograph at the subbasin outlet.

- **SCS unit hydrograph** — lag-time method described in NRCS (2004) and originally
  formulated by Mockus (1957).
- **Clark unit hydrograph** (Clark, 1945) — routes excess precipitation through a
  time-area diagram and a linear reservoir with storage coefficient R.
- **Snyder synthetic unit hydrograph** (Snyder, 1938) — regional relationships
  between basin morphology and unit hydrograph shape via empirical Cp and Ct.
- **User-defined** — tabular unit hydrograph specified directly.

### Routing methods

Channel routing propagates the hydrograph through reaches.

- **Muskingum** (McCarthy, 1938) — storage-based linear method parameterised by
  travel time K and weighting factor x.
- **Muskingum-Cunge** (Cunge, 1969) — diffusion-wave approximation relating
  Muskingum parameters to channel geometry and Manning's roughness; retains
  physical interpretability.
- **Modified Puls** (Puls, 1928) — level-pool reservoir routing using a
  storage-outflow relationship; extended to channel reaches.
- **Lag** — pure translation with no attenuation.

---

## 2D rain-on-mesh solver

The 2D solver (`pywmp.rom`) integrates the depth-averaged shallow-water equations
(Saint-Venant, 1871) on a structured rectangular grid using an explicit first-order
HLL (Harten-Lax-van Leer) finite-volume scheme (Harten et al., 1983). The HLL
Riemann solver is selected for robustness on wetting-drying fronts, which are
prevalent in the flat coastal urban terrain targeted by PyWMP.

### Key solver characteristics

- **Wetting and drying** — a dry-depth threshold (`h_dry`, default 1e-6 ft) governs
  cell activation. This approach follows the treatment in Bates and De Roo (2000) and
  Toro (2001). Setting `h_dry` too large (e.g., 0.01 ft) zeroes out real shallow-flow
  cells on flat terrain.
- **CFL stability** — the adaptive time step satisfies the Courant-Friedrichs-Lewy
  (CFL) condition (Courant et al., 1928). `max_dt_sec` provides an upper bound.
- **Infiltration** — three options: deficit-constant (SCS equivalent), Green-Ampt
  cell-by-cell (Green & Ampt, 1911), and gridded SCS-CN (NRCS, 2004). Loss is applied
  before overland flow routing begins.
- **Boundary conditions** — normal-depth outlet, fixed-stage (coastal/tidal),
  inflow hydrograph, and internal inflow for canal structures.
- **Backends** — NumPy (portable), Numba JIT (CPU, 10–30× faster), CUDA (GPU).

---

## Hybrid 1D-2D coupling

One-way coupling routes the 1D network outflow into the 2D floodplain as a boundary
inflow. Two modes are available:

- **Outlet-to-inflow** (`HybridSimulation`) — the last-reach outflow hydrograph
  from the 1D model becomes an `InflowBC` at a specified cell in the 2D grid.
- **Excess-precipitation** (`HybridExcessPrecipSimulation`) — the 1D model computes
  rainfall excess per subbasin; excess rainfall is distributed onto the 2D grid
  through spatial subbasin masks (`SubbasinMaskSpec`).

Coupling is one-way (1D → 2D). This is appropriate when backwater effects at the
1D-2D interface are small relative to the inflow forcing, consistent with the
assumptions discussed in Bates and De Roo (2000).

---

## Sediment transport

The sediment module (`pywmp.sediment`) operates on the same grid and time step as
the 2D ROM solver and is driven by the depth and velocity fields from `ROMSimulation`.

### RUSLE-based gross erosion

Gross erosion rate is computed from the Revised Universal Soil Loss Equation
(RUSLE; Renard et al., 1997):

```
A = R × K × LS × C × P
```

where R is the rainfall erosivity factor (from NOAA Atlas 14; Perica et al., 2013),
K is the soil erodibility factor (Wischmeier & Smith, 1978), LS is the slope-length
factor, C is the cover-management factor, and P is the support-practice factor. The
LS factor is derived from the local slope arrays using the method of Moore and
Burch (1986), with an upslope contributing area option following Desmet and Govers
(1996).

### Suspended load transport

`SuspendedSedimentTransport` applies first-order upwind advection of depth-averaged
concentration (Fischer et al., 1979) with RUSLE erosion as the source term and a
settling sink based on the settling velocity formulation of Ferguson and Church (2004).

### Bedload transport

`BedloadTransport` implements the Wong-Parker (2006) re-calibration and correction
of the Meyer-Peter and Müller (1948) bedload formula:

```
q_b* = 3.97 (tau* - tau*_cr)^1.5
```

where tau*_cr = 0.0495 (the corrected critical Shields parameter; Shields, 1936).
The original Meyer-Peter and Müller (1948) formula is available by setting
`use_wong_parker=False`.

### Cohesive sediment

`KronePartheniades` applies the Krone (1962) and Partheniades (1965) framework
for deposition and re-suspension of fine-grained cohesive material. Deposition
occurs when bed shear stress falls below the critical deposition threshold (tau_cd);
erosion occurs above the critical erosion threshold (tau_ce).

### Morphodynamics

`MorphodynamicsModel` updates the DEM bed elevation at each time step from the
divergence of bedload flux, enabling long-term bed evolution simulations.

---

## Water quality

The water-quality module (`pywmp.wq`) solves advection-diffusion equations for
constituent mass on the 2D grid (Fischer et al., 1979), driven by the shallow-water
velocity field.

- **TSSModel** — total suspended solids with settling and diffusion terms.
- **TPModel** — total phosphorus with event mean concentration (EMC) loading from
  land use (Driver & Tasker, 1990; U.S. Environmental Protection Agency, 1983),
  first-order settling, and equilibrium partitioning coefficient Kp. The built-in
  `EMC_TP_BY_NLCD` table provides default loading rates by NLCD class (Homer et al.,
  2020).
- **WQTransport** — generic advection-diffusion for user-defined tracers.

---

## Coastal flood modelling

The coastal module (`pywmp.coastal`) implements a SLR-driven assessment workflow
for seawall-protected coastal basins. Sea-level rise projections follow the NOAA
(2017) intermediate and intermediate-high scenarios, which are the required
scenarios under the Florida Resilient Florida Programme for assessments initiated
before July 2024.

- **SeawallGeometry** — encodes seawall footprint, crest elevation profile, and
  stage-storage curve from a DEM and vector mask.
- **SeawallSLRSweep** — executes a sequence of 2D ROM simulations over a list of
  SLR levels with a raised tidal boundary. Returns `SweepResults` with peak stage,
  flood extent, and overtopping metrics per scenario, consistent with the EurOtop
  (van der Meer et al., 2018) overtopping framework.
- **CoastalFloodMap** — vectorises the max-depth raster to a flood polygon with
  scenario metadata.

---

## Calibration

`pywmp.calibration` implements classical parameter optimisation for hydrologic models.

- **Nash-Sutcliffe Efficiency (NSE)** (Nash & Sutcliffe, 1970) — measures the ratio
  of model residual variance to observed variance; NSE = 1 is perfect fit.
- **Kling-Gupta Efficiency (KGE)** (Gupta et al., 2009; Kling et al., 2012) —
  decomposes model performance into correlation (r), variability bias (alpha), and
  mean bias (beta). KGE >= 0.75 indicates good performance (Moriasi et al., 2007).
- **Differential evolution** (Storn & Price, 1997) — recommended global optimiser
  for most calibration problems; robust to local minima.
- **SCE-UA** (Duan et al., 1992) — Shuffled Complex Evolution; the classical
  hydrology calibration algorithm.
- **Nelder-Mead** (Nelder & Mead, 1965) — local search; use for final refinement.

---

## Validation

`pywmp.validation` provides tools for comparing model output against observations.

- **HydroMetrics** — NSE (Nash & Sutcliffe, 1970), KGE with its alpha/beta/r
  components (Gupta et al., 2009; Kling et al., 2012), RMSE, percent bias,
  peak-flow error, and peak-timing error. Performance ratings follow the
  guidelines of Moriasi et al. (2007).
- **ModelVsObserved** — pairs a USGS NWIS time series with model output; applies
  the rating thresholds recommended by Moriasi et al. (2007).
- **SpatialFloodValidation** — compares a simulated depth raster against a binary
  reference flood extent (FEMA NFHL or SAR) using the Critical Success Index (CSI;
  Schaefer, 1990), hit rate, false alarm ratio (FAR), and F1 score. Validation
  methodology follows Wing et al. (2017) and Bates et al. (2010).

---

## Dataset assembly

`pywmp.datasets.DatasetManager` automates download of eight open-access datasets.

| Method | Source | Reference |
|--------|--------|-----------|
| `download_dem()` | USGS 3DEP | USGS, 2024 |
| `download_watershed()` | USGS WBD | USGS, 2023a |
| `download_nhd()` | NHDPlus HR | USGS, 2023b |
| `download_nlcd()` | MRLC/USGS | Homer et al., 2020 |
| `download_soils()` | USDA SSURGO | Soil Survey Staff, 2023 |
| `download_cn()` | NLCD + SSURGO | NRCS, 2004; USDA SCS, 1986 |
| `download_atlas14()` | NOAA HDSC API | Perica et al., 2013 |
| `download_floodzone()` | FEMA NFHL | FEMA, 2023 |

---

## References

Bates, P. D., & De Roo, A. P. J. (2000). A simple raster-based model for flood
  inundation simulation. *Journal of Hydrology*, *236*(1–2), 54–77.
  [DOI ↗](https://doi.org/10.1016/S0022-1694(00)00278-X)

Bates, P. D., Horritt, M. S., & Fewtrell, T. J. (2010). A simple inertial
  formulation of the shallow water equations for efficient two-dimensional flood
  inundation modelling. *Journal of Hydrology*, *387*(1–2), 33–45.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2010.03.027)


Clark, C. O. (1945). Storage and the unit hydrograph. *Transactions of the American
  Society of Civil Engineers*, *110*(1), 1419–1446.
  [DOI ↗](https://doi.org/10.1061/TACEAT.0005791)


Cunge, J. A. (1969). On the subject of a flood propagation computation method
  (Muskingum method). *Journal of Hydraulic Research*, *7*(2), 205–230.
  [DOI ↗](https://doi.org/10.1080/00221686909500264)

Desmet, P. J. J., & Govers, G. (1996). A GIS procedure for automatically
  calculating the USLE LS factor on topographically complex landscape units.
  *Journal of Soil and Water Conservation*, *51*(5), 427–433.
  [JSWC ↗](https://www.jswconline.org/content/51/5/427)

Driver, N. E., & Tasker, G. D. (1990). *Techniques for estimation of storm-runoff
  loads, volumes, and selected constituent concentrations in urban watersheds in
  the United States* (Water-Supply Paper 2363). U.S. Geological Survey.
  [PDF ↗](https://pubs.usgs.gov/wsp/2363/report.pdf)

Duan, Q., Sorooshian, S., & Gupta, V. K. (1992). Effective and efficient global
  optimization for conceptual rainfall-runoff models. *Water Resources Research*,
  *28*(4), 1015–1031.
  [DOI ↗](https://doi.org/10.1029/91WR02985)

Federal Emergency Management Agency. (2023). *National Flood Hazard Layer (NFHL)*.
  [FEMA MSC ↗](https://msc.fema.gov)

Ferguson, R. I., & Church, M. (2004). A simple universal equation for grain settling
  velocity. *Journal of Sedimentary Research*, *74*(6), 933–937.
  [DOI ↗](https://doi.org/10.1306/051204740933)

Fischer, H. B., List, E. J., Koh, R. C. Y., Imberger, J., & Brooks, N. H. (1979).
  *Mixing in inland and coastal waters*. Academic Press.
  [Publisher ↗](https://www.elsevier.com/books/mixing-in-inland-and-coastal-waters/fischer/978-0-12-258150-6)

Green, W. H., & Ampt, G. A. (1911). Studies on soil physics. *Journal of
  Agricultural Science*, *4*(1), 1–24.
  [DOI ↗](https://doi.org/10.1017/S0021859600001441)

Gupta, H. V., Kling, H., Yilmaz, K. K., & Martinez, G. F. (2009). Decomposition
  of the mean squared error and NSE performance criteria: Implications for improving
  hydrological modelling. *Journal of Hydrology*, *377*(1–2), 80–91.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2009.08.003)

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

Kling, H., Fuchs, M., & Paulin, M. (2012). Runoff conditions in the upper Danube
  basin under an ensemble of climate change scenarios. *Journal of Hydrology*,
  *424–425*, 264–277.
  [DOI ↗](https://doi.org/10.1016/j.jhydrol.2012.01.011)

Krone, R. B. (1962). *Flume studies of the transport of sediment in estuarial
  shoaling processes: Final report*. University of California, Berkeley.
  [DTIC ↗](https://apps.dtic.mil/sti/citations/AD0293875)


Mein, R. G., & Larson, C. L. (1973). Modeling infiltration during a steady rain.
  *Water Resources Research*, *9*(2), 384–394.
  [DOI ↗](https://doi.org/10.1029/WR009i002p00384)

Meyer-Peter, E., & Müller, R. (1948). Formulas for bed-load transport. In
  *Proceedings of the 2nd Meeting of the International Association for Hydraulic
  Structures Research* (pp. 39–64). IAHR.
  [TU Delft ↗](https://repository.tudelft.nl/record/uuid:4fda9b61-be28-4703-ab06-43cdc2a21bd7)

Mockus, V. (1957). *Use of storm and watershed characteristics in synthetic
  hydrograph analysis and application*. American Geophysical Union.
  [USDA NAL ↗](https://handle.nal.usda.gov/10113/IND43966827)

Moore, I. D., & Burch, G. J. (1986). Physical basis of the length-slope factor in
  the Universal Soil Loss Equation. *Soil Science Society of America Journal*,
  *50*(5), 1294–1298.
  [DOI ↗](https://doi.org/10.2136/sssaj1986.03615995005000050042x)

Moriasi, D. N., Arnold, J. G., Van Liew, M. W., Bingner, R. L., Harmel, R. D., &
  Veith, T. L. (2007). Model evaluation guidelines for systematic quantification of
  accuracy in watershed simulations. *Transactions of the ASABE*, *50*(3), 885–900.
  [DOI ↗](https://doi.org/10.13031/2013.23153)

Nash, J. E., & Sutcliffe, J. V. (1970). River flow forecasting through conceptual
  models. Part I — A discussion of principles. *Journal of Hydrology*, *10*(3),
  282–290.
  [DOI ↗](https://doi.org/10.1016/0022-1694(70)90255-6)

Natural Resources Conservation Service. (2004). *National Engineering Handbook,
  Part 630: Hydrology*. U.S. Department of Agriculture.
  [USDA NAL ↗](https://handle.nal.usda.gov/10113/32494)

National Oceanic and Atmospheric Administration. (2017). *Global and regional sea
  level rise scenarios for the United States* (NOAA Technical Report NOS CO-OPS 083).
  NOAA.
  [NOAA ↗](https://oceanservice.noaa.gov/hazards/sealevelrise/sealevelrise-tech-report.html)

Nelder, J. A., & Mead, R. (1965). A simplex method for function minimization.
  *The Computer Journal*, *7*(4), 308–313.
  [DOI ↗](https://doi.org/10.1093/comjnl/7.4.308)

Partheniades, E. (1965). Erosion and deposition of cohesive soils. *Journal of the
  Hydraulics Division*, *91*(1), 105–139.
  [DOI ↗](https://doi.org/10.1061/JYCEAJ.0001197)

Perica, S., Pavlovic, S., St. Laurent, M., Trypaluk, C., Unruh, D., Martin, D., &
  Wilhite, O. (2013). *NOAA Atlas 14: Precipitation-frequency atlas of the United
  States, Volume 9: Southeastern States, Version 3* (NOAA Atlas 14, Vol. 9). NOAA.
  [DOI ↗](https://doi.org/10.25923/xnb4-5613)

Puls, L. G. (1928). *Flood regulation of the Tennessee River* (House Doc. 185, 70th
  Congress, 1st session). U.S. Army Corps of Engineers.
  [HathiTrust ↗](https://catalog.hathitrust.org/Record/001697457)

Renard, K. G., Foster, G. R., Weesies, G. A., McCool, D. K., & Yoder, D. C. (1997).
  *Predicting soil erosion by water: A guide to conservation planning with the Revised
  Universal Soil Loss Equation (RUSLE)* (Agriculture Handbook No. 703). U.S.
  Department of Agriculture.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=16945)


Schaefer, J. T. (1990). The critical success index as an indicator of warning skill.
  *Weather and Forecasting*, *5*(4), 570–575.
  [DOI ↗](https://doi.org/10.1175/1520-0434(1990)005<0570:TCSIAA>2.0.CO;2)


Snyder, F. F. (1938). Synthetic unit graphs. *Eos, Transactions, American
  Geophysical Union*, *19*(1), 447–454.
  [DOI ↗](https://doi.org/10.1029/TR019i001p00447)

Soil Survey Staff. (2023). *Web Soil Survey*. USDA Natural Resources Conservation
  Service.
  [Web Soil Survey ↗](https://websoilsurvey.nrcs.usda.gov)

Storn, R., & Price, K. (1997). Differential evolution — A simple and efficient
  heuristic for global optimization over continuous spaces. *Journal of Global
  Optimization*, *11*(4), 341–359.
  [DOI ↗](https://doi.org/10.1023/A:1008202821328)

Toro, E. F. (2001). *Shock-capturing methods for free-surface shallow flows*.
  Wiley.
  [Publisher ↗](https://www.wiley.com/en-us/9780471987666)

U.S. Army Corps of Engineers. (2023). *Hydrologic Modeling System HEC-HMS:
  Technical reference manual* (Version 4.12). Hydrologic Engineering Center.
  [HEC ↗](https://www.hec.usace.army.mil/software/hec-hms/)

U.S. Environmental Protection Agency. (1983). *Results of the nationwide urban
  runoff program: Final report* (USEPA 400/3-83-16). USEPA.
  [EPA ↗](https://www.epa.gov/npdes/urban-runoff-national-stormwater-program)

U.S. Geological Survey. (2023a). *Watershed Boundary Dataset (WBD)*.
  [USGS ↗](https://www.usgs.gov/national-hydrography/watershed-boundary-dataset)

U.S. Geological Survey. (2023b). *National Hydrography Dataset Plus High
  Resolution (NHDPlus HR)*.
  [USGS ↗](https://www.usgs.gov/nhd)

U.S. Geological Survey. (2024). *3D Elevation Program (3DEP)*.
  [USGS ↗](https://www.usgs.gov/3dep)

van der Meer, J. W., Allsop, N. W. H., Bruce, T., De Rouck, J., Kortenhaus, A.,
  Pullen, T., Schüttrumpf, H., Troch, P., & Zanuttigh, B. (2018). *EurOtop: Manual
  on wave overtopping of sea defences and related structures* (2nd ed.).
  [EurOtop ↗](https://www.overtopping-manual.com)

Wing, O. E. J., Bates, P. D., Sampson, C. C., Smith, A. M., Johnson, K. A., &
  Erickson, T. A. (2017). Validation of a 30 m resolution flood hazard model of the
  conterminous United States. *Water Resources Research*, *53*(9), 7968–7986.
  [DOI ↗](https://doi.org/10.1002/2017WR020917)

Wischmeier, W. H., & Smith, D. D. (1978). *Predicting rainfall erosion losses: A
  guide to conservation planning* (Agriculture Handbook No. 537). U.S. Department
  of Agriculture.
  [ARS ↗](https://www.ars.usda.gov/research/publications/publication/?seqNo115=90921)

Wong, M., & Parker, G. (2006). Reanalysis and correction of bed-load relation of
  Meyer-Peter and Müller using their own database. *Journal of Hydraulic Engineering*,
  *132*(11), 1159–1168.
  [DOI ↗](https://doi.org/10.1061/(ASCE)0733-9429(2006)132:11(1159))
