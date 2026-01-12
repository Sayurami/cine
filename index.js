const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://sinhalasub.lk';

app.use(express.json());

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
        if (!query) return res.status(400).json({ error: 'Provide query ?q=movie_name' });

        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.movies-list .ml-item, .ml-item').each((i, el) => {
            const title = $(el).find('.mli-info h2, h2').text().trim();
            const movieUrl = $(el).find('a').attr('href');
            const year = $(el).find('.year').text().trim();
            const image = $(el).find('img').attr('data-original') || $(el).find('img').attr('src');

            if (title && movieUrl) {
                results.push({ title, url: movieUrl, year, image });
            }
        });

        res.json({ query, count: results.length, results });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// Download links endpoint
app.get('/download-links', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) return res.status(400).json({ error: 'Provide movie URL ?url=movie_url' });

        const { data } = await axios.get(movieUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const $ = cheerio.load(data);

        const title = $('h1.entry-title').text().trim() || 'Unknown Title';

        // Extract download servers
        const downloadOptions = [];
        $('.box_links .sbox').each((i, el) => {
            const serverId = $(el).attr('id');
            const serverTitle = $(el).prev('.linktabs').find(`a[href="#${serverId}"]`).text().trim() || serverId;

            const links = [];
            $(el).find('tbody tr').each((i, row) => {
                const quality = $(row).find('.quality').text().trim() || 'Unknown';
                const size = $(row).find('td').eq(2).text().trim() || 'Unknown';
                const url = $(row).find('a').attr('href');

                if (url) {
                    let directUrl = url;
                    // Convert Pixeldrain to direct API link
                    if (url.includes('pixeldrain.com')) {
                        const id = url.split('/').pop();
                        directUrl = `https://pixeldrain.com/api/file/${id}`;
                    }
                    links.push({ quality, size, url, directUrl });
                }
            });

            if (links.length > 0) downloadOptions.push({ server: serverTitle, links });
        });

        res.json({ success: true, title, downloadOptions, url: movieUrl });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
