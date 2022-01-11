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
        var canBeStarted = false;
        if (games[c]) {
            players = games[c].players;
            hostId = games[c].hostId;
            canBeStarted = !games[c].started;
        }
        var participants = Object.values(clients).filter(cl => (cl.subscribed || '') == c);
        participants.forEach(par => par.send({
            type: 'participants',
            data: {
                participants: participants.map(p => { 
                    var role = 'observer';
                    var authority = '';
                    var connectionState = 'online';
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
                    if (!p.isConnected) {
                        connectionState = 'offline';
                    }
                    return {
                        name: p.name,
                        publicId: p.publicId,
                        role: role,
                        authority: authority,
                        canStart: authority == 'host' && canBeStarted,
                        status: connectionState
                    };
                }),
                channel: c
            }
        }));
    })
}

function joinChannel(client, channel, force) {
    var sendBoard = false;
    var sendJoinMessage = false;

    var oldChannel = client.subscribed;
    if (oldChannel != channel) {
        client.subscribed = channel;
        updateChannelParticipants([oldChannel, channel]);
        sendBoard = true;
        sendJoinMessage = true;
    } else {
        if (force) {
            client.subscribed = channel;
            updateChannelParticipants([channel]);
            sendBoard = true;
            sendJoinMessage = true;
        }
    }

    if (sendJoinMessage) {
        client.send({
            type: 'information',
            data: 'Joined: ' + channel
        });
    }

    if (sendBoard) {
        // default board
        var lastBroadcast = { 
            type: 'board', 
            data: { 
                board: [
                    {type: 'p',faction: 1,x: 3,y: 3,id:1},{type: 'b',faction: 0,x: 4,y: 3,id:2},
                    {type: 'n',faction: 0,x: 3,y: 4,id:3},{type: 'k',faction: 1,x: 4,y: 4,id:4}
                ],
                killed: [],
                status: 'pre',
                timers: [
                    { active: false, activeSince: 0, timeRemaining: 300000 },
                    { active: false, activeSince: 0, timeRemaining: 300000 }
                ]
            }
        };
        if (games[channel]) {
            lastBroadcast = games[channel].lastBroadcast || lastBroadcast;
        }
        client.send(lastBroadcast);
    }
}

var cookieToPublicIdMap = {};

var publicIdGen = 10000;

function cookieToPublicId(cookie) {
    if (!cookieToPublicIdMap[cookie]) {
        cookieToPublicIdMap[cookie] = publicIdGen;
        publicIdGen++;
    }
    return cookieToPublicIdMap[cookie];
}

function parseMessage(m, client) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'connection': // connection when the player opens the page - if they don't have an id we give them an id, also give them faction
            var cookie = message.data.cookie;
            var publicId = cookieToPublicId(messaga.data.cookie || '');
            var name = message.data.name;
            var channel = message.data.channel;
            if (cookie == null) {
                // generate an id
                cookie = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
                publicId = cookieToPublicId(cookie);
            }
            if (channel == null || !Object.keys(games).includes(channel)) {
                channel = 'default';
            }
            if (name == null) {
                name = 'Player ' + defaultClientNameId;
                defaultClientNameId++;
            }
            client.cookie = cookie;
            client.publicId = publicId;
            client.subscribed = channel;
            client.name = name;
            client.send = function(message) {
                if (client.ws.readyState === ws.OPEN && client.isConnected) {
                    client.ws.send(JSON.stringify(message));
                }
            }
            clients[cookie] = client;
            client.send({ type: 'cookie', data: { cookie: client.cookie, publicId: client.publicId, name: client.name, channel: client.subscribed }});
            broadcastChannels();
            joinChannel(client, client.subscribed, true);
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
            client.send({
                type: 'nameconfirmation',
                data: client.name
            });
            updateChannelParticipants([client.subscribed]);
            break;
        case 'create':
            var gameCode = message.data;
            if (gameCode == 'default') {
                break;
            }
            if (!/[A-Za-z]+/.test(gameCode)) {
                break;
            }
            if (Object.keys(games).includes(gameCode)) {
                break;
            }
            games[gameCode] = new game.Game(gameCode, client.cookie, broadcast, updateChannelParticipants);
            broadcastChannels();
            joinChannel(client, gameCode);
            break;
        case 'join':
            // join a game or channel
            var gameCode = message.data;
            if (games[gameCode] || gameCode == 'default') {
                joinChannel(client, gameCode);
            }
            break;
        case 'play':
            var gameCode = message.data;
            if (games[gameCode]) {
                joinChannel(client, gameCode);
                games[gameCode].addPlayer(client.cookie);
            }
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

var nextTrueId = Math.random()*1000000000;

wss.on('connection', function connection(ws) {
    var trueId = nextTrueId;
    nextTrueId++;
    ws.client = { ws: ws, isConnected: true, trueId: trueId };
    ws.on('message', function incoming(message) {
        parseMessage(message, ws.client);
    });
    ws.on('close', () => {
        ws.client.isConnected = false;
        ws.client.disconnected = Date.now();
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

    Object.values(clients).filter(c => !c.isConnected && c.disconnected < (Date.now() - 30000)).forEach(c => {
        var channel = c.subscribed;
        delete clients[c.cookie];
        updateChannelParticipants([channel]);
    })
}, 1000);