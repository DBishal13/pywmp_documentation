Cascade2001 Tutorial
===================

This tutorial provides a comprehensive guide to using the Cascade2001Model in PyWMP for watershed modeling.

Introduction to Cascade2001
----------------------------

The Cascade2001 methodology is a network-based approach for modeling watershed systems. It represents watersheds as directed graphs where:

- **Nodes** represent hydrologic units (basins, pumps, spillways, outlets)
- **Edges** represent flow connections between units
- **Attributes** store physical and hydraulic properties

Setting Up Your Data
---------------------

The Cascade2001Model requires watershed data in a specific format. The most common approach is using an Excel file with the following columns:

.. code-block:: text

   Required Columns:
   - Name (From Basin): Unique identifier for each node
   - To Basin: Downstream connection(s), comma-separated if multiple
   - Long: Longitude coordinate (decimal degrees)
   - Lat: Latitude coordinate (decimal degrees)
   - Node Type: Classification (basin, pump, spillway, outlet)
   
   Optional Columns:
   - Area: Drainage area (km²)
   - Storage: Storage capacity (m³)
   - Elevation: Node elevation (m)

Step 1: Loading and Creating the Model
---------------------------------------

.. code-block:: python

   import pywmp
   import pandas as pd
   import matplotlib.pyplot as plt
   
   # Load watershed data
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
   
   print(f"Model created with {len(model.graph.nodes)} nodes")
   print(f"Network has {len(model.graph.edges)} connections")

Step 2: Exploring the Network
-----------------------------

.. code-block:: python

   # Get network information
   graph = model.graph
   
   # Find all basin nodes
   basins = [node for node, data in graph.nodes(data=True) 
            if data.get('type') == 'basin']
   print(f"Number of basins: {len(basins)}")
   
   # Find pump stations
   pumps = [node for node, data in graph.nodes(data=True) 
           if data.get('type') == 'pump']
   print(f"Number of pumps: {len(pumps)}")
   
   # Find outlet nodes (nodes with no downstream connections)
   outlets = [node for node in graph.nodes() 
             if graph.out_degree(node) == 0]
   print(f"Outlet nodes: {outlets}")

Step 3: Network Visualization
-----------------------------

.. code-block:: python

   # Basic network plot
   model.plot_network()
   
   # Customized visualization
   fig, ax = plt.subplots(1, 1, figsize=(12, 10))
   
   # Get node positions from coordinates
   pos = {node: (data['pos'][0], data['pos'][1]) 
          for node, data in graph.nodes(data=True)}
   
   # Color nodes by type
   node_colors = []
   for node, data in graph.nodes(data=True):
       node_type = data.get('type', 'unknown')
       if node_type == 'basin':
           node_colors.append('lightblue')
       elif node_type == 'pump':
           node_colors.append('red')
       elif node_type == 'spillway':
           node_colors.append('orange')
       else:
           node_colors.append('gray')
   
   # Draw network
   nx.draw(graph, pos, ax=ax,
           node_color=node_colors,
           node_size=300,
           edge_color='black',
           arrows=True,
           arrowsize=20,
           with_labels=True,
           font_size=8)
   
   plt.title('Cascade2001 Watershed Network')
   plt.show()

Step 4: Setting Up Simulation
-----------------------------

.. code-block:: python

   # Create hydrologic simulator
   simulator = pywmp.HydrologicSimulator(
       graph=model.graph,
       outdir='cascade2001_results',
       start_time=0.0,
       end_time=72.0,
       time_interval=1.0
   )
   
   # Define initial conditions
   initial_conditions = {}
   for node in model.graph.nodes():
       initial_conditions[node] = {
           'water_level': 0.0,
           'storage': 0.0,
           'inflow': 0.0
       }

Step 5: Running Simulation
--------------------------

.. code-block:: python

   # Define rainfall scenario
   rainfall_scenario = {
       'total_depth': 100.0,  # mm
       'duration': 24.0,      # hours
       'distribution': 'sfwmd'
   }
   
   # Run simulation
   results = simulator.run_simulation(
       initial_conditions=initial_conditions,
       rainfall=rainfall_scenario
   )
   
   print("Simulation completed successfully!")

Step 6: Analyzing Results
-------------------------

.. code-block:: python

   # Load simulation results
   node_flows = pd.read_csv('cascade2001_results/node_flows.csv')
   water_levels = pd.read_csv('cascade2001_results/water_levels.csv')
   
   # Plot hydrographs for key nodes
   fig, axes = plt.subplots(2, 2, figsize=(15, 10))
   
   # Plot flows at outlet
   outlet_node = outlets[0]
   outlet_flows = node_flows[node_flows['node'] == outlet_node]
   axes[0,0].plot(outlet_flows['time'], outlet_flows['discharge'])
   axes[0,0].set_title(f'Outlet Flow - {outlet_node}')
   axes[0,0].set_xlabel('Time (hours)')
   axes[0,0].set_ylabel('Discharge (m³/s)')
   
   # Plot water levels at a key basin
   key_basin = basins[0]
   basin_levels = water_levels[water_levels['node'] == key_basin]
   axes[0,1].plot(basin_levels['time'], basin_levels['level'])
   axes[0,1].set_title(f'Water Level - {key_basin}')
   axes[0,1].set_xlabel('Time (hours)')
   axes[0,1].set_ylabel('Water Level (m)')
   
   # Plot pump operations if pumps exist
   if pumps:
       pump_flows = node_flows[node_flows['node'] == pumps[0]]
       axes[1,0].plot(pump_flows['time'], pump_flows['discharge'])
       axes[1,0].set_title(f'Pump Discharge - {pumps[0]}')
       axes[1,0].set_xlabel('Time (hours)')
       axes[1,0].set_ylabel('Discharge (m³/s)')
   
   # Plot total system inflow
   total_inflow = node_flows.groupby('time')['inflow'].sum().reset_index()
   axes[1,1].plot(total_inflow['time'], total_inflow['inflow'])
   axes[1,1].set_title('Total System Inflow')
   axes[1,1].set_xlabel('Time (hours)')
   axes[1,1].set_ylabel('Inflow (m³/s)')
   
   plt.tight_layout()
   plt.show()

Best Practices
--------------

1. **Data Quality**: Ensure your watershed data is complete and consistent
2. **Network Connectivity**: Verify all nodes have proper upstream/downstream connections
3. **Coordinate Systems**: Use consistent coordinate system for all spatial data
4. **Time Steps**: Choose appropriate time intervals for your simulation needs
5. **Validation**: Compare results with observed data when available

Common Issues and Solutions
---------------------------

**Issue**: "Node not found in graph"
**Solution**: Check node naming consistency between data sources

**Issue**: "Circular dependencies detected"
**Solution**: Review network connectivity for loops or cycles

**Issue**: "Simulation diverges"
**Solution**: Reduce time step or check initial conditions

**Issue**: "Memory errors with large networks"
**Solution**: Consider network simplification or increase system memory
