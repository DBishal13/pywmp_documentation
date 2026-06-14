---
hide:
  - toc
---

<section class="gl-hero">
  <div class="gl-hero__text">
    <p class="eyebrow">Open-source · Python · Watershed Modeling</p>
    <h1 class="gl-hero__title">Hydrologic modeling<br><span class="gl-accent">without the friction.</span></h1>
    <p class="gl-hero__lead">PyWMP automates the full pipeline — spatial data acquisition to flood map — in clean, Python-native code. 1D, 2D, hybrid coupling, calibration, coastal, sediment, water quality.</p>
    <div class="hero__actions">
      <a class="md-button md-button--primary" href="installation/">Get started →</a>
      <a class="md-button" href="quickstart/">Quick start</a>
      <a class="md-button" href="https://github.com/mandalanil/pywmp" target="_blank">GitHub ↗</a>
    </div>
  </div>
  <img src="images/hero_viz.svg" class="gl-hero__viz" alt="PyWMP watershed analysis — terrain map, stream network, flood extent, and runoff hydrograph">
</section>

<div class="stats-row">
  <div class="stat-item">
    <span class="stat-num">21</span>
    <span class="stat-label">Modules</span>
  </div>
  <div class="stat-item">
    <span class="stat-num">8+</span>
    <span class="stat-label">Automated datasets</span>
  </div>
  <div class="stat-item">
    <span class="stat-num">5</span>
    <span class="stat-label">Calibration algorithms</span>
  </div>
  <div class="stat-item">
    <span class="stat-num">1D·2D</span>
    <span class="stat-label">Hybrid simulation</span>
  </div>
</div>

## What PyWMP does

<div class="feature-grid" markdown>

<div class="feature-card fc-blue" markdown>
### Automated data prep
Download DEM (3DEP 1–30 m), watershed boundaries, NHD stream network, NLCD land cover, SSURGO soil groups, composite CN rasters, NOAA Atlas 14, and FEMA flood zones — with one `download_all()` call.

[Dataset reference →](reference/datasets.md)
</div>

<div class="feature-card fc-green" markdown>
### 1D hydrologic modeling
SCS CN and Green-Ampt losses. Clark, SCS, and Snyder unit hydrographs. Muskingum and kinematic wave routing. HEC-HMS–compatible multi-subbasin network.

[Full pipeline tutorial →](tutorials/full_pipeline.md)
</div>

<div class="feature-card fc-purple" markdown>
### 2D floodplain simulation
Rain-on-mesh ROM solver over DEM-derived grids. HAND-based inundation depth mapping. Export to GeoTIFF and Cloud Optimized GeoTIFF for web sharing.

[Module reference →](reference/modules.md)
</div>

<div class="feature-card fc-amber" markdown>
### Hybrid 1D–2D coupling
Outlet-to-inflow-BC and excess-precip distribution modes. Combine 1D channel routing accuracy with 2D spatial flood extent in a single run.

[Hybrid coupling tutorial →](tutorials/hybrid_coupling.md)
</div>

<div class="feature-card fc-red" markdown>
### Calibration & optimization
`CalibrationEngine` with differential evolution, Nelder-Mead, dual annealing, LHS, and grid search. NSE, KGE, PBIAS, RMSE objective functions. Morris and Sobol sensitivity.

[Calibration tutorial →](tutorials/calibration_validation.md)
</div>

<div class="feature-card fc-cyan" markdown>
### Model validation
`HydroMetrics` for gauge-based skill scores. `SpatialFloodValidation` for raster extent comparison — CSI, hit rate, false alarm ratio, F1, area bias.

[Validation reference →](reference/validation.md)
</div>

<div class="feature-card fc-sky" markdown>
### Coastal modeling
`SeawallGeometry` and storm surge routing. TC intensity estimator. `SeawallSLRSweep` for multi-scenario sea-level rise analysis across return periods.

[Coastal reference →](reference/coastal.md)
</div>

<div class="feature-card fc-lime" markdown>
### Sediment transport
Bedload via Meyer-Peter–Müller. Cohesive suspended sediment. `MorphodynamicBed` for iterative bed evolution. Stokes settling velocity by particle class.

[Sediment & WQ tutorial →](tutorials/sediment_wq.md)
</div>

<div class="feature-card fc-pink" markdown>
### Water quality
TSS and total phosphorus transport coupled to 1D discharge. EMC lookup table for 25 NLCD classes. Sub-daily constituent loading estimation.

[WQ reference →](reference/wq.md)
</div>

<div class="feature-card fc-orange" markdown>
### REST API & deployment
FastAPI server — submit HMS and Cascade runs, stream live progress over WebSocket, poll results. Upload `.dat` files. Docker Compose included, scale with `--workers`.

[REST API tutorial →](tutorials/rest_api.md)
</div>

</div>

[Read the API reference](reference/index.md){ .md-button .md-button--primary }
[Browse tutorials](tutorials/full_pipeline.md){ .md-button }
[View on GitHub](https://github.com/mandalanil/pywmp){ .md-button }
