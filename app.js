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
        let create = (player.wish == 'create');
        function createGameRoom(player) {
            let minPlayers = (create ? player.minPlayers : 1);
            var gameRoom = {
                id: (player.roomid ? player.roomid : io.engine.generateId()),
                state: (create ? 'custom' : 'waiting'),
                sentence: sentences[Math.floor(Math.random() * sentences.length)],
                players: [],
                start: function () {
                    game.to(this.id).emit('start game', this);
                },
                init: function () {
                    if (gameRoom.players.length >= gameRoom.minPlayers) {
                        this.countdown();
                        gameRoom.init = function(){};
                    } else {
                        game.to(this.id).emit('waiting for players', gameRoom.minPlayers - gameRoom.players.length);
                    }
                },
                minPlayers: parseInt(minPlayers, 10),
                maxPlayers: 3,
                countdown: (function () {
                    let count = 10;
                    return function countdown() {
                        if (gameRoom.state != 'dead') {
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
                    }
                })(),
                initialTime: 100,
                timeLeft: 100,
                endCountdown: (function () {
                    return function countdown() {
                            if (gameRoom.state != 'dead') {
                            game.to(gameRoom.id).emit('end countdown', gameRoom.timeLeft--);
                            if (gameRoom.timeLeft >= 0) {
                                setTimeout(function() {
                                    countdown();
                                }, 1000);
                            } else {
                                game.to(gameRoom.id).emit('end game', gameRoom);
                                index = games.findIndex(gr => gr.id = gameRoom.id);
                                games.splice(index, 1);
                            }
                        }
                    }
                })(),
                addPlayer: function(player) {
                    gameRoom.players.push(player);
                    if (gameRoom.players.length >= gameRoom.maxPlayers)
                        gameRoom.state = 'full';
                }
            };
            games.push(gameRoom);
            return gameRoom;
        }
        let availableRooms;
        if (player.wish == 'join') {
            availableRooms = games.filter((create) ? (gr => gr.id == player.roomid) : (gr => gr.state == 'waiting'));
            return (availableRooms.length == 0) ? createGameRoom(player) : availableRooms[0];
        } else {
            return createGameRoom(player);
        }
    }
})();

game.on('connection', function (socket) {
    socket.on('join game', function(player, setPlayer) {
        if (games.find(g => g.players.find(p => p.id == player.id) !== undefined) === undefined) {
            let gameRoom = nextAvailableGameRoom(player);
            socket.join(gameRoom.id);
            gameRoom.addPlayer(player);
            gameRoom.init();
            game.to(gameRoom.id).emit('init player', gameRoom);
            setPlayer(JSON.stringify({roomid: gameRoom.id}));
        }
    });
    
    // Find player's game room
    function getPlayer(player) {
        let [gameIndex, playerIndex] = getPlayerIndices(player);
        if (gameIndex !== false && playerIndex !== false)
            return games[gameIndex].players[playerIndex];
    }
    
    function getPlayerIndices(player) {
        let gameIndex, playerIndex;
        gameIndex = games.findIndex(g => g.id == player.roomid);
        if (gameIndex > -1) {
            playerIndex = games[gameIndex].players.findIndex(p => p.id == player.id)
            return [gameIndex, playerIndex];
        }
        return [false];
    }
    
    function removePlayer(player) {
        let [gameIndex, playerIndex] = getPlayerIndices(player);
        if (gameIndex !== false && playerIndex !== false) {
            games[gameIndex].players.splice(playerIndex, 1);
            if (games[gameIndex].players.length == 0) {
                games[gameIndex].state = 'dead';
                games.splice(gameIndex, 1);
            }
        }
    }
    
    socket.on('race finished', function (player, setPlayer) {
        progressUpdate(player, setPlayer);
        removePlayer(player);
    });
    
    function progressUpdate(player, setPlayer) {
        if (player.roomid) {
            let gameRoom = games.find(g => player.roomid == g.id);
            if (gameRoom) {
                let timeElapsed = gameRoom.initialTime - gameRoom.timeLeft;
                let newWPM = Math.round(player.charIndex / 5 * 60 / timeElapsed);
                setPlayer(JSON.stringify({wpm: newWPM}));
                player.wpm = newWPM;
                game.to(player.roomid).emit('progress update', player);
            }
        }
    }
    
    socket.on('progress update', progressUpdate);
    socket.on('disconnect', function() {
        
    });
});

io.on('connection', function(socket) {
    
});

http.listen(port, function() {
    console.log(`listening on ${port}`);
});

