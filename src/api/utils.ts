const VALID_LANGUAGES = ["en", "fr", "de", "nl", "pt", "ko", "jpn", "zh", "ru", "hi", "eo", "es", "vn", "tgl", "th", "ukr", "tam", "swe"];

const determineLanguage = (req: any): string | null => {
    try {
        const host = req?.headers?.host;
        if (!host) return null;

        const hostname = host.split(":")[0].toLowerCase();
        const parts = hostname.split(".");
        
        // Korean TLD
        if (parts[parts.length - 1] === "kr") return "ko";
        
        // Language subdomain
        if (parts.length > 2) {
            const subdomain = parts[0];
            if (VALID_LANGUAGES.includes(subdomain)) return subdomain;
        }
        
        return null;
    } catch {
        return null;
    }
}

export { determineLanguage };