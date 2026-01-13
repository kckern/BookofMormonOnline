import { Request } from 'express';

const botPattern = new RegExp("(bot|Bot|facebook|googlebot|Twitterbot|BingPreview|ImgProxy|naver|Seo|Yeti|github|_escaped_fragment_)", "i");

const requireSSR = (req: Request): boolean => {
    const domain = req.headers.host;
    const userAgent = req.headers["user-agent"] || '';
    const isBot = botPattern.test(userAgent) || !!req.query._escaped_fragment_;
    const isFirefox = /firefox/i.test(userAgent);
    const isSSRDomain = /^(ssr)/i.test(domain || '');
    const isLocalTest = /^(localhost|127)/i.test(domain || '') && isFirefox;
    return isBot || isSSRDomain || isLocalTest;
};

export { requireSSR };
