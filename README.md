# 🌤️ Windy-Style Pro Weather Dashboard

> A high-density, professional-grade meteorological dashboard built with React and HTML5 Canvas, deeply integrated with the [Open-Meteo API](https://open-meteo.com/).

This project moves beyond standard consumer weather apps, rendering high-fidelity meteorological data with advanced visualizations like **Ensemble Spaghetti Plots**, **CAPE Heatmaps**, and **Precise Sun Event Shading**, inspired by industry leaders like [Windy.com](https://www.windy.com/).

## ✨ Key Features

- **Multi-City & Multi-Date Unified Timeline**: Pass routing parameters to sequentially track weather across different locations and dates in a single unbroken horizontal scroll. (e.g., `/?route=Beijing:2026-03-24,London:2026-03-26`)
- **Advanced Ensemble Clustering**: Automatically queries `ecmwf_ifs04` (51 members), `icon_seamless`, or `gfs05` depending on forecast horizon to render **uncertainty plumes** and probability densities for **Temperature** and **Surface Pressure**.
- **Dynamic Granular Lanes**:
  - **CAPE (Convective Available Potential Energy)**: Heatmap-based warning blocks for convective and severe thunderstorm risks.
  - **UV Index**: Dynamic safety-colored numbering.
  - **Cloud Stratification**: Independent shading for High, Mid, and Low cloud coverage arrays.
  - **Precipitation**: Precipitation probability (%) juxtaposed directly against the volume (mm) chart.
  - **Wind Dynamics**: Uses strict Beaufort Scale (`bft`) mapping for base wind, plotted against dangerous peak gusts.
- **Micro-Precision Sun Events**: Real-time cross-referencing with exact `sunrise` and `sunset` times to draw pixel-perfect physical night-shade bands directly over the time axis, eliminating fixed 18:00–06:00 rendering artifacts.
- **Fallback Resilience**: Intelligent fallback logic seamlessly degrades from exact deterministic models to cluster-mean aggregations for queries extending >15 days into the future.

## 🚀 Tech Stack

- **React 18** + **Vite**: Ultra-fast frontend component architecture.
- **HTML Canvas 2D**: Performance-critical ensemble line rendering for hundreds of overlapping transparent members.
- **Vanilla CSS Flexbox**: Strict flex-layout arrays controlling variable lane heights, ensuring zero horizontal misalignment across diverse data sources.
- **Lucide React**: Crisp iconography for sun events and wind vectors.

## 📦 Getting Started

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser exactly to the printed local port (usually `localhost:5174`). Modify the URL query block (`?route=Shanghai:2026-03-26`) to instantly fetch new locations!

### Build for Production

```bash
npm run build
```
The output will reside in the `/dist` directory, completely static and ready to be dragged and dropped onto generic hosts.

## 🌐 Deploying independently

Because the app operates 100% on the client-side and interacts autonomously with the open-access Open-Meteo endpoint (no API keys required), it is exquisitely structured for static edge networks.

- **Vercel**: Import the repository and set the framework preset to `Vite`.
- **Netlify**: Same configuration. Build command: `npm run build`, Publish directory: `dist`.
- **GitHub Pages**: You can wrap the build out via GitHub Actions.

---
_Note: Geocoding is natively built right into the dashboard parser (`/v1/search`), meaning arbitrary string locations correctly resolve lat/long independently._
