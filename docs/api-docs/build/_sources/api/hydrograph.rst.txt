Hydrograph Module
=================

The :mod:`pywmp.hydrograph` module provides functions for generating and processing hydrographs (flow time series).

.. automodule:: pywmp.hydrograph
   :members:
   :undoc-members:
   :show-inheritance:

Key Functions
-------------

The main functions in this module include:

- **generate_runoff_hydrograph()** - Generate runoff hydrographs from rainfall data
- **convolve_hydrograph()** - Convolution operations for hydrograph routing
- **peak_discharge_analysis()** - Peak flow analysis and statistics

Usage Example
-------------

.. code-block:: python

   import pywmp.hydrograph as hydro
   
   # Generate runoff hydrograph
   hydrograph = hydro.generate_runoff_hydrograph(
       rainfall_data=rainfall_series,
       watershed_area=100.0,  # km²
       curve_number=75
   )
   
   # Analyze peak discharge
   peak_flow = hydro.peak_discharge_analysis(hydrograph)
   print(f"Peak discharge: {peak_flow:.2f} m³/s")
