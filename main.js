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

function isAbsoluteURL(url) {
    // Regular expression to test if the URL starts with a scheme followed by '://'
    const regex = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;
    return regex.test(url);
}

function toAbsoluteURL(baseURL, relativeURL) {
    try {
        const absoluteURL = new URL(relativeURL, baseURL);
        return absoluteURL.href;
    } catch (e) {
        console.error('Invalid URL:', e);
        return null;
    }
}

function isValidURL(string) {
    try {
        // Attempt to create a new URL object with a base URL to handle relative URLs
        new URL(string, 'http://example.com');
        return true;
    } catch (e) {
        return false;
    }
}

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
        console.log("Response fetched")
        const html = response.data;
        console.log("HTML fetched")
        const $ = cheerio.load(html);
        console.log("$ loaded")
        const title = $('title').text() || getMetaTagContent($, 'title');
        console.log("Title fetched")
        const description = getMetaTagContent($, 'description');
        console.log("Description fetched")
        let imageUrl = $('link[rel="image_src"]').attr('href') || getMetaTagContent($, 'image');
        console.log("Image fetched")
        let faviconUrl = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
        console.log("Favicon fetched")
        const imageAlt = getMetaTagContent($, 'image:alt');
        console.log("Image alt fetched")
        if (imageUrl) {
            try {
                imageUrl = await getBase64Image(imageUrl);
                console.log("imageUrl getBase64Image loaded")
            } catch (error) {
                console.error('Error fetching imageUrl:', error.message);
            }
            console.log("imageUrl getBase64Image loaded")
        } else {
            const screenshotResponse = await axiosInstance.get(`http://localhost:3001/screenshot?url=${encodeURIComponent(url)}`, { responseType: 'arraybuffer' });
            console.log("screenshotResponse loaded")
            const buffer = Buffer.from(screenshotResponse.data, 'binary');
            console.log("Buffer loaded")
            const mimeType = screenshotResponse.headers['content-type'];
            console.log("mimeType loaded")
            imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
            console.log("imageUrl loaded")
        }

        if (faviconUrl) {
            try {
                faviconUrl = await getBase64Image(faviconUrl);
                console.log("faviconUrl getBase64Image loaded")
            } catch (error) {
                console.error('Error fetching faviconUrl:', error.message);
            }
        }
        if(isValidURL(faviconUrl)){
            if(!isAbsoluteURL(faviconUrl)){
                faviconUrl = toAbsoluteURL(url, faviconUrl);
            }
        }
        if(isValidURL(imageUrl)){
            if(!isAbsoluteURL(imageUrl)){
                imageUrl = toAbsoluteURL(url, imageUrl);
            }
        }

        res.json({ title, description, imageUrl, faviconUrl, imageAlt });
    } catch (error) {
        try {
            
            console.error('Failed to fetch URL: '+error.response.statusText);
            res.status(error.response.status).json({ error: 'Failed to fetch URL: '+error.response.statusText});
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch URL' });
        }
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
