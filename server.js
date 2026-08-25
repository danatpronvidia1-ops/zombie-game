const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    socket.emit('update_all_players', players);

    socket.on('add_player', (data) => {
        if (data.name && !players[data.name]) {
            players[data.name] = 'survivors';
            io.emit('update_all_players', players);
        }
    });

    socket.on('move_player', (data) => {
        if (players[data.name]) {
            players[data.name] = data.status;
            io.emit('update_all_players', players);
            
            if(data.status === 'caught') {
                io.emit('play_network_sound', { message: `ВНИМАНИЕ! ${data.name.toUpperCase()} ПОЙМАН!` });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Сетевой интернет-сервер успешно запущен!');
});
