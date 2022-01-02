var webaddress = 'ws://localhost:7666';
//var webaddress = 'wss://plainsightindustries.com/simulchesssocket';
var resourceaddress = 'http://localhost:8080/';
//var resourceaddress = 'https://plainsightindustries.com/simulchess/';
let socket = new WebSocket(webaddress);

socket.onopen = function() {
    sendMessage({
        type: 'connection',
        data: localStorage.getItem('azoline0.1')
    });
};

socket.onmessage = function(event) {
    processMessage(event.data);
};

var chatlog = [];
var lobbyName = '';

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died');
    }
    chatlog.push({ message: 'Connection died. Please refresh the page to reconnect.', age: Date.now() });
};

socket.onerror = function(error) {
    console.log(`[error] ${error.message}`);
};

function sendMessage(message) {
    socket.send(JSON.stringify(message));
}

function processMessage(m) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'text':
            chatlog.push({ message: message.data, age: Date.now() });
            break;
        case 'cookie':
            localStorage.setItem('azoline0.1', message.data.cookie);
            break;
        case 'nameplease':
            showNamebox = true;
            break;
        case 'codeplease':
            joinCode = '';
            showJoinUI = true;
            break;
        case 'lobby':
            lobbyName = message.data;
            break;
        case 'host':
            showHostUI = true;
            break;
        case 'turn':
            this.boards.forEach(b => {
                b.turn = (b.id == message.data);
            });
            break;
        case 'playerlist':
            boards = message.data.players.map(p => NewBoard(p.id, p.name, p.score));
            break;
        case 'playerid':
            playerId = message.data;
            break;
    }
}

var canvas = document.getElementById('canvas');
var gl = canvas.getContext('webgl');
var canvasDimensions = canvas.getBoundingClientRect();


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

    gl.clearColor(0.36, 0.64, 1.0, 1.0);
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

var lastTimestamp = 0;
var playerId = '';
var turn = false;

function NewBoard(id, name, score) {
    return {
        id: id,
        name: name,
        score: score || 0,
        pattern: [
            [{}],
            [{},{}],
            [{},{},{}],
            [{},{},{},{}],
            [{},{},{},{},{}]
        ],
        grid: [
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}]
        ],
        floor: [{},{},{},{},{},{},{}]
    }
}

var factories = [];
var boards = [];
var tiles = [];
var middle = {};
var lid = {};
var bag = {};

function render(timestamp) {
    var now = Date.now();
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var fractionOfSecond = (timestamp % 1000) / 1000;

    var calls = {};

    function draw(sheet, sx, sy, sw, sh, dx, dy, dw, dh, angle, z, color) {
        calls[sheet] = calls[sheet] || [];
        calls[sheet].push([sx, sy, sw, sh, dx, dy, dw, dh, z, angle, color]);
    }

    function drawSprite(sheet, fx, fy, dx, dy, w, h, angle, z, color) {
        var dim = graphics[sheet].dim
        var sx = fx*dim;
        var sy = fy*dim;
        draw(sheet, sx, sy, dim, dim, dx, dy, w, h, angle, z, color);
    }

    function computeTilePositions(tiles) {
        function extractDisplayValue(position) {
            if (position.display.tiles) {
                return position.display.tiles.shift();
            } else {
                return position.display;
            }
        }

        tiles.forEach(t => {
            if (t.position.display != null) {
                if (t.oldposition && t.oldposition.display && t.startTime && t.r1 && t.r2) {
                    // lerp between origin and destination
                    var lerp = Math.max(Math.min(1, (now - t.startTime) / 1000), 0);
    
                    var from = extractDisplayValue(t.oldposition);
                    var to = extractDisplayValue(t.position);

                    if (lerp == 1 || (from.x == to.x && from.y == to.y)) {
                        t.oldposition = null;
                        t.startTime = null;
                        t.r1 = null;
                        t.r2 = null;
    
                        t.display = to;
                    } else {
                        var xy = bezier({ from: from, to: to, r1: t.r1, r2: t.r2 }, lerp);
        
                        var size = (from.w * (1-lerp)) + (to.w * (lerp));
        
                        t.display = { x: xy.x, y: xy.y, a: lerp*Math.PI*Math.floor(t.r1*6), w: size }
                    }
                } else {
                    if (t.position) {
                        t.display = extractDisplayValue(t.position);
                    }
                }
            }
        });
    }

    function computeBoardPositions(left, top, width, height, board) {
        var widthDiff = 0;
        if (height*1.6 < width) {
            widthDiff = width - 1.6*height;
            width = 1.6*height;
        }
        left += (widthDiff/1.6); // if we need to shrink the width we must shuffle in

        // calculate pattern positions
        var unit = width/10;
        top += (unit/2);
        left += (unit/2);

        for (var y = 0; y < 5; y++) {
            for (var x = 0; x < y+1; x++) {
                board.pattern[y][x].display = { x: left + (4-x)*unit, y: top + y*unit, w: unit*0.8 };
            }
        }

        // calculate grid positions
        for (var y = 0; y < 5; y++) {
            for (var x = 0; x < 5; x++) {
                board.grid[y][x].display = { x: left + ((5+x)*unit), y: top + y*unit, w: unit*0.8 };
            }
        }

        // calculate floor positions
        for (var x = 0; x < 7; x++) {
            board.floor[x].display = { x: left + (x*unit), y: top + 5*unit, w: unit*0.8 };
        }

        // calculate text positions
        // score
        // name
        board.display = {
            name: {
                x: left,
                y: top,
                w: unit*0.5
            },
            score: {
                x: left + width - 3*unit,
                y: top + unit*5,
                w: unit*0.8
            }
        }

    }

    function computeFactoryPositions(left, top, width, height, factories) {
        var widthDiff = 0;
        if (height < width) {
            widthDiff = width - height;
            width = height;
        }
        left += (widthDiff/2);
        // determine factory size
        var numberOfFactories = factories.length;
        var angleBetween = Math.PI*2/numberOfFactories;

        var maxRadiusOfFactory = 0.7*(width*Math.PI) / (Math.pow(2*numberOfFactories, 0.9) + (2*Math.PI));
        var distanceFromCenter = (width/2) - maxRadiusOfFactory;
        var center = { x: left+(width/2), y: top+(width/2), w: Math.max(distanceFromCenter-maxRadiusOfFactory, 1) };

        // generate mid tiles display

        middle.display = { x: center.x, y: center.y, w: center.w, tiles: [] };

        var unit = maxRadiusOfFactory/2;

        for(var i = 0; i < 34; i++) {
            if (i < 3) {
                var angle = (2 * Math.PI * i) / 3 ;
                var distance = unit/1.4;

                middle.display.tiles.push({
                    x: center.x+(Math.sin(angle)*distance),
                    y: center.y+(Math.cos(angle)*distance),
                    w: unit
                });
            } else {
                if (i < 9) {
                    var angle = (2 * Math.PI * (i-3)) / 6;
                    var distance = 2*unit;
    
                    middle.display.tiles.push({
                        x: center.x+(Math.sin(angle)*distance),
                        y: center.y+(Math.cos(angle)*distance),
                        w: unit
                    });
                } else {
                    var angle = (2 * Math.PI * (i-9)) / 12;
                    var distance = 3*unit;
    
                    middle.display.tiles.push({
                        x: center.x+(Math.sin(angle)*distance),
                        y: center.y+(Math.cos(angle)*distance),
                        w: unit
                    });
                }
            }
        }

        var factoryAngle = 0;
        for(var f = 0; f < numberOfFactories; f++) {
            var fx = center.x + (Math.sin(factoryAngle) * distanceFromCenter);
            var fy = center.y + (Math.cos(factoryAngle) * distanceFromCenter);

            factories[f].display = { x: fx, y: fy, w: 1.8*maxRadiusOfFactory, tiles: [] };

            var tileAngle = 0;
            for (var t = 0; t < 4; t++) {
                var tx = fx + (Math.sin(tileAngle) * maxRadiusOfFactory * 0.5);
                var ty = fy + (Math.cos(tileAngle) * maxRadiusOfFactory * 0.5);
                var sizeOfTile = maxRadiusOfFactory / 2;

                factories[f].display.tiles.push({
                    x: tx,
                    y: ty,
                    w: sizeOfTile
                });

                tileAngle += Math.PI*0.5;
            }

            factoryAngle += angleBetween;
        }

    }

    // calculate display based on canvas resolution;

    var playerCount = boards.length;
    var playerTileSize = canvas.width * 0.08;

    if (canvas.width < canvas.height) {
        // vert layout
        // X X
        // X X (optional)
        //  F
        //  B
        var oppositionBoardWidth = canvas.width/2;
        var oppositionBoardHeight = playerCount > 3 ? canvas.height / 6 : canvas.height / 4;
        var remainingHeight = canvas.height - (oppositionBoardHeight * (playerCount > 3 ? 2 : 1));
        var factoryHeight = remainingHeight * 0.6;
        var factoryWidth = canvas.width;
        var playerBoardHeight = remainingHeight * 0.4;
        var playerBoardWidth = canvas.width;

        computeFactoryPositions(0, canvas.height - remainingHeight, factoryWidth, factoryHeight, factories);

        if (boards.length && playerId != '') {
            var playerPosition = boards.findIndex(b => b.id == playerId);
            var numberOfOpponents = boards.length - 1;
            var leftSideCount = Math.ceil(numberOfOpponents/2);
            computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, boards[playerPosition]);
            playerTileSize = boards[playerPosition].display.score.w;

            var iter = 0;
            for(var bi = (playerPosition+1) % boards.length; bi != playerPosition; bi = ((bi+1) % boards.length)) {
                var xpos = 0;
                var ypos = 0;
                if (iter >= leftSideCount) {
                    // right
                    xpos = 1;
                    ypos = iter - leftSideCount;
                } else {
                    // left
                    ypos = leftSideCount - (1+iter);
                }
                computeBoardPositions(xpos*oppositionBoardWidth, ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, boards[bi]);
                iter++;
            }
        }
        
    } else {
        // hori layout
        // X F X
        // X F X
        //   B
        var oppositionBoardWidth = canvas.width / 4;
        var oppositionBoardHeight = playerCount > 3 ? canvas.height / 4 : canvas.height / 2;
        var factoryHeight = canvas.height * 0.6;
        var factoryWidth = canvas.width / 2;
        var playerBoardHeight = canvas.height*0.4;
        var playerBoardWidth = canvas.width;

        computeFactoryPositions(oppositionBoardWidth, 0, factoryWidth, factoryHeight, factories);

        if (boards.length && playerId != '') {
            var playerPosition = boards.findIndex(b => b.id == playerId);
            var numberOfOpponents = boards.length - 1;
            var leftSideCount = Math.ceil(numberOfOpponents/2);
            computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, boards[playerPosition]);
            playerTileSize = boards[playerPosition].display.score.w;

            var iter = 0;
            for(var bi = (playerPosition+1) % boards.length; bi != playerPosition; bi = ((bi+1) % boards.length)) {
                var xpos = 0;
                var ypos = 0;
                if (iter >= leftSideCount) {
                    // right
                    xpos = 1;
                    ypos = iter - leftSideCount;
                } else {
                    // left
                    ypos = leftSideCount - (1+iter);
                }
                computeBoardPositions(xpos*(oppositionBoardWidth+factoryWidth), ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, boards[bi]);
                iter++;
            }
        }
    }

    computeLidAndBagPositions();

    computeTilePositions(tiles);

    factories.forEach(f => {
        drawSprite('factory', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.6);
    });

    boards.forEach(b => {
        b.pattern.forEach(pr => pr.forEach(pc => {
            drawSprite('highlight', 0, 0, pc.display.x, pc.display.y, pc.display.w, pc.display.w, 0, 0.5, 'grey');
        }));
        b.grid.forEach((gr, gri) => gr.forEach((gc, gci) => {
            drawSprite('places', COLOURS[gri][gci], 0, gc.display.x, gc.display.y, gc.display.w, gc.display.w, 0, 0.5);
        }));
        b.floor.forEach((f, fi) => {
            drawSprite('highlight', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.55, 'red');
        });
        // draw text
        drawText(b.display.name.x, b.display.name.y, b.display.name.w, b.display.name.w*8, b.turn ? ':' + b.name + ':' : b.name, 0.3, false);
        drawText(b.display.score.x, b.display.score.y, b.display.score.w, b.display.name.w*8, b.score < 0 ? 'n'+b.score: ''+b.score, 0.3, false);
    });


    // process cursorPosition
    var highlightedPosition = null;
    var highlightedColour = null;
    tiles.forEach(t => {
        if (t.display && (factories.includes(t.position) || t.position == middle) && t.colour != 5) {
            if (tileClicked) {
                highlightedPosition = tileClicked.position;
                highlightedColour = tileClicked.colour;
            } else {
                if (Math.hypot(t.display.x - cursorX, t.display.y - cursorY) < (t.display.w*0.7)) {
                    highlightedPosition = t.position;
                    highlightedColour = t.colour;
                }
            }
        }
    });

    var playerBoard = boards.filter(b => b.id == playerId)[0];
    if (tileClicked) {
        playerBoard.pattern.forEach(p => {
            if (p.filter(pt => {
                return Math.hypot(pt.display.x - cursorX, pt.display.y - cursorY) < (pt.display.w*0.7);
            }).length > 0) {
                p.forEach(pt => {
                    drawSprite('highlight', 0, 0, pt.display.x, pt.display.y, pt.display.w, pt.display.w, 0, 0.45, 'green');
                });
            }
        });

        if(playerBoard.floor.filter(f => {
            return Math.hypot(f.display.x - cursorX, f.display.y - cursorY) < (f.display.w*0.7);
            }).length > 0) 
            {
                playerBoard.floor.forEach(f => {
                    drawSprite('highlight', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.45, 'green');
                });
        }
    }


    // process most recent click
    var click = clicks.pop();
    clicks = [];
    if(click) {
        // check where click is

        var sentCommand = false;
        if (tileClicked) {
            // check for destination click, if so then send command otherwise
            var playerBoard = boards.filter(b => b.id == playerId)[0];
            playerBoard.pattern.forEach((p, pi) => {
                p.forEach(pt => {
                    if(Math.hypot(pt.display.x - click.x, pt.display.y - click.y) < (pt.display.w*0.7)) {
                        // send a command
                        // determine factory
                        var factory = -1;
                        for(var i = 0; i < factories.length; i++) {
                            if (factories[i] == tileClicked.position) {
                                factory = i;
                            }
                        }

                        sendMessage({
                            type: 'command',
                            data: {
                                colour: COLORMAP[tileClicked.colour],
                                zone: factory,
                                destination: pi
                            }
                        });
                        sentCommand = true;
                        tileClicked = false;
                    }
                })
            });

            if (!sentCommand) {
                // check if floor row
                if(playerBoard.floor.filter(f => {
                    return Math.hypot(f.display.x - click.x, f.display.y - click.y) < (f.display.w*0.7);
                    }).length > 0) {
                        // send a command
                        // determine factory
                        var factory = -1;
                        for(var i = 0; i < factories.length; i++) {
                            if (factories[i] == tileClicked.position) {
                                factory = i;
                            }
                        }

                        sendMessage({
                            type: 'command',
                            data: {
                                colour: COLORMAP[tileClicked.colour],
                                zone: factory,
                                destination: -1
                            }
                        });
                        sentCommand = true;
                        tileClicked = false;
                    }
            }
        }

        if (!sentCommand) {
            tileClicked = null;
            tiles.forEach(t => {
                if ((factories.includes(t.position) || t.position == middle) && t.colour != 5) {
                    if(Math.hypot(t.display.x - click.x, t.display.y - click.y) < (t.display.w*0.7)) {
                        tileClicked = t;
                    }
                }
            });
        }
    }

    tiles.forEach(t => {
        if (t.display) {
            drawSprite('tiles', t.colour, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, !!t.display.a ? 0.49 : 0.5);

            if (t.position == highlightedPosition && t.colour == highlightedColour) {
                drawSprite('highlight', 0, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, 0.45, 'green');
            }
        }
    });

    // draw chat
    chatlog = chatlog.filter(c => c.age > (Date.now() - 15000));

    var top = canvas.height/2;
    var unit = canvas.height/20;
    var j = 0;
    for (var i = Math.max(0, chatlog.length - 8); i < chatlog.length; i++) {
        drawText(unit, top + unit + (j*unit), unit*0.8, canvas.width/2, chatlog[i].message, 0.3);
        j++;
    }

    if (showChatbox) {
        drawText(unit, top + (9*unit), unit*0.8, canvas.width/2, ':' + chat, 0.3, fractionOfSecond < 0.5);
    }

    if (showNamebox) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Please enter your name',
            type: 'text',
            cb: () => {
                return playerName;
            }
        }]);
    }

    if (showJoinUI) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Please enter a game code',
            type: 'text',
            cb: () => {
                return joinCode;
            }
        }]);
    }

    if (showHostUI && !showMenuUI) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Click to start',
            type: 'button',
            buttonText: 'Start',
            cb: (x, y, w, h, u) => {
                x -= u/2;
                y -= u/2;
                if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                    sendMessage({
                        type: 'start'
                    });
                    showHostUI = false;
                }
            }
        }]);
    }

    if (showMenuUI) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [
            {
                text: 'Leave the game?',
                type: 'button',
                buttonText: 'Leave',
                cb: (x, y, w, h, u) => {
                    x -= u/2;
                    y -= u/2;
                    if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                        sendMessage({
                            type: 'leave'
                        });
                        showMenuUI = false;
                        showHostUI = false;
                    }
                }
            },
            {
                text: 'Close the menu button just for Dylan',
                type: 'button',
                buttonText: 'Close',
                cb: (x, y, w, h, u) => {
                    x -= u/2;
                    y -= u/2;
                    if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                        showMenuUI = false;
                    }
                }
            }
        ])
    }

    if (lobbyName) {
        // put in top right
        drawText(canvas.width - (lobbyName.length * 11), 11, 11, lobbyName.length*11, lobbyName, 0.2);

        // put menu somewhere
        var x = canvas.width - playerTileSize;
        var y = canvas.height - playerTileSize;
        drawSprite('ui', 0, 5, x, y, playerTileSize, playerTileSize, 0, 0.2);
        if(click && Math.hypot(x - click.x, y - click.y) < (playerTileSize*0.7)) {
            showMenuUI = !showMenuUI;
        }
    }

    drawScene(gl, programInfo, calls);
    window.requestAnimationFrame(render);
}

canvas.width = Math.floor(canvasDimensions.width);
canvas.height = Math.floor(canvasDimensions.height);

window.addEventListener('resize', (e) => {
    var canvasDimensions = canvas.getBoundingClientRect();
    canvas.width = Math.floor(canvasDimensions.width);
    canvas.height = Math.floor(canvasDimensions.height);
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

var showChatbox = false;
var showNamebox = false;
var showJoinUI = false;
var showHostUI = false;
var showMenuUI = false;
var chat = '';
var playerName = '';
var joinCode = '';

function updateCursorPosition(e) {
    cursorX = e.x;
    cursorY = e.y;
}

function mouseDown(e) {
    if (e.button == 0) {
        //select
        clicks.push({ x: cursorX, y: cursorY });
    }
}

function touchDown(e) {
    clicks.push({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    if (showNamebox) {
        playerName = prompt('Enter your name');
        sendMessage({
            type: 'name',
            data: playerName
        });
        showNamebox = false;
        showJoinUI = true;
    } else {
        if (showJoinUI) {
            joinCode = prompt('Enter game code');
            sendMessage({
                type: 'join',
                data: joinCode
            });
            tiles = [];
            boards = [];
            factories = [];
            joinCode = '';
            showJoinUI = false;
        }
    }
}

document.addEventListener('mousemove', updateCursorPosition, false);
document.addEventListener('mousedown', mouseDown, false);
document.addEventListener('touchstart', touchDown, false);
document.addEventListener('keydown', keyDown, false);

setInterval(() => {
    sendMessage({
        type: 'ping'
    });
}, 20000);