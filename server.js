var ws = require('ws');
var game = require('./game');

const wss = new ws.Server({ port: 7666 });

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

var defaultClientNameId = 5000;
var clients = {};
var games = {};

function broadcast(message, gameId, players) {
    var receivers = [];
    if (players) {
        players.forEach(p => {
            receivers.push(clients[p]);
        });
    } else {
        receivers = Object.values(clients).filter(c => (c.subscribed || '') == (gameId || ''));
    }

    receivers.forEach(r => {
        r.send(message); 
    });
}

function updateChannelParticipants(channels) {
    channels.forEach(c => {
        var players = [];
        var hostId = null;
        if (games[c]) {
            players = games[c].players;
            hostId = games[c].hostId;
        }
        var participants = Object.values(clients).filter(c => (c.subscribed || '') == c);
        broadcast({
            type: 'participants',
            data: participants.map(p => { 
                var role = 'observer';
                var authority = '';
                var index = players.indexOf(p.cookie);
                if (index == 0) {
                    role = 'white';
                } 
                if (index == 1) {
                    role = 'black';
                }
                if (hostId == p.cookie) {
                    authority = 'host';
                }
                return {
                    name: p.name,
                    role: role,
                    authority: authority
                };
            })
        })
    })
}

function parseMessage(m, client) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'connection': // connection when the player opens the page - if they don't have an id we give them an id, also give them faction
            var cookie = message.data;
            if (cookie == null) {
                // generate an id
                cookie = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
            }
            client.cookie = cookie;
            if (clients[cookie]) {
                clients[cookie].ws = client.ws;
                client = clients[cookie];
                client.isConnected = true;
                client.ws.client = client;
            } else {
                clients[cookie] = client;
                client.name = 'Player ' + defaultClientNameId;
                defaultClientNameId++;
            }
            client.send = function(message) {
                if (client.ws.readyState === ws.OPEN && client.isConnected) {
                    client.ws.send(JSON.stringify(message));
                }
            }
            client.send({ type: 'cookie', data: { cookie: cookie }});
            break;
        case 'chat': // chat
            // chat to same subscription
            broadcast({ 
                type: 'text',
                data: message.data
            }, client.subscribed);
            break;
        case 'name':    // client sets their name
            client.name = message.data;
            updateChannelParticipants(client.subscribed);
            break;
        case 'create':
            var gameCode = message.data;
            games[gameCode] = new game.Game(gameCode, client.cookie, broadcast, updateChannelParticipants);
            client.subscribed = gameCode;
            break;
        case 'join':
            // either enter them into a game or start a new game
            var gameCode = message.data;
            client.subscribed = gameCode;
            break;
        case 'start': 
            if (client.subscribed) {
                var subscribedGame = games[client.subscribed];
                if (subscribedGame) {
                    subscribedGame.start(client.cookie);
                }
            }
            break;
        case 'resign':
            if (client.subscribed) {
                var subscribedGame = games[client.subscribed];
                if (subscribedGame) {
                    subscribedGame.resign(client.cookie);
                }
            }
            break;
        case 'move':
            if (client.subscribed) {
                var subscribedGame = games[client.subscribed];
                if (subscribedGame) {
                    subscribedGame.move(message.data, client.cookie);
                }
            }
            break;
        case 'ping':
            client.send({
                type: 'pong'
            });
            break;
    }

}

wss.on('connection', function connection(ws) {
    ws.client = { ws: ws, isConnected: true };
    ws.on('message', function incoming(message) {
        parseMessage(message, ws.client);
    });
    ws.on('close', () => {
        if (ws.player) {
            ws.client.isConnected = false;
        }
    });
});

setInterval(() => {
    Object.keys(games).forEach(g => {
        var game = games[g];
        if (game.finished < Date.now()) {
            clients.filter(c => (c.subscribed || '') == g).forEach(c => {
                c.subscribed = '';
            })
            delete games[g];
        }
    });
}, 1000);