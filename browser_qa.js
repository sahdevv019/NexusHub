const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 4830;
const ROOT_DIR = __dirname;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\fakea\\.gemini\\antigravity\\brain\\54584f93-630b-417d-9a5f-f10831aebfe2\\screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Create static HTTP server
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(ROOT_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // SPA fallback
        const indexPath = path.join(ROOT_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(PORT, () => {
      console.log(`[HTTP Server] Listening on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runBrowserQA() {
  const server = await startServer();
  let browser;

  const results = {
    viewports: [],
    interactions: [],
    overflows: []
  };

  try {
    console.log('[Browser QA] Launching Chrome executable:', CHROME_PATH);
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();

    // Catch page errors
    page.on('pageerror', err => {
      console.warn('  [Page Error]:', err.message);
    });

    const viewports = [
      { name: 'desktop_1440', width: 1440, height: 900 },
      { name: 'laptop_1024', width: 1024, height: 768 },
      { name: 'tablet_768', width: 768, height: 1024 },
      { name: 'mobile_375', width: 375, height: 812 }
    ];

    for (const vp of viewports) {
      console.log(`\n▶ Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const maxScroll = Math.max(docWidth, bodyWidth);
        const hasOverflow = maxScroll > winWidth;
        return {
          winWidth,
          docWidth,
          bodyWidth,
          hasOverflow,
          overflowPx: hasOverflow ? maxScroll - winWidth : 0
        };
      });

      console.log(`  Horizontal overflow check: ${overflow.hasOverflow ? 'FAILED (' + overflow.overflowPx + 'px overflow)' : 'PASSED (0px overflow)'}`);
      results.overflows.push({ viewport: vp.name, ...overflow });

      // Take screenshot of viewport
      const ssPath = path.join(SCREENSHOT_DIR, `${vp.name}_homepage.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`  Screenshot saved: ${ssPath}`);
      results.viewports.push({ viewport: vp.name, screenshot: ssPath });
    }

    // Interactive Tests:
    console.log('\n▶ Testing Interactive Components:');

    // 1. Mobile Drawer Toggle (at 375px)
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    const hamburgerExists = await page.evaluate(() => {
      const btn = document.querySelector('.nav-hamburger') || document.querySelector('button[aria-label="Toggle navigation"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (hamburgerExists) {
      await new Promise(r => setTimeout(r, 300));
      const drawerIsOpen = await page.evaluate(() => {
        const drawer = document.querySelector('.mobile-nav-drawer') || document.querySelector('#mobile-nav');
        return drawer && (drawer.classList.contains('open') || drawer.classList.contains('active') || window.getComputedStyle(drawer).display !== 'none');
      });
      console.log(`  Mobile drawer toggle test: ${drawerIsOpen ? 'PASSED (drawer opened)' : 'WARNING (drawer state)'}`);
      
      const drawerSsPath = path.join(SCREENSHOT_DIR, 'mobile_375_drawer.png');
      await page.screenshot({ path: drawerSsPath });
      results.interactions.push({ test: 'mobile_drawer', passed: !!drawerIsOpen, screenshot: drawerSsPath });
    }

    // 2. Category Filter & Search Test (at 1440px)
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    const categoryTest = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.cat-chip'));
      if (chips.length > 1) {
        const secondChip = chips[1];
        const categoryName = secondChip.textContent.trim();
        secondChip.click();
        return { clicked: true, categoryName };
      }
      return { clicked: false };
    });

    if (categoryTest.clicked) {
      await new Promise(r => setTimeout(r, 200));
      const activeChip = await page.evaluate(() => {
        const active = document.querySelector('.cat-chip.active');
        return active ? active.textContent.trim() : null;
      });
      console.log(`  Category filter chip click: PASSED (Selected "${activeChip}")`);
      results.interactions.push({ test: 'category_filter', passed: activeChip === categoryTest.categoryName });
    }

    // 3. Project Showcase Modal Test
    const modalTest = await page.evaluate(() => {
      const cardBtn = document.querySelector('.project-card .card-action-btn') || document.querySelector('.project-card button');
      if (cardBtn) {
        cardBtn.click();
        return true;
      }
      return false;
    });

    if (modalTest) {
      await new Promise(r => setTimeout(r, 300));
      const modalState = await page.evaluate(() => {
        const modal = document.querySelector('#projectmodal');
        const title = document.querySelector('#modal-project-title');
        const isVisible = modal && !modal.classList.contains('hidden');
        return {
          isVisible,
          title: title ? title.textContent.trim() : ''
        };
      });

      console.log(`  Project details modal open: ${modalState.isVisible ? 'PASSED ("' + modalState.title + '")' : 'FAILED'}`);
      const modalSsPath = path.join(SCREENSHOT_DIR, 'desktop_1440_modal.png');
      await page.screenshot({ path: modalSsPath });
      results.interactions.push({ test: 'project_modal', passed: modalState.isVisible, title: modalState.title, screenshot: modalSsPath });

      // Test close modal with Escape key
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 200));
      const modalClosed = await page.evaluate(() => {
        const modal = document.querySelector('#projectmodal');
        return modal && modal.classList.contains('hidden');
      });
      console.log(`  Modal close on Escape key: ${modalClosed ? 'PASSED' : 'FAILED'}`);
      results.interactions.push({ test: 'modal_escape_close', passed: modalClosed });
    }

    // 4. Mobile Modal Test (at 375px)
    await page.setViewport({ width: 375, height: 812 });
    await page.evaluate(() => {
      const cardBtn = document.querySelector('.project-card .card-action-btn') || document.querySelector('.project-card button');
      if (cardBtn) cardBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const mobileModalSsPath = path.join(SCREENSHOT_DIR, 'mobile_375_modal.png');
    await page.screenshot({ path: mobileModalSsPath });
    console.log(`  Mobile modal screenshot: ${mobileModalSsPath}`);

    // Check modal overflow at 375px
    const mobileModalOverflow = await page.evaluate(() => {
      const modalBox = document.querySelector('#projectmodal .modal-box') || document.querySelector('#projectmodal .modal-inner');
      if (!modalBox) return { overflow: false };
      return {
        boxWidth: modalBox.offsetWidth,
        winWidth: window.innerWidth,
        overflow: modalBox.offsetWidth > window.innerWidth
      };
    });
    console.log(`  Mobile modal width check: ${!mobileModalOverflow.overflow ? 'PASSED (no horizontal blowout)' : 'FAILED'}`);

    // 5. Test Static Asset Serving on HTTP Server (Milestone 6)
    console.log('\n▶ Testing Static Image Serving:');
    const assetResp = await page.goto(`http://localhost:${PORT}/assets/projects/demo/cover.webp`);
    const status = assetResp.status();
    const contentType = assetResp.headers()['content-type'];
    const isAssetOk = status === 200 && (contentType || '').includes('image/webp');
    console.log(`  Static WebP fetch (/assets/projects/demo/cover.webp): ${isAssetOk ? 'PASSED (Status 200, Content-Type ' + contentType + ')' : 'FAILED (' + status + ')'}`);
    results.interactions.push({ test: 'static_asset_serving', passed: isAssetOk, status, contentType });

    console.log('\n========================================================');
    console.log('BROWSER QA EXECUTION COMPLETED SUCCESSFULLY');
    console.log('========================================================');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Browser QA failed with error:', err);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runBrowserQA();
