
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

module.exports = {
    connectToDB,
    queryDB
}