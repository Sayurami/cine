// index.js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

app.use(express.json());

// Root
app.get('/', (req, res) => {
  res.json({
    api: 'Sinhala Sub Movie API',
    developer: 'Mr Senal',
    endpoints: {
      search: '/search?q={movie_name}',
      details: '/details?url={movie_url}'
    }
  });
});

// Search endpoint
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query ?q=' });

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.ml-item, .item, .post').forEach(el => {
        const titleEl = el.querySelector('h2, .title, .entry-title');
        const linkEl = el.querySelector('a');
        const imgEl = el.querySelector('img');

        if (titleEl && linkEl) {
          items.push({
            title: titleEl.innerText.trim(),
            url: linkEl.href,
            image: imgEl ? imgEl.src : null
          });
        }
      });
      return items;
    });

    await browser.close();
    res.json({ query, count: results.length, results });
  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Details endpoint (download links)
app.get('/details', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1.entry-title')?.innerText || 'Unknown';
      const downloadOptions = [];

      document.querySelectorAll('.box_links .sbox').forEach(sbox => {
        const serverId = sbox.id;
        const serverTitle = sbox.previousElementSibling?.querySelector('a')?.innerText || serverId;
        const links = [];

        sbox.querySelectorAll('tbody tr').forEach(tr => {
          const quality = tr.querySelector('.quality')?.innerText || 'Unknown';
          const size = tr.querySelectorAll('td')[2]?.innerText || 'Unknown';
          const url = tr.querySelector('a')?.href || null;
          if (url) links.push({ quality, size, url });
        });

        if (links.length) downloadOptions.push({ server: serverId, serverTitle, links });
      });

      return { title, downloadOptions };
    });

    await browser.close();
    res.json(data);
  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch details', details: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
