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

app.get('/schwab', async (req, res) => {
  console.log('🟡 /schwab route triggered');
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      await page.goto('https://www.schwab.com/money-market-funds', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    } catch (navError) {
      console.error('❌ Navigation failed:', navError);
      await browser.close();
      return res.status(500).json({ error: 'Navigation timeout', details: navError.message });
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    const data = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        const name = cells[0]?.innerText.trim().replace(/\(.*$/, '').trim();
        const yieldValue = cells[1]?.innerText.trim();
        const tickerMatch = name.match(/\((\w{4,5})\)/);
        const ticker = tickerMatch ? tickerMatch[1] : '';
        return { name, ticker, yield: yieldValue };
      });
    });

    console.log('📊 Extracted data:', data);
    await browser.close();
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Scraping failed', details: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
