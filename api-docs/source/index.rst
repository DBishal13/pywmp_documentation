PyWMP API Documentation
========================

.. note::
   This is the **API Documentation** for PyWMP Python library. 
   
   For the main project documentation, visit: `PyWMP Documentation Website <../../../docs/index.html>`_

.. image:: https://img.shields.io/badge/python-3.8%2B-blue.svg
   :target: https://www.python.org/downloads/
   :alt: Python Version

.. image:: https://img.shields.io/github/license/mandalanil/pywmp.svg
   :target: https://github.com/mandalanil/pywmp/blob/main/LICENSE
   :alt: License

**PyWMP API Documentation** provides comprehensive reference for the PyWMP Python library.
This documentation covers all modules, classes, and functions available in the pywmp package.

📚 API Reference Overview
-------------------------

This documentation is organized into the following sections:

- **Installation & Quick Start**: Getting started with the API
- **Core Modules**: Main modeling and simulation components  
- **Models API**: Cascade2001Model and watershed representation
- **Simulation API**: HydrologicSimulator and flow routing
- **Hydrograph & Hyetograph**: Time series processing
- **Structure Flows**: Pumps, spillways, and hydraulic structures
- **Utilities**: Helper functions and data processing

.. toctree::
   :maxdepth: 2
   :caption: Getting Started:

   installation
   quickstart

.. toctree::
   :maxdepth: 2
   :caption: API Reference:

   api/models
   api/simulation
   api/hydrograph
   api/hyetograph  
   api/runoff
   api/structure_flows
   api/stage_storage

.. toctree::
   :maxdepth: 2
   :caption: Examples:

   examples/basic_usage
   examples/advanced_modeling
   tutorials/cascade2001_tutorial

🚀 Quick Start
--------------

Installation
~~~~~~~~~~~~

.. code-block:: bash

   # Install from PyPI
   pip install pywmp

   # Or install from source
   git clone https://github.com/mandalanil/pywmp.git
   cd pywmp
   pip install -e .

Basic Usage
~~~~~~~~~~~

.. code-block:: python

   import pywmp
   import pandas as pd

   # Create watershed model from Excel data
   df = pd.read_excel('data/Nodes.xlsx')
   model = pywmp.Cascade2001Model(
       df=df,
       from_col='Name (From Basin)',
       to_col='To Basin',
       lon_col='Long',
       lat_col='Lat'
   )

   # Create hydrologic simulator
   simulator = pywmp.HydrologicSimulator(
       graph=model.graph,
       outdir='results',
       start_time=0.0,
       end_time=72.0
   )

   # Generate unit hydrograph
   unit_hydrograph = pywmp.gdcuh(
       watershed_area=25.0,
       time_to_peak=2.5
   )

🤝 Community & Support
----------------------

- **GitHub Repository**: https://github.com/mandalanil/pywmp
- **Main Documentation**: `PyWMP Documentation Website <../../../docs/index.html>`_
- **PyPI Package**: https://pypi.org/project/pywmp/
- **Issues**: https://github.com/mandalanil/pywmp/issues

📊 Research Applications
------------------------

PyWMP is used by researchers worldwide for:

- Flood risk assessment and mitigation planning
- Urban drainage system design and optimization  
- Climate change impact studies on watersheds
- Water resource management and planning
- Network-based hydrological modeling research

🏆 Citation
-----------

If you use PyWMP in your research, please cite:

.. code-block:: bibtex

   @software{pywmp2025,
     title={PyWMP: Python Watershed Modeling Package},
     author={PyWMP Development Team},
     year={2025},
     url={https://github.com/mandalanil/pywmp},
     version={1.0.0}
   }

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
