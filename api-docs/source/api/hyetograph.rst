Hyetograph Module
=================

The :mod:`pywmp.hyetograph` module provides functions for generating and processing hyetographs (rainfall time series).

.. automodule:: pywmp.hyetograph
   :members:
   :undoc-members:
   :show-inheritance:

Key Functions
-------------

The main functions in this module include:

- **generate_rainfall_table()** - Generate rainfall time series from storm data
- **sfwmd_rainfall_distribution()** - SFWMD standard rainfall distributions
- **temporal_rainfall_scaling()** - Scale rainfall for different durations

Usage Example
-------------

.. code-block:: python

   import pywmp.hyetograph as hyeto
   
   # Generate rainfall table
   rainfall = hyeto.generate_rainfall_table(
       total_depth=100.0,  # mm
       duration=24.0,      # hours
       time_interval=1.0,  # hours
       distribution='sfwmd'
   )
   
   # Display rainfall statistics
   print(f"Total rainfall: {rainfall['depth'].sum():.1f} mm")
   print(f"Peak intensity: {rainfall['intensity'].max():.2f} mm/hr")
