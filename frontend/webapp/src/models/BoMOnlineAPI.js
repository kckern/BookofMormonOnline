import axios from 'axios';
import { getCache, setCache, prepareCacheObject, responseKeyOf } from './Cache'
import { prepareQueries } from './GraphQLQueries'
import { determineLanguage } from "./Utils.js";

const currentDomain = window.location.hostname;
const currentProtocol = window.location.protocol;
const currentPort = window.location.port;
const nonDefaultPort = currentPort !== "80" && currentPort !== "443" && currentPort;
const containedAPI = currentProtocol + "//" + currentDomain + (nonDefaultPort ? ":" + currentPort : "");
const isWebappOnly = parseInt(currentPort) === 3000;
const localTest = /localhost/.test(currentDomain) && false;

export const assetUrl = "https://media.bookofmormon.online";
// Base origin for the dynamic facsimile render API (/fax/render/...). Default is
// SAME-ORIGIN ("") so /fax/render + /fax/text are reverse-proxied to the backend
// (setupProxy.js in dev; nginx/CDN in prod) — this works regardless of the host
// the browser used (localhost, LAN IP, public domain), unlike an absolute
// localhost URL. Set REACT_APP_RENDER_URL to the media CDN once CloudFront
// origin-failover is wired.
export const renderBaseUrl = process.env.REACT_APP_RENDER_URL || "";
// Use empty string for localhost:3000 to leverage proxy, otherwise use appropriate API URL
export const ApiBaseUrl = localTest ? "http://localhost:5005" : isWebappOnly ? "" : containedAPI;
// GraphQL must use the dedicated reverse-proxy location in production. Posting
// to the site root is handled by the Next/CRA front door and returns index.html.
export const GraphQLApiUrl = ApiBaseUrl + "/graphql";
export const fbPixel = "4544125442358924";

export function exitBeacon(appController){
    navigator.sendBeacon(GraphQLApiUrl, JSON.stringify({ 'query': `{closetab(token:"${appController.states.user.token}")}` }));
}

export default async function BoMOnlineAPI(input, options) {
	//	console.log('Input',input);
	//	console.log('Options',options);
    // Check Cache
    if (!options) options = {};
    let cacheResults;
    if (options.useCache !== false) cacheResults = await getCache(input);
    else cacheResults = { missing: input, found: {} };
	//	console.log('CacheResults',cacheResults);
    //Prepare Server Query based on non-cached items
    let queries = prepareQueries(cacheResults.missing, options.token);


    let results = {};
    if (queries.length > 0) {
        //Make GraphQL Server API Call
        let compoundQuery = "{" + queries.map((q) => q.query).join("\n") + "}";
        compoundQuery = compoundQuery.replace(/{mutation(.*)}/, 'mutation$1');
        let apiResults = await serverGQLCall(compoundQuery, options.authToken, options.lang);
		//		console.log('ApiResult',apiResults);
        if(!apiResults?.data) return {error:apiResults};
        //Cache each new item
       
        if (options.useCache !== false) {
            let newCacheObject = prepareCacheObject(queries, apiResults.data, options.useCache);
				//		console.log('NewCacheObject', newCacheObject);
            setCache(newCacheObject);
        }

        //Merge with Already-cached items
        let structuredResults = structureResults(queries, apiResults.data);
        results = mergeResults(structuredResults, cacheResults.found);

    }
    else {
        //Save cache as results
        results = cacheResults.found;
    }
    //Return Result
    return results;
}

async function serverGQLCall(graphQL, authToken, language) {
    const lang = language || determineLanguage();
    let config = {
        method: "post",
        url: GraphQLApiUrl + (lang ? "/"+lang : ""),
        timeout: 1000 * 45, // Wait for 15 seconds
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        data: { query: graphQL }
      }
    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.code === "ECONNABORTED") return { data: null };
        console.log({ config, error });
        return Promise.reject(error);
    }
}


// Merge freshly-fetched results with the warm-cached ones. Exported + pure so
// the union behaviour can be tested without IndexedDB/network.
//
// `structuredResults` holds this request's fresh data; array-typed collections
// (e.g. verses) arrive as raw arrays while `found` holds the same collection as
// an id-keyed object. The previous code returned only the fresh array for those
// keys, silently DROPPING every warm-cached item (a verse served from cache then
// rendered blank). Union them instead — the two sets are disjoint (cached items
// are never re-requested), and consumers read via Object.values, which works on
// the concatenated array.
export function mergeResults(structuredResults, found) {
    if (!found || Object.keys(found).length === 0) return structuredResults;
    const results = {};
    const allKeys = [...new Set(Object.keys(found).concat(Object.keys(structuredResults)))];
    for (const key of allKeys) {
        const fresh = structuredResults[key];
        const cached = found[key];
        if (Array.isArray(fresh)) {
            results[key] = (cached && !Array.isArray(cached))
                ? fresh.concat(Object.values(cached))
                : fresh;
        } else if (Array.isArray(cached)) {
            results[key] = cached;
        } else {
            results[key] = { ...(fresh || {}), ...(cached || {}) };
        }
    }
    return results;
}

export function structureResults(queries, apiResults) {
    let resultObj = {};
    for (let i in queries) {
        let query = queries[i];
        let results = apiResults[responseKeyOf(query.query)];
        if (!Array.isArray(results)) results = [results];
        if (!query.val) {
            resultObj[query.type] = results
        }
        else if(["lookup","search","searchAll","mapstories","verses","verse_highlights"].includes(query.type))
        {
            resultObj[query.type] = apiResults[query.type];
        }
        else {
            for (let j in results) {
                let queryKey = query.key;
                if (resultObj[query.type] === undefined) resultObj[query.type] = {};
                // Prefer a row-derived key (query.keyFn) so results stay correctly
                // associated even when the server drops/reorders rows (e.g.
                // versehighlights omits pairs with no highlight); positional
                // query.val[j] mis-keys every row after a dropped one.
                let dbIndex = query.keyFn && results[j] != null
                    ? query.keyFn(results[j])
                    : (results[j] ? results[j][queryKey] : query.val[j]); // Updated
                if (dbIndex === undefined) dbIndex = query.val[j];
                if (dbIndex === undefined) resultObj[query.type] = results[j];
                else resultObj[query.type][dbIndex] = results[j] ?? null;
            }
        }
    }
    return resultObj;
}
