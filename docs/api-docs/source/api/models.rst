Models Module
=============

The :mod:`pywmp.models` module provides core watershed modeling functionality, primarily the Cascade2001Model class.

.. automodule:: pywmp.models
   :members:
   :undoc-members:
   :show-inheritance:

Cascade2001Model Class
----------------------

The Cascade2001Model implements the Cascade 2001 methodology for watershed routing and flow simulation using NetworkX graphs.

.. autoclass:: pywmp.models.Cascade2001Model
   :members:
   :undoc-members:
   :show-inheritance:

Key Features
------------

- **Graph-Based Modeling**: Uses NetworkX DiGraph for watershed representation
- **Node Classification**: Supports different node types (pumps, spillways, basins)
- **Visualization**: Built-in plotting capabilities with geographic coordinates
- **Excel Integration**: Direct import from Excel watershed definition files

Usage Example
-------------

.. code-block:: python

   import pywmp
   import pandas as pd
   
   # Load watershed data from Excel
   df = pd.read_excel('watershed_nodes.xlsx')
   
   # Create Cascade2001 model
   model = pywmp.Cascade2001Model(
       df=df,
       from_col='Name (From Basin)',
       to_col='To Basin',
       lon_col='Long',
       lat_col='Lat',
       node_type_col='Node Type'
   )
   
   # Access the NetworkX graph
   print(f"Number of nodes: {len(model.graph.nodes)}")
   print(f"Number of edges: {len(model.graph.edges)}")
   
   # Plot the watershed network
   model.plot_network()

- ``create_channel_network()`` - Create NetworkX graph from stream data
- ``calculate_network_properties()`` - Calculate network topology metrics
- ``find_critical_nodes()`` - Identify critical points in network
