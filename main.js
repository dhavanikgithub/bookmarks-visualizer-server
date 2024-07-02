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

const axiosInstance = axios.create({
    headers: { 'Content-Type': 'application/json' },
});

const getMetaTagContent = ($, name) => {
    return $(`meta[name="${name}"]`).attr('content') ||
           $(`meta[property="og:${name}"]`).attr('content') || '';
};

const getBase64Image = async (url) => {
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const mimeType = response.headers['content-type'];
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

app.get('/fetch-url', async (req, res) => {
    const { url } = req.query;
    console.log(url);

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const response = await axiosInstance.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const title = $('title').text() || getMetaTagContent($, 'title');
        const description = getMetaTagContent($, 'description');
        let imageUrl = $('link[rel="image_src"]').attr('href') || getMetaTagContent($, 'image');
        let faviconUrl = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
        const imageAlt = getMetaTagContent($, 'image:alt');

        if (imageUrl) {
            imageUrl = await getBase64Image(imageUrl);
        } else {
            const screenshotResponse = await axiosInstance.get(`http://localhost:3001/screenshot?url=${encodeURIComponent(url)}`, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(screenshotResponse.data, 'binary');
            const mimeType = screenshotResponse.headers['content-type'];
            imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        }

        if (faviconUrl) {
            faviconUrl = await getBase64Image(faviconUrl);
        }

        res.json({ title, description, imageUrl, faviconUrl, imageAlt });
    } catch (error) {
        console.error('Error fetching URL:', error.message);
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
        console.error('Error capturing screenshot:', error.message);
        res.status(500).json({ error: 'Failed to capture screenshot' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
