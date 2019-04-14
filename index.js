var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

nextAvailableGameRoom = (function() {
    var games = [];
    return function() {
        function createGameRoom() {
            var gameRoom = {};
            gameRoom.id = 'someroom';
            gameRoom.state = 'waiting';
            gameRoom.sentence = 'this is a sentence';
            gameRoom.players = [];
            gameRoom.start = (function () {
                count = 10;
                return function countdown() {
                    if (count > 0) {
                        if (count <= 3)
                            gameRoom.state = 'starting';
                        setTimeout(function() {
                            --count;
                            console.log(count);
                            countdown();
                        }, 1000);
                    } else {
                        gameRoom.state = 'active';
                        
                        console.log('game started');
                    }
                }
            })();
            gameRoom.start();
            games.push(gameRoom);
            return gameRoom;
        }
        let availableRooms;
        availableRooms = games.filter(gr => gr.state != 'waiting');
        if (availableRooms.length == 0)
            return createGameRoom();
        else
            return availableRooms[0];
    }
})();

const game = io.of('/game');
game.on('connection', function (socket) {
    console.log('Someone joined TypeFast!');
    socket.on('join game', function() {
        let gameRoom = nextAvailableGameRoom();
        console.log('game joined');
        socket.join('someroom');
    });
    socket.on('disconnect', function(){
        console.log('Someone left TypeFast...');
    });
});

io.on('connection', function(socket) {
    
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});

