const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Connection': 'keep-alive',
  'Referer': BASE_URL
};

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    api: 'Sinhala Sub Movie API',
    developer: 'Mr Senal',
    endpoints: {
      search: '/search?q={movie_name}',
      downloadLinks: '/download-links?url={movie_url}'
    }
  });
});

// ====== SEARCH ENDPOINT ======
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query ?q=movie_name' });

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl, { headers, timeout: 10000 });

    const $ = cheerio.load(data);
    const results = [];

    $('article.post').each((i, el) => {
      const title = $(el).find('h2.entry-title a').text().trim();
      const url = $(el).find('h2.entry-title a').attr('href');
      const image = $(el).find('img').attr('src') || null;

      if (title && url) {
        results.push({ title, url, image });
      }
    });

    res.json({ query, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== DOWNLOAD LINKS ENDPOINT ======
app.get('/download-links', async (req, res) => {
  try {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ error: 'Missing URL ?url=movie_url' });

    const { data } = await axios.get(movieUrl, { headers, timeout: 10000 });
    const $ = cheerio.load(data);

    const title = $('h1.entry-title').text().trim() || 'Unknown Title';

    // Download links
    const downloadOptions = [];
    $('.box_links .sbox').each((i, el) => {
      const serverId = $(el).attr('id');
      const serverTitle = $(el).prev('.linktabs').find(`a[href="#${serverId}"]`).text().trim() || serverId;

      const links = [];
      $(el).find('tbody tr').each((j, row) => {
        const quality = $(row).find('.quality').text().trim() || 'Unknown';
        const size = $(row).find('td').eq(2).text().trim() || 'Unknown';
        const url = $(row).find('a').attr('href');
        const hostImg = $(row).find('img').attr('src') || '';
        const hostName = hostImg
          ? hostImg.includes('favicons')
            ? new URL(hostImg).searchParams.get('domain')
            : hostImg.split('/').pop().replace('.jpg','').replace('.png','')
          : 'Unknown';

        if (url) {
          // Pixeldrain direct link
          let directUrl = url;
          if (hostName.toLowerCase().includes('pixeldrain')) {
            const id = url.split('/').pop();
            directUrl = `https://pixeldrain.com/api/file/${id}`;
          }

          links.push({ quality, size, url, host: hostName, directUrl });
        }
      });

      if (links.length > 0) downloadOptions.push({ server: serverId, serverTitle, links });
    });

    res.json({ success: true, title, downloadOptions, url: movieUrl });
  } catch (err) {
    res.status(500).json({ error: err.message, url: req.query.url || 'Unknown' });
  }
});

// Start server
app.listen(PORT, () => console.log(`SinhalaSub API running on port ${PORT}`));
