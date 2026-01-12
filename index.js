// index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

// Headers to mimic browser
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Referer': BASE_URL
};

app.use(express.json());

// Root API info
app.get('/', (req, res) => {
  res.json({
    api: "Sinhala Sub Movie API",
    developer: "Mr Senal",
    endpoints: {
      search: "/search?q={movie_name}",
      movie: "/movie?url={movie_url}"
    }
  });
});

// Search movies
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Please provide ?q=movie_name" });

    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const results = [];

    $('.movies-list .ml-item, .mlist, .item').each((i, el) => {
      const title = $(el).find('h2, .title').text().trim();
      const movieUrl = $(el).find('a').attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

      if(title && movieUrl) results.push({ title, url: movieUrl, poster });
    });

    res.json({ query, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get movie info + download links (Pixeldrain)
app.get('/movie', async (req, res) => {
  try {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ error: "Please provide ?url=movie_url" });

    const { data } = await axios.get(movieUrl, { headers });
    const $ = cheerio.load(data);

    // Movie title
    const title = $('h1.entry-title').text().trim() || 'Unknown Title';

    // Movie info
    const info = {};
    $('.movie-info li').each((i, el) => {
      const label = $(el).find('b').text().trim().replace(':','');
      const value = $(el).contents().filter(function(){ return this.nodeType === 3; }).text().trim();
      if(label && value) info[label.toLowerCase()] = value;
    });

    // Cast
    const cast = [];
    $('.persons .person').each((i, el) => {
      const name = $(el).find('.name a').text().trim();
      const role = $(el).find('.caracter').text().trim();
      const image = $(el).find('img').attr('src');
      if(name) cast.push({ name, role, image });
    });

    // Download links
    const downloadOptions = [];
    $('.box_links .sbox').each((i, el) => {
      const serverId = $(el).attr('id');
      $(el).find('tbody tr').each((j, row) => {
        const quality = $(row).find('.quality').text().trim() || 'Unknown';
        const size = $(row).find('td').eq(2).text().trim() || 'Unknown';
        const link = $(row).find('a').attr('href');
        const hostImg = $(row).find('img').attr('src') || '';
        const host = hostImg.includes('pixeldrain') ? 'Pixeldrain' : 'Other';

        // Pixeldrain direct link
        let directLink = '';
        if(host === 'Pixeldrain' && link) {
          const id = link.split('/').pop();
          directLink = `https://pixeldrain.com/api/file/${id}`;
        }

        if(link) downloadOptions.push({ quality, size, host, url: link, direct: directLink });
      });
    });

    res.json({ title, info, cast, downloadOptions, url: movieUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
