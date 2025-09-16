Advanced Modeling Techniques
============================

This section covers advanced modeling techniques and complex workflows in PyWMP.

Multi-Scenario Analysis
-----------------------

Running multiple scenarios for comparative analysis:

.. code-block:: python

   import pywmp
   import pandas as pd
   import matplotlib.pyplot as plt
   
   # Load watershed model
   model = pywmp.Cascade2001Model(df=watershed_data)
   
   # Define multiple rainfall scenarios
   scenarios = {
       '10yr': {'total_depth': 75.0, 'duration': 24.0},
       '25yr': {'total_depth': 95.0, 'duration': 24.0},
       '100yr': {'total_depth': 125.0, 'duration': 24.0}
   }
   
   results = {}
   for scenario_name, params in scenarios.items():
       # Create simulator for this scenario
       simulator = pywmp.HydrologicSimulator(
           graph=model.graph,
           outdir=f'results_{scenario_name}',
           start_time=0.0,
           end_time=72.0,
           time_interval=1.0
       )
       
       # Run simulation
       results[scenario_name] = simulator.run_simulation(params)
       print(f"Completed {scenario_name} scenario")

Network Analysis and Visualization
-----------------------------------

Advanced network analysis and custom visualization:

.. code-block:: python

   import networkx as nx
   import matplotlib.pyplot as plt
   
   # Analyze network properties
   graph = model.graph
   
   # Find critical flow paths
   longest_path = nx.dag_longest_path(graph)
   print(f"Critical path: {' -> '.join(longest_path)}")
   
   # Calculate network metrics
   centrality = nx.betweenness_centrality(graph)
   
   # Custom visualization with centrality
   fig, ax = plt.subplots(1, 1, figsize=(12, 8))
   
   pos = nx.spring_layout(graph)
   node_sizes = [centrality[node] * 1000 for node in graph.nodes()]
   
   nx.draw(graph, pos, ax=ax, 
           node_size=node_sizes,
           node_color='lightblue',
           edge_color='gray',
           with_labels=True)
   
   plt.title('Watershed Network with Betweenness Centrality')
   plt.show()

Time Series Analysis
--------------------

Advanced time series processing and analysis:

.. code-block:: python

   import numpy as np
   from scipy import signal
   
   # Load simulation results
   hydrograph_data = pd.read_csv('results/node_flows.csv')
   
   # Peak flow analysis
   peaks, properties = signal.find_peaks(
       hydrograph_data['discharge'], 
       height=10.0,  # minimum peak height
       distance=24   # minimum distance between peaks (hours)
   )
   
   # Calculate flow statistics
   peak_flows = hydrograph_data['discharge'].iloc[peaks]
   flow_stats = {
       'max_flow': peak_flows.max(),
       'mean_peak': peak_flows.mean(),
       'flow_volume': np.trapz(hydrograph_data['discharge'], 
                              hydrograph_data['time'])
   }
   
   print(f"Flow Statistics: {flow_stats}")

Custom Structure Implementation
-------------------------------

Implementing custom hydraulic structures:

.. code-block:: python

   def custom_weir_discharge(head, weir_width, crest_elevation, 
                           discharge_coefficient=0.62):
       """
       Custom weir discharge calculation.
       
       Parameters:
       - head: Water elevation above weir crest (m)
       - weir_width: Width of weir opening (m)  
       - crest_elevation: Elevation of weir crest (m)
       - discharge_coefficient: Weir discharge coefficient
       
       Returns:
       - discharge: Flow rate over weir (m³/s)
       """
       if head <= crest_elevation:
           return 0.0
       
       effective_head = head - crest_elevation
       discharge = (discharge_coefficient * weir_width * 
                   np.sqrt(2 * 9.81) * effective_head**1.5)
       
       return discharge
   
   # Use custom structure in simulation
   simulator.add_custom_structure('weir_001', custom_weir_discharge)
