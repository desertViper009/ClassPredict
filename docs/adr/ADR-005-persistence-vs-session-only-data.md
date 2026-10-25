# ADR-005: Ephemeral In-Memory Session State vs. Persistent Storage

> **Status**: Accepted  
> **Date**: October 2026  
> **Scope**: State Management, Storage & Data Lifecycle

---

## 1. Context

Academic applications operated by university students or advisors are frequently run on shared university laboratory computers, personal laptops, or public demonstration screens. If uploaded student grades are cached in persistent browser storage (`localStorage`, IndexedDB) or written to a local database file (SQLite), remnants of sensitive academic records persist long after the user departs, creating a severe data exposure vulnerability.

---

## 2. Alternatives Considered

* **Server Database (PostgreSQL / MySQL)**: Rejected due to unnecessary infrastructure maintenance, connection credentials, and persistent data privacy risks.
* **Persistent Client Storage (`localStorage` / IndexedDB)**: Convenient for preserving state across page reloads, but leaves unencrypted academic grades permanently stored in the browser's disk profile.
* **Volatile In-Memory JavaScript State (SELECTED)**:
  - Dataset arrays, model coefficients, and staging buffers reside exclusively in the JavaScript heap memory of the active browser tab.
  - Closing or refreshing the tab completely wipes all records from memory.
  - Users can export validated data or predictions to a local CSV file when persistence is desired.

---

## 3. Decision

Adopt **Volatile In-Memory Session State** managed via a centralized `state_manager.js` service. No sensitive academic marks will be written to `localStorage`, `sessionStorage`, or IndexedDB.

---

## 4. Consequences & Trade-offs

* **Positive**: Perfect privacy protection against shared-workstation data recovery; zero database configuration; zero lingering disk cache; instant state reset for clean demonstrations.
* **Negative**: Refreshing the browser tab clears the loaded dataset, requiring the user to re-import their CSV file (mitigated by fast, sub-50ms CSV re-import).
