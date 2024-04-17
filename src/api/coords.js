const { queryDB } = require("../library/db");
const {sendbird} = require("../library/sendbird.js");
const crypto = require('crypto');

const md5 = (value)=>{
    if(!value) return "";
    if(/$[0-9a-f]{32}$/.test(value)) return value;
    return crypto.createHash('md5').update(value,'utf8').digest("hex");
  }
  


const updateCoords =async  (req, res) => {

    //get token from header
    const {token} = req.headers;
    //get lat, lng, map, and guid from body
    const {lat,lng,map,slug,name,label,lang,min,max,zoom} = req.body;



    let result = await queryDB("SELECT user FROM bom_user_token WHERE token = ?",[token]);
    let user = null;
    if(result && result.length > 0) {
        user = result[0].user;
    }    
    if(!user) return res.json({success:false, message: "Invalid token"});


    const md5Username = md5(user);
    //get sendbird object
    const metadata = await sendbird.getUserMetadata(md5Username);
    const keys = Object.keys(metadata);
    if(["isAdmin","isMapper"].every(key=>!keys.includes(key))) return res.json({success:false, message: "User is not a mapper", keys});
    const guidR = await queryDB("SELECT guid FROM bom_places WHERE slug = ?",[slug]);
    const guid = guidR?.[0]?.guid;
    if(!guid) return res.json({success:false, message: "Invalid slug", slug, guidR});
    req.body.guid = guid;
    if( map  && guid && slug)
    {
        if(lat && lng) {
        const sql = `INSERT INTO bom_places_coords (lat, lng, time, user, guid, map, slug) VALUES (?, ?, NOW(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), time = VALUES(time), user = VALUES(user), slug = VALUES(slug)`;
        await queryDB(sql,[lat,lng,user,guid,map,slug]);
        }

        if(min || max || zoom) {
            const fields = { min, max, zoom };
            let sql = 'UPDATE bom_places_coords SET ';
            let params = [];
            for (let [key, value] of Object.entries(fields)) {
                if (value !== null) {
                    sql += `${key} = ?, `;
                    params.push(value);
                }
            }

            // Remove the last comma and space
            sql = sql.slice(0, -2);

            sql += ' WHERE guid = ? AND map = ? LIMIT 1';
            params.push(guid);
            params.push(map);

            if (params.length > 1) { // Ensure there's more than just the guid
                await queryDB(sql, params);
            }
        }
      

    }
    
    if(name || label)
    {
        if(!lang || lang === "en") {
            const updates = {name, label};
            let sql = 'UPDATE bom_places SET ';
            let params = [];
            for (let [key, value] of Object.entries(updates)) {
                if (value !== null) {
                    sql += `${key} = ?, `;
                    params.push(value);
                }
            }
            sql = sql.slice(0, -2);
            sql += ' WHERE guid = ? LIMIT 1';
            params.push(guid);
            await queryDB(sql, params);
        }else{
            [{name},{label}].forEach(async (object)=>{
                const [key,value] = Object.entries(object)[0];
                if(!value) return;
                await queryDB(` UPDATE bom_translation SET value = ? WHERE lang = ? AND guid = ? AND refkey = ? LIMIT 1`,[value,lang,guid,key]);
            });
        }
    }

    //load fresh from database
    const [coords] = await queryDB("SELECT * FROM bom_places_coords WHERE guid = ? AND map = ?",[guid,map]);
    const updatedBody = { lat : coords.lat, lng : coords.lng, min : coords.min, max : coords.max, zoom : coords.zoom , guid, map, slug};
    res.json({success:true, items:updatedBody});


}


module.exports = { updateCoords }