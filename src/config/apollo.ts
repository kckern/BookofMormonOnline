
import typeDefs from '../typeDefs';
import resolvers from '../resolvers';
import { isArray } from 'util';
import { sequelize } from './database';

const langs = ["en","fr","de","nl","pt","ko","jpn","zh","ru","hi","eo","es","vn","tgl","th"];



export const apollo_config = {
    sequelize,
    typeDefs,
    resolvers,
    introspection: true,
    context: ({ req }) => {
      const headers = req.headers || {};

      //check if language subdomain
      const subdomain = req.headers.host.split('.')[0];
      const pathlang = req.url.split('/').reverse().shift() || 'en';

      const lang = langs.includes(subdomain) ? subdomain : pathlang;

      return {
        lang,
        ip: maybeGetuserIpAddress(headers),
        db: sequelize
      };
    },
    formatResponse: (res) => {
      const filter = (obj) => {
        if (!obj) return null;
        Object.keys(obj).map((key) => {
          let value = obj[key];
          if (value === '' || value === null || (isArray(value) && !value.length)) {
            delete obj[key];
          } else if (Object.prototype.toString.call(value) === '[object Object]') {
            filter(value);
          } else if (Object.prototype.toString.call(value) === '[object Array]') {
            value.map((v) => {
              filter(v);
            });
          }
        });
      };
      filter(res.data);
      return res;
    }
  }



export const maybeGetuserIpAddress = (headers) => {
  if (!headers) return '127.0.0.1';
  const ipAddress = headers['x-forwarded-for'];
  if (!ipAddress) return '127.0.0.1';
  return ipAddress;
};
