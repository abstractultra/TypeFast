var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

const game = io.of('/game');

const games = [];

var nextAvailableGameRoom = (function(player) {
    var sentences = [
        "If you're part of the minority who truly wants to learn more, I'd love to help you with your journey. I welcome you to my website, \"for the minority has already proved themselves.\" This website is not just about being that smart student in class, but also about learning well on your own.",
        "If you spend too much time thinking about a thing, you'll never get it done.",
        "Failure will never overtake me if my determination to succeed is strong enough.",
        "Unfortunately, only having a motive isn't enough. You can be fully determined and motivated to finish a project, but the execution of your project can be a big factor in the efficiency of execution during the process and the quality of your work in the end. As such, execution is one of the biggest factors that determine whether a project will go well...or not. If we glance back to the definition of this very topic, we find that the definition itself points us in the direction of making a specific plan, and calls a project \"a planned undertaking.\"",
        "It may be possible to continue on with willpower alone, but the issue is that with pure willpower and a lack of motivation, the quality of work tends to deteoriate, and you start lacking a reason to produce quality work.",
        "Motivation doesn't just come from responses in the future, but it can also come from the present, perhaps even on your journey to your goal. I don't particulary advise to spam your walls with motivational posters, but you should always have something that would help you keep moving forward. Your brain loves coming up with negative thoughts, so by keeping positive thoughts ubiquitous, you receive perhaps just a bit of extra motivation to keep you pushing forward.",
        "Without a strict schedule, we often waste time deciding on what to do. And believe it or not, these times actually eat away at our willpower, because the act of deciding what to do next itself is something that takes thought and can often lead to wasted time. By keeping with you a path to reach your goals, and knowing what to do next, you eliminate the need to have to think about the next thing to do, and can focus on keeping your progress towards your goal consistent."
    ];
    return function (player) {
        let roomid = player.roomid;
        function createGameRoom(player) {
            let minPlayers = (roomid) ? player.minPlayers : 1;
            var gameRoom = {};
            gameRoom.id = (roomid) ? roomid : io.engine.generateId();
            gameRoom.state = (roomid) ? 'custom' : 'waiting';
            gameRoom.sentence = sentences[Math.floor(Math.random() * 5)];
            gameRoom.players = [];
            gameRoom.start = function () {
                game.to(this.id).emit('start game', this);
            };
            gameRoom.init = function () {
                if (gameRoom.players.length >= gameRoom.minPlayers) {
                    this.countdown();
                    gameRoom.init = function(){};
                } else {
                    game.to(this.id).emit('waiting for players', gameRoom.minPlayers - gameRoom.players.length);
                }
            }
            gameRoom.minPlayers = parseInt(minPlayers, 10);
            gameRoom.maxPlayers = 3;
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
                        
                    }
                }
            })();
            gameRoom.initialTime = 100;
            gameRoom.timeLeft = 100;
            gameRoom.endCountdown = (function () {
                return function countdown() {
                    game.to(gameRoom.id).emit('end countdown', gameRoom.timeLeft--);
                    if (gameRoom.timeLeft >= 0) {
                        setTimeout(function() {
                            countdown();
                        }, 1000);
                    } else {
                        index = games.indexOf(gameRoom);
                        games.splice(index, 1);
                        game.to(gameRoom.id).emit('end game', gameRoom);
                        
                    }
                }
            })();
            gameRoom.addPlayer = function(player) {
                gameRoom.players.push(player);
                if (gameRoom.players.length >= gameRoom.maxPlayers)
                    gameRoom.state = 'full';
            }
            games.push(gameRoom);
            return gameRoom;
        }
        let availableRooms;
        if (player.wish == 'join') {
            if (roomid) {
                availableRooms = games.filter(gr => gr.id == roomid);
            } else {
                availableRooms = games.filter(gr => gr.state == 'waiting');
            }
            if (availableRooms.length == 0)
                return createGameRoom(player);
            else
                return availableRooms[0];
        } else if (player.wish == 'create') {
            return createGameRoom(player);
        }
    }
})();

game.on('connection', function (socket) {
   
    socket.on('join game', function(player, setRoomId) {
        if (games.find(g => g.players.find(p => p.id == player.id) !== undefined) === undefined) {
            let gameRoom = nextAvailableGameRoom(player);
            socket.join(gameRoom.id);
            gameRoom.addPlayer(player);
            gameRoom.init();
            game.to(gameRoom.id).emit('init player', gameRoom);
            setRoomId(gameRoom.id);
        }
    });
    
    socket.on('race finished', function (player) {
        delete player.roomid;
    });
    
    socket.on('progress update', function (player) {
        let gameRoom = games.find(g => player.roomid == g.id);
        if (gameRoom) {
            let timeElapsed = gameRoom.initialTime - gameRoom.timeLeft;
            let wpm = Math.round(player.charIndex / 5 * 60 / timeElapsed);
            player.wpm = wpm;
            game.to(player.roomid).emit('progress update', player);
        }
    });
    
    socket.on('disconnect', function() {
        
    });
});

io.on('connection', function(socket) {
    
});

http.listen(port, function() {
    console.log(`listening on ${port}`);
});

