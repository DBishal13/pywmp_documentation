Runoff Module
=============

The :mod:`pywmp.runoff` module provides various runoff calculation methods, primarily the GDCUH function.

.. automodule:: pywmp.runoff
   :members:
   :undoc-members:
   :show-inheritance:

GDCUH Function
--------------

The Generalized Dimensionless Curvilinear Unit Hydrograph (GDCUH) method is a key component of PyWMP for generating unit hydrographs.

.. autofunction:: pywmp.runoff.gdcuh

Key Features
------------

- **Unit Hydrograph Generation**: Creates dimensionless unit hydrographs for watershed modeling
- **Peak Flow Timing**: Calculates time to peak and peak discharge
- **Curve Shape Parameters**: Configurable parameters for different watershed characteristics

Usage Example
-------------

.. code-block:: python

   import pywmp
   
   # Generate GDCUH unit hydrograph
   unit_hydrograph = pywmp.gdcuh(
       watershed_area=25.0,    # km²
       time_to_peak=2.5,       # hours
       peak_factor=0.75,       # dimensionless
       time_base=12.0          # hours
   )
   
   # Display results
   print(f"Unit hydrograph points: {len(unit_hydrograph)}")
   print(f"Peak discharge: {unit_hydrograph['discharge'].max():.3f}")

Parameters
----------

The GDCUH function typically requires:

- **Watershed characteristics**: Area, slope, channel length
- **Timing parameters**: Time to peak, lag time
- **Shape parameters**: Peak factor, recession constants

- ``green_ampt_method()`` - Calculate infiltration using Green-Ampt method
- ``calculate_infiltration_rate()`` - Determine infiltration rates

Unit Hydrograph Methods
-----------------------

Various unit hydrograph generation methods:

- ``snyder_unit_hydrograph()`` - Snyder synthetic unit hydrograph
- ``scs_unit_hydrograph()`` - SCS dimensionless unit hydrograph  
- ``clark_unit_hydrograph()`` - Clark unit hydrograph method

Rainfall Analysis
-----------------

Functions for rainfall event analysis:

- ``create_design_storm()`` - Generate design storm hyetographs
- ``calculate_rainfall_intensity()`` - Calculate rainfall intensity patterns
