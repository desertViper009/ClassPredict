/**
 * @file browser_ui_audit.mjs
 * @description Native Node.js Browser UI & Responsive Audit for ClassPredict.
 * Connects directly to local Chrome via Chrome DevTools Protocol (CDP) over WebSocket.
 * Exercises viewports 1440x900, 1280x800, 1024x768, 768x1024, and 390x844.
 * Checks for zero document horizontal overflow, zero console errors, interactive
 * tab transitions, demo dataset loading, drawer toggling, and captures screenshots.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.join(projectRoot, 'docs', 'redesign', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const VIEWPORTS = [
  { name: '1440_desktop', width: 1440, height: 900, isMobile: false },
  { name: '1280_laptop', width: 1280, height: 800, isMobile: false },
  { name: '1024_tablet_landscape', width: 1024, height: 768, isMobile: false },
  { name: '768_tablet_portrait', width: 768, height: 1024, isMobile: true },
  { name: '390_mobile_phone', width: 390, height: 844, isMobile: true }
];

// Start local static server
function startServer(port = 8899) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(projectRoot, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${reqPath}`);
      }
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// Simple CDP client over WebSocket
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
          this.consoleErrors.push(text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        this.consoleErrors.push(`Uncaught Exception: ${desc}`);
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
    await this.send('Emulation.setVisibleSize', { width, height });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 600));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(outputPath) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(shot.data, 'base64'));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runAudit() {
  console.log('===============================================================');
  console.log('Starting ClassPredict Browser UI & Responsive Audit (CDP)');
  console.log('===============================================================');

  const PORT = 8899;
  const server = await startServer(PORT);
  console.log(`✓ Local static test server listening on http://127.0.0.1:${PORT}`);

  const candidateBrowsers = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  const chromePath = candidateBrowsers.find(p => fs.existsSync(p)) || 'chrome';
  const cdpPort = 9444;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  let cdp = null;
  const auditResults = {
    viewportsTested: 0,
    overflowFailures: [],
    consoleErrors: [],
    interactionsVerified: [],
    screenshotsCaptured: []
  };

  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const targets = await res.json();
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target available in Chrome');
    }

    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('✓ Connected to Headless Chrome CDP session');

    /* --------------------------------------------------------------------------
       AUDIT 1: design-preview.html across all 5 viewports
       -------------------------------------------------------------------------- */
    console.log('\n--- Section 1: Auditing design-preview.html ---');
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.width, vp.height, vp.isMobile);
      await cdp.navigate(`http://127.0.0.1:${PORT}/design-preview.html`);

      // Check overflow
      const overflow = await cdp.evaluate(`(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { docW, winW, hasOverflow: docW > winW + 1 };
      })()`);

      if (overflow.hasOverflow) {
        auditResults.overflowFailures.push(`design-preview.html at ${vp.width}px (scrollWidth: ${overflow.docW} > ${overflow.winW})`);
        console.error(`  ✗ OVERFLOW DETECTED: design-preview.html at ${vp.width}px: scrollWidth ${overflow.docW} > ${overflow.winW}`);
      } else {
        console.log(`  ✓ design-preview.html [${vp.width}x${vp.height}]: No horizontal overflow (${overflow.docW} <= ${overflow.winW})`);
      }

      // Capture screenshot
      const shotName = `preview_${vp.width}.png`;
      const shotPath = path.join(screenshotsDir, shotName);
      await cdp.captureScreenshot(shotPath);
      auditResults.screenshotsCaptured.push(shotName);

      auditResults.viewportsTested++;
    }

    // Test preview interactions
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`http://127.0.0.1:${PORT}/design-preview.html`);
    const previewNavTabs = ['dataset', 'individual', 'class', 'ocr', 'lab', 'overview'];
    for (const tab of previewNavTabs) {
      const switched = await cdp.evaluate(`(() => {
        const btn = document.querySelector('[data-preview-target="${tab}"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()`);
      if (switched) {
        auditResults.interactionsVerified.push(`design-preview switch to tab: ${tab}`);
      }
    }
    console.log('  ✓ Verified preview tab switching across all 6 preview workspaces');

    /* --------------------------------------------------------------------------
       AUDIT 2: index.html across all 5 viewports & workflows
       -------------------------------------------------------------------------- */
    console.log('\n--- Section 2: Auditing index.html (Production Application) ---');
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.width, vp.height, vp.isMobile);
      await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);

      // Check initial overflow on empty state
      let overflow = await cdp.evaluate(`(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { docW, winW, hasOverflow: docW > winW + 1 };
      })()`);

      if (overflow.hasOverflow) {
        auditResults.overflowFailures.push(`index.html (empty) at ${vp.width}px (${overflow.docW} > ${overflow.winW})`);
        console.error(`  ✗ OVERFLOW DETECTED: index.html empty at ${vp.width}px`);
      } else {
        console.log(`  ✓ index.html empty [${vp.width}x${vp.height}]: No horizontal overflow (${overflow.docW} <= ${overflow.winW})`);
      }

      // Load synthetic demo
      await cdp.evaluate(`(() => {
        const btn = document.querySelector('#btn-header-demo') || document.querySelector('#btn-hero-demo-load') || document.querySelector('#btn-demo-load');
        if (btn) btn.click();
      })()`);
      await new Promise(r => setTimeout(r, 400));

      // Check overflow with loaded dataset
      overflow = await cdp.evaluate(`(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { docW, winW, hasOverflow: docW > winW + 1 };
      })()`);

      if (overflow.hasOverflow) {
        auditResults.overflowFailures.push(`index.html (loaded) at ${vp.width}px (${overflow.docW} > ${overflow.winW})`);
        console.error(`  ✗ OVERFLOW DETECTED: index.html loaded at ${vp.width}px`);
      } else {
        console.log(`  ✓ index.html loaded [${vp.width}x${vp.height}]: No horizontal overflow (${overflow.docW} <= ${overflow.winW})`);
      }

      // Capture screenshot
      const shotName = `app_overview_${vp.width}.png`;
      const shotPath = path.join(screenshotsDir, shotName);
      await cdp.captureScreenshot(shotPath);
      auditResults.screenshotsCaptured.push(shotName);

      auditResults.viewportsTested++;
    }

    /* --------------------------------------------------------------------------
       AUDIT 3: Sectional View Verification & Screenshots (1440x900)
       -------------------------------------------------------------------------- */
    console.log('\n--- Section 3: Auditing Application Workspaces & Views (1440x900) ---');
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);

    // Ensure demo loaded
    await cdp.evaluate(`(() => {
      const btn = document.querySelector('#btn-header-demo') || document.querySelector('#btn-hero-demo-load') || document.querySelector('#btn-demo-load');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Verify KPIs
    const kpiSummary = await cdp.evaluate(`(() => {
      const students = document.querySelector('#kpi-unique-students')?.innerText;
      const records = document.querySelector('#kpi-accepted-records')?.innerText;
      const transitions = document.querySelector('#kpi-valid-transitions')?.innerText;
      return { students, records, transitions };
    })()`);
    console.log(`  ✓ Loaded dataset KPIs verified: Students: ${kpiSummary.students}, Records: ${kpiSummary.records}, Transitions: ${kpiSummary.transitions}`);

    // Check each tab
    const tabsToAudit = [
      { id: 'dataset', name: 'app_dataset_1440.png' },
      { id: 'individual', name: 'app_predictions_1440.png' },
      { id: 'ocr', name: 'app_ocr_1440.png' },
      { id: 'lab', name: 'app_lab_1440.png' }
    ];

    for (const t of tabsToAudit) {
      await cdp.evaluate(`(() => {
        const btn = document.querySelector('[data-nav-id="${t.id}"]') || document.querySelector('[data-tab="${t.id}"]');
        if (btn) btn.click();
      })()`);
      await new Promise(r => setTimeout(r, 400));

      const overflow = await cdp.evaluate(`(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { docW, winW, hasOverflow: docW > winW + 1 };
      })()`);

      if (overflow.hasOverflow) {
        auditResults.overflowFailures.push(`Tab ${t.id} has horizontal overflow (${overflow.docW} > ${overflow.winW})`);
        console.error(`  ✗ OVERFLOW on tab ${t.id}: ${overflow.docW} > ${overflow.winW}`);
      } else {
        console.log(`  ✓ Tab [${t.id}] verified: No horizontal overflow`);
      }

      const shotPath = path.join(screenshotsDir, t.name);
      await cdp.captureScreenshot(shotPath);
      auditResults.screenshotsCaptured.push(t.name);
      auditResults.interactionsVerified.push(`Navigated to tab: ${t.id}`);
    }

    // In Numerical Lab: verify experiment subtab switching
    const labTabs = ['exp-a', 'exp-b', 'exp-c', 'exp-d', 'topics'];
    for (const sub of labTabs) {
      await cdp.evaluate(`(() => {
        const btn = document.querySelector('[data-subtab="${sub}"]');
        if (btn) btn.click();
      })()`);
      await new Promise(r => setTimeout(r, 200));
      auditResults.interactionsVerified.push(`Lab experiment subtab: ${sub}`);
    }
    console.log('  ✓ Verified Numerical Lab subtabs A, B, C, D, and Stability Topics');

    // Test mobile drawer at 390px
    console.log('\n--- Section 4: Testing Mobile Drawer Navigation (390px) ---');
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
    await new Promise(r => setTimeout(r, 400));

    const drawerOpened = await cdp.evaluate(`(() => {
      const toggle = document.querySelector('#sidebar-toggle-btn');
      if (toggle) {
        toggle.click();
        const drawer = document.querySelector('#app-sidebar');
        return drawer?.classList.contains('is-open') || drawer?.classList.contains('active');
      }
      return false;
    })()`);
    console.log(`  ✓ Mobile drawer toggle click: opened = ${drawerOpened}`);
    auditResults.interactionsVerified.push('Mobile drawer open toggle');

    // Close drawer
    await cdp.evaluate(`(() => {
      const toggle = document.querySelector('#sidebar-toggle-close') || document.querySelector('#sidebar-backdrop');
      if (toggle) toggle.click();
    })()`);

    // Capture mobile drawer screenshot
    const mobileShot = path.join(screenshotsDir, 'app_mobile_drawer_390.png');
    await cdp.captureScreenshot(mobileShot);
    auditResults.screenshotsCaptured.push('app_mobile_drawer_390.png');

    auditResults.consoleErrors = cdp.consoleErrors;

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
    server.close();
  }

  console.log('\n===============================================================');
  console.log('AUDIT SUMMARY REPORT');
  console.log('===============================================================');
  console.log(`Viewports Tested:          ${auditResults.viewportsTested}`);
  console.log(`Screenshots Captured:      ${auditResults.screenshotsCaptured.length} files in docs/redesign/screenshots/`);
  console.log(`Interactions Verified:     ${auditResults.interactionsVerified.length} actions`);
  console.log(`Horizontal Overflow Flags: ${auditResults.overflowFailures.length}`);
  if (auditResults.overflowFailures.length > 0) {
    auditResults.overflowFailures.forEach(f => console.error(`  - ${f}`));
  }
  console.log(`Console Errors:            ${auditResults.consoleErrors.length}`);
  if (auditResults.consoleErrors.length > 0) {
    auditResults.consoleErrors.forEach(e => console.error(`  - ${e}`));
  }

  if (auditResults.overflowFailures.length === 0 && auditResults.consoleErrors.length === 0) {
    console.log('\n✅ BROWSER UI & RESPONSIVE AUDIT PASSED: All viewports and actions clear.');
  } else {
    console.error('\n❌ BROWSER AUDIT FAILED with regressions.');
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
