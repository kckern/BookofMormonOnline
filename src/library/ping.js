const axios = require("axios");
const jsonToQuery = function (obj, prefix) {
    var str = [], p;
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        var k = prefix ? prefix + "[" + p + "]" : p,
          v = obj[p];
        str.push(
          v !== null && typeof v === "object"
            ? jsonToQuery(v, k)
            : encodeURIComponent(k) + "=" + encodeURIComponent(v)
        );
      }
    }
    return str.join("&");
};

const ping = async (req, res) => {
    req.query.ip_address = (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
    
    req.query.ua = req.get("user-agent");
    // console.log(req.query);
    try{
    const url = `https://in.getclicky.com/in.php?sitekey_admin=${process.env.clickySiteAdmin}&` +  jsonToQuery(req.query);
    //console.log({url});
    const response = await axios.get(url);
    res.set("content-type", "text/plain");
  
  
    res.send(response.data);
    }catch(e){


        res.json(e)
    }

  };

module.exports = {ping};