import axios from "axios";
import csv from "csvtojson";
import fs from 'fs'

const CSVURL = "https://docs.google.com/spreadsheets/d/1s8VT3fa1AyKi63TmJkCx2xqvZpRBdqMgr5Pr2Mym_lg/export?format=csv&gid=60384685";


let raw = await axios.get(CSVURL);
csv({
    noheader:false,
    output: "csv"
})
.fromString(raw.data)
.then((parsedData)=>{ 

    let sql = parsedData.map(item=>{

        let label = `INSERT INTO bom_label (\`guid\`, \`type\`, \`label_id\`, \`label_text\`)
        VALUES
            ('${item.slice(0,4).join("','")}')
        ON DUPLICATE KEY UPDATE
         type = '${item[1]}', label_id = '${item[2]}', label_text = '${item[3]}';
        `;

        let translation = `DELETE FROM bom_translation WHERE guid='${item[0]}' AND lang = 'vn';
            INSERT INTO bom_translation 
            ( \`guid\`, \`lang\`, \`refkey\`, \`value\`, \`contributor\`) 
            VALUES ('${item[0]}','vn','label_text','${item[4]}','kcsql');
        `;
        return `${translation}`; 

    })
    fs.writeFile('./updateVN.sql', sql.join("\n"), err => {
        if (err) {
          console.error(err)
          return
        }
        //file written successfully
        console.log(sql.length+" queries written.")
      })
      
})