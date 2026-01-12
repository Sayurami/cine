const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Referer': BASE_URL
};

app.use(express.json());

// Root
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

// Search Movies
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Please provide ?q=movie_name' });

    try {
        const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers });
        const $ = cheerio.load(data);
        const results = [];

        $('.ml-item, .item').each((i, el) => {
            const $item = $(el);
            const title = $item.find('h2, .title').text().trim();
            const url = $item.find('a').attr('href');
            const poster = $item.find('img').attr('data-original') || $item.find('img').attr('src');
            const year = $item.find('.year, .date').text().trim().match(/\d{4}/)?.[0] || '';

            if (title && url) results.push({ title, url, poster, year });
        });

        res.json({ query, count: results.length, results });
    } catch (err) {
        console.error('Search Error:', err.message);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// Download Links
app.get('/download-links', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ error: 'Please provide ?url=movie_url' });
    if (!movieUrl.includes('sinhalasub.lk')) return res.status(400).json({ error: 'Invalid SinhalaSub movie URL' });

    try {
        const { data } = await axios.get(movieUrl, { headers, timeout: 10000 });
        const $ = cheerio.load(data);

        const title = $('h1.entry-title').text().trim() || 'Unknown Title';
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
                const hostName = hostImg
                    ? hostImg.includes('favicons')
                        ? new URL(hostImg).searchParams.get('domain')
                        : hostImg.split('/').pop().replace('.jpg', '').replace('.png', '')
                    : 'Unknown';
                if (url) links.push({ quality, size, url, host: hostName });
            });

            if (links.length) downloadOptions.push({ server: serverId, serverTitle, links });
        });

        if (!downloadOptions.length) {
            return res.json({ success: false, title, message: 'No download links found', url: movieUrl });
        }

        res.json({ success: true, title, downloadOptions, url: movieUrl });
    } catch (err) {
        console.error('Download Links Error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch download links', details: err.message });
    }
});

// Start Server
app.listen(PORT, () => console.log(`Sinhala Sub API running on port ${PORT}`));
