'use strict';

var host = false;
var player = false;
var money = 0;
var level = 25;
var fails = 0;
var haveToFail = false;

var pack = {};
var packGot = false;

var clickAble = true;

var helpButtons = {
    'quad': true,
    'half': true,
    'phone': true,
    'error': true,
    'dice': true
};

var roundHelp = false;
var answersAnimationTimers = [0, 0, 0, 0];

const delayBeforeRightAnswer = 6000;


$(function () {
    var socket = io();
    var type = GetCookie('type');

    var hostMenu = $('.host-menu');
    var diceInfo = $('#dice-info');

    socket.emit('get pack');

    hostMenu.hide();
    diceInfo.hide();

    if (type === 'host') hostMenu.show();

    socket.on('game info', function (msg) {
        if ((level - msg['level']) === 1 && pack['name'] !== undefined) loadLevel(level - 1);
        helpButtons = msg['helpButtons'];
        level = msg['level'];
        money = msg['money'];
        fails = msg['fails'];
        haveToFail = msg['haveToFail'];
        roundHelp = msg['roundHelp'];

        console.log(helpButtons['quad']);

        updateHud();
    });

    socket.on('pack', function (msg) {
        if (packGot) return true;
        if (msg === 'pack isn\'t set') return window.location.href = '/';
        pack = msg;
        packGot = true;
        console.log('Pack ' + pack['name'] + ' got');
        loadLevel(level);
    });

    socket.on('remove answers', function (msg) {
        console.log('remove answers: ' + msg['items']);
        var items = msg['items'];
        for (var i = 0; i < items.length; i++) $('#a' + items[i]).hide();
    });

    socket.on('answer', function (msg) {
        console.log('answer got');
        var myAns = msg['myAns'];
        var rightAns = msg['rightAns'];
        if (msg['answer'] === true) animateRightAnswer(myAns);
        else animateWrongAnswer(rightAns, myAns);
    });

    socket.on('dice info', function (msg) {
        diceInfo.html('С кубика выпало: ' + msg['item']);
        diceInfo.show();
        setTimeout(clearTimer, 3000);
    });

    $('.help img').click(function (e) {
        if (type !== 'player' || roundHelp) return e.preventDefault();
        roundHelp = true;
        var item;

        switch ($(this).attr('id')) {
            case 'quad':
                useQuad();
                break;
            case 'half':
                useHalf();
                break;
            case 'phone':
                if (helpButtons['phone']) socket.emit('use phone');
                break;
            case 'error':
                useError();
                break;
            case 'dice':
                if (helpButtons['dice']) {
                    item = getRandomInt(1, 7);


                    socket.emit('use dice', item);
                }
                break;
        }

    });

    $('#next-question').click(function (e) {
        if (type !== 'host') return e.preventDefault();
        socket.emit('next level');
    });

    $('.answers p').click(function (e) {
        if (type !== 'player' || !clickAble) return e.preventDefault();
        var myAns = $(this).attr('id');
        clickAble = false;
        socket.emit('take ans', myAns);
    });

    function clearTimer() {
        diceInfo.hide();
    }

    function useQuad() {
        var answers = pack['questions']['question' + level];
        var right = [];
        if (helpButtons['quad']) {

            for (var i = 1; i <= 4; i++) if (!answers['a' + i]['true']) right.push(i);

            var item = right[Math.floor(Math.random() * right.length)];

            socket.emit('use quad', item);
        }
    }

    function useHalf() {
        var item;
        var right = [];
        var answers = pack['questions']['question' + level];
        if (helpButtons['half']) {
            for (var i = 1; i <= 4; i++) if (!answers['a' + i]['true']) right.push(i);
            var itemsToRemove = [];
            item = right[Math.floor(Math.random() * right.length)];
            itemsToRemove.push(item);
            right.splice(right.indexOf(item), 1);
            item = right[Math.floor(Math.random() * right.length)];
            itemsToRemove.push(item);

            socket.emit('use half', itemsToRemove);
        }
    }

    function useError() {
        if (helpButtons['error']) socket.emit('use error');
    }


});

function animateRightAnswer(item) {
    animatePlayerPick(item);
    setTimeout(function () {
        $('#' + item).css('background-color', 'green');
    }, delayBeforeRightAnswer);
}

function animateWrongAnswer(right, wrong) {
    animatePlayerPick(wrong);
    setTimeout(function () {
        $('#' + right).css('background-color', 'green');
        $('#' + wrong).css('background-color', 'orange');
    }, delayBeforeRightAnswer);
}

function animatePlayerPick(item) {
    var ans = $('#' + item);
    ans.css('background-color', 'yellow');
    var delay;
    for (var i = 1; i <= 3; i++) {
        (function () {
            delay = (i * 2000) - 1000;
            setTimeout(function () {
                ans.css('background-color', 'grey');
            }, delay);
            setTimeout(function () {
                ans.css('background-color', 'yellow');
            }, delay + 1000);
        })();
    }
}

function loadLevel(lvl) {
    if (pack['name'] === undefined) return false;
    console.log('level load ' + lvl);
    var lvlToLoad = pack['questions']['question' + lvl];
    var question = $('#question');
    question.html(lvlToLoad['question']);
    question.hide();
    question.removeClass('animated fadeIn');
    for (var i = 1; i <= 4; i++) {
        (function () {
            if (answersAnimationTimers[i - 1] !== 0) clearTimeout(answersAnimationTimers[i - 1]);
            var ans = $('#a' + i);
            ans.html(lvlToLoad['a' + i]['text']);
            ans.css('background-color', 'grey');
            ans.hide();
            ans.removeClass('animated fadeIn');
        })();
    }
    clickAble = true;
    animateNextLevel();
}

function animateNextLevel() {
    var question = $('#question');
    question.addClass('animated fadeIn');
    setTimeout(function () {
        question.show();
    }, 1);
    for (var i = 1; i <= 4; i++) {
        (function () {
            var ans = $('#a' + i);
            ans.addClass('animated fadeIn');
            answersAnimationTimers[i - 1] = setTimeout(function () {
                ans.show();
            }, i * 3000);
        })();
    }
}

function updateHud() {
    $('#level').html('Уровень: ' + level);
    $('#money').html('Выигрыш: ' + money + ' рублей');
    $('#fails').html('Ошибок: ' + fails);
    $.each(helpButtons, function (index, value) {
        if (!value) $('#' + index).parent().hide();
    });
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * @return {null}
 */
function GetCookie(sName) {
    // cookies are separated by semicolons
    var aCookie = document.cookie.split("; ");
    for (var i = 0; i < aCookie.length; i++) {
        // a name/value pair (a crumb) is separated by an equal sign
        var aCrumb = aCookie[i].split("=");
        if (sName === aCrumb[0]) {
            return decodeURI(aCrumb[1]);
        }
    }
    // a cookie with the requested name does not exist
    return null;
}