import { slanimeclub_search, slanimeclub_ep, slanimeclub_dl, slanimeclub_mv_search, slanime_mv_info } from "../slanime.js";
import { parse } from "url";

export default async function handler(req, res) {
    try {
        const { query } = parse(req.url, true);
        const type = query.type;
        const q = query.query;
        const url = query.url;

        let data;

        switch(type) {
            case 'search':
                if (!q) return res.status(400).json({ status: false, message: 'Missing query parameter' });
                data = await slanimeclub_search(q);
                break;

            case 'episode':
                if (!url) return res.status(400).json({ status: false, message: 'Missing url parameter' });
                data = await slanimeclub_ep(url);
                break;

            case 'download':
                if (!url) return res.status(400).json({ status: false, message: 'Missing url parameter' });
                data = await slanimeclub_dl(url);
                break;

            case 'movie_search':
                if (!q) return res.status(400).json({ status: false, message: 'Missing query parameter' });
                data = await slanimeclub_mv_search(q);
                break;

            case 'movie_info':
                if (!url) return res.status(400).json({ status: false, message: 'Missing url parameter' });
                data = await slanime_mv_info(url);
                break;

            default:
                return res.status(400).json({ status: false, message: 'Invalid type parameter' });
        }

        return res.status(200).json({ status: true, data });
    } catch (err) {
        console.error('Vercel API Error:', err.message);
        return res.status(500).json({ status: false, message: 'Server Error', error: err.message });
    }
}
