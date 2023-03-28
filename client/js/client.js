var socket = io.connect('http://localhost:5004');
var Cases = [];
var End = false;

socket.on('go', function (data) {
    CancelMessage();
    document.getElementById('colorPlay').textContent = data.Name;
    document.getElementById('grid').style.borderCollapse = 'separate';
    document.getElementById('play').innerHTML = 'Restart';
    document.getElementById('play').style.opacity = '';
    document.getElementById('colorPlay').className = 'cellRed';
    document.getElementById('player-name').style.borderBottomColor = data.ID == 1 ? '#F73859' : '#29D2E4';

    Cases.forEach(function(_case){
        _case.Clicker = 0;
        _case.Element.style.borderRadius = '30px';
    });
    socket.emit('join', {room: room});
});

socket.on('getClick', function (data) {
    var _case = CaseXY(data.X, data.Y);
    
    _case.Element.className = data.Clicker == 1 ? 'cellRed' : 'cellBlue';
    document.getElementById('colorPlay').className = data.Clicker == 1 ? 'cellBlue' : 'cellRed';
     if(data.Clicker == 1){
        _case.Element.classList.add('red-fall')
     }
     if(data.Clicker == 2){
        _case.Element.classList.add('blue-fall')
     }

    _case.Element.Clicker = data.Clicker;
    _case.Element.classList.add('animate');

    setTimeout(function () {
        _case.Element.classList.remove('animate');
    }, 200);


});

socket.on('errorClick', function (data) {
    var _case = CaseXY(data.X, data.Y).Element;
    _case.classList.add('cellError');
    setTimeout(function(){
        _case.classList.remove('cellError');
    }, 200);
});

socket.on('win', function(data) {
    if(data !== 0){
        Message('You ' + data.Status);
        var CasesWin = [];
        data.CasesWin.forEach(function(_caseWin) { CasesWin.push(CaseXY(_caseWin.X, _caseWin.Y));});

        CasesWin.forEach(function(_case){
            _case.Element.className = 'flash-bg';
        });
        Cases.forEach(function(_case){
            if(CasesWin.indexOf(_case) < 0 && _case.Element.Clicker > 0 && !End)
                _case.Element.style.opacity = 0.2;
        });
    } else {
        Message('Equality');
        Cases.forEach(function(_case){
            _case.Element.style.opacity = 0.2;
        });
    }
    End = true;
});

socket.on('getUnHover', function(data) {
    CaseXY(data.X, data.Y).Element.className = '';

    for(var i = 0; i < 7; i++){
        document.getElementById('piece-'+i).style.backgroundColor = '#FFFFFF';
    }

});

socket.on('getHover', function(data) {
    
    
    for(var i = 0; i < 7; i++){
        document.getElementById('piece-'+i).style.backgroundColor = '#FFFFFF';
    }
    if(data.Clicker == 1){
        document.getElementById('piece-'+data.Case.X,).style.backgroundColor = '#FF5F63';
    }
    if(data.Clicker == 2){
        document.getElementById('piece-'+data.Case.X,).style.backgroundColor = '#4fc3dc';
    }

    CaseXY(data.Case.X, data.Case.Y).Element.className = data.Clicker == 1 ? 'cellRedHover' : 'cellBlueHover';
    
});

socket.on('wait', function() {
    Message('Waiting for a player...');
    document.getElementById('play').style.opacity = .5;
});

socket.on('playerName', function(data) {
    document.getElementById('colorPlay').textContent = data;
});

socket.on('leave', function(){
    Message('Your opponent leave the game');
    Cases.forEach(function(_case) {
        if(_case.Element.Clicker > 0)
            _case.Element.style.opacity = .2;
    });
});

function Initialize() {
    var grid = document.getElementById('grid');
    grid.innerHTML = '';

    for (var r = 0; r < 6; ++r) {
        var tr = grid.appendChild(document.createElement('tr'));
        for (var c = 0; c < 7; ++c) {
            var _case = new Grid(c, r, 0);
            _case.Create(tr);
            Cases.push(_case);
        }
    }
    for(var i = 0; i < 7; i++){
        document.getElementById('piece-'+i).style.backgroundColor = 'white';
    }
}

function Play(){
    socket.emit('disconnectPlayer');
    Cases.forEach(function(_case){
        _case.Element.Clicker = 0;
        _case.Element.style.borderRadius = '30px';
        _case.Element.className = '';
        _case.Element.style.opacity = '';
    });
    document.getElementById('colorPlay').textContent = 'Connect Four';
    document.getElementById('player-name').style.borderBottomColor = '';
    document.getElementById('colorPlay').className = '';
    document.getElementById('grid').style.borderCollapse = '';
    End = false;
    socket.emit('search', document.getElementById('player-name').value);

    var name = document.getElementById('player-name').value;
    if(name !=''){
        document.getElementById('room-to-join').innerHTML = `Go to Room: <a target="_blank" href="/room?name=${name}">${name}</a>`;
        httpGet(name);
    }
    
}


function httpGet(name)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", `/addRoom?name=${name}`,false);
    xmlHttp.send(null);
    return xmlHttp.responseText;
}

function Grid(X, Y, Clicker) {
    this.Element = document.createElement('td');
    this.Element.Clicker = Clicker;
    this.Element.X = X;
    this.Element.Y = Y;

    this.Create = function (i) {
        this.Element.onmouseover = function (e){
            socket.emit('hover', e.target);
        }

        this.Element.onmouseout = function (e){
            socket.emit('unhover', e.target);
        }

        this.Element.onclick = function (e) {
            socket.emit('click', e.target);
        };

        i.appendChild(this.Element);
    }
}

function CaseXY(x, y) {
    for (var i = 0; i < Cases.length; i++) {
        if (Cases[i].Element.X == x && Cases[i].Element.Y == y) {
            return Cases[i];
        }
    }
    return new Grid(0, 0, -1);
}

function Message(msg) {
    var info = document.getElementById('info');
    info.innerHTML = msg;
    info.style.display = "block";
    setTimeout(function() {
        info.style.opacity = .8;
    }, 1);
}

function CancelMessage() {
    var info = document.getElementById('info');
    info.style.opacity = 0;
    setTimeout(function () {
        info.style.display = "none";
    }, 300);
}

function NameUpdate(){
    socket.emit('nameUpdate', document.getElementById('player-name').value);
}