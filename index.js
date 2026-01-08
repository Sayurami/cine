// index.js - CineSubz API Full Version (Vercel-compatible Puppeteer)
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const chromium = require('chrome-aws-lambda');

const app = express();
const PORT = process.env.PORT || 5000;

const BASE_URL = 'https://cinesubz.co';
const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1.2',
  api_name: 'CineSubz Movie Downloader API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Referer': 'https://cinesubz.co/'
};

app.use(express.json());

// -------------------- Root --------------------
app.get('/', (req, res) => {
  res.json({
    developer: API_INFO.developer,
    version: API_INFO.version,
    api_name: API_INFO.api_name,
    endpoints: {
      search: '/search?q={query}',
      details: '/details?url={movie_url}',
      episodes: '/episodes?url={tvshow_url}',
      episode_details: '/episode-details?url={episode_url}',
      download: '/download?url={countdown_url}',
      resolve: '/resolve?url={url}'
    }
  });
});

// -------------------- Search Endpoint --------------------
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query parameter ?q=' });

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(response.data);
    const results = [];

    $('.item-box, .display-item, article.item, article').each((i, el) => {
      const $el = $(el);
      const title = $el.find('.title a, .item-desc-title').text().trim();
      const url = $el.find('a').first().attr('href');
      const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
      const type = url?.includes('/tvshows/') ? 'tvshow' : 'movie';
      if (title && url) results.push({ title, url, poster, type });
    });

    const uniqueResults = [...new Map(results.map(r => [r.url, r])).values()];
    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      query,
      total_results: uniqueResults.length,
      results: uniqueResults
    });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- Details Endpoint --------------------
app.get('/details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('meta[itemprop="name"]').attr('content') || $('h1.entry-title').text().trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src');
    const description = $('meta[name="description"]').attr('content') || $('p').first().text().trim();
    const rating = $('.imdb-score').text().trim();
    const year = $('meta[itemprop="dateCreated"]').attr('content')?.match(/\d{4}/)?.[0] || 'N/A';

    const genres = [];
    $('.sgeneros a, .genre-list a').each((i, el) => genres.push($(el).text().trim()));

    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href?.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
        downloadLinks.push({ quality: qualityMatch ? qualityMatch[1] : 'Unknown', url: href });
      }
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      movie_info: { title, poster, description, rating, year, genres: genres.length ? genres : ['N/A'] },
      download_links: downloadLinks
    });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- Episodes Endpoint --------------------
app.get('/episodes', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const seasons = [];
    $('#seasons .se-c').each((i, el) => {
      const $season = $(el);
      const seasonNum = $season.find('.se-t').text().trim();
      const episodes = [];
      $season.find('.se-a ul li').each((j, epEl) => {
        const $ep = $(epEl);
        const epTitle = $ep.find('.episodiotitle a').text().trim();
        const epUrl = $ep.find('.episodiotitle a').attr('href');
        if (epUrl) episodes.push({ title: epTitle, url: epUrl });
      });
      if (episodes.length) seasons.push({ season: seasonNum, episodes });
    });

    res.json({ developer: API_INFO.developer, version: API_INFO.version, seasons });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- Episode Details Endpoint --------------------
app.get('/episode-details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href?.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
        downloadLinks.push({ quality: qualityMatch ? qualityMatch[1] : 'Unknown', url: href });
      }
    });

    res.json({ developer: API_INFO.developer, version: API_INFO.version, download_links: downloadLinks });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- Puppeteer Sonic Cloud Extraction --------------------
async function extractSonicCloudLinks(sonicCloudUrl) {
  try {
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setUserAgent(headers['User-Agent']);
    await page.goto(sonicCloudUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(1500);

    const downloadLinks = await page.evaluate(() => {
      const result = { direct: null, google_drive_1: null, google_drive_2: null, telegram: null, file_name: null, file_size: null };
      const fileNameEl = document.querySelector('.file-name') || document.body;
      const fileSizeEl = document.querySelector('.file-size') || document.body;
      result.file_name = fileNameEl.innerText.trim();
      result.file_size = fileSizeEl.innerText.trim();

      document.querySelectorAll('a').forEach(a => {
        const href = a.href;
        const text = a.innerText.toLowerCase();
        if (!href) return;
        if (text.includes('direct download')) result.direct = href;
        else if (text.includes('google download 1')) result.google_drive_1 = href;
        else if (text.includes('google download 2')) result.google_drive_2 = href;
        else if (text.includes('telegram download')) result.telegram = href;
      });

      return result;
    });

    await browser.close();
    return downloadLinks;
  } catch (err) {
    console.error('Sonic Cloud extraction error:', err.message);
    return null;
  }
}

// -------------------- /download Endpoint --------------------
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

  try {
    let rawLink = url;
    let linkType = 'sonic_cloud_page';
    if (rawLink.includes('t.me')) linkType = 'telegram';
    else if (rawLink.includes('drive.google.com')) linkType = 'google_drive';
    else if (rawLink.includes('mega.nz')) linkType = 'mega';
    else if (rawLink.includes('mediafire.com')) linkType = 'mediafire';

    let downloadData = {};
    if (linkType === 'sonic_cloud_page') downloadData = await extractSonicCloudLinks(rawLink);

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      success: true,
      raw_link: rawLink,
      link_type: linkType,
      download_links: downloadData || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------- /resolve Endpoint --------------------
app.get('/resolve', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { maxRedirects: 0, validateStatus: s => s < 400 || s === 302 || s === 301 });
    const location = response.headers.location;

    if (location) res.json({ developer: API_INFO.developer, version: API_INFO.version, success: true, originalUrl: url, redirectUrl: location });
    else {
      const $ = cheerio.load(response.data);
      const scripts = $('script').map((i, el) => $(el).html()).get().join('\n');
      const linkMatch = scripts.match(/https?:\/\/[^"'\s<>]+(?:sonic-cloud|drive|mega)[^"'\s<>]+/i);
      res.json({ developer: API_INFO.developer, version: API_INFO.version, success: !!linkMatch, originalUrl: url, extractedLink: linkMatch ? linkMatch[0] : null });
    }
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, success: false, error: err.message });
  }
});

// -------------------- Start Server --------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CineSubz API v${API_INFO.version} running at http://0.0.0.0:${PORT}`);
});
