const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;

const BASE_URL = 'https://sinhalasub.lk';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    api: "Sinhala Sub Movie API",
    developer: "Mr Senal",
    endpoints: {
      search: "/search?q={movie_name}",
      downloadLinks: "/download-links?url={movie_url}"
    }
  });
});

// Search endpoint
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing search query ?q=' });

    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);

    const results = [];

    $('article.post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2.entry-title a').text().trim();
      const url = $el.find('h2.entry-title a').attr('href');
      const img = $el.find('img').attr('src');
      const yearMatch = title.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : '';

      if (title && url) {
        results.push({ title, url, img, year });
      }
    });

    res.json({
      query,
      count: results.length,
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download links endpoint
app.get('/download-links', async (req, res) => {
  try {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ error: 'Missing movie URL ?url=' });

    const { data } = await axios.get(movieUrl, { headers });
    const $ = cheerio.load(data);

    const title = $('h1.entry-title').text().trim() || 'Unknown';
    const downloadOptions = [];

    $('.box_links .sbox').each((i, el) => {
      const serverId = $(el).attr('id');
      const serverTitle = $(el).prev('.linktabs').find(`a[href="#${serverId}"]`).text().trim() || serverId;

      const links = [];
      $(el).find('tbody tr').each((i, row) => {
        const quality = $(row).find('.quality').text().trim() || 'Unknown';
        const size = $(row).find('td').eq(2).text().trim() || 'Unknown';
        const url = $(row).find('a').attr('href');
        const hostImg = $(row).find('img').attr('src') || '';
        const hostName = hostImg.split('/').pop().replace('.jpg','').replace('.png','') || 'Unknown';

        if (url) {
          let directUrl = url;
          if (hostName.toLowerCase().includes('pixeldrain')) {
            const id = url.split('/').pop();
            directUrl = `https://pixeldrain.com/api/file/${id}`;
          }
          links.push({ quality, size, url, host: hostName, directUrl });
        }
      });

      if (links.length) downloadOptions.push({ server: serverId, serverTitle, links });
    });

    res.json({ success: true, title, downloadOptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
