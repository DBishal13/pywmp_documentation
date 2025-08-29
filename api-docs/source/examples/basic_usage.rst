Basic Usage Examples
====================

This section provides basic usage examples for getting started with PyWMP.

Example 1: Creating a Watershed Model
--------------------------------------

.. code-block:: python

   import pywmp
   import pandas as pd
   
   # Load watershed data from Excel file
   df = pd.read_excel('data/Nodes.xlsx')
   
   # Create Cascade2001 model
   model = pywmp.Cascade2001Model(
       df=df,
       from_col='Name (From Basin)',
       to_col='To Basin',
       lon_col='Long',
       lat_col='Lat',
       node_type_col='Node Type'
   )
   
   print(f"Created watershed with {len(model.graph.nodes)} nodes")

Example 2: Running a Hydrologic Simulation
-------------------------------------------

.. code-block:: python

   # Create simulation instance
   simulator = pywmp.HydrologicSimulator(
       graph=model.graph,
       outdir='results',
       start_time=0.0,
       end_time=72.0,
       time_interval=1.0
   )
   
   # Configure initial conditions
   initial_conditions = {
       'water_level': 0.0,
       'storage': 0.0
   }
   
   # Run simulation
   results = simulator.run_simulation(initial_conditions)

Example 3: Generating Unit Hydrographs
---------------------------------------

.. code-block:: python

   # Generate GDCUH unit hydrograph
   unit_hydrograph = pywmp.gdcuh(
       watershed_area=25.0,
       time_to_peak=2.5,
       peak_factor=0.75
   )
   
   # Display peak discharge
   peak_discharge = unit_hydrograph['discharge'].max()
   print(f"Peak unit discharge: {peak_discharge:.3f}")

Example 4: Structure Flow Calculations
---------------------------------------

.. code-block:: python

   # Calculate pump discharge
   pump_flow = pywmp.pump_discharge(
       water_level=2.5,
       pump_capacity=5.0,
       operating_level=1.5
   )
   
   # Calculate spillway discharge  
   spillway_flow = pywmp.gated_spillway_discharge(
       head=1.2,
       gate_opening=0.8,
       spillway_width=10.0
   )
   
   print(f"Total outflow: {pump_flow + spillway_flow:.2f} m³/s")
