import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://sinhalasub.lk';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Referer': BASE_URL
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    // ===== ROOT INFO =====
    if (pathname === '/') {
      return res.json({
        developer: 'Mr Senal',
        version: 'v1.0',
        api_name: 'CineSubz Movie API',
        endpoints: {
          search: '/search?q={movie_name}',
          details: '/details?url={movie_url}',
          download: '/download-links?url={movie_url}'
        }
      });
    }

    // ===== SEARCH =====
    if (pathname === '/search') {
      const q = query.q;
      if (!q) return res.status(400).json({ error: 'Missing search query ?q=movie_name' });

      const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(q)}`;
      const { data } = await axios.get(searchUrl, { headers, timeout: 10000 });
      const $ = cheerio.load(data);

      const results = [];
      $('.movies-list .ml-item, .mlist, .item, .post').each((i, el) => {
        const $item = $(el);
        const title = $item.find('h2, .title, .entry-title').text().trim();
        const url = $item.find('a').attr('href');
        const image = $item.find('img').attr('data-src') || $item.find('img').attr('src');
        const year = $item.find('.year, .date').text().trim().match(/\d{4}/)?.[0] || '';

        if (title && url) {
          results.push({ title, url, image, year });
        }
      });

      return res.json({ query: q, count: results.length, results });
    }

    // ===== DETAILS =====
    if (pathname === '/details') {
      const movieUrl = query.url;
      if (!movieUrl) return res.status(400).json({ error: 'Missing movie URL ?url=...' });

      const { data } = await axios.get(movieUrl, { headers, timeout: 10000 });
      const $ = cheerio.load(data);

      const title = $('h1.entry-title').text().trim() || 'Unknown';
      const info = {};
      $('.movie-info li').each((i, el) => {
        const label = $(el).find('b').text().trim().replace(':','');
        const value = $(el).contents().filter((_, n) => n.type === 'text').text().trim();
        if (label && value) info[label.toLowerCase()] = value;
      });

      const cast = [];
      $('.persons .person').each((i, el) => {
        const name = $(el).find('.name a').text().trim();
        const role = $(el).find('.caracter').text().trim();
        const image = $(el).find('img').attr('src') || null;
        if (name) cast.push({ name, role, image });
      });

      return res.json({ success: true, title, info, cast, url: movieUrl });
    }

    // ===== DOWNLOAD LINKS =====
    if (pathname === '/download-links') {
      const movieUrl = query.url;
      if (!movieUrl) return res.status(400).json({ error: 'Missing movie URL ?url=...' });

      const { data } = await axios.get(movieUrl, { headers, timeout: 10000 });
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
          if (url) links.push({ quality, size, url });
        });

        if (links.length > 0) downloadOptions.push({ server: serverId, serverTitle, links });
      });

      return res.json({ success: true, title, downloadOptions, url: movieUrl });
    }

    // ===== UNKNOWN PATH =====
    res.status(404).json({ error: 'Endpoint not found' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
}
