var webaddress = 'ws://localhost:7666';
//var webaddress = 'wss://plainsightindustries.com/simulchesssocket';
var resourceaddress = 'http://localhost:8080/';
//var resourceaddress = 'https://plainsightindustries.com/simulchess/';


var AnimationDuration = 300;
var COOKIEKEY = 'simulchess0.1cookie';
var NAMEKEY = 'simulchess0.1name';
var CHANNELKEY = 'simulchess0.1channel';
var chatTitle = document.getElementById('messages-title');
var chatlog = document.getElementById('messages');
var chatInput = document.getElementById('message-input');
var gameList = document.getElementById('games');
var playerList = document.getElementById('players');
var setPlayerNameSection = document.getElementById('change-name');
var setPlayerNameInput = document.getElementById('set-player-name');
var setPlayerNameButton = document.getElementById('set-player-name-button');
var createGameSection = document.getElementById('create-game');
var createGameNameInput = document.getElementById('create-game-name');
var createGameButton = document.getElementById('create-game-button');
var startGameSection = document.getElementById('start-game');
var startGameButton = document.getElementById('start-game-button');
var playGameSection = document.getElementById('play-game');
var playGameButton = document.getElementById('play-game-button');
var flipBoardButton = document.getElementById('flip-board-button');

var timer1 = document.getElementById('timer1');
var timer2 = document.getElementById('timer2');
var playerNameDisplay1 = document.getElementById('playername1');
var playerNameDisplay2 = document.getElementById('playername2');

function appendToChat(message, color) {
    var c = document.createElement('p');
    c.innerText = message;
    c.style.color = color;
    chatlog.appendChild(c);
    chatlog.scrollTop = chatlog.scrollHeight;
}

function removeChildren(node) {
    var last;
    while (last = node.lastChild) node.removeChild(last);
}

function updateControlArea(canStartGame, canPlay) {
    if (canStartGame) {
        startGameSection.style.display = 'block';
        createGameSection.style.display = 'none';
    } else {
        startGameSection.style.display = 'none';
        createGameSection.style.display = 'block';
    }
    if (canPlay) {
        playGameSection.style.display = 'block';
    } else {
        playGameSection.style.display = 'none';
    }
} 

function setGameList(games) {
    removeChildren(gameList);
    games.forEach(g => {
        var c = document.createElement('p');
        c.innerText = g;
        gameList.appendChild(c);
    });
}

function setCurrentChannel(channel) {
    localStorage.setItem(CHANNELKEY, channel);
    currentChannel = channel;
    chatTitle.innerText = channel;
}

function setPlayerList(players) {
    removeChildren(playerList);
    var canStart = false;
    activePlayers = [];
    players.forEach(p => {
        var c = document.createElement('p');
        c.innerText = p.name + (p.role != 'observer' ? ' (' + p.role + ')' : '') + (p.canStart ? ' (host)' : '');
        if (p.role != 'observer') {
            activePlayers.push(p);
        }
        if (p.publicId == playerPublicId) {
            if (p.canStart && boardStatus == 'pre') {
                canStart = true;
            }
            if (p.role != 'observer') {
                faction = (p.role == 'white' ? 0 : 1);
            } else {
                faction = -1;
            }
        }
        playerList.appendChild(c);
    });
    var canPlay = activePlayers.length < 2 && !activePlayers.map(p => p.publicId).includes(playerPublicId) && currentChannel != 'default';
    updateControlArea(canStart, canPlay);
    updatePlayerNameDisplays();
}

var socket = null;
var sendMessage = null;

function connect(connectionCount) {
    socket = new WebSocket(webaddress);

    socket.onopen = function() {
        sendMessage({
            type: 'connection',
            data: {
                cookie: localStorage.getItem(COOKIEKEY),
                name: localStorage.getItem(NAMEKEY),
                channel: localStorage.getItem(CHANNELKEY)
            }
        });

        if (connectionCount > 0) {
            appendToChat('Reconnected successfully', '#00ff00');
        }

        connectionCount = 0;
    };
    
    socket.onmessage = function(event) {
        processMessage(event.data);
    };
    
    socket.onclose = function(event) {
        if (event.wasClean) {
            console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
            console.log('[close] Connection died');
        }

        var reconnectionTime = Math.pow(2, connectionCount);

        if (reconnectionTime > 300) {
            appendToChat('Connection permanently died. Refresh the page to attempt reconnection.', '#ff0000');
        } else {
            appendToChat('Connection died. Connection will retry in ' + (reconnectionTime > 1 ? reconnectionTime + ' seconds.' : ' 1 second.'), '#ff0000')

            setTimeout(() => {
                connect(connectionCount+1);
            }, 1000 * reconnectionTime);
        }
    };
    
    socket.onerror = function(error) {
        console.log(`[error] ${error.message}`);
    };

    sendMessage = function(message) {
        socket.send(JSON.stringify(message));
    }
}

connect(0);

function processMessage(m) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'notification':
            appendToChat(message.data, '#ff0000');
            break;
        case 'information':
            appendToChat(message.data, '#0000ff');
            break;
        case 'text':
            appendToChat(message.data);
            break;
        case 'cookie':
            localStorage.setItem(COOKIEKEY, message.data.cookie);
            localStorage.setItem(NAMEKEY, message.data.name);
            localStorage.setItem(CHANNELKEY, message.data.channel);
            playerName = message.data.name;
            playerPublicId = message.data.publicId;
            break;
        case 'board':
            lastBoard = activeBoard;
            activeBoard = message.data.board;
            animationStartTime = Date.now();
            killed = message.data.killed;
            timers = message.data.timers;
            boardStatus = message.data.status;
            if (boardStatus == 'active') {
                updateControlArea(false, false);
            }
            moveConfirmedPiece = null;
            moveConfirmedPos = null;
            updateDisplay(1);
            break;
        case 'moveconfirmation':
            moveConfirmedPiece = message.data.id;
            moveConfirmedPos = { x: message.data.x, y: message.data.y };
            updateDisplay(1);
            break;
        case 'nameconfirmation':
            playerName = message.data;
            localStorage.setItem(NAMEKEY, playerName);
            break;
        case 'timers':
            timers = message.data.timers;
            break;
        case 'participants':
            setCurrentChannel(message.data.channel);
            setPlayerList(message.data.participants);
            break;
        case 'channels':
            setGameList(message.data.channels);
            break;
    }
}

var canvas = document.getElementById('canvas');
var gl = canvas.getContext('webgl');

var vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexcoord;
    attribute vec3 aRecolor;

    uniform vec3 uResolution;

    varying vec2 vTexcoord;
    varying vec3 vRecolor;
    
    void main() {
        vec3 zeroToOne = aVertexPosition / uResolution;
        vec3 zeroToTwo = zeroToOne * 2.0;
        vec3 clipSpace = zeroToTwo - 1.0;

        gl_Position = vec4(clipSpace, 1);

        vTexcoord = aTexcoord;
        vRecolor = aRecolor;
    }`;

var fsSource = `
    precision mediump float;

    varying vec2 vTexcoord;
    varying vec3 vRecolor;

    uniform sampler2D uTexture;

    void main() {
        vec4 color = texture2D(uTexture, vTexcoord);
        
        if (vRecolor.r != 0.0 && vRecolor.g != 0.0 && vRecolor.b != 0.0) {
            if (color.r < 0.01 && color.g > 0.99 && color.b > 0.99) {
                color.r = vRecolor.r;
                color.g = vRecolor.g;
                color.b = vRecolor.b;
            }
    
            if (color.r < 0.01 && color.g > 0.49 && color.g < 0.51 && color.b > 0.49 && color.b < 0.51) {
                color.r = mix(vec3(0, 0, 0), vRecolor, 0.5).r;
                color.g = mix(vec3(0, 0, 0), vRecolor, 0.5).g;
                color.b = mix(vec3(0, 0, 0), vRecolor, 0.5).b;
            }
        }

        if (color.a < 0.01) {
            discard;
        }

        gl_FragColor = color;
    }
`;

function initShaderProgram(gl, vs, fs) {
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vs);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(vertexShader));
    }
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fs);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(fragmentShader));
    }
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    }
    return shaderProgram;
}

var shaderProgram = initShaderProgram(gl, vsSource, fsSource);

var programInfo = {
    program: shaderProgram,
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        texturePosition: gl.getAttribLocation(shaderProgram, 'aTexcoord'),
        recolorData: gl.getAttribLocation(shaderProgram, 'aRecolor')
    },
    uniformLocations: {
        resolution: gl.getUniformLocation(shaderProgram, 'uResolution')
    }
};

function loadTexture(src, d, noblur)  {
    var texture = gl.createTexture();
     
    // Asynchronously load an image
    var image = new Image();
    image.src = resourceaddress+src;
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,  gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, noblur ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, noblur ? gl.NEAREST : gl.LINEAR);
    });

    return { 
        texture: texture,
        image: image,
        dim: d
    };
}

var positionBuffer = gl.createBuffer();
var texturePositionBuffer = gl.createBuffer();
var colourBuffer = gl.createBuffer();

function drawScene(gl, programInfo, calls) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    gl.uniform3f(programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height, 1);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (var k in calls) {
        var drawCalls = calls[k];

        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        var positions = [];
        function calculatePosition(x, y, w, h, z, angle) {
            y = canvas.height - y;
            z = z || 0.5;

            var sine = Math.sin(angle);
            var cosine = Math.cos(angle);
            // offset vectors
            var w2 = -w/2; var h2 = h/2;
            var v0 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            };
            w2 = w/2; h2 = h/2;
            var v1 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }
            w2 = w/2; h2 = -h/2;
            var v2 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }
            w2 = -w/2; h2 = -h/2;
            var v3 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }

            positions.push(
                x+v0.x, y+v0.y, z,
                x+v1.x, y+v1.y, z,
                x+v2.x, y+v2.y, z,

                x+v0.x, y+v0.y, z,
                x+v3.x, y+v3.y, z,
                x+v2.x, y+v2.y, z
            );
        }
        drawCalls.forEach(dc => {
            calculatePosition(dc[4], dc[5], dc[6], dc[7], dc[8], dc[9]);
        });
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    
        // bind the texture
        gl.bindTexture(gl.TEXTURE_2D, graphics[k].texture);
    
        gl.enableVertexAttribArray(programInfo.attribLocations.texturePosition);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, texturePositionBuffer);
        var textureData = new Array(drawCalls.length * 12);
        for(var index = 0; index < drawCalls.length; index++) {
            var dc = drawCalls[index];
            var x = dc[0];
            var y = dc[1];
            var w = dc[2];
            var h = dc[3];
            var image = graphics[k].image;
            var i = index * 12;
            var width = image.width;
            var height = image.height;
            var sx = x / width;
            var sy = y / height;
            var ex = (x+w) / width;
            var ey = (y+h) / height;
            textureData[i] = sx;
            textureData[i+1] = sy;

            textureData[i+2] = ex;
            textureData[i+3] = sy;

            textureData[i+4] = ex;
            textureData[i+5] = ey;

            textureData[i+6] = sx;
            textureData[i+7] = sy;

            textureData[i+8] = sx;
            textureData[i+9] = ey;

            textureData[i+10] = ex;
            textureData[i+11] = ey;
        }
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(textureData),
            gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.texturePosition, 2, gl.FLOAT, false, 0, 0);
    
        gl.enableVertexAttribArray(programInfo.attribLocations.recolorData);
        gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
        var colors = [];
        drawCalls.forEach(dc => {
            var r = dc[10].r || 0;
            var g = dc[10].g || 0;
            var b = dc[10].b || 0;
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
        });
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(colors),
            gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.recolorData, 3, gl.FLOAT, false, 0, 0);

        var count = textureData.length / 2;
        gl.drawArrays(gl.TRIANGLES, 0, count);
    }
}

var framesToAnimate = 1;
var lastTimestamp = 0;
var turn = false;

var playerName = '';
var playerPublicId = -1;
var currentChannel = 'default';
var faction = -1;
var hostOf = '';
var timers = [];
var activePlayers = [];
var activeBoard = [];
var animationStartTime = 0;
var killed = [];
var boardStatus = '';
var possibleMoves = [];
var lastBoard = [];
var boardDirection = 1;
var grabbedPiece = null;
var moveConfirmedPiece = null;
var moveConfirmedPos = null;

function updateDisplay(x) {
    framesToAnimate += x;
    possibleMoves = validMoves(-1, activeBoard);
    window.requestAnimationFrame(render);
}

function render(timestamp) {
    var now = Date.now();
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var fractionOfSecond = (timestamp % 1000) / 1000;

    var yOffset = Math.floor((canvas.height - 24*8) / 2);
    var xOffset = Math.floor((canvas.width - 24*8) / 2);

    var calls = {};

    function draw(sheet, sx, sy, sw, sh, dx, dy, dw, dh, z, angle, color) {
        calls[sheet] = calls[sheet] || [];
        color = color || { r: 0, g: 0, b: 0 };
        angle = angle || 0;
        calls[sheet].push([sx, sy, sw, sh, dx, dy, dw, dh, z, angle, color]);
    }

    function drawSprite(sheet, fx, fy, dx, dy, w, h, z, angle, color) {
        var dim = graphics[sheet].dim
        var sx = fx*dim;
        var sy = fy*dim;
        draw(sheet, sx, sy, dim, dim, xOffset + dx, yOffset + dy, w, h, z, angle, color);
    }

    // draw chess board

    for (var x = 0; x < 8; x++) {
        for (var y = 0; y < 8; y++) {
            var spriteFrame = (x+y+1) % 2;
            drawSprite('tiles', spriteFrame, 0, 12 + (x*24), 12+ (y*24), 24, 24, 0.8, 0);
        }
    }

    // process most recent click
    var click = clicks.pop();
    
    clicks = [];
    var executingCommand = false;

    if (click && grabbedPiece) {
        // try to do a command

        var xTile = Math.floor((click.x - xOffset) / 24);
        var yTile = Math.floor((click.y - yOffset) / 24);
        if (boardDirection < 0) {
            xTile = 7 - xTile;
            yTile = 7 - yTile;
        }

        var validMove = validMoves(faction, activeBoard).filter(m => m.id == grabbedPiece && m.x == xTile && m.y == yTile).length > 0;

        if (validMove) {
            executingCommand = true;

            sendMessage({
                type: 'move',
                data: {
                    id: grabbedPiece,
                    x: xTile,
                    y: yTile
                }
            });
        }

        grabbedPiece = 0;
    }

    function lerp(x1, x2, p) {
        return p*x2 + (1-p)*x1;
    }

    // draw chess pieces

    function drawPiece(piece) {
        var spriteFrame = 0;
        var black = {
            r: 0.2,
            g: 0.2,
            b: 0.2,
        };
        var white = {
            r: 1,
            g: 1,
            b: 1,
        };
        switch(piece.type) {
            case 'n':
                spriteFrame = 1;
                break;
            case 'b':
                spriteFrame = 2;
                break;
            case 'r':
                spriteFrame = 3;
                break;
            case 'q':
                spriteFrame = 4;
                break;
            case 'k':
                spriteFrame = 5;
                break;
        }

        var x = boardDirection > 0 ? piece.x : 7-piece.x;
        var y = boardDirection > 0 ? piece.y : 7-piece.y;

        var displayX = (x*24) + 12;
        var displayY = (y*24) + 12;

        var lerpX = displayX;
        var lerpY = displayY;

        var animating = (animationStartTime + AnimationDuration) > now;

        if (animating && typeof piece.oldx == 'number') {
            var p = (now - animationStartTime) / AnimationDuration;

            var oldx = boardDirection > 0 ? piece.oldx : 7-piece.oldx;
            var oldy = boardDirection > 0 ? piece.oldy : 7-piece.oldy;
    
            var displayOldX = (oldx*24) + 12;
            var displayOldY = (oldy*24) + 12;
    
            lerpX = lerp(displayOldX, displayX, p);
            lerpY = lerp(displayOldY, displayY, p);

            console.log(oldx, oldy, lerpX, lerpY);
        }

        if (animating || !piece.killed) {
            drawSprite('pieces', spriteFrame, 0, lerpX, lerpY, 16, 16, 0.7, 0, piece.faction == 0 ? white : black);
            if (grabbedPiece == piece.id) {
                drawSprite('piecehighlight', spriteFrame, 0, lerpX, lerpY, 18, 18, 0.7, 0);
            }
            lerpX += xOffset;
            lerpY += yOffset;
            if (click && !executingCommand && Math.hypot(lerpX - click.x, lerpY - click.y) < 10) {
                grabbedPiece = piece.id;
            }
        }
    }

    activeBoard.forEach(piece => {
        drawPiece(piece);
    });

    killed.forEach(piece => {
        drawPiece(piece);
    });

    // draw possible moves
    if (grabbedPiece && !moveConfirmedPos) {
        possibleMoves.filter(pm => pm.id == grabbedPiece).forEach( pm => {
            var x = boardDirection > 0 ? pm.x : 7-pm.x;
            var y = boardDirection > 0 ? pm.y : 7-pm.y;
            var displayX = (x*24) + 12.5;
            var displayY = (y*24) + 12.5;
            drawSprite('tilehighlight', 0, 0, displayX-1, displayY-1, 25, 25, 0.6, 0);
        })
    }

    if (moveConfirmedPos) {
        console.log(moveConfirmedPiece, moveConfirmedPos);

        var x = boardDirection > 0 ? moveConfirmedPos.x : 7-moveConfirmedPos.x;
        var y = boardDirection > 0 ? moveConfirmedPos.y : 7-moveConfirmedPos.y;
        var displayX = (x*24) + 12.5;
        var displayY = (y*24) + 12.5;
        drawSprite('tilehighlight', 0, 0, displayX-1, displayY-1, 25, 25, 0.6, 0);

        var piece = activeBoard.filter(p => p.id == moveConfirmedPiece)[0];
        if (piece) {
            var x = boardDirection > 0 ? piece.x : 7-piece.x;
            var y = boardDirection > 0 ? piece.y : 7-piece.y;
            var displayX = (x*24) + 12.5;
            var displayY = (y*24) + 12.5;
            drawSprite('tilehighlight', 0, 0, displayX-1, displayY-1, 25, 25, 0.6, 0);
        }
    }

    drawScene(gl, programInfo, calls);
    framesToAnimate--;
    if (framesToAnimate > 0 || (animationStartTime + AnimationDuration) > now) {
        window.requestAnimationFrame(render);
    }
}

function calculateCanvasSize() {
    var canvasMinWidth = 192;
    var canvasMinHeight = 192;
    var canvasDimensions = canvas.getBoundingClientRect();

    var dimX = Math.floor(canvasDimensions.width);
    var dimY = Math.floor(canvasDimensions.height);

    if (dimX < dimY) {
        // taller than wide
        canvas.width = canvasMinWidth;
        canvas.height = (dimY / dimX) * canvasMinHeight;
    } else {
        // wider than tall
        canvas.width = (dimX / dimY) * canvasMinWidth;
        canvas.height = canvasMinHeight;
    }
    updateDisplay(1);
}

calculateCanvasSize();

window.addEventListener('resize', () => {
    calculateCanvasSize();
});

var cursorX = 256;
var cursorY = 256;
var clicks = [];

var tileClicked = null;

var graphics = [
    { n : 'pieces.png', d: 16, noblur: true },
    { n: 'piecehighlight.png', d: 18, noblur: true },
    { n: 'tiles.png', d: 24, noblur: true },
    { n: 'tilehighlight.png', d: 25, noblur: true }
].reduce((a, c) => {
    var name = c.n.split('.')[0];
    a[name] = loadTexture(c.n, c.d, c.noblur);
    return a;
}, {});

function updateCursorPosition(e) {
    var pos = translateFromDomToRenderSpace(e.offsetX, e.offsetY);
    cursorX = pos.x;
    cursorY = pos.y;
    if (grabbedPiece) {
        updateDisplay(2);
    }
}

function mouseDown(e) {
    if (e.button == 0) {
        //select
        clicks.push(translateFromDomToRenderSpace({ x: e.offsetX, y: e.offsetY }));
    }
    updateDisplay(2);
}

function chat(e) {
    var message = e.target.value;
    e.target.value = '';
    
    sendMessage({
        type: 'chat',
        data: message
    });
}

function flipBoard() {
    boardDirection *= -1;
    updatePlayerNameDisplays();
    updateTimers();
    updateDisplay(1);
}

function createChannel() {
    sendMessage({
        type: 'create',
        data: createGameNameInput.value
    });
    createGameNameInput.value = '';
}

function changeName() {
    var name = setPlayerNameInput.value;
    sendMessage({
        type: 'name',
        data: name
    });
    setPlayerNameInput.value = '';
}

function joinChannel(e) {
    if (e.target.children.length == 0) {
        sendMessage({
            type: 'join',
            data: e.target.innerText
        });
    }
}

function startGame() {
    sendMessage({
        type: 'start',
        data: currentChannel
    });
}

function playGame() {
    sendMessage({
        type: 'play',
        data: currentChannel
    });
}

function touchDown(e) {
    var pos = getTouchPos(canvas, e);
    pos = translateFromDomToRenderSpace(pos);
    cursorX = pos.x;
    cursorY = pos.y;
    clicks.push({ x: cursorX, y: cursorY });
    updateDisplay(2);
}

canvas.addEventListener('mousemove', updateCursorPosition, false);
canvas.addEventListener('mousedown', mouseDown, false);
canvas.addEventListener('touchstart', touchDown, false);

chatInput.addEventListener('change', chat, false);
gameList.addEventListener('click', joinChannel, false);
createGameButton.addEventListener('click', createChannel, false);
setPlayerNameButton.addEventListener('click', changeName, false);
startGameButton.addEventListener('click', startGame, false);
playGameButton.addEventListener('click', playGame, false);
flipBoardButton.addEventListener('click', flipBoard, false);

function updateTimer(element, index) {
    function formatTime(x) {
        var seconds = Math.round(x / 1000);
        var minutes = Math.floor(seconds / 60);
        var secondsRemaining = seconds % 60;
        return minutes + ':' + (secondsRemaining < 10 ? '0'+secondsRemaining : secondsRemaining);
    }

    if (timers) {
        var timer = timers[index];

        if (timer) {
            if (!timer.active) {
                element.innerText = formatTime(timer.timeRemaining);
            } else {
                var remaining = timer.timeRemaining;
                var elapsed = Date.now() - timer.activeSince;
                remaining -= elapsed;
                element.innerText = formatTime(remaining);
            }
        }
    }
}

function updatePlayerNameDisplay(element, index) {
    var player = activePlayers[index];
    if (player) {
        element.innerText = player.name;
    }
}

function updatePlayerNameDisplays() {
    var white = activePlayers.findIndex(ap => ap.role == 'white');
    var black = activePlayers.findIndex(ap => ap.role == 'black');
    updatePlayerNameDisplay(playerNameDisplay1, boardDirection < 0 ? black : white);
    updatePlayerNameDisplay(playerNameDisplay2, boardDirection < 0 ? white : black);
}

function updateTimers() {
    updateTimer(timer1, boardDirection < 0 ? 1 : 0);
    updateTimer(timer2, boardDirection < 0 ? 0 : 1);
}

setInterval(() => {
    sendMessage({
        type: 'ping'
    });
}, 20000);

setInterval(() => {
    updateTimers();
}, 1000);

function getTouchPos(canvasDom, touchEvent) {
    var rect = canvasDom.getBoundingClientRect();
    var x = touchEvent.touches[0].clientX - rect.left;
    var y = touchEvent.touches[0].clientY - rect.top;
    return {
      x: Math.round(x),
      y: Math.round(y)
    };
}

function translateFromDomToRenderSpace(pos) {
    var rect = canvas.getBoundingClientRect();
    x = canvas.width * (pos.x / rect.width);
    y = canvas.height * (pos.y / rect.height);
    return {
        x: Math.round(x),
        y: Math.round(y)
    }
}