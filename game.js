const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function Game(name, hostId, broadcast, updateChannelParticipants) {
	this.name = name;
	this.players = [hostId];
	this.hostId = hostId;
	this.started = false;
	this.finished = 0;

	this.currentMoves = [null, null];
	this.board = null;
	this.turn = 0;

	this.history = [];

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

	this.broadcastState = function() {
		broadcast({
			type: 'board',
			data: {
				board: this.board,
				status: 'active',
				timers: [300, 300]
			}
		}, this.name);
	}

	this.start = function(playerId) {
		if (this.hostId != playerId) {
			return;
		}

		this.setupBoard();
		this.broadcastState();
		// TODO: broadcast start message
		


	}

	this.move = function(data, playerId) {

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

	return this;
}

module.exports = {
    Game
}