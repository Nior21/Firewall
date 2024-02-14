const express = require('express');
const bodyParser = require('body-parser');
const {
    exec
} = require('child_process');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

const blockedAddresses = new Set();

app.post('/addresses', (req, res) => {
    const addresses = req.body.addresses;
    addresses.forEach(address => {
        if (blockedAddresses.has(address)) {
            // Удаление правила, если уже заблокирован
            blockedAddresses.delete(address);
            exec(`netsh advfirewall firewall delete rule name="Block: ${address}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Ошибка выполнения команды: ${error}`);
                    res.status(500).json({
                        error: `Ошибка выполнения команды: ${stderr}`
                    });
                } else {
                    console.log(`Команда выполнена успешно: ${stdout}`);
                    res.json({
                        message: 'Адрес успешно удален из списка заблокированных'
                    });
                }
            });
        } else {
            // Добавление нового правила
            blockedAddresses.add(address);
            exec(`netsh advfirewall firewall add rule name="Block: ${address}" dir=out interface=any action=block remoteip=${address}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Ошибка выполнения команды: ${error}`);
                    res.status(500).json({
                        error: `Ошибка выполнения команды: ${stderr}`
                    });
                } else {
                    console.log(`Команда выполнена успешно: ${stdout}`);
                    res.json({
                        message: 'Адрес успешно добавлен в список заблокированных'
                    });
                }
            });
        }
    });
});

app.listen(3000, () => {
    console.log('Сервер запущен на порте 3000');
});