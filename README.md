# FlatGeobuf Viewer

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://do-me.github.io/flatgeobuf-viewer/)

A fast, simple, client-side web application to visualize [FlatGeobuf](https://flatgeobuf.org/) (`.fgb`) files directly in your browser.

![Screenshot of the FlatGeobuf Viewer application](https://github.com/user-attachments/assets/423226e7-9652-4624-ae7a-aa08ef42b7fb)

## Features

-   **Drag & Drop:** Easily load `.fgb` files from your local machine.
-   **Feature Inspection:** Click on any feature to view its properties in a popup.
-   **Metadata Viewer:** See the file's header metadata, including CRS, geometry type, and schema.
-   **Data Statistics:** Get a quick overview of the feature count and geometry type.
-   **Dark Mode:** Toggle between light and dark themes for comfortable viewing.
-   **Client-Side Processing:** Your data stays on your machine. No uploads, no waiting.
-   **Responsive Design:** Works on both desktop and mobile devices.

## How to Use

1.  **Open the Live Demo:** [https://do-me.github.io/flatgeobuf-viewer/](https://do-me.github.io/flatgeobuf-viewer/)
2.  **Load Data:**
    -   Drag and drop a `.fgb` file anywhere on the page.
    -   OR, click the "Load Data" box to browse for a file on your computer.
3.  **Explore:** The map will automatically zoom to your data's extent and display the features.

A default dataset is loaded on startup for demonstration.

## Data 

- NUTS3 areas downloaded from https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics
- Quickly processed and filtered with GeoPandas:

```python
import geopandas as gpd
gdf = gpd.read_file("NUTS_RG_01M_2024_3857.geojson")
gdf[
    (gdf["CNTR_CODE"].isin(["IT","DE","AT","CH","HR","SI","MC","SM","FR", "LI"])) & # random list of countries
    (gdf["LEVL_CODE"] == 3)
    ].to_crs("4326").to_file("EU_NUTS3_01M.fgb")
```

## Technology Stack

-   [FlatGeobuf](https://github.com/flatgeobuf/flatgeobuf) - For deserializing `.fgb` files.
-   [MapLibre GL JS](https://maplibre.org/) - For rendering the interactive map.
-   [Tailwind CSS](https://tailwindcss.com/) - For styling the user interface.
-   [JSON-Formatter-JS](https://github.com/mohsen1/json-formatter-js) - For pretty-printing metadata.
-   [OpenFreeMap](https://openfreemap.org/quick_start/) - For the basemap.

## Credits and Acknowledgements

-   Developed by **Dominik Weckmüller**.
-   This project is derived from and inspired by the official [FlatGeobuf MapLibre Example](https://flatgeobuf.org/examples/maplibre/).

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
