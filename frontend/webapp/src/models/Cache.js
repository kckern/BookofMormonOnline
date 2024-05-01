

export async function getCache(input) {
    let db = await loadDBRequest();
    var itemObjectStore = db.transaction("items", "readwrite").objectStore("items");
    let items = { found: {}, missing: {} };
    for (let key in input) {
        let vals = normalizeVal(input[key]);
        if (!vals) {
            let item = await getSingleCache(key, itemObjectStore);
            if (item) {
                if (items.found[key] === undefined) items.found[key] = {}
                items.found[key] = item;
            }
            else {
                if (!Array.isArray(items.missing[key])) items.missing[key] = []
                items.missing[key].push(null)
            }
        } else {

            for (let i in vals) {
                let val = vals[i];
                let item = await getSingleCache(key + "." + val, itemObjectStore);
                if (!item || (key==="page" && !item.sections)) {
                    if (!Array.isArray(items.missing[key])) items.missing[key] = []
                    items.missing[key].push(val)
                }
                else {
                    if (items.found[key] === undefined) items.found[key] = {}
                    items.found[key][val] = item;
                }
            }
        }
    }
		console.log('GetCacheITems',items);
    return new Promise(function (resolve, reject) {
        resolve(items);
    });
}

export function normalizeVal(val) {
    if(val===true) return false;
    if (!Array.isArray(val)) val = [val];
    if ([null, false].indexOf(val[0]) >= 0) val = false;
    return val;
}


export function prepareCacheObject(queries, apiResults, useCache) {
    let cacheObj = {};
    let resultKeys = Object.keys(apiResults);
    for (let i in queries) {
        if(Array.isArray(useCache)) if(!useCache.includes(resultKeys[i])) continue;
        let query = queries[i];
        let results = apiResults[resultKeys[i]];
        if (!Array.isArray(results)) results = [results];
        if (!query.val) {
            cacheObj[query.type] = results
        }
        else {
            for (let j in results) {
                let queryKey = query.key;
                let dbIndex = results[j] ? results[j][queryKey] : query.val[j]; // Update By ME  
                if (dbIndex === undefined) dbIndex = query.val[j];
                cacheObj[query.type + "." + dbIndex] = results[j];
            }

        }
    }
    return cacheObj;
}

export async function getSingleCacheFromKey(key) {
    const itemObjectStore = (await loadDBRequest()).transaction("items", "readwrite").objectStore("items");
    return await getSingleCache(key, itemObjectStore);
}

 async function getSingleCache(key, itemObjectStore) {
    return new Promise(function (resolve, reject) {
        var req = itemObjectStore.openCursor(key);
        req.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) { // key already exist
                resolve(e.target.result.value);
            } else { // key not exist
                resolve(false);
            }
        };
        req.onerror = function (e) {
            reject();
        };
    });
}

export async function setCache(input) {
    let db = await loadDBRequest();
    var itemObjectStore = db.transaction("items", "readwrite").objectStore("items");
    for (let key in input) {
        let item = input[key];
        var req = itemObjectStore.openCursor(key);


        req.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) { // key already exist
                cursor.update(item, key);
            } else { // key not exist
                itemObjectStore.add(item, key);
            }
        };

        req.onerror = function (e) {
            // report the success of our request
        };
    };


}


function loadDBRequest(callBack) {
    return new Promise(function (resolve, reject) {
        let databaseName = "BoMCache";
        var request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = function (event) {
            let db = event.target.result;
            var objectStore = db.createObjectStore("items");
            objectStore.transaction.oncomplete = function (event) {
                resolve(db);
            }
        }
        request.onsuccess = function (event) {
            resolve(event.target.result)
        }
        request.onerror = function (event) {
            reject('error opening database ');
        }
    });
}

