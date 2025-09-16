Structure Flows Module
======================

The :mod:`pywmp.structure_flows` module provides functions for calculating flows through hydraulic structures.

.. automodule:: pywmp.structure_flows
   :members:
   :undoc-members:
   :show-inheritance:

Key Functions
-------------

The main functions in this module include:

.. autofunction:: pywmp.structure_flows.pump_discharge
.. autofunction:: pywmp.structure_flows.gated_spillway_discharge

Pump Discharge Calculations
---------------------------

Functions for modeling pump stations and their discharge characteristics.

Spillway Flow Calculations
--------------------------

Functions for calculating flows through gated spillways and overflow structures.

Usage Example
-------------

.. code-block:: python

   import pywmp
   
   # Calculate pump discharge
   pump_flow = pywmp.pump_discharge(
       water_level=2.5,        # meters
       pump_capacity=5.0,      # m³/s
       operating_level=1.5,    # meters
       shutoff_level=3.0       # meters
   )
   
   # Calculate spillway discharge
   spillway_flow = pywmp.gated_spillway_discharge(
       head=1.2,               # meters
       gate_opening=0.8,       # fraction (0-1)
       spillway_width=10.0,    # meters
       discharge_coefficient=0.65
   )
   
   print(f"Pump discharge: {pump_flow:.2f} m³/s")
   print(f"Spillway discharge: {spillway_flow:.2f} m³/s")

Structure Types
---------------

The module supports various hydraulic structure types:

- **Pump Stations**: Variable speed pumps, fixed capacity pumps
- **Spillways**: Gated spillways, overflow spillways
- **Weirs**: Broad-crested weirs, sharp-crested weirs
- **Culverts**: Box culverts, circular culverts

- ``plot_network()`` - Plot watershed network topology
- ``plot_stream_network()`` - Plot stream network with attributes
- ``plot_3d_terrain()`` - Create 3D terrain visualizations

Inundation Mapping
------------------

Functions for flood visualization:

- ``plot_inundation_map()`` - Create inundation depth maps
- ``create_flood_animation()`` - Generate flood animation sequences
- ``plot_depth_duration_curves()`` - Plot depth-duration relationships

Interactive Plotting
--------------------

Functions for interactive visualizations:

- ``create_interactive_map()`` - Create interactive web maps
- ``dashboard_app()`` - Launch interactive dashboard
- ``export_to_web()`` - Export visualizations for web
