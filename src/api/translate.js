
const { queryDB } = require("../library/db");


const loadTranslations = async (lang, items, guidkey = "guid") => {

    if(!items || !items.length) return [];
    if(!Array.isArray(items)) items = [items];
    const guids = items.map(item => item?.[guidkey]);
    const refKeys = [...new Set(items.flatMap(item => Object.keys(item)))].filter(key => ["guid",guidkey].indexOf(key) === -1);
    const sql = `SELECT refkey, value, guid FROM bom_translation 
        WHERE lang = ? AND guid IN (${guids.map((guid) => "?").join(",")}) 
        AND refkey IN (${refKeys.map((key) => "?").join(",")})`;

    const params = [lang, ...guids, ...refKeys];
    const rows = await queryDB(sql, params);
    
    const translations = rows.reduce((acc,row)=>{
        const {guid, refkey, value} = row;
        acc[guid] = acc[guid] || {};
        acc[guid][refkey] = value;
        return acc;
    },{});
    let results =  items.map(item => ({...item, ...translations[item[guidkey]]}));
    //remove empty elements in array objects
    results = results.map(item => {
        Object.keys(item).forEach(key => {
            if(Array.isArray(item[key]) && item[key].length === 0) delete item[key];
        })
        return item;
    })
    return results;
  }



module.exports = {loadTranslations};