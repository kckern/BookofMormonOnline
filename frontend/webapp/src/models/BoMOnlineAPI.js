import axios from 'axios';
import { getCache, setCache, prepareCacheObject } from './Cache'
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
export const ApiBaseUrl = localTest ?   "http://localhost:5005" : isWebappOnly? "https://dev.bookofmormon.online" : containedAPI ;
export const fbPixel = "4544125442358924";

export function exitBeacon(appController){
    navigator.sendBeacon(ApiBaseUrl, JSON.stringify({ 'query': `{closetab(token:"${appController.states.user.token}")}` }));
}

export default async function BoMOnlineAPI(input, options) {

    // Check Cache
    if (!options) options = {};
    let cacheResults;
    if (options.useCache !== false) cacheResults = await getCache(input);
    else cacheResults = { missing: input, found: {} };

    //Prepare Server Query based on non-cached items
    let queries = prepareQueries(cacheResults.missing, options.token);


    let results = {};
    if (queries.length > 0) {
        //Make GraphQL Server API Call
        let compoundQuery = "{" + queries.map((q) => q.query).join("\n") + "}";
        compoundQuery = compoundQuery.replace(/{mutation(.*)}/, 'mutation$1');
        let apiResults = await serverGQLCall(compoundQuery);
        if(!apiResults?.data) return {error:apiResults};
        //Cache each new item
       
        if (options.useCache !== false) {
            let newCacheObject = prepareCacheObject(queries, apiResults.data, options.useCache);
            setCache(newCacheObject);
        }

        //Merge with Already-cached items
        let structuredResults = structureResults(queries, apiResults.data);

        if (Object.keys(cacheResults.found).length > 0) {
            let allKeys = Object.keys(cacheResults.found).concat(Object.keys(structuredResults));
            for (let i in allKeys) {
                let key = allKeys[i];
                if (cacheResults.found[key] === undefined) cacheResults.found[key] = {};
                if (structuredResults[key] === undefined) structuredResults[key] = {};
                results[key] = { ...structuredResults[key], ...cacheResults.found[key] };
            }
        } else {
            results = structuredResults;
        }

    }
    else {
        //Save cache as results
        results = cacheResults.found;
    }
    //Return Result
    return results;
}

function serverGQLCall(graphQL) {
    const lang = determineLanguage();
    let config = {
        method: "post",
        url: ApiBaseUrl + (lang ? "/"+lang : ""),
        timeout: 1000 * 15, // Wait for 15 seconds
        headers: {
          "Content-Type": "application/json"
        },
        data: { query: graphQL }
      }
    return axios(config).then((response) => response.data)
        .catch(error => { 
            if(error.code==="ECONNABORTED") return {data:null};
            console.log({config,error});
            return Promise.reject(error)
        })
}


function structureResults(queries, apiResults) {
    let resultObj = {};
    let resultKeys = Object.keys(apiResults);
    for (let i in queries) {
        let query = queries[i];
        let results = apiResults[resultKeys[i]];
        if (!Array.isArray(results)) results = [results];
        if (!query.val) {
            resultObj[query.type] = results
        }
        else if(["lookup","search"].includes(query.type))
        {
            resultObj[query.type] = apiResults[query.type];
        }
        else {
            for (let j in results) {
                let queryKey = query.key;
                if (resultObj[query.type] === undefined) resultObj[query.type] = {};
                // let dbIndex = results[j][queryKey]; 
                let dbIndex = results[j] ? results[j][queryKey] : query.val[j]; // Updated
                if (dbIndex === undefined) dbIndex = query.val[j];
                if (dbIndex === undefined) resultObj[query.type] = results[j];
                else resultObj[query.type][dbIndex] = results[j];
            }
        }
    }
    return resultObj;
}

