// app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const dns = require('dns');

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
            });
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

function isIP(address) {
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    return ipPattern.test(address);
}

app.post('/updateStatus', async (req, res) => {
    const address = req.body.address;
    const status = req.body.status;

    // Проверка входных данных
    if (!address || typeof status !== 'boolean' || !isIP(address)) {
        return res.status(400).json({ message: 'Переданы некорректные данные. Ожидается IP-адрес.' });
    }

    // Проверка существующих правил через PowerShell
    const checkExistingCommand = `powershell -command "& {(Get-NetFirewallRule -DisplayName 'Block: ${address}').Count}"`;

    exec(checkExistingCommand, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка при проверке существующих правил Firewall.' });
        }

        if (parseInt(stdout.trim()) > 0 && status) {
            return res.json({ message: 'Правило с таким именем уже существует в Firewall. Добавление не требуется.' });
        } else if (parseInt(stdout.trim()) === 0 && !status) {
            return res.json({ message: 'Правил с таким именем нет в Firewall. Удаление не требуется.' });
        } else {
            const command = status ?
                `netsh advfirewall firewall add rule name="Block: ${address}" dir=out interface=any action=block remoteip=${address}` :
                `netsh advfirewall firewall delete rule name="Block: ${address}"`;

            exec(command, (error) => {
                if (error) {
                    return res.status(500).json({ message: `Ошибка при ${status ? 'добавлении' : 'удалении'} правила Firewall.` });
                } else {
                    const stmt = db.prepare('UPDATE addresses SET status = ? WHERE address = ?');
                    stmt.run(status, address, (err) => {
                        if (err) {
                            res.status(500).json({ message: `Произошла ошибка при обновлении статуса в БД.` });
                        } else {
                            res.json({ message: `Операция ${status ? 'добавления' : 'удаления'} правила Firewall прошла успешно. Статус обновлен в БД.` });
                        }
                    });
                    stmt.finalize();
                }
            });
        }
    });
});


app.post('/deleteAddress', (req, res) => {
    const address = req.body.address;
    // выполнить SQL-запрос для удаления указанного адреса
    db.run('DELETE FROM addresses WHERE address = ?', address, function (err) {
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