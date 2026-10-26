# Deployment & Runtime Guide — Gradivue

> **Document ID**: DOC-DEP-001  
> **Status**: Approved & Verified (Phase 10 Production Deployment & Hardening Complete)  
> **Lifecycle State**: Deployed & Verified  
> **Last Updated**: October 2026

---

## 1. Runtime Environment & Tooling Clarity

Gradivue is a static client-side web application built with vanilla HTML5, CSS3, and ES6 JavaScript modules.

### 1.1 Requirements Breakdown:

| Workflow | Minimum Requirements | Notes |
| :--- | :--- | :--- |
| **Running the App Locally** | Modern Web Browser + Local HTTP Server (Python `http.server` or Node `npx serve`) | **Local HTTP server is required** because opening `index.html` via `file://` triggers browser CORS restrictions on ES6 module imports. |
| **Running Automated Tests** | Node.js LTS (v18+) | **Node.js is required ONLY for developer testing** (`npm test`). It is not a backend server for the web app. |
| **Production Hosting** | Any standard static file host (GitHub Pages, Cloudflare Pages, Vercel, Netlify, Nginx) | Zero backend API, database, or server runtime required. |

> [!NOTE]
> **No "Zero-Setup" Misrepresentation**: We do not claim zero-setup execution. A local HTTP server is required to test or run ES6 modules locally in compliance with browser security models.

---

## 2. Local Workstation Execution

### 2.1 Launching via Python (Built-in)
```bash
# Navigate to project root
cd /path/to/ClassPredict

# Launch local HTTP server
python -m http.server 8000
```
Open a browser and navigate to: `http://localhost:8000`

### 2.2 Launching via Node.js
```bash
npx serve . -l 8000
```

---

## 3. Browser-Side OCR Asset Delivery & Privacy

To protect student data, we distinguish between **downloading static application assets** and **transmitting user data**:

### 3.1 Static Asset Ingestion & Vendor Libraries:
In `index.html`, the browser runtime loads the following vendor libraries for document decoding and OCR:
```html
<!-- PDF.js v3.11.174 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
</script>

<!-- Tesseract.js v5 -->
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
```

* **Asset Transparency & Network Requirement**:
  - Because `pdf.min.js`, `pdf.worker.min.js`, `tesseract.min.js`, and the English OCR language model (`eng.traineddata`, $\approx 4\text{MB}$) are fetched from CDNs on the initial page load, **an initial internet connection is required to fetch these script assets**.
  - **Honest Privacy Disclosure**: The application does *not* claim 100% offline out-of-the-box operation when loading assets from CDNs. Once cached by the browser service worker or browser cache, subsequent sessions function without network connectivity.
  - To achieve 100% air-gapped offline operation, administrators may vendor these static assets directly into a local `/vendor/` directory and update the `src` attributes in `index.html`.

### 3.2 Verification of Data Isolation:
* **Zero Outbound Data Transmission**: All mark sheet rendering, sub-canvas cropping, Web Worker OCR recognition, and key reconciliation occur locally in volatile browser memory.
* **Verification Procedure**:
  1. Open Chrome/Firefox DevTools $\to$ **Network** tab.
  2. Filter by `Fetch/XHR`.
  3. Upload an image marksheet or PDF marksheet.
  4. Perform crop, OCR recognition, review, and dataset commitment.
  5. Observe that **zero outgoing HTTP requests** containing student marks, images, crops, or keys are transmitted. Only inbound static `.wasm` or `.traineddata` chunks may appear during worker initialization.
  6. Tested and verified in automated unit test suite (`TC-OCR-31` and `TC-OCR-32`).

---

## 4. Production Static Hosting

### 4.1 GitHub Pages Deployment
1. Repository: [https://github.com/desertViper009/ClassPredict](https://github.com/desertViper009/ClassPredict)
2. Live Production Site: [https://desertviper009.github.io/ClassPredict/](https://desertviper009.github.io/ClassPredict/)
3. The included GitHub Actions workflow (`.github/workflows/deploy.yml`) runs `npm test` automatically before assembling and uploading the `_site` production artifact.
4. Pages build source is configured to **GitHub Actions** (`build_type: workflow`).
5. Every push to `main` executes 226 unit and numerical tests before automatically deploying to GitHub Pages.

### 4.2 Cloudflare Pages / Vercel Deployment
* Connect GitHub repository.
* Build Command: *None* (Static site).
* Output Directory: `.` (Project root).

### 4.3 Service Worker & Offline Shell Caching (`sw.js`)
Gradivue incorporates a production Service Worker (`sw.js`) registered automatically in `js/app.js`:
* **Cache Name**: `gradivue-v1.1.0-static`.
* **Strategy**: Network-first for `index.html` navigation requests (ensuring users receive new releases when online); Cache-first with network fallback for local static assets (CSS, JS, sample dataset).
* **Strict Privacy Caching Guardrail**: The service worker explicitly ignores and **never caches** user uploads, blob URLs (`blob:*`), or student records.
* **Offline Shell Status**: A visual connection badge (`#net-status-badge`) in the top navigation bar displays `Online` (emerald) when network is connected and switches to `Offline Shell` (amber) when offline.

---

## 5. Pre-Deployment Security & Privacy Checklist

- [x] **Synthetic Data Audit**: Verified that `samples/sample_class_sgpa.csv` contains *only* synthetic records (`SYN_001` to `SYN_013`) and zero real student data.
- [x] **Git Exclusion Check**: Ensured `.gitignore` is active and that no real `.pdf`, `.png`, or `.csv` files are staged or committed.
- [x] **Console Logging Audit**: Confirmed that debugging statements dumping records have been suppressed or removed.
- [x] **Scale Verification**: Verified default grading scale is set to $[0.00, 4.00]$ and out-of-bounds warning badges render correctly.
- [x] **Zero Exfiltration**: Inspected network calls to ensure pure client-side processing without remote analytics, databases, or tracking telemetry.
- [x] **HTTPS Enforcement**: Ensured SSL/TLS is active on public deployments to safeguard local Web Worker cryptographic integrity.
