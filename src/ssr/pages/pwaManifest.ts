import { Request, Response } from 'express';
import { models } from '../../config/database';
import { determineLanguage } from '../../api/utils';

const generateManifest = async (lang?: string): Promise<object> => {
    try {
        // Include translation if language is provided and not English
        const includeOptions = lang && lang !== 'en' ? [{
            model: models.BomTranslation,
            as: 'translation',
            where: { 
                lang: lang,
                refkey: 'label_text'
            },
            attributes: ['value'],
            required: false
        }] : [];

        // Fetch site title and short title from database
        const siteTitleRecord = await models.BomLabel.findOne({
            where: { label_id: 'home_title' },
            attributes: ['label_text'],
            include: includeOptions
        });

        const shortTitleRecord = await models.BomLabel.findOne({
            where: { label_id: 'short_title' },
            attributes: ['label_text'],
            include: includeOptions
        });

        // Extract translated values
        const getTranslatedValue = (record: any, field: string) => {
            if (!record) return null;
            const translations = record.getDataValue('translation');
            if (translations && translations.length > 0) {
                return translations[0].getDataValue('value');
            }
            return record.getDataValue(field);
        };

        const siteTitle = getTranslatedValue(siteTitleRecord, 'label_text');
        const shortTitle = getTranslatedValue(shortTitleRecord, 'label_text');


        const name = siteTitle || "Book of Mormon Online";
        const short_name = shortTitle || "BkMrmn";

        return {
            name,
            short_name,
            start_url: "/",
            display: "standalone",
            background_color: "#323b4d",
            theme_color: "#003366",
            icons: [
                {
                    src: "/icons/icon-16.png",
                    sizes: "16x16",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-32.png",
                    sizes: "32x32",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-144.png",
                    sizes: "144x144",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-192.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-512.png",
                    sizes: "512x512",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-1024.png",
                    sizes: "1024x1024",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "/icons/icon-2048.png",
                    sizes: "2048x2048",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "/favicon.ico",
                    sizes: "64x64 32x32 24x24 16x16",
                    type: "image/x-icon"
                }
            ]
        };
    } catch (error) {
        console.error('Error loading manifest from database:', error);
        // Fallback to hardcoded values
        return {};
    }
};

const handleManifest = async (req: Request, res: Response): Promise<void> => {
    try {
        const lang = determineLanguage(req) || 'en';
        const manifest = await generateManifest(lang);
        
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
            icons: [
                {
                    src: "/icons/icon-192.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-512.png",
                    sizes: "512x512",
                    type: "image/png"
                },
                {
                    src: "/icons/icon-1024.png",
                    sizes: "1024x1024",
                    type: "image/png"
                },
                {
                    src: "/favicon.ico",
                    sizes: "64x64 32x32 24x24 16x16",
                    type: "image/x-icon"
                }
            ]
        }, null, 2));
    }
};

export { generateManifest, handleManifest };
