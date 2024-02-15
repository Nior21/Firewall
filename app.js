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

app.post('/addresses', async (req, res) => {
    const addresses = req.body.addresses;
    for (const address of addresses) {
        try {
            const row = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM addresses WHERE address = ?', address, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            if (row) {
                return res.status(409).json({ message: 'Адрес уже существует в базе данных' });
            } else {
                await new Promise((resolve, reject) => {
                    db.run('INSERT INTO addresses (address, status) VALUES (?, ?)', [address, false], (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        } catch (err) {
            return res.status(500).json({ message: 'Произошла ошибка при обработке запроса' });
        }
    }
    res.json({ message: 'Адреса успешно добавлены в базу данных' });
});


app.post('/updateStatus', (req, res) => {
    const address = req.body.address;
    const status = req.body.status; // Получаем статус напрямую
    const stmt = db.prepare('UPDATE addresses SET status = ? WHERE address = ?');
    stmt.run(status, address, (err) => {
        if (err) {
            res.status(500).json({
                message: 'Произошла ошибка при обновлении статуса'
            });
        } else {
            res.json({
                message: 'Статус успешно обновлен'
            });
        }
    });
    stmt.finalize();
});


app.post('/deleteAddress', (req, res) => {
    const address = req.body.address;
    // выполнить SQL-запрос для удаления указанного адреса
    db.run('DELETE FROM addresses WHERE address = ?', address, function(err) {
        if (err) {
            res.status(500).json({ message: 'Произошла ошибка при удалении адреса' });
        } else {
            res.json({ message: 'Адрес успешно удален' });
        }
    });
});

app.listen(3000, () => {
    console.log('Сервер запущен на порте 3000');
});