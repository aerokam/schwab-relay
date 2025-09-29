const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`🔍 Incoming request: ${req.method} ${req.url}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  next();
});

// simple health check
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/schwab', async (req, res) => {
  console.log('🟡 /schwab route triggered');
  const start = Date.now();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    console.log('➡️ Navigating to Schwab...');
    await page.goto('https://www.schwab.com/money-market-funds', {
      waitUntil: 'load',
      timeout: 60000
    });
    console.log('✅ Page loaded');

    // wait explicitly for the table to appear
    await page.waitForSelector('table tbody tr', { timeout: 20000 });
    console.log('✅ Table found');
    
    const data = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
    
        // ticker is always inside the <a> element
        const link = cells[0]?.querySelector('a');
        const ticker = link ? link.innerText.trim() : '';
    
        // full cell text (includes name + ticker + footnotes)
        let fullText = cells[0]?.innerText.trim() || '';
    
        // remove the ticker portion and any trailing symbols
        if (ticker) {
          fullText = fullText.replace(`(${ticker})`, '');
        }
        const name = fullText.replace(/\*+$/, '').trim();
    
        const yieldValue = cells[1]?.innerText.trim();
        return { name, ticker, yield: yieldValue };
      });
    });
    
    console.log('📊 Extracted data:', data);
    await browser.close();

    const durationMs = Date.now() - start;
    console.log(`⏱ Scrape duration: ${Math.floor(durationMs / 1000)}s`);
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Scraping failed', details: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
