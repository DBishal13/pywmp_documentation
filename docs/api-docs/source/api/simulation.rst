Simulation Module
=================

The :mod:`pywmp.simulate` module provides the HydrologicSimulator class for running watershed simulations.

.. automodule:: pywmp.simulate
   :members:
   :undoc-members:
   :show-inheritance:

HydrologicSimulator Class
-------------------------

The HydrologicSimulator encapsulates the data and methods for watershed hydrologic simulation using NetworkX graphs.

.. autoclass:: pywmp.simulate.HydrologicSimulator
   :members:
   :undoc-members:
   :show-inheritance:

Key Features
------------

- **Time Series Simulation**: Configurable time steps and simulation periods
- **Multi-Node Routing**: Flow routing through complex watershed networks
- **Structure Integration**: Pumps, spillways, and hydraulic structures
- **Output Management**: Automated result file generation and organization

Usage Example
-------------

.. code-block:: python

   import pywmp
   import networkx as nx
   
   # Assume you have a NetworkX graph from Cascade2001Model
   model = pywmp.Cascade2001Model(df=watershed_data)
   
   # Create hydrologic simulator
   simulator = pywmp.HydrologicSimulator(
       graph=model.graph,
       outdir='simulation_results',
       start_time=0.0,
       end_time=72.0,
       time_interval=1.0
   )
   
   # Run simulation
   results = simulator.simulate_watershed(
       rainfall_scenario='100yr_24hr',
       initial_conditions={'water_level': 0.0}
   )
   
   # Access simulation results
   print(f"Simulation completed: {len(results)} time steps")

Helper Functions
----------------

The module also includes utility functions:

- **round_df()** - Round DataFrame values to specified decimal places

- ``reservoir_routing()`` - Reservoir flow routing
- ``level_pool_routing()`` - Level pool routing method

Channel Hydraulics
------------------

Functions for hydraulic computations:

- ``manning_velocity()`` - Calculate velocity using Manning's equation
- ``calculate_hydraulic_radius()`` - Hydraulic radius calculations
- ``normal_depth()`` - Normal depth calculations
