Installation Guide
==================

PyWMP can be installed in several ways depending on your needs and environment.

Requirements
------------

PyWMP requires Python 3.8 or later and has the following dependencies:

Core Dependencies
~~~~~~~~~~~~~~~~~

- numpy >= 1.20.0
- scipy >= 1.7.0
- matplotlib >= 3.4.0
- pandas >= 1.3.0
- geopandas >= 0.10.0
- rasterio >= 1.2.0
- networkx >= 2.6.0
- shapely >= 1.8.0

Optional Dependencies
~~~~~~~~~~~~~~~~~~~~~

- plotly >= 5.0.0 (for interactive visualization)
- streamlit >= 1.0.0 (for web applications)
- arcpy (for ArcGIS integration)
- jupyter >= 1.0.0 (for notebook examples)

Installation Methods
--------------------

Method 1: PyPI (Recommended)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The easiest way to install PyWMP is using pip:

.. code-block:: bash

   pip install pywmp

For the complete installation with optional dependencies:

.. code-block:: bash

   pip install pywmp[all]

Or install specific optional features:

.. code-block:: bash

   # For visualization features
   pip install pywmp[viz]
   
   # For GIS features
   pip install pywmp[gis]
   
   # For web applications
   pip install pywmp[web]

Method 2: Development Installation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To install the latest development version from GitHub:

.. code-block:: bash

   git clone https://github.com/mandalanil/pywmp.git
   cd pywmp
   pip install -e .

For developers who want to contribute:

.. code-block:: bash

   git clone https://github.com/mandalanil/pywmp.git
   cd pywmp
   pip install -e .[dev]

Method 3: Conda Installation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

PyWMP is also available through conda-forge:

.. code-block:: bash

   conda install -c conda-forge pywmp

ArcGIS Pro Installation
~~~~~~~~~~~~~~~~~~~~~~~

For ArcGIS Pro users, install the toolbox package:

.. code-block:: bash

   conda install -c esri -c conda-forge pywmp-arcgis

Verification
------------

To verify your installation, run:

.. code-block:: python

   import pywmp
   print(f"PyWMP version: {pywmp.__version__}")
   
   # Run basic test
   pywmp.test()

You should see output confirming successful installation and all tests passing.

Environment Setup
-----------------

Virtual Environment (Recommended)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

It's recommended to install PyWMP in a virtual environment:

.. code-block:: bash

   # Create virtual environment
   python -m venv pywmp_env
   
   # Activate (Windows)
   pywmp_env\Scripts\activate
   
   # Activate (Linux/Mac)
   source pywmp_env/bin/activate
   
   # Install PyWMP
   pip install pywmp[all]

Conda Environment
~~~~~~~~~~~~~~~~~

Alternatively, use conda:

.. code-block:: bash

   # Create conda environment
   conda create -n pywmp python=3.9
   conda activate pywmp
   
   # Install PyWMP
   conda install -c conda-forge pywmp

Troubleshooting
---------------

Common Issues
~~~~~~~~~~~~~

**ImportError: No module named 'pywmp'**

Make sure you have activated the correct environment and installed PyWMP.

**GDAL/GEOS installation issues**

On Windows, install from conda-forge:

.. code-block:: bash

   conda install -c conda-forge gdal geos

On Ubuntu/Debian:

.. code-block:: bash

   sudo apt-get install gdal-bin libgdal-dev libgeos-dev

On macOS:

.. code-block:: bash

   brew install gdal geos

**Memory issues with large DEMs**

For large datasets, increase available memory:

.. code-block:: python

   import pywmp
   pywmp.config.set_memory_limit('8GB')

Getting Help
~~~~~~~~~~~~

If you encounter issues:

1. Check the `FAQ <faq.html>`_
2. Search existing `GitHub Issues <https://github.com/mandalanil/pywmp/issues>`_
3. Ask questions in `Discussions <https://github.com/mandalanil/pywmp/discussions>`_
4. Contact the development team

Next Steps
----------

After installation, continue with:

- :doc:`quickstart` - Basic usage examples
- :doc:`tutorials/index` - Step-by-step tutorials  
- :doc:`examples/index` - Real-world examples
