const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '127.0.0.1',  
  user: 'root',
  password: 'admin',
  database: 'kala'
});

module.exports = connection;
