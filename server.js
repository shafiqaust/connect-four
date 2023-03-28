var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
const path = require('path');
const PORT = process.env.PORT || 5004;
server.listen(PORT);
app.use('/', express.static(__dirname + '/client'));
var roomsList = []

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


app.get('/', (req, res) => {

    res.render(path.join(__dirname,'/client','index.html'),{rooms: roomsList});
});


app.get('/room/', (req, res) => {
    var name = req.query.name;
    res.render(path.join(__dirname,'/client','rooms.html'),{rooms: name});
});
app.get('/addRoom/', (req, res) => {
    var name = req.query.name;
    roomsList.push(name);
    res.sendStatus(200)
});

function GameStorage(Players) {
    this.Columns = 7;
    this.Rows = 6;
    this.End = false;
    this.Turn = 1;
    this.Players = Players;
    this.Game = [];
    for (var x = 0; x < 7; x++) {
        for (var y = 0; y < 6; y++) {
            this.Game.push(new Grid(x, y, 0));
        }
    }

    this.Players.forEach(function(p) {
        Players.forEach(function(pName) {
            if (p != pName)
                p.emit('go', {
                    ID: p.ID,
                    Name: pName.Name
                });
        });
    });

    this.EmitToOtherClient = function(_client, message, data) {
        this.Players.forEach(function(p) {
            if (p != _client)
                p.emit(message, data);
        });
    }

    this.getCaseClick = function(x) {
        Count = this.Game.filter(function(_c) {
            return _c.X === x && _c.Clicker === 0
        }).length;
        return this.CaseXY(x, Count - 1);
    }

    this.CaseXY = function(x, y) {
        for (var i = 0; i < this.Game.length; i++) {
            if (this.Game[i].X === x && this.Game[i].Y === y) {
                return this.Game[i];
            }
        }
        return null;
    }

    this.UpdateGame = function(_case, ID) {
        if (!this.End) {
            _case.Clicker = this.Turn;
            this.EmitPlayers('getClick', _case);

            if (this.Turn < this.Players.length)
                this.Turn++;
            else
                this.Turn = 1;

            this.TestWin(_case);
        }
    }

    this.EmitPlayers = function(message, data) {
        this.Players.forEach(function(p) {
            if (p != null) {
                p.emit(message, data);
            }
        });
    }

    this.Click = function(client, _caseClicked) {
        var _case = this.getCaseClick(_caseClicked.X);
        if (this.Turn === client.ID && _case != null)
            this.UpdateGame(_case, client.ID);
        else if (!this.End)
            client.emit('errorClick', _caseClicked);
    }

    this.Hover = function(client, _case) {
        if (this.Turn === client.ID && !this.End)
            this.EmitPlayers('getHover', {
                Case: this.getCaseClick(_case.X),
                Clicker: client.ID
            });
    }

    this.UnHover = function(client, _case) {
        if (this.Turn === client.ID)
            this.EmitPlayers('getUnHover', this.getCaseClick(_case.X));
    }

    this.UpdateNames = function(client) {
        this.EmitToOtherClient(client, 'playerName', client.Name);
    }

    this.EndGame = function() {
        if(!this.End) {
            this.EmitPlayers('leave');
            this.End = true;
        }
    }

    this.TestWin = function(_case) {
        var Directions = [
            this.Game.filter(function(a) {
                return a.X == _case.X
            }),
            this.Game.filter(function(a) {
                return a.Y == _case.Y
            }),
            this.Game.filter(function(a) {
                return a.X - _case.X == a.Y - _case.Y
            }),
            this.Game.filter(function(a) {
                return -(a.X - _case.X) == a.Y - _case.Y
            })
        ];

        for (var i = 0; i < Directions.length; i++) {
            var aWin = [];
            for (var j = 0; j < Directions[i].length; j++) {
                if (Directions[i][j].Clicker === _case.Clicker) {
                    aWin.push(Directions[i][j]);
                    if (aWin.length >= 4) {
                        this.Players.forEach(function(p) {
                            p.emit('win', {
                                Status: _case.Clicker == p.ID ? 'win' : 'loose',
                                CasesWin: aWin
                            });
                        });
                        this.End = true;
                        break;
                    }
                } else aWin = [];
            }
        }

        if (this.Game.filter(function(a) {
                return a.Clicker > 0
            }).length >= this.Game.length) {
            this.End = true;
            this.EmitPlayers('win', 0);

            
        }
    }
}

function Grid(X, Y, Clicker) {
    this.X = X;
    this.Y = Y;
    this.Clicker = Clicker;
}

var aClients = [];
var aGroup = [];

io.on('connection', function(client) {

    console.log(`A user connected at port: *:${PORT}`);

    client.on('join', (data)=>{
        client.join(data.room);
    });
    client.on('search', function(name) {
        if (aClients.indexOf(client) < 0) {
            aClients.push(client);
            client.Name = name;
            client.ID = aClients.length;
            client.identifierID = null;
            if (aClients.length >= 2) {
                aClients.forEach(function(_c) { _c.identifierID = aGroup.length; });
                aGroup.push(new GameStorage(aClients));
                aClients = [];
            } else {
                client.emit('wait');
            }
        }
    });

    client.on('click', function(data) {

        if(client.identifierID != null)
            aGroup[client.identifierID].Click(client, data);
    });

    client.on('nameUpdate', function(data) {
        client.Name = data;

        if(client.identifierID != null)
            aGroup[client.identifierID].UpdateNames(client);
    });

    client.on('hover', function(data) {
        if(client.identifierID != null)
            aGroup[client.identifierID].Hover(client, data);
    });

    client.on('unhover', function(data) {
        if(client.identifierID != null)
            aGroup[client.identifierID].UnHover(client, data);
    });

    client.on('disconnectPlayer', function() {
        Leave();
    });

    client.on('disconnect', function() {
        Leave();

        aClients.forEach(function(_c) {
            if (_c === client)
                aClients.splice(client, 1);
        });
    });

    function Leave() {
        if(client.identifierID != null)
            aGroup[client.identifierID].EndGame();
    }
});
