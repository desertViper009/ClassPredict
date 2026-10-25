# ADR-001: Selection of Client-Side Web Architecture (HTML5 / Vanilla CSS / ES6 Modules)

> **Status**: Accepted  
> **Date**: October 2026  
> **Scope**: System Architecture & Technology Stack

---

## 1. Context

ClassPredict is an undergraduate Computer Science & Engineering final project in **Numerical Methods**. The system must fulfill two distinct objectives:
1. Provide a rigorous, mathematically defensible, and testable implementation of numerical linear algebra and regression algorithms.
2. Deliver a responsive, portfolio-worthy web interface (Obsidian & Crimson dark aesthetic) suitable for academic defense and professional showcase.
3. Guarantee that student academic transcripts are processed ethically with zero privacy leaks.

---

## 2. Alternatives Considered

### Alternative A: Python Full-Stack (FastAPI / Flask + React / Next.js)
* *Pros*: Native Python scientific ecosystem (`numpy`, `scipy`).
* *Cons*: 
  - Massive friction during academic defense: evaluators must install Python virtual environments, pip packages, and Node modules.
  - Examiner skepticism during viva: "Did you actually write Gaussian elimination, or did you just call `numpy.linalg.solve`?"
  - Security liability: Uploaded gradesheets must traverse HTTP endpoints to a backend server.

### Alternative B: Full-Stack Next.js with PostgreSQL Database
* *Pros*: Modern server components, easy backend API routes.
* *Cons*: Severe architectural over-engineering. Requires hosting databases, running database migrations, managing server credentials, and assuming GDPR/FERPA compliance liabilities for stored grades.

### Alternative C: Client-Side Single Page Application (HTML5 / Vanilla CSS3 / Modular ES6 JavaScript) — SELECTED
* *Pros*:
  - **Pedagogical Purity**: Every matrix operation, row pivot, and polynomial table is implemented directly in clean, readable JavaScript. No opaque black-box libraries.
  - **Zero Privacy Leakage**: All computation, file reading, and OCR occurs locally in the user's browser runtime. Zero bytes travel across a network.
  - **Zero Deployment Overhead**: Runs instantly via any static file server (`python -m http.server` or GitHub Pages).
  - **Portfolio Excellence**: Pure Vanilla CSS ensures complete styling control over the obsidian/crimson dark palette without framework bloat.
* *Cons*:
  - Heavy OCR tasks (Tesseract.js) must run in browser Web Workers.
  - Client workstation CPU bound.

---

## 3. Decision

Adopt **Alternative C**: A client-side web application built with HTML5, custom Vanilla CSS3 design system, and modular ES6 JavaScript. Document extraction uses PDF.js and Tesseract.js running in local Web Workers. Automated testing is executed via Node.js test runner against headless pure numerical modules.

---

## 4. Consequences & Trade-offs

* **Positive**: Evaluators can open the project in any browser with zero setup. Student privacy is cryptographically guaranteed by network isolation. All numerical algorithms are 100% transparent and inspectable.
* **Negative**: In-browser OCR processing takes 2–4 seconds per cropped column depending on client hardware.
