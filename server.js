import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import cors from 'cors';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
app.use(cors());
app.use(express.json());

// Human-like fingerprint
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 }
];

app.get('/render', async (req, res) => {
    const { url, wait = 12, scroll = true } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    let browser = null;
    
    try {
        console.log(`🎯 Rendering: ${url}`);
        
        // Launch with anti-detection args
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-features=BlockInsecurePrivateNetworkRequests',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--disable-webgl',
                '--disable-software-rasterizer',
                '--no-zygote',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        });

        const page = await browser.newPage();
        
        // Random user agent
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        
        // Random viewport
        const viewport = viewports[Math.floor(Math.random() * viewports.length)];
        await page.setViewport(viewport);
        
        // Set extra headers to look like real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        });

        // Remove webdriver property
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override chrome property
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        // Set cookies to look like returning user
        await page.setCookie({
            name: 'session_id',
            value: Math.random().toString(36).substring(7),
            domain: new URL(url).hostname
        });

        console.log('🌍 Navigating to page...');
        
        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log(`⏳ Waiting ${wait} seconds for chat to load...`);
        await page.waitForTimeout(wait * 1000);

        // Human-like scrolling
        if (scroll === 'true') {
            console.log('📜 Scrolling through chat...');
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 150;
                    const scrollDelay = 300;
                    
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        
                        // Random pause mid-scroll (human behavior)
                        if (totalHeight > scrollHeight * 0.7 && Math.random() > 0.7) {
                            setTimeout(() => {}, 800);
                        }
                        
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, scrollDelay);
                });
            });
            
            // Scroll back up a bit (humans do this)
            await page.evaluate(() => {
                window.scrollBy(0, -300);
            });
            
            await page.waitForTimeout(1000);
        }

        // Try to click any "Load more" buttons
        console.log('🔍 Looking for load more buttons...');
        await page.evaluate(() => {
            const loadMoreSelectors = [
                'button:contains("Load more")',
                'button:contains("Show more")',
                'button:contains("View more")',
                '[class*="load-more"]',
                '[class*="show-more"]',
                '[class*="view-more"]'
            ];
            
            loadMoreSelectors.forEach(selector => {
                const buttons = document.querySelectorAll(selector);
                buttons.forEach(button => {
                    if (button.offsetParent !== null) { // Check if visible
                        button.click();
                        console.log('Clicked load more button');
                    }
                });
            });
        });
        
        await page.waitForTimeout(3000);

        // Get the fully rendered HTML
        const html = await page.content();
        
        // Also take a screenshot (optional, good for debugging)
        const screenshot = await page.screenshot({ encoding: 'base64' });

        console.log(`✅ Success! Downloaded ${(html.length / 1024).toFixed(1)}KB`);

        res.json({
            success: true,
            html: html,
            screenshot: screenshot,
            size: html.length,
            url: url,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Anti-detection render service running' 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
