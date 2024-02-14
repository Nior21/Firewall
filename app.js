// app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

const db = new sqlite3.Database('addresses.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the addresses database.');
    }
});

app.post('/addresses', (req, res) => {
    const addresses = req.body.addresses;
    addresses.forEach(address => {
        const stmt = db.prepare('INSERT INTO addresses(address, status) VALUES(?, ?)');
        stmt.run(address, 'enabled');
        stmt.finalize();
    });
    res.json({
        message: 'Адреса успешно добавлены в базу данных'
    });
});

app.get('/addresses', (req, res) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='addresses'", (err, row) => {
        if (err) {
            throw err;
        }
        if (!row) {
            console.log('Таблица addresses не существует, создаем...');
            db.run("CREATE TABLE addresses (address TEXT, status TEXT)");
            res.json({
                addresses: []
            }); // Пустой массив, так как таблица только что создана
        } else {
            let sql = 'SELECT address, status FROM addresses';
            let addresses = [];
            db.all(sql, [], (err, rows) => {
                if (err) {
                    throw err;
                }
                rows.forEach(row => {
                    addresses.push({
                        address: row.address,
                        status: row.status
                    });
                });
                res.json({
                    addresses: addresses
                });
            });
        }
    });
});

app.listen(3000, () => {
    console.log('Сервер запущен на порте 3000');
});