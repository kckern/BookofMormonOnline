
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
    if(action === "context") return getContext(req, res);
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

    const sql = `SELECT x.id, x.guid, p.${refkey} src, x.value dst FROM ${table} p JOIN bom_translation x ON p.${guidKey} = x.guid AND x. refkey = ? AND x.lang = ? AND x.score IS NULL AND x.contributor <> ? `;

    const list = await queryDB(sql, [refkey, lang, user, limit]);

    const filteredList = list.filter(row => {
        if(table === "bom_text" && /\d$/.test(row.src)) return false;
        return true;
    });

    return res.json(filteredList);
}

async function auditTranslation(req, res) {
    const  {score, id, user} = req.body;
    const sql = `UPDATE bom_translation SET auditor = ?, score = ? WHERE id = ?`;
    await queryDB(sql, [user, score, id]);
    return res.json({success: true});
}

async function updateTranslation(req, res) {
    const {id, value, user} = req.body;
    const sql = `UPDATE bom_translation SET prev_value = value, value = ?, contributor = ?, auditor = NULL, score = NULL WHERE id = ?`;
    await queryDB(sql, [value, user, id]);
    return res.json({success: true});
}


async function getContext(req, res) {
    const {table, refkey, guid, lang} = req.body;
    const guidString = ["bom_people"].includes(table) ? "slug" : "guid";

    const functions = {
        "bom_page": async ()=>{
            const section_titles = (await queryDB(`SELECT value as section_title FROM bom_section s JOIN bom_translation x ON s.guid = x.guid AND x.lang = ? AND x.refkey = "title" WHERE s.parent = ?`, [lang, guid])).map(row => row.section_title);
            const page_images = (await queryDB(`SELECT id FROM bom_xtras_image WHERE location_guid IN (SELECT guid FROM bom_text WHERE page = ?)`, [guid])).map(row => row.id);
            const page_people = await queryDB(` SELECT bom_people.slug, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'name' AND vt.guid = bom_people.slug AND vt.lang = ?) as name, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'title' AND vt.guid = bom_people.slug AND vt.lang = ?) as title, COUNT(bom_index.slug) as slug_count FROM bom_text JOIN bom_lookup ON bom_text.guid = bom_lookup.text_guid JOIN bom_index ON bom_lookup.verse_id = bom_index.verse_id JOIN bom_people ON bom_index.slug = bom_people.slug WHERE bom_text.page = ? GROUP BY bom_people.slug ORDER BY slug_count DESC`, [lang, lang, guid]);
            return res.json({section_titles, page_images, page_people});
        },
        "bom_section": async ()=>{
            //replace 	{Mặc Môn|mormon2} to Mặc Môn
            //replace  [Mặc Môn|mormon2] to Mặc Môn

            const narrations = (await queryDB(` SELECT value as narration FROM bom_narration n JOIN bom_sectionrow sr ON n.parent = sr.guid JOIN bom_section s ON sr.parent = s.guid JOIN bom_translation x ON n.guid = x.guid AND x.lang = ? AND x.refkey = "description" WHERE s.guid = ? `, [lang, guid])).map(row => row.narration.replace(/\{(.+?)\|(.+?)\}/g, "$1").replace(/\[(.+?)\|(.+?)\]/g, "$1"));
            const section_images = (await queryDB(`SELECT id FROM bom_xtras_image WHERE location_guid IN (SELECT guid FROM bom_text WHERE section = ?)`, [guid])).map(row => row.id);
            const section_people = await queryDB(` SELECT bom_people.slug, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'name' AND vt.guid = bom_people.slug AND vt.lang = ?) as name, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'title' AND vt.guid = bom_people.slug AND vt.lang = ?) as title, COUNT(bom_index.slug) as slug_count FROM bom_text JOIN bom_lookup ON bom_text.guid = bom_lookup.text_guid JOIN bom_index ON bom_lookup.verse_id = bom_index.verse_id JOIN bom_people ON bom_index.slug = bom_people.slug WHERE bom_text.section = ? GROUP BY bom_people.slug ORDER BY slug_count DESC`, [lang, lang, guid]);
            return res.json({narrations, section_images, section_people});
        },
        "bom_text": async ()=>{
            const text_content = (await queryDB(`SELECT value as text_content FROM bom_translation WHERE guid = ? AND lang = ? AND refkey = "content"`, [guid, lang])).map(row => row.text_content)[0]?.replace(/<[^>]+>/g, "").replace(/_/g, "").trim()
            .replace(/\[[ic]\]\d+\[\/[ic]\]/g, "").replace(/\n/g, " ").replace(/\s+/g, " ");
            const text_images = (await queryDB(`SELECT id FROM bom_xtras_image WHERE location_guid = ?`, [guid])).map(row => row.id);
            const text_people = await queryDB(` SELECT bom_people.slug, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'name' AND vt.guid = bom_people.slug AND vt.lang = ?) as name, (SELECT vt.value FROM bom_translation vt WHERE vt.refkey = 'title' AND vt.guid = bom_people.slug AND vt.lang = ?) as title, COUNT(bom_index.slug) as slug_count FROM bom_text JOIN bom_lookup ON bom_text.guid = bom_lookup.text_guid JOIN bom_index ON bom_lookup.verse_id = bom_index.verse_id JOIN bom_people ON bom_index.slug = bom_people.slug WHERE bom_text.guid = ? GROUP BY bom_people.slug ORDER BY slug_count DESC`, [lang, lang, guid]);
            return res.json({text_content,text_images, text_people});
        },
        "bom_people": async ()=>{
            //SELECT CONCAT(book, " ", chapter,":", verse) ref, text FROM lds_scriptures_translations WHERE lang = "vn" AND verse_id IN (SELECT verse_id FROM bom_index WHERE slug = "alma2")
            const people_refs = (await queryDB(`SELECT CONCAT(book, " ", chapter,":", verse) ref, text FROM lds_scriptures_translations WHERE lang = ? AND verse_id IN (SELECT verse_id FROM bom_index WHERE slug = ?)`, [lang, guid]));
            return res.json({people_refs});
        },
        "bom_places": async ()=>{
            const place_refs = (await queryDB(`SELECT CONCAT(book, " ", chapter,":", verse) ref, text FROM lds_scriptures_translations WHERE lang = ? AND verse_id IN (SELECT verse_id FROM bom_index WHERE slug = ?)`, [lang, guid]));
            return res.json({place_refs});
        }
    }

    const fn = functions[table] || (()=>{res.json({error: "Invalid table or refkey"});})

    return fn();
}





module.exports = {
    loadTranslations,
    translate
};