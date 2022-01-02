var webaddress = 'ws://localhost:7666';
//var webaddress = 'wss://plainsightindustries.com/simulchesssocket';
var resourceaddress = 'http://localhost:8080/';
//var resourceaddress = 'https://plainsightindustries.com/simulchess/';
let socket = new WebSocket(webaddress);

var COOKIEKEY = 'simulchess0.1';

socket.onopen = function() {
    sendMessage({
        type: 'connection',
        data: localStorage.getItem(COOKIEKEY)
    });
};

socket.onmessage = function(event) {
    processMessage(event.data);
};

var chatlog = document.getElementById('messages');
var chatInput = document.getElementById('message-input');

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died');
    }
    var c = document.createElement("p");
    c.innerText = 'Connection died. Please refresh the page to reconnect.';
    c.style.color = "#ff0000";
    chatlog.appendChild(c)
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
        case 'notification':
            var c = document.createElement("p");
            c.innerText = message.data;
            c.style.color = "#ff0000";
            chatlog.appendChild(c)
            break;
        case 'text':
            var c = document.createElement("p");
            c.innerText = message.data;
            chatlog.appendChild(c);
            chatlog.scrollTop = chatlog.scrollHeight;
            break;
        case 'cookie':
            localStorage.setItem(COOKIEKEY, message.data.cookie);
            break;
        case 'board':
            lastBoard = activeBoard;
            activeBoard = message.data.board;
            console.log(activeBoard);
            updateDisplay(1);
            break;
        case 'playerlist':

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
var playerId = '';
var turn = false;

var activeBoard = [{
    type: 'p',
    faction: 0,
    x: 0,
    y: 0
}];
var lastBoard = [];
var boardDirection = 1;
var grabbedPiece = null;

function ParseBoard(gameId, moveNumber) {
    return {
        id: gameId,
        move: moveNumber
    }
}

function updateDisplay(x) {
    framesToAnimate = x;
    window.requestAnimationFrame(render);
}

function render(timestamp) {
    var now = Date.now();
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var fractionOfSecond = (timestamp % 1000) / 1000;

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
        draw(sheet, sx, sy, dim, dim, dx, dy, w, h, z, angle, color);
    }

    // draw chess board

    for (var x = 0; x < 8; x++) {
        for (var y = 0; y < 8; y++) {
            var spriteFrame = (x+y+1) % 2;
            drawSprite('tiles', spriteFrame, 0, 12 + (x*24), 12+ (y*24), 24, 24, 0.8);
        }
    }

    // draw chess pieces

    activeBoard.forEach(piece => {
        var displayX = boardDirection > 0 ? piece.x : 7-piece.x;
        var displayY = boardDirection > 0 ? piece.y : 7-piece.y;
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

        console.log('pieces', spriteFrame, 0, (displayX*24) + 12, (displayY*24) + 12, 16, 16, 0.7, 0, piece.faction == 0 ? white : black);

        drawSprite('pieces', spriteFrame, 0, (displayX*24) + 12, (displayY*24) + 12, 16, 16, 0.7, 0, piece.faction == 0 ? white : black);
    })

    // process most recent click
    var click = clicks.pop();
    clicks = [];
    if(click) {
        // check where click is
        
    }

    // tiles.forEach(t => {
    //     if (t.display) {
    //         drawSprite('tiles', t.colour, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, !!t.display.a ? 0.49 : 0.5);

    //         if (t.position == highlightedPosition && t.colour == highlightedColour) {
    //             drawSprite('highlight', 0, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, 0.45, 'green');
    //         }
    //     }
    // });

    drawScene(gl, programInfo, calls);
    framesToAnimate--;
    if (framesToAnimate > 0) {
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
    { n: 'tilehighlight.png', d: 24, noblur: true }
].reduce((a, c) => {
    var name = c.n.split('.')[0];
    a[name] = loadTexture(c.n, c.d, c.noblur);
    return a;
}, {});

function updateCursorPosition(e) {
    cursorX = e.offsetX;
    cursorY = e.offsetY;
}

function mouseDown(e) {
    if (e.button == 0) {
        //select
        clicks.push({ x: e.offsetX, y: e.offsetY });
    }
}

function chat(e) {
    var message = e.target.value;
    e.target.value = '';
    
    sendMessage({
        type: 'chat',
        data: message
    });
}

function touchDown(e) {
    var pos = getTouchPos(canvas, e);
    cursorX = pos.x;
    cursorY = pos.y;
    //clicks.push({ x: e.touches[0].clientX, y: e.touches[0].clientY });
}


canvas.addEventListener('mousemove', updateCursorPosition, false);
canvas.addEventListener('mousedown', mouseDown, false);
canvas.addEventListener('touchstart', touchDown, false);

chatInput.addEventListener('change', chat, false);

setInterval(() => {
    sendMessage({
        type: 'ping'
    });
}, 20000);

function getTouchPos(canvasDom, touchEvent) {
    var rect = canvasDom.getBoundingClientRect();
    return {
      x: Math.round(touchEvent.touches[0].clientX - rect.left),
      y: Math.round(touchEvent.touches[0].clientY - rect.top)
    };
  }