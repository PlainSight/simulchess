var moves = require('./moves');

function Game(name, hostId, broadcast, updateChannelParticipants) {
	this.name = name;
	this.players = [hostId];
	this.hostId = hostId;
	this.started = false;
	this.finished = 0;

	this.currentMoves = [null, null];
	this.board = null;
	this.killed = [];
	this.timers = [];
	this.turn = 0;

	this.history = [];

	this.lastBroadcast = null;
	this.lastTimerBroadcast = null;

	this.lastBoard = function() {
		return this.history[this.history.length-1] || null;
	}

	this.addPlayer = function(playerId) {
		if (!this.started && this.players.length < 2) {
			this.players.push(playerId);
			updateChannelParticipants([this.name]);
		} else {
			broadcast({
				type: 'notification',
				data: 'Game already has two players'
			}, null, [ playerId ]);
		}
	}

	this.resign = function(playerId) {
		if (!this.started || !this.players.includes(playerId)) {
			return;
		}
		this.finished = Date.now() + 30000;

		// TODO: broadcast winner message
	}

	this.broadcastTimers = function() {
		this.lastTimerBroadcast = {
			type: 'timers',
			data: {
				timers: this.timers
			}
		};
		this.lastBroadcast.data.timers = this.timers;
		broadcast(this.lastTimerBroadcast, this.name);
	}

	this.broadcastState = function() {
		this.lastBroadcast = {
			type: 'board',
			data: {
				board: this.board,
				killed: this.killed,
				status: 'active',
				timers: this.timers
			}
		};
		broadcast(this.lastBroadcast, this.name);
	}

	this.start = function(playerId) {
		if (this.hostId != playerId) {
			return;
		}
		if (this.players.length != 2) {
			return;
		}

		this.setupBoard();
		this.setupTimers(300000);
		this.broadcastState();
		this.broadcastTimers();

		// TODO: broadcast start message
	}

	this.resolveMoves = function() {
		// calculate attack paths
		var movePaths = this.currentMoves.map(m => {
			var piece = this.board.filter(p => p.id == m.id)[0];
			var dest = { x: m.x, y: m.y };
			var dx = m.x - piece.x;
			var dy = m.y - piece.y;
			var idx = 0;
			var idy = 0;
			if (dx != 0) {
				idx = dx / Math.abs(dx);
			}
			if (dy != 0) {
				idy = dy / Math.abs(dy);
			}
			if (piece.type == 'n') {
				return { piece: piece, path: [dest] };
			} else {
				var result = [];
				for(var i = 1; i <= Math.max(Math.abs(dx), Math.abs(dy)); i++) {
					var pos = { x: piece.x + (i*idx), y: piece.y + (i*idy) };
					result.push(pos);
				}
				return { piece: piece, path: result };
			}
		});

		// move pieces
		this.board.forEach(p => {
			var associatedMove = this.currentMoves.filter(cm => cm.id == p.id)[0];
			p.oldx = p.x;
			p.oldy = p.y;
			if (associatedMove) {
				p.x = associatedMove.x;
				p.y = associatedMove.y;
			}
		});

		

		// TODO: block pieces from moving through each other, resolve fairly ie. pieces move same distance before being blocked
		{
			function eq(v1, v2) {
				return v1.x == v2.x && v1.y == v2.y;
			}

			function intersection(a1, a2) {
				var u = [];
				a1.forEach(a1e => {
					a2.forEach(a2e => {
						if (eq(a1e, a2e)) {
							u.push(a1e);
						}
					});
				});
				return u;
			}

			function dist(v1, v2) {
				return Math.max(Math.abs(v1.x - v2.x), Math.abs(v1.y - v2.y));
			}

			var piece0 = movePaths[0].piece;
			var piece1 = movePaths[1].piece;

			var idx0 = piece0.x - piece0.oldx;
			idx0 = idx0 != 0 ? idx0 / Math.abs(idx0) : 0;
			var idy0 = piece0.y - piece0.oldy;
			idy0 = idy0 != 0 ? idy0 / Math.abs(idy0) : 0;

			var idx1 = piece1.x - piece1.oldx;
			idx1 = idx1 != 0 ? idx1 / Math.abs(idx1) : 0;
			var idy1 = piece1.y - piece1.oldy;
			idy1 = idy1 != 0 ? idy1 / Math.abs(idy1) : 0;

			if (idx0 == -1 * idx1 && idy0 == -1 * idy1 && intersection(movePaths[0].path, movePaths[1].path).length > 0) {
				// check for overlapping attack spaces
		tc:		while (i < movePaths[0].path.length && j < movePaths[1].path.length) {
					if (dist(movePaths[0][i], movePaths[1][j]) < 2) {
						break tc;
					} else {
						piece0.x = movePaths[0].path[i].x;
						piece0.y = movePaths[0].path[i].y;
						piece1.x = movePaths[1].path[j].x;
						piece1.y = movePaths[1].path[j].y;
					}
				}
			} else {
				// just see if one's destination lies within the attack path of the other
			}
		}

		var attackedSquares = moves.validMoves(-1, this.board, true);

		var attackedLocations = attackedSquares.reduce((a, c) => {
            a[c.x+','+c.y+','+c.faction] = (a[c.x+','+c.y+','+c.faction] || { faction: c.faction, count: 0, x: c.x, y: c.y }); 
            a[c.x+','+c.y+','+c.faction].count += 1;
            return a;
        }, {});
        Object.values(attackedLocations).forEach(al => {
			// TODO: kill units on squares attacked by 2 or more enemy units
			if (al.count > 1) {
				var pieceUnderAttack = this.board.filter(p => p.x == al.x && p.y == al.y && p.faction != al.faction)[0];
				if (pieceUnderAttack) {
					pieceUnderAttack.killed = true;
				}
			}
		});

		this.killed = this.board.filter(p => p.killed);
		this.board = this.board.filter(p => !p.killed);

		if (this.killed.filter(k => k.type == 'k').length > 0) {
			this.finished = Date.now() + 30000;
		}

		this.broadcastState();

		this.currentMoves = [null, null];
	}

	this.move = function(data, playerId) {
		var playerIndex = this.players.indexOf(playerId);
		if (playerIndex  == -1) {
			return;
		}
		if (this.currentMoves[playerIndex]) {
			return;
		}
		if (this.finished) {
			return;
		}
		// validate move
		if (!moves.validMoves(playerIndex, this.board, false).filter(m => m.id == data.id && m.x == data.x && m.y == data.y).length == 1) {
			return;
		}

		broadcast({
			type: 'moveconfirmation',
			data: data
		}, null, [playerId]);

		this.currentMoves[playerIndex] = data;

		if (this.currentMoves[(playerIndex+1)%2] == null) {
			this.activateTimer((playerIndex+1)%2);
			this.broadcastTimers();
		} else {
			this.pauseTimers();
			this.resolveMoves();
		}
	}

	var PAWN = 'p';
	var KNIGHT = 'n';
	var BISHOP = 'b';
	var ROOK = 'r';
	var QUEEN = 'q';
	var KING = 'k';

	var WHITE = 0;
	var BLACK = 1;

	var pieceId = 100;

	function mp(type, faction, x, y) {
		var id = pieceId;
		pieceId++;
		return {
			type: type,
			faction: faction,
			x: x,
			y: y,
			id: id
		}
	}

	this.setupBoard = function() {
		this.board = [
			// white
			mp(ROOK, WHITE, 0, 0), mp(KNIGHT, WHITE, 1, 0), mp(BISHOP, WHITE, 2, 0), mp(QUEEN, WHITE, 3, 0), 
			mp(KING, WHITE, 4, 0), mp(BISHOP, WHITE, 5, 0), mp(KNIGHT, WHITE, 6, 0), mp(ROOK, WHITE, 7, 0),
			mp(PAWN, WHITE, 0, 1), mp(PAWN, WHITE, 1, 1), mp(PAWN, WHITE, 2, 1), mp(PAWN, WHITE, 3, 1), 
			mp(PAWN, WHITE, 4, 1), mp(PAWN, WHITE, 5, 1), mp(PAWN, WHITE, 6, 1), mp(PAWN, WHITE, 7, 1),
			// black
			
			mp(PAWN, BLACK, 0, 6), mp(PAWN, BLACK, 1, 6), mp(PAWN, BLACK, 2, 6), mp(PAWN, BLACK, 3, 6), 
			mp(PAWN, BLACK, 4, 6), mp(PAWN, BLACK, 5, 6), mp(PAWN, BLACK, 6, 6), mp(PAWN, BLACK, 7, 6),
			mp(ROOK, BLACK, 0, 7), mp(KNIGHT, BLACK, 1, 7), mp(BISHOP, BLACK, 2, 7), mp(QUEEN, BLACK, 3, 7), 
			mp(KING, BLACK, 4, 7), mp(BISHOP, BLACK, 5, 7), mp(KNIGHT, BLACK, 6, 7), mp(ROOK, BLACK, 7, 7)
		];
	}

	this.pauseTimers = function() {
		this.timers.forEach(t => {
			if (t.active) {
				var elapsed = Date.now() - t.activeSince;
				t.timeRemaining -= elapsed;
			}
			t.active = false;
			t.activeSince = 0;
		})
	}

	this.activateTimer = function(n) {
		var t = this.timers[n];
		if (!t) {
			return;
		}
		t.active = true;
		t.activeSince = Date.now();
	}

	this.setupTimers = function(time) {
		function setupTimer(time) {
			return {
				active: false,
				activeSince: 0,
				timeRemaining: time
			}
		}
		this.timers = [setupTimer(time), setupTimer(time)];
	}

	return this;
}

module.exports = {
    Game
}