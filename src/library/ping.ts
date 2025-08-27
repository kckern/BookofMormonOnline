import axios from 'axios';
import { Request, Response } from 'express';

interface QueryData {
  [key: string]: any;
  ip_address?: string;
  ua?: string;
}

const jsonToQuery = function (obj: any, prefix?: string): string {
  var str: string[] = [], p: string;
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

const ping = async (req: Request, res: Response): Promise<void> => {
  let queryData: QueryData = {};
  
  // Check if this is a POST request with base64 encoded data
  if (req.method === 'POST' && req.body && req.body.data) {
    try {
      // Decode the base64 data
      const decodedData = Buffer.from(req.body.data, 'base64').toString('utf-8');
      
      // Parse the query string into an object
      const urlParams = new URLSearchParams(decodedData);
      urlParams.forEach((value, key) => {
        queryData[key] = value;
      });
    } catch (e) {
      // If decoding fails, fall back to regular query params
      queryData = req.query as QueryData;
    }
  } else {
    // Use regular query parameters for GET requests or fallback
    queryData = req.query as QueryData;
  }
  
  // Get client IP address, prioritizing x-forwarded-for header
  let ip = req.headers['x-forwarded-for'] as string;
  if (ip) {
    // x-forwarded-for can be a comma-separated list; take the first public IPv4 address
    ip = ip
      .split(',')
      .map(s => s.trim())
      .find(addr =>
        /^[0-9.]+$/.test(addr) && // IPv4 only
        !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(addr) && // not private
        !/^127\./.test(addr) && // not loopback
        !/^169\.254\./.test(addr) // not link-local
      ) || '';
  }
  if (!ip) {
    // fallback to remote address, but still filter for public IPv4
    ip =
      [
        (req as any).connection?.remoteAddress,
        (req as any).socket?.remoteAddress,
        (req as any).connection?.socket?.remoteAddress
      ]
        .map(addr => (addr || '').replace(/^::ffff:/, '')) // handle IPv4-mapped IPv6
        .find(addr =>
          /^[0-9.]+$/.test(addr) &&
          !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(addr) &&
          !/^127\./.test(addr) &&
          !/^169\.254\./.test(addr)
        ) || '';
  }
  queryData.ip_address = ip;
  
  queryData.ua = req.get("user-agent");
  
  try {
    const url = `https://in.getclicky.com/in.php?sitekey_admin=${process.env.clickySiteAdmin}&` + jsonToQuery(queryData);
    const response = await axios.get(url);
    res.set("content-type", "text/plain");
    res.send(response.data);
  } catch (e) {
    res.json(e);
  }
};

export { ping };
