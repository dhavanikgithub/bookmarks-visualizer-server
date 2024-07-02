// server.js

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get('/fetch-url', async (req, res) => {
    const { url } = req.query;
    console.log(url)
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        let title = $('title').text();
        if (!title) {

            title = $('meta[name="title"]').attr('content');
        }
        if (!title) {
            title = $('meta[property="og:title"]').attr('content');
        }
        let description = $('meta[name="description"]').attr('content');
        if (!description) {
            description = $('meta[property="og:description"]').attr('content');
        }
        let imageUrl = $('link[rel="image_src"]').attr('href');
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }
        let faviconUrl = $('link[rel="icon"]').attr('href');
        if (!faviconUrl) {
            faviconUrl = $('link[rel="shortcut icon"]').attr('href');
        }
        let imageAlt = $('meta[property="og:image:alt"]').attr('content');
        if(imageUrl)
        {
            const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(res.data, 'binary');
            const base64 = buffer.toString('base64');
            const mimeType = response.headers['content-type'];
            imageUrl = `data:${mimeType};base64,${base64}`
        }
        if(faviconUrl){
            const res = await axios.get(faviconUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(res.data, 'binary');
            const base64 = buffer.toString('base64');
            const mimeType = response.headers['content-type'];
            faviconUrl = `data:${mimeType};base64,${base64}`
        }
        if(!imageUrl){
            const res = await axios.get("http://localhost:3001/screenshot?url=" + encodeURIComponent(url), { responseType: 'arraybuffer' });
            const buffer = Buffer.from(res.data, 'binary');
            const base64 = buffer.toString('base64');
            const mimeType = response.headers['content-type'];
            imageUrl = `data:${mimeType};base64,${base64}`
        }
        
        res.json({
            title,
            description,
            imageUrl,
            faviconUrl,
            imageAlt
        });

    } catch (error) {
        console.error('Error fetching URL:', error);
        res.status(500).json({ error: 'Failed to fetch URL' });
    }
});



app.get('/screenshot', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        const screenshot = await page.screenshot({ type: 'png' });
        await browser.close();

        res.setHeader('Content-Type', 'image/png');
        res.send(screenshot);
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        res.status(500).json({ error: 'Failed to capture screenshot' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
