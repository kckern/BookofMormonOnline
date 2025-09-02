import { Request, Response } from 'express';
import { models } from '../../config/database';
import { determineLanguage } from '../../api/utils';

// Constants for manifest configuration
const MANIFEST_CONSTANTS = {
    DEFAULT_VALUES: {
        name: "Book of Mormon Online",
        short_name: "BkMrmn",
        description: "A dynamic, social study resource for all students of the Book of Mormon",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#323b4d",
        theme_color: "#000000",
        categories: ["books", "education", "reference", "religion"],
        dir: "ltr",
        id: "/",
    },
    LABEL_IDS: [
        'home_title',
        'short_title', 
        'home_subtitle',
        'menu_read',
        'menu_study',
        'menu_people',
        'menu_theater',
        'pwa_screenshot_desktop_label',
        'pwa_screenshot_mobile_label'
    ],
    SHORTCUTS: [
        {
            slug: 'read',
            labelKey: 'menu_read',
            defaultName: 'Read',
            defaultDescription: 'Read',
            url: '/read'
        },
        {
            slug: 'study',
            labelKey: 'menu_study',
            defaultName: 'Study',
            defaultDescription: 'Study',
            url: '/study'
        },
        {
            slug: 'people',
            labelKey: 'menu_people',
            defaultName: 'People',
            defaultDescription: 'People',
            url: '/people'
        },
        {
            slug: 'theater',
            labelKey: 'menu_theater',
            defaultName: 'Theater',
            defaultDescription: 'Theater',
            url: '/theater'
        }
    ]
};

// Helper function to create icon objects
const createIcon = (size: string, purpose?: string): object => ({
    src: `/icons/icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    ...(purpose && { purpose })
});

// Helper function to generate icons array
const generateIcons = (): object[] => [
    createIcon("16"),
    createIcon("32"),
    createIcon("48"),
    createIcon("72"),
    createIcon("96"),
    createIcon("144"),
    createIcon("192", "any"),
    { ...createIcon("192", "maskable"), src: "/icons/icon-192-maskable.png" },
    createIcon("512", "any"),
    { ...createIcon("512", "maskable"), src: "/icons/icon-512-maskable.png" },
    createIcon("1024", "any"),
    createIcon("2048", "any"),
    {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon"
    }
];

// Helper function to generate screenshots
const generateScreenshots = (labels: Map<string, string>): object[] => [
    {
        src: "https://media.bookofmormon.online/interface/app/en-desktop",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: labels.get('pwa_screenshot_desktop_label') || "Desktop view"
    },
    {
        src: "https://media.bookofmormon.online/interface/app/en-mobile",
        sizes: "375x812",
        type: "image/png",
        form_factor: "narrow",
        label: labels.get('pwa_screenshot_mobile_label') || "Mobile view"
    }
];

// Helper function to generate shortcuts
const generateShortcuts = (labels: Map<string, string>): object[] => 
    MANIFEST_CONSTANTS.SHORTCUTS.map(shortcut => ({
        name: labels.get(shortcut.labelKey) || shortcut.defaultName,
        short_name: labels.get(shortcut.labelKey) || shortcut.defaultName,
        description: labels.get(shortcut.labelKey) || shortcut.defaultDescription,
        url: shortcut.url,
        icons: [{
            src: `/icons/shortcut-${shortcut.slug}.png`,
            sizes: "192x192"
        }]
    }));

// Helper function to fetch labels from database
const fetchLabels = async (lang?: string): Promise<Map<string, string>> => {
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

    const labelRecords = await Promise.all(
        MANIFEST_CONSTANTS.LABEL_IDS.map(labelId => 
            models.BomLabel.findOne({
                where: { label_id: labelId },
                attributes: ['label_text'],
                include: includeOptions
            })
        )
    );

    const labels = new Map();
    MANIFEST_CONSTANTS.LABEL_IDS.forEach((labelId, index) => {
        const record = labelRecords[index];
        if (record) {
            const translations = record.getDataValue('translation');
            const value = translations && translations.length > 0 
                ? translations[0].getDataValue('value')
                : record.getDataValue('label_text');
            labels.set(labelId, value);
        }
    });

    return labels;
};

// Helper function to create the base manifest structure
const createBaseManifest = (labels: Map<string, string>, lang?: string, host?: string): object => {
    const defaults = MANIFEST_CONSTANTS.DEFAULT_VALUES;
    
    return {
        name: labels.get('home_title') || defaults.name,
        short_name: labels.get('short_title') || defaults.short_name,
        description: labels.get('home_subtitle') || defaults.description,
        start_url: defaults.start_url,
        scope: defaults.scope,
        display: defaults.display,
        orientation: defaults.orientation,
        background_color: defaults.background_color,
        theme_color: defaults.theme_color,
        categories: defaults.categories,
        lang: lang || "en",
        dir: defaults.dir, // TODO: Set to "rtl" for Arabic, Hebrew, etc.
        id: defaults.id,
        screenshots: generateScreenshots(labels),
        icons: generateIcons(),
        shortcuts: generateShortcuts(labels),
        iarc_rating_id: "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",
        prefer_related_applications: false,
        related_applications: [],
        scope_extensions: [
            {
                origin: `https://${host || 'bookofmormon.online'}`
            }
        ],
        launch_handler: {
            client_mode: "focus-existing"
        }
    };
};

const generateManifest = async (lang?: string, host?: string): Promise<object> => {
    try {
        const labels = await fetchLabels(lang);
        return createBaseManifest(labels, lang, host);
    } catch (error) {
        console.error('Error loading manifest from database:', error);
        // Fallback to default values with empty labels map
        return createBaseManifest(new Map(), lang, host);
    }
};

const handleManifest = async (req: Request, res: Response): Promise<void> => {
    try {
        const lang = determineLanguage(req) || 'en';
        const host = req.get('host') || 'bookofmormon.online';
        const manifest = await generateManifest(lang, host);
        
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(manifest, null, 2));
    } catch (error) {
        console.error('Error generating manifest:', error);
        // Fallback uses the same base manifest with empty labels
        const host = req.get('host') || 'bookofmormon.online';
        const fallbackManifest = createBaseManifest(new Map(), 'en', host);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(fallbackManifest, null, 2));
    }
};

export { generateManifest, handleManifest };
