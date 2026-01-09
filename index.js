const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;

const BASE_URL = 'https://www.sinhala-subtitles.com'; // Sinhala subtitles site
const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1.0',
  api_name: 'Sinhala Subtitles API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    developer: API_INFO.developer,
    version: API_INFO.version,
    api_name: API_INFO.api_name,
    endpoints: {
      search: '/search?q={movie_or_show_name}',
      details: '/details?url={subtitle_page_url}',
      download: '/download?url={subtitle_file_url}'
    }
  });
});

// Search movies/TV shows
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query ?q=' });

    const searchUrl = `${BASE_URL}/search/${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(response.data);

    const results = [];

    $('.post-item, .movie-item, .tv-item').each((i, el) => {
      const title = $(el).find('h2 a').text().trim();
      const url = $(el).find('h2 a').attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      const year = $(el).find('.year').text().trim();
      const type = url && url.includes('/tvshows/') ? 'tvshow' : 'movie';

      if (title && url) {
        results.push({ title, url, poster, year, type });
      }
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      query,
      total_results: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Details endpoint - subtitle page
app.get('/details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL ?url=' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('h1.entry-title').text().trim();
    const poster = $('.post-thumbnail img').attr('src');

    const subtitles = [];
    $('.sub-download a').each((i, el) => {
      const link = $(el).attr('href');
      const lang = $(el).text().trim();
      if (link) subtitles.push({ lang, url: link });
    });

    // Detect if TV show with episodes
    const episodes = [];
    $('.episode-item a').each((i, el) => {
      const epTitle = $(el).text().trim();
      const epUrl = $(el).attr('href');
      if (epUrl) episodes.push({ title: epTitle, url: epUrl });
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      title,
      poster,
      url,
      subtitles,
      episodes: episodes.length > 0 ? episodes : null
    });
  } catch (error) {
    console.error('Details error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Download subtitle (redirect)
app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL ?url=' });

    // Redirect to actual .SRT file
    res.redirect(url);
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔════════════════════════════════╗`);
  console.log(`║ Sinhala Subtitles API v${API_INFO.version} ║`);
  console.log(`╚════════════════════════════════╝`);
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET  /                  - API info`);
  console.log(`   GET  /search?q=         - Search movies/TV shows`);
  console.log(`   GET  /details?url=      - Get subtitle details`);
  console.log(`   GET  /download?url=     - Redirect to subtitle file`);
});
