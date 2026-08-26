const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');

app.use(express.static(__dirname));

// Файл для хранения статистики, чтобы ничего не пропадало
const DB_FILE = './database.json';
let players = {};

// Загружаем базу данных при старте
if (fs.existsSync(DB_FILE)) {
    try {
        players = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        players = {};
    }
}

// Функция для сохранения статистики
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2), 'utf8');
}

// Функция определения ранга по очкам XP
function getRank(xp) {
    if (xp >= 100) return { name: '👑 GLOBAL ELITE', class: 'rank-global' };
    if (xp >= 60)  return { name: '🦅 ЛЕГЕНДАРНЫЙ БЕРКУТ', class: 'rank-lem' };
    if (xp >= 30)  return { name: '⭐ МАГИСТР ХРАНИТЕЛЬ', class: 'rank-mg' };
    if (xp >= 10)  return { name: '⭐ СИЛЬВЕР МАСТЕР', class: 'rank-sem' };
    return { name: '⚪ СИЛЬВЕР I', class: 'rank-silver' };
}

io.on('connection', (socket) => {
    socket.emit('update_all_players', players);

    // Добавление нового или вход существующего игрока
    socket.on('add_player', (data) => {
        const name = data.name ? data.name.trim() : '';
        if (name) {
            if (!players[name]) {
                // Если игрока нет, создаем ему нулевую статистику
                players[name] = {
                    status: 'survivors',
                    xp: 0,
                    survivedCount: 0,
                    caughtCount: 0
                };
            } else {
                // Если игрок уже был, просто возвращаем его в раунд как выжившего
                players[name].status = 'survivors';
            }
            saveDB();
            io.emit('update_all_players', players);
        }
    });

    socket.on('move_player', (data) => {
        if (players[data.name]) {
            players[data.name].status = data.status;
            
            // Начисляем статистику при изменении статуса
            if (data.status === 'caught') {
                players[data.name].caughtCount += 1;
                io.emit('play_network_sound', { message: `ВНИМАНИЕ! ${data.name.toUpperCase()} ПОЙМАН!` });
            }
            
            saveDB();
            io.emit('update_all_players', players);
        }
    });

    // Нажатие кнопки КРАСНОЙ кнопки в админке — завершение раунда
    socket.on('clear_all_players', () => {
        // Выжившим в этом раунде начисляем очки победы!
        for (let name in players) {
            if (players[name].status === 'survivors') {
                players[name].xp += 10; // +10 XP за победу
                players[name].survivedCount += 1; // +1 к выживаниям
            }
            // Сбрасываем позиции для следующей игры, но статистику НЕ СТИРАЕМ
            players[name].status = 'survivors';
        }
        saveDB();
        io.emit('update_all_players', players);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Сетевой сервер статистики запущен!');
});
