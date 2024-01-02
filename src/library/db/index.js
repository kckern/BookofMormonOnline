
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const connectToDB = async () => {

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USER,
        database: process.env.MYSQL_DB,
        password: process.env.MYSQL_PASSWORD
    });


    return connection;

}


const queryDB = async (sql, params) => {

    if(params) sql = mysql.format(sql, params);
    const connection = await connectToDB();
    const results = (await connection.query(sql))[0];
    connection.end();
    return results;

}

const loadScripturesFromVerseIds = async (verse_ids,lang) => {

    //TODO: add language support

    const count = verse_ids.length;
    const questionmarks = Array(count).fill('?').join(',');
    const sql = `SELECT verse_id, verse_title, verse_scripture text, 
    (SELECT text FROM bom_prd.lds_scriptures_headings 
        WHERE verse_id = ( SELECT MAX(verse_id) FROM bom_prd.lds_scriptures_headings 
        WHERE verse_id <= lds_scriptures_verses.verse_id AND lang = 'en') LIMIT 1 ) as heading 
    FROM bom_prd.lds_scriptures_verses WHERE verse_id IN (${questionmarks}) ORDER BY verse_id ASC;`;
    const verses = await queryDB(sql, verse_ids);
    return verses;

}

const loadTextGuidsFromVerseIds = async (verse_ids) => {
    //bom_prd.bom_lookup
    const questionmarks = Array(verse_ids.length).fill('?').join(',');
    const sql = `SELECT text_guid FROM bom_prd.bom_lookup WHERE verse_id IN (${questionmarks}) ORDER BY verse_id ASC;`;
    const text_guids = await queryDB(sql, verse_ids);
    return text_guids.map(x => x.text_guid);

}

const loadPageSlugFromTextGuid = async (text_guid) => {
    const sql = `SELECT bt.link, bt.content, bt.guid AS 'text_guid', TRIM(LEADING '/' FROM CONCAT_WS('/', IFNULL(bs2.slug,''), IFNULL(bs1.slug,''), bs.slug)) AS 'pageslug' FROM bom_text bt JOIN bom_slug bs ON bs.link = bt.page LEFT JOIN bom_slug bs1 ON bs1.guid = bs.parent LEFT JOIN bom_slug bs2 ON bs2.guid = bs1.parent WHERE bt.guid = ?`;
    const item = await queryDB(sql, text_guid);
    const {link, pageslug, content} = item[0];
    return [pageslug, link, content];



}

module.exports = {
    connectToDB,
    queryDB,
    loadScripturesFromVerseIds,
    loadTextGuidsFromVerseIds,
    loadPageSlugFromTextGuid
}