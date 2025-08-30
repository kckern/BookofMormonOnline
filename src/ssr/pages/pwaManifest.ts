import { Request, Response } from 'express';
import { models } from '../../config/database';

const generateManifest = async (): Promise<object> => {
    try {
        // Fetch site title and short title from database
        const siteTitle = (await models.BomLabel.findOne({
            where: { label_id: 'home_title' },
            attributes: ['label_text']
        })).getDataValue('label_text');

        const shortTitle = (await models.BomLabel.findOne({
            where: { label_id: 'short_title' },
            attributes: ['label_text']
        })).getDataValue('label_text');


        const name = siteTitle || "Book of Mormon Online";
        const short_name = shortTitle || "BkMrmn";

        return {
            name,
            short_name,
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#003366",
            icons: []
        };
    } catch (error) {
        console.error('Error loading manifest from database:', error);
        // Fallback to hardcoded values
        return {
            name: "Book of Mormon Online",
            short_name: "BkMrmn",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#003366",
            icons: []
        };
    }
};

const handleManifest = async (req: Request, res: Response): Promise<void> => {
    try {
        const manifest = await generateManifest();
        
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(manifest, null, 2));
    } catch (error) {
        console.error('Error generating manifest:', error);
        // Fallback to basic manifest
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({
            name: "Book of Mormon Online",
            short_name: "BkMrmn",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#003366",
            icons: []
        }, null, 2));
    }
};

export { generateManifest, handleManifest };
