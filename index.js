const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`🔍 Incoming request: ${req.method} ${req.url}`);
  next();
});

app.get('/schwab', async (req, res) => {
  console.log('🟡 /schwab route triggered');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://www.schwab.com/money-market-funds', { waitUntil: 'networkidle2' });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.map(row => {
      const cells = row.querySelectorAll('td');
      const name = cells[0]?.innerText.trim();
      const yieldValue = cells[1]?.innerText.trim();
      const tickerMatch = name.match(/\((\w{4,5})\)/);
      const ticker = tickerMatch ? tickerMatch[1] : '';
      return { name, ticker, yield: yieldValue };
    });
  });
  const html = await page.content();
  console.log(html);
  await browser.close();
  res.json(data);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
