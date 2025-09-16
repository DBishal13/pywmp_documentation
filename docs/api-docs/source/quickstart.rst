Quick Start Guide
=================

This guide will get you up and running with PyWMP in just a few minutes.

Basic Workflow
--------------

The typical PyWMP workflow consists of four main steps:

1. **Load and prepare data** (DEM, rainfall, land use)
2. **Delineate watershed** and create channel network
3. **Calculate runoff** using appropriate methods
4. **Route flow** through the network and visualize results

Example 1: Basic Watershed Analysis
------------------------------------

Let's start with a simple watershed analysis:

.. code-block:: python

   import pywmp
   import numpy as np
   import matplotlib.pyplot as plt

   # Step 1: Create watershed from DEM
   ws = pywmp.Watershed.from_dem(
       dem_path='data/dem.tif',
       outlet_coords=(123.456, 45.789),  # longitude, latitude
       threshold=1000  # minimum catchment area in pixels
   )

   # Step 2: Define rainfall event
   rainfall = pywmp.RainfallEvent(
       intensity=25.4,    # mm/hr (1 inch/hour)
       duration=2,        # hours
       return_period=10   # years
   )

   # Step 3: Calculate runoff
   runoff = ws.calculate_runoff(
       rainfall_event=rainfall,
       method='scs_cn',           # SCS Curve Number method
       curve_number=75            # Mixed land use CN
   )

   # Step 4: Route flow through network
   hydrograph = ws.route_flow(
       runoff_hydrograph=runoff,
       routing_method='muskingum_cunge'
   )

   # Step 5: Visualize results
   fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
   
   # Plot network
   ws.plot_network(ax=ax1, show_elevation=True)
   ax1.set_title('Watershed Network')
   
   # Plot hydrograph
   pywmp.visualization.plot_hydrograph(hydrograph, ax=ax2)
   ax2.set_title('Outlet Hydrograph')
   
   plt.tight_layout()
   plt.show()

Example 2: Flood Inundation Mapping
------------------------------------

Create flood inundation maps for different return periods:

.. code-block:: python

   import pywmp

   # Load watershed
   ws = pywmp.Watershed.from_dem('data/dem.tif')

   # Define multiple return periods
   return_periods = [10, 25, 50, 100]
   inundation_maps = {}

   for rp in return_periods:
       # Create design storm for return period
       rainfall = pywmp.runoff.create_design_storm(
           return_period=rp,
           duration=24,           # 24-hour storm
           storm_type='scs_type2'
       )
       
       # Calculate runoff and route flow
       runoff = ws.calculate_runoff(rainfall, method='scs_cn')
       hydrograph = ws.route_flow(runoff)
       
       # Create inundation map
       inundation = ws.create_inundation_map(
           hydrograph=hydrograph,
           method='2d_diffusion',
           manning_n=0.035
       )
       
       inundation_maps[rp] = inundation

   # Visualize flood maps
   fig, axes = plt.subplots(2, 2, figsize=(12, 10))
   axes = axes.flatten()

   for i, rp in enumerate(return_periods):
       pywmp.visualization.plot_inundation_map(
           inundation_maps[rp], 
           ax=axes[i],
           title=f'{rp}-Year Flood'
       )

   plt.tight_layout()
   plt.show()

Example 3: Multi-Scenario Analysis
-----------------------------------

Compare different land use scenarios:

.. code-block:: python

   import pywmp

   # Base watershed
   ws = pywmp.Watershed.from_dem('data/dem.tif')

   # Define scenarios
   scenarios = {
       'current': {'cn': 75, 'manning_n': 0.035},
       'urban_development': {'cn': 85, 'manning_n': 0.025},
       'forest_restoration': {'cn': 65, 'manning_n': 0.045}
   }

   # Rainfall event
   rainfall = pywmp.RainfallEvent(intensity=50, duration=2, return_period=100)

   results = {}
   for scenario_name, params in scenarios.items():
       # Calculate runoff with scenario parameters
       runoff = ws.calculate_runoff(
           rainfall_event=rainfall,
           method='scs_cn',
           curve_number=params['cn']
       )
       
       # Route with scenario-specific roughness
       hydrograph = ws.route_flow(
           runoff_hydrograph=runoff,
           manning_n=params['manning_n']
       )
       
       results[scenario_name] = hydrograph

   # Compare peak flows
   for scenario, hydrograph in results.items():
       peak_flow = np.max(hydrograph.flow)
       print(f"{scenario}: Peak flow = {peak_flow:.1f} m³/s")

   # Plot comparison
   pywmp.visualization.plot_multiple_hydrographs(
       results, 
       title='Land Use Scenario Comparison'
   )

Working with Real Data
----------------------

Loading DEM Data
~~~~~~~~~~~~~~~~~

PyWMP supports various DEM formats:

.. code-block:: python

   # From GeoTIFF
   ws = pywmp.Watershed.from_dem('data/dem.tif')

   # From NetCDF
   ws = pywmp.Watershed.from_netcdf('data/dem.nc', variable='elevation')

   # From array with geospatial information
   import rasterio
   with rasterio.open('data/dem.tif') as src:
       dem_array = src.read(1)
       transform = src.transform
       crs = src.crs

   ws = pywmp.Watershed.from_array(
       dem_array, 
       transform=transform, 
       crs=crs
   )

Loading Rainfall Data
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # From CSV file
   rainfall_data = pywmp.utils.read_rainfall_data('data/rainfall.csv')

   # From design storms
   rainfall = pywmp.runoff.create_design_storm(
       return_period=100,
       duration=24,
       location='Miami, FL',
       storm_type='scs_type2'
   )

   # Custom rainfall time series
   time_hours = np.arange(0, 24, 0.25)  # 15-minute intervals
   intensity_mm_hr = np.array([0, 5, 15, 25, 45, 30, 10, 5, 0, ...])
   
   rainfall = pywmp.RainfallEvent.from_timeseries(
       time=time_hours,
       intensity=intensity_mm_hr
   )

Advanced Features
-----------------

Uncertainty Analysis
~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # Define parameter uncertainty
   uncertainty = pywmp.UncertaintyAnalysis(
       parameters=['curve_number', 'manning_n', 'time_of_concentration'],
       distributions={
           'curve_number': ('normal', 75, 5),      # mean=75, std=5
           'manning_n': ('uniform', 0.025, 0.045), # min=0.025, max=0.045
           'time_of_concentration': ('triangular', 1.5, 2.0, 3.0)  # min, mode, max
       }
   )

   # Run Monte Carlo simulation
   results = uncertainty.monte_carlo(
       watershed=ws,
       rainfall_event=rainfall,
       n_simulations=1000
   )

   # Analyze results
   uncertainty.plot_sensitivity_analysis(results)
   confidence_intervals = uncertainty.calculate_confidence_intervals(results)

Calibration and Validation
~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # Load observed data
   observed = pywmp.utils.read_streamflow_data('data/observed_flow.csv')

   # Set up calibration
   calibrator = pywmp.Calibration(
       watershed=ws,
       observed_data=observed,
       parameters_to_calibrate=['curve_number', 'manning_n']
   )

   # Run calibration
   best_params = calibrator.optimize(
       method='differential_evolution',
       objective_function='nash_sutcliffe'
   )

   # Validate results
   validation_stats = calibrator.validate(best_params)
   print(f"Nash-Sutcliffe Efficiency: {validation_stats['nse']:.3f}")

Next Steps
----------

Now that you've learned the basics, explore:

- :doc:`tutorials/index` - Detailed step-by-step tutorials
- :doc:`examples/index` - Real-world case studies  
- :doc:`api/hydrology` - Complete API reference
- :doc:`contributing` - Contributing to PyWMP development
