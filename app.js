var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

const game = io.of('/game');
nextAvailableGameRoom = (function() {
    var games = [];
    var sentences = [
    "sentence 1",
    "sentence 2",
    "sentence 3",
    "sentence 4",
    "sentence 5"
    ];
    return function() {
        function createGameRoom() {
            var gameRoom = {};
            gameRoom.id = io.engine.generateId();
            gameRoom.state = 'waiting';
            gameRoom.sentence = sentences[Math.floor(Math.random * 5)];
            gameRoom.players = [];
            gameRoom.start = function () {
                game.to(this.id).emit('start game', this);
            };
            gameRoom.init = function () {
                this.countdown();
                gameRoom.init = function(){};
            }
            gameRoom.maxPlayers = 2;
            gameRoom.countdown = (function () {
                let count = 10;
                return function countdown() {
                    game.to(gameRoom.id).emit('countdown', count--);
                    if (count >= 0) {
                        if (count <= 3)
                            gameRoom.state = 'starting';
                        setTimeout(function() {
                            countdown();
                        }, 1000);
                    } else {
                        gameRoom.state = 'active';
                        gameRoom.start();
                        gameRoom.endCountdown();
                        console.log('game started');
                    }
                }
            })();
            gameRoom.endCountdown = (function () {
                let count = 10;
                return function countdown() {
                    game.to(gameRoom.id).emit('end countdown', count--);
                    if (count >= 0) {
                        setTimeout(function() {
                            countdown();
                        }, 1000);
                    } else {
                        index = games.indexOf(gameRoom);
                        games.splice(index, 1);
                        game.to(gameRoom.id).emit('end game', gameRoom);
                        console.log('game ended');
                    }
                }
            })();
            gameRoom.addPlayer = function(playerID) {
                gameRoom.players.push(playerID);
                if (gameRoom.players.length >= gameRoom.maxPlayers)
                    gameRoom.state = 'full';
            }
            games.push(gameRoom);
            return gameRoom;
        }
        let availableRooms;
        availableRooms = games.filter(gr => gr.state == 'waiting');
        if (availableRooms.length == 0) {
            return createGameRoom();
        }
        else
            return availableRooms[0];
    }
})();

game.on('connection', function (socket) {
    console.log('Someone joined TypeFast!');
    socket.on('join game', function() {
        let gameRoom = nextAvailableGameRoom();
        socket.join(gameRoom.id);
        gameRoom.addPlayer(socket.id);
        gameRoom.init();
        console.log('game joined');
        
        
    });
    socket.on('disconnect', function(){
        console.log('Someone left TypeFast...');
    });
});

io.on('connection', function(socket) {
    
});

http.listen(port, function() {
    console.log(`listening on ${port}`);
});

