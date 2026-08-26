const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');

app.use(express.static(__dirname));

const DB_FILE = './database.json';
let players = {};
let dangerZoneText = "Зона сужается! Бегите к центру двора!";

if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { players = {}; }
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2), 'utf8'); }

io.on('connection', (socket) => {
    socket.emit('update_all_players', players);
    socket.emit('update_zone_text', dangerZoneText);

    socket.on('add_player', (data) => {
        const name = data.name ? data.name.trim() : '';
        if (name) {
            if (!players[name]) {
                players[name] = { status: 'survivors', xp: 0, survivedCount: 0, caughtCount: 0 };
            } else {
                players[name].status = 'survivors';
            }
            saveDB();
            io.emit('update_all_players', players);
        }
    });

    // ИСПРАВЛЕНО: МОМЕНТАЛЬНЫЙ ТРИГГЕР ДЛЯ ВСЕХ ПРИ НАЖАТИИ КНОПКИ
    socket.on('set_zone_text', (data) => {
        if(data.text) {
            dangerZoneText = data.text;
            io.emit('update_zone_text', dangerZoneText);
            // Сразу же шлем всем принудительное всплывающее окно со звуком!
            io.emit('zone_shrink_alert', { message: dangerZoneText });
        }
    });

    socket.on('trigger_zone_shrink', () => {
        io.emit('zone_shrink_alert', { message: dangerZoneText });
    });

    socket.on('move_player', (data) => {
        if (players[data.name]) {
            players[data.name].status = data.status;
            if (data.status === 'caught') {
                players[data.name].caughtCount += 1;
                players[data.name].xp = Math.max(0, (players[data.name].xp || 0) - 5);
                io.emit('play_network_sound', { message: `ВНИМАНИЕ! ${data.name.toUpperCase()} ПОЙМАН!` });
            }
            saveDB();
            io.emit('update_all_players', players);
        }
    });

    socket.on('change_player_xp', (data) => {
        if (players[data.name]) {
            players[data.name].xp = Math.max(0, (players[data.name].xp || 0) + data.amount);
            saveDB();
            io.emit('update_all_players', players);
        }
    });

    socket.on('reset_entire_database', () => {
        players = {};
        saveDB();
        io.emit('update_all_players', players);
    });

    socket.on('clear_all_players', () => {
        for (let name in players) {
            if (players[name].status === 'survivors') {
                players[name].xp += 2; 
                players[name].survivedCount += 1;
            }
            players[name].status = 'survivors';
        }
        saveDB();
        io.emit('update_all_players', players);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Сервер Danger Zone работает на максимальной скорости!'); });
