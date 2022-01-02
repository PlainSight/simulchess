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
        if (gameId) {
            receivers = Object.values(clients).filter(c => (c.subscribed || '') == (gameId || ''));
        } else {
            receivers = Object.values(clients);
        }
    }

    receivers.forEach(r => {
        r.send(message); 
    });
}

function broadcastChannels() {
    var channels = Object.keys(games);
    channels.push('default');
    channels.sort((a, b) => b < a ? 1 : -1);
    broadcast({
        type: 'channels',
        data: {
            channels: channels
        }
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
        var participants = Object.values(clients).filter(cl => (cl.subscribed || '') == c);
        participants.forEach(par => par.send({
            type: 'participants',
            data: {
                participants: participants.map(p => { 
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
                }),
                channel: c
            }
        }));
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
                client.subscribed = 'default';
                client.name = 'Player ' + defaultClientNameId;
                defaultClientNameId++;
            }
            client.send = function(message) {
                if (client.ws.readyState === ws.OPEN && client.isConnected) {
                    client.ws.send(JSON.stringify(message));
                }
            }
            client.send({ type: 'cookie', data: { cookie: cookie }});
            broadcastChannels();
            updateChannelParticipants([client.subscribed]);
            break;
        case 'chat': // chat
            // chat to same subscription
            broadcast({ 
                type: 'text',
                data: client.name + ": " + message.data
            }, client.subscribed);
            break;
        case 'name':    // client sets their name
            client.name = message.data;
            updateChannelParticipants([client.subscribed]);
            break;
        case 'create':
            var gameCode = message.data;
            if (gameCode == 'default') {
                break;
            }
            games[gameCode] = new game.Game(gameCode, client.cookie, broadcast, updateChannelParticipants);
            client.subscribed = gameCode;
	        updateChannelParticipants([gameCode]);
            broadcastChannels();
            break;
        case 'join':
            // join a game or channel
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
        if (game.finished != 0 && game.finished < Date.now()) {
            Object.values(clients).filter(c => (c.subscribed || '') == g).forEach(c => {
                c.subscribed = 'default';
            });
            delete games[g];
            updateChannelParticipants(['default']);
            broadcastChannels();
        }
    });
}, 1000);