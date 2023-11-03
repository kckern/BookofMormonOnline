const determineLanguage = (req) => {
    const {headers} = req;
    const {host} = headers;
    const hostname = host.split(":")[0];
    const tld = hostname.split(".").pop();
    if(tld==="kr") return "ko";
    const hasSubdomain = hostname.split(".").length > 2;
    if(hasSubdomain) return hostname.split(".")[0];
    return null;
}


module.exports = {determineLanguage};