function validMoves(faction, board) {
    function permute(dxs, dys) {
        var res = [];
        dxs.forEach(dx => {
            dys.forEach(dy => {
                res.push({ dx: dx, dy: dy });
            })
        })
        return res;
    }

    var pawnMove = { iters: 1, dirs: [{ dx: 0, dy: 1 }] };
    var pawnAttack = { iters: 1, dirs: permute([-1, 1], [ 1 ]) };
    var pawnStartMove = { iters: 1, dirs: [{ dx: 0, dy: 2 }] };
    var knightMove = { iters: 1, dirs: [...permute([2, -2], [-1, 1]), ...permute([-1, 1], [2, -2])] };
    var bishopMove = { iters: 7, dirs: permute([-1, 1], [-1, 1]) };
    var rookMove = { iters: 7, dirs: [ { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 } ] };
    var queenMove = { iters: 7, dirs: permute([-1, 0, 1], [-1, 0, 1]).filter(d => !(d.dx == 0 && d.dy == 0)) };
    var kingMove = { iters: 1, dirs: permute([-1, 0, 1], [-1, 0, 1]).filter(d => !(d.dx == 0 && d.dy == 0)) };

    function unoccupied(v) {
        return board.filter(p => p.x == v.x && p.y == v.y).length == 0;
    }

    function at(v) {
        var r = board.filter(p => p.x == v.x && p.y == v.y)[0];
        return r || null;
    }

    function boundsCheck(v) {
        return !(v.x < 0 || v.x > 7 || v.y < 0 || v.y > 7);
    }

    function add(v1, v2) {
        return {
            x: v1.x + v2.dx,
            y: v1.y + v2.dy
        };
    }

    function enumerate(dir, piece, num) {
        var pos = add(piece, dir);
        var validPositions = [];
        var i = 0;
c:      while(boundsCheck(pos) && i < num) {
            if (unoccupied(pos)) {
                validPositions.push({ id: piece.id, x: pos.x, y: pos.y });
                pos = add(pos, dir);
            } else {
                if (at(pos).faction != piece.faction) {
                    validPositions.push({ id: piece.id, x: pos.x, y: pos.y });
                }
                break c;
            }
            i++;
        }
        return validPositions;
    }

    var moves = [];

    board.filter(p => !faction || p.faction == faction).forEach(p => {
        switch(p.type) {
            case 'p':
                // normal movement
                pawnMove.dirs.forEach(m => {
                    var move = m;
                    if (p.faction == 1) {
                        move = { dx: m.dx, dy: -m.dy };
                    }
                    moves.push(...enumerate(move, p, pawnMove.iters));
                });
                // start movement

                // taking

                // en passant 
                break;
            case 'n':
                knightMove.dirs.forEach(m => {
                    moves.push(...enumerate(m, p, knightMove.iters));
                });
                break;
            case 'b':
                bishopMove.dirs.forEach(m => {
                    moves.push(...enumerate(m, p, bishopMove.iters));
                });
                break;
            case 'r':
                rookMove.dirs.forEach(m => {
                    moves.push(...enumerate(m, p, rookMove.iters));
                });
                break;
            case 'q':
                queenMove.dirs.forEach(m => {
                    moves.push(...enumerate(m, p, queenMove.iters));
                });
                break;
            case 'k':
                kingMove.dirs.forEach(m => {
                    moves.push(...enumerate(m, p, kingMove.iters));
                });
                // check for castling possibilities
                break;
        }
    });

    return moves;
}