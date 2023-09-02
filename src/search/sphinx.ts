
import mysql from 'mysql';

const createConnection = () => {
    return mysql.createConnection({
        host: process.env.SPHINX_HOST,
        port: process.env.SPHINX_PORT,
        connectTimeout: 5000
    });
};


export const sphinxQuery = async (sql) => {
    const connection = createConnection();
    console.log(`Connecting to Sphinx on ${process.env.SPHINX_HOST}:${process.env.SPHINX_PORT}`);
    connection.connect();
    console.log(`Running Sphinx query: ${sql}`);
    return new Promise((resolve, reject) => {
        connection.query(sql, (error, results) => {
            if(error) reject(error);
            resolve(results);
        });
    });
}


const getResults = (connection, keyword, version, min, max) => {
    let sphinx_sql = `SELECT verse_id, version FROM sgindex 
                      WHERE MATCH('@(text) ${keyword}') AND version IN ('${version.join("','")}') 
                      ${min ? `AND verse_id >= ${min}` : ''} 
                      ${max ? `AND verse_id <= ${max}` : ''} LIMIT 0, 1000000 `;
    console.log(sphinx_sql);

    return new Promise((resolve, reject) => {
        connection.query(sphinx_sql, (error, results) => {
            if(error) reject(error);
            
            const matches = {};
            for(let item of results) {
                if(item && item.version){
                    matches[item.version] = matches[item.version] || [];
                    matches[item.version].push(item.verse_id);
                }
            }
            const count = results ? results.length : 0;
            resolve({ count, matches, keyword, version, min, max });
        });
    });
};

export const processSphinx = async(req: any, res: any) => {
    const parsed = req.body || {};
    const keyword = String(parsed.keyword || req.query.keyword || "garden");
    const versions = String(parsed.version || req.query.version || "KJV,LDS,NIV").split(',');
    let min = Number(parsed.min || req.query.min || null);
    let max = Number(parsed.max || req.query.max || null);

    try {
        const connection = createConnection();

        let results:any = await getResults(connection, keyword, versions, min, max);


        // handle if over 300 results
        if (results.count > 300) {
            console.log(`Too many results (${results.count}) for ${keyword} in ${versions.join(',')}. Splitting into 4 queries.`);
            const ranges = [
                [1,23145], //Old Testament
                [23146,31102], //New Testament
                [31103,37706], //Book of Mormon
                [37707,41995] //Doctrine and Covenants + Pearl of Great Price
            ];
            const allResults = {};
            for (let range of ranges) {
                results = await getResults(connection, keyword, ["KJV","LDS"], range[0], range[1]);
                let range_versions = Object.keys(results.matches);
                for (let version of range_versions) {
                    allResults[version] = allResults[version] || [];
                    allResults[version].push(...results.matches[version]);
                }
            }
            results.matches = allResults;
            delete results.min;
            delete results.max;
            delete results.count;
        } 
        
        connection.end();
        res.json(results.matches);
    } catch(error) {
        res.json(error);
    }
};