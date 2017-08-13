const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const fs = require('fs');

var gameStarted = false;
var hostChoosing = false;
var playerIn = false;
var hostReady = false;

var helpButtons = {
    'quad': true,
    'half': true,
    'phone': true,
    'error': true,
    'dice': true
};
var pack = {};
var level = 26;
var money = 0;
var fails = 0;
var haveToFail = false;
var gameLoosed = false;

const moneyLightLevels = 5;
const moneyHighLevels = 10;


app.use(fileUpload());
app.use(cookieParser());

app.post('/upload', function (req, res) {
    if (!req.files) return res.status(400).send('No files were uploaded');

    var pack = req.files.pack_file;

    pack.mv('./packs/' + pack.name, function (err) {
        if (err) return res.status(500).send(err);
        res.cookie('name', pack.name);
        res.cookie('type', 'host');
        return res.redirect('ready.html');
    });
});

app.get('/ready.html', function (req, res) {
    if (req.cookies.type === 'host') {
        hostReady = true;
        pack = JSON.parse(fs.readFileSync('./packs/' + req.cookies.name, 'utf8'));
        level = 26;
    }
    else {
        res.cookie('type', 'player');
        playerIn = true;
        gameStarted = true;
    }
    res.sendFile(__dirname + '/ready.html')
});

app.use(require('express').static('./'));

io.on('connection', function (socket) {

    if(gameStarted) sendGameInfo();

    sendInfoMM();

    socket.on('host join', function () {
        hostChoosing = true;
        sendInfoMM();
    });

    socket.on('get pack', function () {
        if (pack['name'] === undefined) socket.emit('pack', 'pack isn\'t set');
        else socket.emit('pack', pack);
    });

    socket.on('player connect', function () {
        sendInfoMM();
        sendRoomInfo();
    });

    socket.on('take ans', function (myAns) {
        var rightAns;
        for (var i = 1; i <= 4; i++) if (pack['questions']['question' + level]['a' + i]['true']) rightAns = 'a' + i;
        if (myAns === rightAns) {
            io.emit('answer', {for: 'everyone', 'answer': true, 'myAns': myAns, 'rightAns': rightAns});
            if (!gameLoosed) {
                if (level >= 10) money += moneyLightLevels;
                else money += moneyHighLevels;
                haveToFail = false;
            } else {
                money = 0;
            }
        } else {
            io.emit('answer', {for: 'everyone', 'answer': false, 'myAns': myAns, 'rightAns': rightAns});
            if (!haveToFail) {
                if (level >= 10) money -= moneyLightLevels * 2;
                else money -= moneyHighLevels * 2;
                if (money < 0) money = 0;
                fails++;
                if (fails > 3) {
                    fails = 3;
                    gameLoosed = true;
                }
            } else {
                haveToFail = false;
            }
        }
        sendGameInfo();

        if (level === 1) {
            gameStarted = false;
            gameLoosed = false;
            fails = 0;
            money = 0;
            pack = {};
            hostReady = false;
            hostChoosing = false;
            playerIn = false;
            io.emit('game ended', {for: 'everyone'});
        }
    });

    socket.on('use quad', function (item) {
        removeAnswers([item]);
        helpButtons['quad'] = false;
        sendGameInfo();
        console.log('quad used');
    });

    socket.on('use half', function (items) {
        removeAnswers(items);
        helpButtons['half'] = false;
        sendGameInfo();
        console.log('half used');
    });

    socket.on('use phone', function () {
        helpButtons['phone'] = false;
        sendGameInfo();
        console.log('phone used');
    });

    socket.on('use error', function () {
        helpButtons['error'] = false;
        haveToFail = true;
        sendGameInfo();
        console.log('error used');
    });

    socket.on('use dice', function (item) {
        helpButtons['dice'] = false;
        if (item > 1 && item <= 3) removeAnswers([useDiceQuad()]);
        else if (item > 3 && item <= 5) removeAnswers(useDiceHalf());
        else if (item === 6) useDiceError();
        io.emit('dice info', {for: 'everyone', 'item': item});
        sendGameInfo();
        console.log('dice used ' + item);
    });

    socket.on('next level', function () {
        if (!gameStarted) return false;
        level--;
        haveToFail = false;
        sendGameInfo();
    });

    function removeAnswers(item) {
        io.emit('remove answers', {for: 'everyone', 'items': item});
    }

    function sendInfoMM() {
        io.emit('info', {
            for: 'everyone',
            'gameStarted': gameStarted,
            'hostChoosing': hostChoosing,
            'playerIn': playerIn,
            'hostReady': hostReady
        });
    }

    function sendRoomInfo() {
        io.emit('room info', {
            for: 'everyone',
            'host': hostReady,
            'player': playerIn
        });
    }

    function sendGameInfo() {
        io.emit('game info', {
            for: 'everyone',
            'helpButtons': helpButtons,
            'money': money,
            'level': level,
            'haveToFail': haveToFail,
            'fails': fails
        });
    }

    function useDiceQuad() {
        var answers = pack['questions']['question' + level];
        var right = [];

        for (var i = 1; i <= 4; i++) if (!answers['a' + i]['true']) right.push(i);

        item = right[Math.floor(Math.random() * right.length)];

        return item;
    }

    function useDiceHalf() {
        var item;
        var right = [];
        var answers = pack['questions']['question' + level];
        for (var i = 1; i <= 4; i++) if (!answers['a' + i]['true']) right.push(i);
        var itemsToRemove = [];
        item = right[Math.floor(Math.random() * right.length)];
        itemsToRemove.push(item);
        right.splice(right.indexOf(item), 1);
        item = right[Math.floor(Math.random() * right.length)];
        itemsToRemove.push(item);

        return itemsToRemove;
    }

    function useDiceError() {
        haveToFail = true;
    }
});

http.listen(80, function () {
    console.log('Example app is listening on 80');
});