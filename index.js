const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Referer': BASE_URL
};

app.use(express.json());

// Root info
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

// Real Search
app.get('/search', async (req, res) => {
    try {
      const q = req.query.q;
      if (!q) return res.status(400).json({ error: 'Provide ?q=movie name' });

      const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(q)}`;
      const { data } = await axios.get(searchUrl, { headers });
      const $ = cheerio.load(data);

      const results = [];
      $('article.post').each((i, el) => {
        const title = $(el).find('h2.entry-title a').text().trim();
        const url = $(el).find('h2.entry-title a').attr('href');
        const image = $(el).find('img').attr('src') || null;

        if (title && url) results.push({ title, url, image });
      });

      res.json({ query: q, count: results.length, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// Real download links
app.get('/download-links', async (req, res) => {
    try {
      const movieUrl = req.query.url;
      if (!movieUrl) return res.status(400).json({ error: 'Provide ?url=movie_url' });

      const { data } = await axios.get(movieUrl, { headers });
      const $ = cheerio.load(data);

      const title = $('h1.entry-title').text().trim() || 'Unknown';

      const downloadOptions = [];
      $('.box_links .sbox').each((_, el) => {
        const serverId = $(el).attr('id');
        const serverTitle = $(el).prev('.linktabs').find(`a[href="#${serverId}"]`).text().trim();

        const links = [];
        $(el).find('tbody tr').each((i, row) => {
          const quality = $(row).find('.quality').text().trim();
          const size = $(row).find('td').eq(2).text().trim();
          const url = $(row).find('a').attr('href');

          // pixeldrain direct create
          let direct = url;
          if (url && url.includes('pixeldrain.com')) {
            const id = url.split('/').pop();
            direct = `https://pixeldrain.com/api/file/${id}`;
          }

          links.push({ quality, size, url, direct });
        });

        downloadOptions.push({ server: serverTitle || serverId, links });
      });

      res.json({ success: true, title, downloadOptions, url: movieUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`API running on ${PORT}`));
