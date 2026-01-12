const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

app.use(express.json());

// Root
app.get('/', (req, res) => {
  res.json({
    api: 'SinhalaSub.lk API',
    endpoints: {
      search: '/search?q={movie}',
      details: '/details?url={movie_url}'
    }
  });
});

// Search
app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing search query ?q=' });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(q)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('article.post').forEach(el => {
        const a = el.querySelector('h2.entry-title a');
        if (a) {
          const title = a.innerText.trim();
          const url = a.href;
          const img = el.querySelector('img')?.src || null;
          arr.push({ title, url, img });
        }
      });
      return arr;
    });

    await browser.close();
    res.json({ query: q, count: results.length, results });

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

// Movie details + download links
app.get('/details', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1.entry-title')?.innerText.trim() || '';
      const links = [];
      document.querySelectorAll('.box_links .sbox tbody tr').forEach(tr => {
        const a = tr.querySelector('a');
        const quality = tr.querySelector('.quality')?.innerText.trim() || '';
        const size = tr.querySelectorAll('td')[2]?.innerText.trim() || '';
        if (a) {
          const href = a.href;
          links.push({ quality, size, url: href });
        }
      });
      return { title, links };
    });

    await browser.close();
    res.json(data);

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
