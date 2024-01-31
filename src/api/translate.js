
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


async function translate(req, res) {
    const {action} = req.body;
    if(action === "list") return listTranslations(req, res);
    if(action === "audit") return auditTranslation(req, res);
    if(action === "update") return updateTranslation(req, res);
    return res.status(404).json({error: "Invalid action"});

}

async function  listTranslations(req, res) {
    const guidMap = {
        "bom_people": "slug"
    };

    req.body = req.body || {};
    req.body.lang = req.body.lang || "vn";
    req.body.table = req.body.table || "bom_people";
    req.body.refkey = req.body.refkey || "name";
    req.body.user = req.body.user || "admin";
    req.body.limit = req.body.limit || 100;

    const {lang, table, refkey, limit, user} = req.body;
    const guidKey = guidMap[table] || "guid";

    const sql = `SELECT x.id, x.guid, p.${refkey} src, x.value dst FROM ${table} p JOIN bom_translation x ON p.${guidKey} = x.guid AND x. refkey = ? AND x.lang = ? AND x.score IS NULL AND x.contributor <> ? LIMIT ?`;

    const list = await queryDB(sql, [refkey, lang, user, limit]);

    return res.json(list);
}

async function auditTranslation(req, res) {
    const  {score, id, user} = req.body;
    const sql = `UPDATE bom_translation SET auditor = ?, score = ? WHERE id = ?`;
    await queryDB(sql, [user, score, id]);
    return res.json({success: true});
}

async function updateTranslation(req, res) {
    const {id, value, user} = req.body;
    const sql = `UPDATE bom_translation SET prev_value = value, value = ?, contributor = ? auditor = NULL, score = NULL WHERE id = ?`;
    await queryDB(sql, [value, user, id]);
    return res.json({success: true});
}



module.exports = {
    loadTranslations,
    translate
};