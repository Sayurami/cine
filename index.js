// ===========================
// SinhalaSub.lk Movie/TV API
// Developer: Mr Senal
// Version: v1.0
// ===========================

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;
const BASE_URL = 'https://www.sinhala-subtitles.com'; // Example, adjust if needed

const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1.0',
  api_name: 'SinhalaSub Movie/TV API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Referer': BASE_URL
};

app.use(express.json());

// ===========================
// Root Endpoint
// ===========================
app.get('/', (req, res) => {
  res.json({
    developer: API_INFO.developer,
    version: API_INFO.version,
    api_name: API_INFO.api_name,
    endpoints: {
      search: '/search?q=movie_name',
      details: '/details?url=movie_url',
      episodes: '/episodes?url=tvshow_url',
      download: '/download?url=subtitle_url'
    }
  });
});

// ===========================
// Search Endpoint
// ===========================
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing search query. Use ?q=movie_name' });

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(response.data);

    const results = [];

    $('.post-title a, .item-title a').each((i, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const url = $el.attr('href');
      const poster = $el.closest('.post, .item').find('img').attr('src');
      if (title && url) results.push({ title, url, poster });
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      query,
      total_results: results.length,
      results
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ===========================
// Details Endpoint
// ===========================
app.get('/details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('h1.entry-title').text().trim() || 'N/A';
    const poster = $('.post-thumbnail img').attr('src') || null;
    const description = $('.entry-content p').first().text().trim() || 'N/A';

    const downloadLinks = [];
    $('a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      if (href && text.toLowerCase().includes('download')) {
        downloadLinks.push({ text, url: href });
      }
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      title,
      poster,
      description,
      download_links: downloadLinks
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get details', message: error.message });
  }
});

// ===========================
// Download Endpoint
// ===========================
app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing subtitle URL parameter' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    // Example: SinhalaSub.lk has direct .download-button links
    const downloadLink = $('.download-button').attr('href') || url;

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      success: true,
      download_url: downloadLink
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get download link', message: error.message });
  }
});

// ===========================
// Start Server
// ===========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔════════════════════════════════════════╗`);
  console.log(`║ SinhalaSub API v${API_INFO.version} by ${API_INFO.developer} ║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
