const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 5000;
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

// -------------------- Root Endpoint --------------------
app.get('/', (req, res) => {
  res.json({
    developer: API_INFO.developer,
    version: API_INFO.version,
    api_name: API_INFO.api_name,
    endpoints: {
      search: '/search?q={query}',
      details: '/details?url={encoded_url}',
      episodes: '/episodes?url={encoded_url}',
      episode_details: '/episode-details?url={encoded_url}',
      download: '/download?url={countdown_page_url}',
      resolve: '/resolve?url={url}'
    }
  });
});

// -------------------- /search Endpoint --------------------
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing search query' });

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const results = [];
    $('.item-box, .display-item, .result-item, article.item, article').each((i, el) => {
      const $item = $(el);
      const title = $item.find('h3 a, .title a, .item-desc-title').text().trim();
      const url = $item.find('a').first().attr('href');
      const poster = $item.find('img').first().attr('src') || $item.find('img').attr('data-src');
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

// -------------------- /details Endpoint --------------------
app.get('/details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const title = $('meta[itemprop="name"]').attr('content') || $('h1.entry-title').text().trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src');
    const description = $('meta[name="description"]').attr('content') || $('p').first().text().trim();
    const rating = $('.imdb-score, .rating, .zt_rating_vgs').text().trim() || 'N/A';
    const year = ($('meta[itemprop="dateCreated"]').attr('content')?.match(/\d{4}/) || ['N/A'])[0];
    const genres = [];
    $('.sgeneros a, .genre-list a').each((i, el) => genres.push($(el).text().trim()));

    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if (href && href.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
        downloadLinks.push({ quality: qualityMatch ? qualityMatch[1] : 'Unknown', url: href, text: text.substring(0, 100) });
      }
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      movie_info: { title, year, rating, genres: genres.length ? genres : ['N/A'], description, type: url.includes('/tvshows/') ? 'tvshow' : 'movie' },
      poster_url: poster,
      movie_url: url,
      download_links: downloadLinks
    });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- /episodes Endpoint --------------------
app.get('/episodes', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const seasons = [];
    $('#seasons .se-c').each((i, seasonEl) => {
      const $season = $(seasonEl);
      const seasonNum = $season.find('.se-t').text().trim();
      const episodes = [];
      $season.find('.se-a ul li').each((j, epEl) => {
        const $ep = $(epEl);
        const epUrl = $ep.find('.episodiotitle a').attr('href');
        if (epUrl) episodes.push({ episode: $ep.find('.numerando').text().trim(), title: $ep.find('.episodiotitle a').text().trim(), url: epUrl });
      });
      if (episodes.length) seasons.push({ season: seasonNum, episodeCount: episodes.length, episodes });
    });

    res.json({ developer: API_INFO.developer, version: API_INFO.version, seasonCount: seasons.length, seasons });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- /episode-details Endpoint --------------------
app.get('/episode-details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if (href && href.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p)/i);
        downloadLinks.push({ quality: qualityMatch ? qualityMatch[1] : 'Unknown', url: href, text: text.substring(0, 100) });
      }
    });

    res.json({ developer: API_INFO.developer, version: API_INFO.version, url, downloadLinks });
  } catch (err) {
    res.status(500).json({ developer: API_INFO.developer, version: API_INFO.version, error: err.message });
  }
});

// -------------------- URL Transformation --------------------
const urlMappings = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/', 'https://google.com/server13/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/', 'https://google.com/server23/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' },
  { search: ['https://google.com/server4/1:/'], replace: 'https://cloud.sonic-cloud.online/server4/' },
  { search: ['https://google.com/server5/1:/'], replace: 'https://cloud.sonic-cloud.online/server5/' }
];

function transformDownloadUrl(originalUrl) {
  let modifiedUrl = originalUrl;
  for (const mapping of urlMappings) {
    for (const searchUrl of mapping.search) {
      if (originalUrl.includes(searchUrl)) {
        modifiedUrl = originalUrl.replace(searchUrl, mapping.replace);
        if (modifiedUrl.includes('.mp4?bot=cscloud2bot&code=')) modifiedUrl = modifiedUrl.replace('.mp4?bot=cscloud2bot&code=', '?ext=mp4&bot=cscloud2bot&code=');
        else if (modifiedUrl.includes('.mp4')) modifiedUrl = modifiedUrl.replace('.mp4', '?ext=mp4');
        else if (modifiedUrl.includes('.mkv?bot=cscloud2bot&code=')) modifiedUrl = modifiedUrl.replace('.mkv?bot=cscloud2bot&code=', '?ext=mkv&bot=cscloud2bot&code=');
        else if (modifiedUrl.includes('.mkv')) modifiedUrl = modifiedUrl.replace('.mkv', '?ext=mkv');
        else if (modifiedUrl.includes('.zip')) modifiedUrl = modifiedUrl.replace('.zip', '?ext=zip');
        return modifiedUrl;
      }
    }
  }
  if (modifiedUrl.includes('srilank222')) modifiedUrl = modifiedUrl.replace('srilank222', 'srilanka2222');
  if (modifiedUrl.includes('https://tsadsdaas.me/')) modifiedUrl = modifiedUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
  return modifiedUrl;
}

// -------------------- Puppeteer Sonic Cloud Extraction --------------------
async function extractSonicCloudLinks(sonicCloudUrl) {
  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(headers['User-Agent']);
    await page.goto(sonicCloudUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForTimeout(2000);

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

// -------------------- Instructions Helper --------------------
function getLinkTypeInstructions(linkType) {
  const instructions = {
    telegram: 'Join the Telegram channel/group to access the download',
    google_drive: 'Open Google Drive link to download the file',
    mega: 'Open Mega.nz link to download the file',
    mediafire: 'Open MediaFire link to download the file',
    direct: 'Direct download link - click to start downloading',
    other: 'Follow the link to access the download',
    unknown: 'Follow the link to download'
  };
  return instructions[linkType] || instructions.unknown;
}

// -------------------- /download Endpoint --------------------
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

  try {
    let rawLink = url.includes('google.com/server') ? transformDownloadUrl(url) : url;
    let linkType = 'sonic_cloud_page';

    if (rawLink.includes('t.me')) linkType = 'telegram';
    else if (rawLink.includes('drive.google.com')) linkType = 'google_drive';
    else if (rawLink.includes('mega.nz')) linkType = 'mega';
    else if (rawLink.includes('mediafire.com')) linkType = 'mediafire';

    let downloadData = {};
    if (linkType === 'sonic_cloud_page') downloadData = await extractSonicCloudLinks(rawLink);

    res.json({ developer: API_INFO.developer, version: API_INFO.version, success: true, raw_link: rawLink, link_type: linkType, download_links: downloadData || {}, instructions: getLinkTypeInstructions(linkType) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------- /resolve Endpoint --------------------
app.get('/resolve', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const response = await axios.get(url, { maxRedirects: 0, timeout: 10000, validateStatus: s => s < 400 || s === 302 || s === 301 });
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
  console.log(`╔════════════════════════════════════════════════════════╗`);
  console.log(`║  CineSubz API v${API_INFO.version} - by ${API_INFO.developer}           ║`);
  console.log(`╚════════════════════════════════════════════════════════╝`);
  console.log(`🚀 Server running at: http://0.0.0.0:${PORT}`);
  console.log(`📡 Available Endpoints: /search, /details, /episodes, /episode-details, /download, /resolve`);
});
