import { models } from '../../config/database';
import { Request, Response } from 'express';

interface ImageInfo {
    file: string;
    title: string;
    artist: string;
}

const xmlify = (url: string, priority: string = "0.5", img: ImageInfo | false = false): string => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastmod = lastWeek.toISOString().split('T')[0];
    
    let xml = `    <url>\n`;
    xml += `        <loc>${url}</loc>\n`;
    xml += `        <lastmod>${lastmod}</lastmod>\n`;
    xml += `        <changefreq>weekly</changefreq>\n`;
    xml += `        <priority>${priority}</priority>\n`;
    
    // Image support can be added later if needed
    if (img) {
        // TODO: Add image sitemap support
    }
    
    xml += `    </url>\n`;
    return xml;
};

const generateSitemap = async (host: string = 'bookofmormon.online'): Promise<string> => {
    const baseUrl = `https://${host}`;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
    
    try {
        // Main pages
        xml += xmlify(`${baseUrl}/`, "1.0");
        xml += xmlify(`${baseUrl}/contents`, "0.9");
        
        // Get all slugs
        const slugs = await models.BomSlug.findAll({
            attributes: ['guid']
        });
        
        for (const slug of slugs) {
            // Note: get_slug_direct function would need to be implemented
            // For now, using guid directly
            xml += xmlify(`${baseUrl}/${(slug as any).guid}`, "0.8");
        }
        
        // Map pages
        xml += xmlify(`${baseUrl}/map`, "0.7");
        
        const mapCoords = await models.BomPlacesCoords.findAll({
            attributes: ['map'],
            group: ['map']
        });
        
        for (const coord of mapCoords) {
            if ((coord as any).map === "malay2") continue;
            xml += xmlify(`${baseUrl}/map/${(coord as any).map}`, "0.6");
        }
        
        // Places
        const places = await models.BomPlaces.findAll({
            attributes: ['guid', 'slug']
        });
        
        for (const place of places) {
            xml += xmlify(`${baseUrl}/place/${(place as any).slug}`, "0.6");
            
            const placeCoords = await models.BomPlacesCoords.findAll({
                where: { guid: (place as any).guid },
                attributes: ['map']
            });
            
            for (const coord of placeCoords) {
                if ((coord as any).map === "malay2") continue;
                xml += xmlify(`${baseUrl}/map/${(coord as any).map}/place/${(place as any).slug}`, "0.1");
            }
        }
        
        // People
        const people = await models.BomPeople.findAll({
            attributes: ['slug']
        });
        
        for (const person of people) {
            xml += xmlify(`${baseUrl}/people/${(person as any).slug}`, "0.6");
        }
        
        // FAQ/FAX pages
        xml += xmlify(`${baseUrl}/fax`, "0.7");
        
        const faxPages = await models.BomXtrasFax.findAll({
            where: {
                hide: 0,
                com: 0
            },
            attributes: ['slug'],
            order: [['weight', 'ASC']]
        });
        
        for (const fax of faxPages) {
            xml += xmlify(`${baseUrl}/fax/${(fax as any).slug}`, "0.5");
        }
        
        // History pages
        xml += xmlify(`${baseUrl}/history`, "0.7");
        
        const historyPages = await models.BomXtrasHistory.findAll({
            attributes: ['slug']
        });
        
        for (const history of historyPages) {
            xml += xmlify(`${baseUrl}/history/${(history as any).slug}`, "0.3");
        }
        
    } catch (error) {
        console.error('Error generating sitemap:', error);
        // Continue with basic sitemap
    }
    
    xml += `</urlset>\n`;
    return xml;
};

const handleSitemap = async (req: Request, res: Response): Promise<void> => {
    try {
        const host = req.get('host') || 'bookofmormon.online';
        const sitemapXml = await generateSitemap(host);
        
        res.setHeader("Content-Type", "application/xml");
        res.send(sitemapXml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        // Fallback to basic sitemap
        res.setHeader("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://bookofmormon.online/</loc>
        <priority>1.0</priority>
    </url>
</urlset>
`);
    }
};

export { generateSitemap, handleSitemap };
