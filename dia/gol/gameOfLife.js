function gameOfLife() {
    
    GOL = {
    
        // Considered constant
        ROWS: 100,
        COLS: 100,
        TIMESTEP:100,
        CELLCOLOR: "#1B91E0",
        CELLWIDTH: null,
        
        // RGB values to fade dead cells to.
        FADE_R: 178,
        FADE_G: 255,
        FADE_B: 148,
        
    
        running: false,
        mousedown: false,
        lastrow: -1,
        lastcol: -1,
    
        // Boards of booleans.
        currentBoard: null,
        nextBoard: null,
        
        // Context reference for drawing.
        canvas: null,
        context: null,
        
        getLiveList: function() {
            var str = "[";
            for (var r = 0; r < GOL.ROWS; r++) {
                for (var c = 0; c < GOL.COLS; c++) {
                    if(GOL.currentBoard[r][c]) {
                        str += "["+r+","+c+"], ";
                    }
                }
            }
            str += "]";
            console.log(str);
        },
        
        seeds: {
            glider: [[7,0], [7,1], [7,2], [6,2], [5,1]],
            oneDot: [[7,0]],
            galaxy: [[30, 32], [30, 34], [30, 35], [ 30, 37], [ 30, 38], [ 31, 31], [ 31, 32], [ 31, 34], [ 31, 35], [ 31, 38], [ 31, 39], [ 32, 31], [ 33, 38], [ 33, 39], [ 34, 31], [ 34, 32], [ 34, 38], [ 34, 39], [ 35, 31], [ 35, 32], [ 36, 39], [ 37, 31], [ 37, 32], [ 37, 35], [ 37, 36], [ 37, 38], [ 37, 39], [ 38, 32], [ 38, 33], [ 38, 35], [ 38, 36], [ 38, 38]]
        },

        // Initializes a board as a 2D array of 0's in GOL.ROWS, GOL.COLS.
        create_board: function () {
            var board = [];
            for (var r = 0; r < GOL.ROWS; r++) {
                board[r] = [];
                for (var c = 0; c < GOL.COLS; c++) {
                    board[r][c] = false;
                }
            }
            return board;
        },
        
        // Coords is a X by two 2D array of coords to set alive.
        seed_board: function (coords) {
            if (!coords) return;
            GOL.currentBoard = GOL.create_board();
            var coord;
            for (var s = 0; s < coords.length; s++) {
                coord = coords[s];
                GOL.currentBoard[coord[0]][coord[1]] = true;
            }
        },
        
        // Handles click events on the board.
        onBoardInteraction: function (event) {
            var x;
            var y;
            if (event.pageX || event.pageY) { 
              x = event.pageX;
              y = event.pageY;
            }
            else { 
              x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; 
              y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop; 
            } 
            x -= GOL.canvas.offsetLeft;
            y -= GOL.canvas.offsetTop;
            
            var row = Math.floor(y / GOL.CELLWIDTH);
            var col = Math.floor(x / GOL.CELLWIDTH);
            
            if (GOL.lastrow === row && GOL.lastcol === col) return;
            GOL.lastrow = row;
            GOL.lastcol = col;
            
            // Update cell
            GOL.currentBoard[row][col] = !GOL.currentBoard[row][col];
            // Draw square
            if (GOL.currentBoard[row][col]) {
                GOL.context.fillRect(GOL.CELLWIDTH * col, GOL.CELLWIDTH * row,
                    GOL.CELLWIDTH, GOL.CELLWIDTH);
            } else {
                GOL.context.clearRect(GOL.CELLWIDTH * col, GOL.CELLWIDTH * row,
                    GOL.CELLWIDTH, GOL.CELLWIDTH);
            }
        },
        
        // Returns an array of tuples containing neighbor coords.
        // Considers the board a torus.
        get_neighbors: function (r, c) {            
            var coord;
            var neighbors =
                [[r-1, c-1], [r-1, c  ], [r-1, c+1],
                 [r  , c-1],             [r  , c+1],
                 [r+1, c-1], [r+1, c  ], [r+1, c+1]];

            for (var i = 0; i < neighbors.length; i++) {
                coord = neighbors[i];
            
                if (coord[0] < 0) {
                    coord[0] += GOL.ROWS;
                } else if (coord[0] >= GOL.ROWS) {
                    coord[0] -= GOL.ROWS;
                }
                
                if (coord[1] < 0) {
                    coord[1] += GOL.COLS;
                } else if (coord[1] >= GOL.COLS) {
                    coord[1] -= GOL.COLS;
                }
            }
            
            return neighbors;
            
        },
        
        // Steps the board forward one timestep.
        advanceBoard: function () {
            var neighbors;
            var num_live;
            var coord;
            
            // For each cell in the currentBoard...
            for (var r = 0; r < GOL.ROWS; r++) {
                for (var c = 0; c < GOL.COLS; c++) {
                    // Count the number of live neighbors.
                    neighbors = GOL.get_neighbors(r, c);
                    num_live = 0;
                    for (var i = 0; i < neighbors.length; i++) {
                        coord = neighbors[i];
                        if (GOL.currentBoard[coord[0]][coord[1]]) { 
                            num_live++;
                        }
                    }
                    
                    // Let there be life! And death!
                    if (GOL.currentBoard[r][c] && (num_live === 2 || num_live === 3)) {
                        // For already living cells...
                        GOL.nextBoard[r][c] = true;
                    } else if (!GOL.currentBoard[r][c] && num_live === 3) {
                        // For already dead cells...
                        GOL.nextBoard[r][c] = true;
                    } else {
                        GOL.nextBoard[r][c] = false;
                    }
                }
            }
            
            // Now swap nextBoard and currentBoard.
            var temp = GOL.currentBoard;
            GOL.currentBoard = GOL.nextBoard;
            GOL.nextBoard = temp;
        },
        
        // Draw the game board.
        draw: function() {
            // Clear the canvas.
            //GOL.context.clearRect(0, 0, GOL.canvas.width, GOL.canvas.height);
            
            // Fade out the last board by a bit
            var lastImage = GOL.context.getImageData( 0, 0, GOL.canvas.width, GOL.canvas.height);
            var pixelData = lastImage.data;

            for (var i = 3; i < pixelData.length; i += 4) {
                pixelData[i-3] = GOL.FADE_R;
                pixelData[i-2] = GOL.FADE_G;
                pixelData[i-1] = GOL.FADE_B;
                pixelData[i] -= 10;
            }
            GOL.context.putImageData(lastImage,0,0);
            
            // Draw live cells.
            for (var r = 0; r < GOL.ROWS; r++) {
                for (var c = 0; c < GOL.COLS; c++) {
                    if (GOL.currentBoard[r][c]) {
                        GOL.context.fillRect(GOL.CELLWIDTH * c, GOL.CELLWIDTH * r,
                            GOL.CELLWIDTH, GOL.CELLWIDTH);
                    }
                }
            }
        },
        
        // Set up the board and run!
        init: function(cvs) {
            GOL.canvas = cvs;
            GOL.context = GOL.canvas.getContext("2d");
            GOL.context.fillStyle = GOL.CELLCOLOR;
            GOL.CELLWIDTH = Math.floor(GOL.canvas.height / GOL.ROWS);
            
            GOL.canvas.addEventListener("mousedown", function(e) {
                GOL.mousedown = true;
                GOL.onBoardInteraction(e);
            }, false);
            GOL.canvas.addEventListener("mouseup", function() {
                GOL.mousedown = false;
                GOL.lastrow = -1;
                GOL.lastcol = -1;
            }, false);
            GOL.canvas.addEventListener("mousemove", function(e) {
                if (GOL.mousedown) GOL.onBoardInteraction(e);
            }, false);
            
            GOL.seed_board(GOL.seeds.galaxy);
            GOL.nextBoard = GOL.create_board();
            
            GOL.draw();
        },
        
        // The game loop.
        step: function() {
            GOL.advanceBoard();
            GOL.draw();
            if (GOL.running) setTimeout(GOL.step, GOL.TIMESTEP);
        },
        
        pause: function() {
            GOL.running = false;
        },
        
        play: function() {
            if (!GOL.running) {
                GOL.running = true;
                GOL.step();
            }
        }
    
    };
    
    // Run the game.
    GOL.init(document.getElementById("gameBoard"));   
}

var GOL;

window.addEventListener("DOMContentLoaded", gameOfLife, false);
