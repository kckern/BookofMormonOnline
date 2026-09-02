

// Commentary rows gained text_highlight (the verse excerpt its bubble
// highlights). The backend strips null/''/[] keys from GraphQL responses for
// legacy parity, so a MISSING text_highlight cannot tell a stale cached row
// apart from a fresh one that simply has no excerpt — checking `"text_highlight"
// in item` would refetch ~90% of commentary forever. Stamp fresh writes instead
// and treat unstamped commentary as stale. Bump on the next commentary shape change.
export const COMMENTARY_SHAPE_V = 2;

// The GraphQL response key for a query string: an explicit alias
// ("alias: field") wins, otherwise the bare field name, after skipping any
// leading query/mutation operation keyword. Consumers (structureResults,
// prepareCacheObject) look results up BY NAME (not by position) so a server
// that omits a field entirely — e.g. `page` returns nothing for a
// section-level slug — can't shift every subsequent field onto the wrong
// query. See docs/bugs/2026-09-01-section-links-bounce-to-contents.md.
export function responseKeyOf(queryString) {
    const s = String(queryString || "")
        .trim()
        .replace(/^(?:query|mutation)\b\s*\w*\s*\{?/, "")
        .trim();
    const alias = s.match(/^([A-Za-z_]\w*)\s*:/);
    if (alias) return alias[1];
    const field = s.match(/^([A-Za-z_]\w*)/);
    return field ? field[1] : undefined;
}

export async function getCache(input) {
    let db = await loadDBRequest();
    var itemObjectStore = db.transaction("items", "readwrite").objectStore("items");
    let items = { found: {}, missing: {} };
    for (let key in input) {
        let vals = normalizeVal(input[key]);
        if (!vals) {
            let item = await getSingleCache(key, itemObjectStore);
            // chiasmus list query gained verse_id/line_lengths/speaker (Task 16), then
            // page (verse→reading-page); it caches as a bare array under "chiasmus" —
            // refetch cached rows predating either change ("speaker"/"page" in row is
            // true even when the value is null)
            if (key === "chiasmus" && Array.isArray(item) && item.length && (!("speaker" in item[0]) || !("page" in item[0]))) item = false;
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
                // passagenotes query gained chiasmus_id (e37a5aa7); the chiasm detail
                // query gained speaker (tile header shows avatar+name); commentary
                // gained text_highlight (see COMMENTARY_SHAPE_V above)
                // — refetch cached items predating any of those shape changes
                if (!item || (key==="page" && !item.sections) || (key.startsWith("passagenotes") && item.chiasmus?.length && !item.chiasmus[0].chiasmus_id) || (key==="chiasm" && item && !("speaker" in item)) || (key==="commentary" && item._v !== COMMENTARY_SHAPE_V)) {
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
		//console.log('GetCacheITems',items);
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
    for (let i in queries) {
        let query = queries[i];
        // Look results up BY NAME (not by position) so an omitted/reordered
        // response field can't be cached under the wrong query — the same
        // fragility fixed in structureResults.
        let responseKey = responseKeyOf(query.query);
        if(Array.isArray(useCache)) if(!useCache.includes(responseKey)) continue;
        let results = apiResults[responseKey];
        if (!Array.isArray(results)) results = [results];
        if (!query.val) {
            cacheObj[query.type] = results
        }
        else {
            for (let j in results) {
                let queryKey = query.key;
                // Prefer a row-derived key so cache entries stay correctly
                // associated when the server drops/reorders rows (versehighlights).
                let dbIndex = query.keyFn && results[j] != null
                    ? query.keyFn(results[j])
                    : (results[j] ? results[j][queryKey] : query.val[j]); // Update By ME
                if (dbIndex === undefined) dbIndex = query.val[j];
                cacheObj[query.type + "." + dbIndex] =
                    query.type === "commentary" && results[j]
                        ? { ...results[j], _v: COMMENTARY_SHAPE_V }
                        : results[j];
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

