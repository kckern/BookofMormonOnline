
const botPattern = new RegExp("(bot|Bot|facebook|googlebot|Twitterbot|BingPreview|ImgProxy|naver|Seo|Yeti|github|_escaped_fragment_)", "i");

const requireSSR = (req) => {
    const domain = req.headers.host;
    const isBot = botPattern.test(req.headers["user-agent"]) || !!req.query._escaped_fragment_;
    const isFirefox = /firefox/i.test(req.headers["user-agent"]);
    const isSSRDomain = /^(ssr)/i.test(domain);
    const isLocalTest = /^(localhost|127)/i.test(domain) && isFirefox;
    return isBot || isSSRDomain || isLocalTest;
};


module.exports= {requireSSR}