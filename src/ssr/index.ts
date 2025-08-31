import { Request, Response } from 'express';
import { handleSitemap } from './pages/sitemap';
import { handleManifest } from './pages/pwaManifest';

const handleSSR = (req: Request, res: Response): void | Promise<void> => {
    const path = req.path;
    
    // Handle sitemap.xml
    if (path === '/sitemap.xml') {
        return handleSitemap(req, res);
    }
    
    // Handle robots.txt
    if (path === '/robots.txt') {
        return handleRobots(req, res);
    }
    
    // Handle manifest.json
    if (path === '/manifest.json') {
        return handleManifest(req, res);
    }

    // Default SSR page
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Book of Mormon Online</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Book of Mormon Online">
    </head>
    <body>
        <h1>Book of Mormon Online</h1>
        <p>Book of Mormon Online Server Side Rendered</p>
    </body>
    </html>`);
}

// Handle robots.txt inline
const handleRobots = (req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/plain");
    const host = req.get('host') || '';
    
    // Whitelist of domains allowed to be crawled
    const indexedDomains = ['bookofmormon.online', 'xn--289a67xla.kr']; //TODO: externalize config

    if (indexedDomains.includes(host)) {
        res.send([
            'User-agent: *',
            'Disallow:',
            `Sitemap: https://${host}/sitemap.xml`,
            ''
        ].join('\n'));
    } else {
        res.send([
            'User-agent: *',
            'Disallow: /',
            ''
        ].join('\n'));
    }
}

// Export the single handler and the match patterns
export const ssrRoutes = ['/sitemap.xml', '/robots.txt', '/manifest.json'];
export { handleSSR };