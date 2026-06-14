# PyWMP Documentation

Official documentation for **PyWMP** — an open-source Python based watershed modelling and planning tool for 1D, 2D, and hybrid simulations.

## Live Site

**[dbishal13.github.io/pywmp_documentation](https://dbishal13.github.io/pywmp_documentation/)**

## What's in Here

```
pywmp_documentation/
├── docs/                        # MkDocs markdown source
│   ├── index.md                 # Homepage with hero + feature grid
│   ├── installation.md
│   ├── quickstart.md
│   ├── concepts.md
│   ├── architecture.md
│   ├── css/overrides.css        # CWR3 design system (FAU navy + hydro-cyan)
│   ├── images/
│   ├── reference/               # 16 module reference pages
│   ├── tutorials/               # 7 tutorials
│   ├── references.md            # APA bibliography with DOI links
│   ├── troubleshooting.md
│   ├── pywmp.html               # Standalone PyWMP landing page
│   ├── pywmp-pro.html           # PyWMP Pro page
│   ├── portal.html              # Documentation hub
│   ├── tools/                   # Interactive HTML tools
│   └── api-docs/source/         # Sphinx RST source files
├── overrides/                   # MkDocs theme overrides
│   ├── main.html                # Sidebar brand strip + version chip
│   └── partials/                # Footer + palette toggle
├── mkdocs.yml                   # Site config — nav, theme, extensions
├── requirements.txt             # mkdocs + mkdocs-material
└── .github/workflows/deploy.yml # Auto-deploy on push to main
```

## Local Development

```bash
git clone https://github.com/DBishal13/pywmp_documentation.git
cd pywmp_documentation
pip install -r requirements.txt
mkdocs serve
# open http://localhost:8000
```

## How Deployment Works

Every push to `main` triggers GitHub Actions → MkDocs builds → deploys to GitHub Pages. No manual steps needed.

## Contributing

Open a PR — all changes to `docs/` are reviewed before merging to main.

## Linked Repository

Source code: **[github.com/mandalanil/pywmp](https://github.com/mandalanil/pywmp)**
