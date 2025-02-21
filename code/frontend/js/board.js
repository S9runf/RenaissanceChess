import { createWebsocket, valid_moves, player_color } from './websocket.js'

export let board = null
export let game = new Chess()
let fen, promote_to
export let socket = null;

// If something breaks, change these with let
let piece_theme = 'img/chesspieces/wikipedia/{piece}.png'
let promotion_dialog = $('#promotion-dialog')
let promoting = false
let light = true
let letters, part2 = null
let comments = ""
let pass = false
let color
let is_moving;
let has_sensed = false;

export function startConnection(url, timer, bot, color) {
    socket = createWebsocket(game, url, document.getElementById("player_timer"), document.getElementById("opponent_timer"));

    //activates when the user switches tabs
    document.addEventListener("visibilitychange", () => {
        //when the tab is active send a request for the timers to the backend
        if (document.visibilityState === 'visible' && socket.readyState == WebSocket.OPEN)
            socket.send(JSON.stringify({ action: 'get_active_timer' }));
    });

    //only send the start game request when the socket is open
    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ action: 'start_game', seconds: timer, bot: bot, color: color }))

        //remove the event listener after the game has started to prevent it from being called again
        socket.removeEventListener('open', () => { });
    })


}

window.addEventListener('beforeunload', function (e) {
    //show the confirm dialog only if the game is not over
    if(socket.readyState == WebSocket.OPEN && !game.is_over)
       e.preventDefault();
});

let config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
}


export function showToast(message, type) {
    // Here again, change with let if something breaks
    let toastId = new Date().getTime();
    let toastHTML = `
<div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="500000">
<div class="toast-header">
    <strong class="mr-auto">${type}</strong>
    <button type="button" class="close" data-dismiss="toast" aria-label="Close">
        <span aria-hidden="true">&times;</span>
    </button>
</div>
<div class="toast-body">
    ${message}
</div>
</div>
`;

    // Aggiungi il messaggio toast al contenitore
    $('#toast-scroll').append(toastHTML);

    // Mostra il messaggio toast
    $('#' + toastId).toast('show');

    let toastContainer = document.getElementById('toast-scroll');
    toastContainer.scrollTop = toastContainer.scrollHeight;

    // Rimuovi il messaggio toast dopo che è stato nascosto
    $('#' + toastId).on('hidden.bs.toast', function () {
        $(this).remove();
    });
}

/*-----------Arbiter messages--------------*/

export function haveEaten(target) {
    comments = ''
    if (target === 'b') {
        comments = "White captured a black piece ⚪⚔⚫ \n" + comments
    }
    if (target === 'w') {
        comments = "Black captured a white piece ⚫⚔⚪ \n" + comments
    }
    showToast(comments, '');
}

export function showSideToMove(game_turn) {
    comments = ''
    if (!pass) {
        if (game_turn === player_color) {
            comments = "It's your turn to move ♟️ \n" + comments;
            light = false;

        } else {
            comments = "opponent's turn . . . 🎭 \n" + comments;
            light = true;
        }
        showToast(comments, '');
    }
    else pass = false;
    is_moving = game_turn;
}

export function illegalMove() {
    comments = ''
    comments = "illegal move ❌ \n" + comments;
    showToast(comments, '');
}

export function showSense() {
    //the player's turn has started, now they can sense
    has_sensed = false;

    comments = ''
    comments = "It's your turn to sense 🔦 \n" + comments;
    showToast(comments, '')
}

export function youPassed() {
    comments = '';
    if (game.turn() === color) {
        comments = "You passed 😶‍🌫️ \n" + comments;
        showToast(comments, '')
        showSideToMove(game.turn());
    }
}

export function showGameOver(reason, winner) {
    comments = ''
    let result = winner ? 'White won, ' : (winner !== 'None' ? 'black won, ' : 'Draw')
    comments = result + reason + "🏆 \n" + comments;
    showToast(comments, '');
    light = true;
}

export function onDragStart(source, piece) {
    document.body.style.overflow = 'hidden';
    
    // do not pick up pieces if the game is over
    if (game.game_over() || game.is_over) return false
    //do not move the pieces if it is not your turn
    if(is_moving !== color) return false

    if ((color === 'w') && (piece.search(/^b/) !== -1)) return false
    if ((color === 'b') && (piece.search(/^w/) !== -1)) return false

    lightsOff();
}

/*-----------Board movements--------------*/

//update the game board with the move made by the opponent
export function makeOpponentMove(board_conf) {
    //load the board fen sent by the backend
    game.load(board_conf);
    //updte the board shown to the user
    board.position(game.fen(), false);

    // Apply custom styles after updating the board
    lightsOff();
}

//taken fron https://github.com/jhlywa/chess.js/issues/382
export function passTurn() {
    //only allow the user to pass if it is their turn
    if (!game.turn() === color)
        return
    pass = true;
    youPassed();
    //get the current fen and split it in tokens
    let tokens = game.fen().split(/\s/)
    //change the turn token
    tokens[1] = game.turn() == game.WHITE ? game.BLACK : game.WHITE
    tokens[3] = '-' // reset the en passant square 
    game.load(tokens.join(' '))
    //send the pass request to the backend
    socket.send(JSON.stringify({ action: 'pass' }));
}

export function onDrop(source, target) {
    document.body.style.overflow = 'visible';
    let move_cfg = {
        from: source,
        to: target,
        promotion: 'q'
    };

    // check we are not trying to make an illegal pawn move to the 8th or 1st rank,
    // so the promotion dialog doesn't pop up unnecessarily
    if (!valid_moves.some(move => move.startsWith(source + target))) {
        document.body.style.overflow = 'visible';
        illegalMove();
        config.draggable = true;
        return 'snapback';
    }

    let source_rank = source.substring(2, 1);
    let target_rank = target.substring(2, 1);
    let source_column = source.substring(0, 1);
    let target_column = target.substring(0, 1);
    console.log('source column: ' + source_column);
    console.log('target column: ' + target_column);
    let piece = game.get(source).type;
    let target_type = game.get(target);
    console.log(target_type);

    //change the opacity of the squares
    if ((piece.search(/^w/) && color == 'w') || (piece.search(/^b/) && color == 'b')) {
        let squareSource = $('#myBoard .square-' + source);
        let squareTarget = $('#myBoard .square-' + target);
        squareTarget.css('opacity', 1);
        squareTarget.css('filter', 'none');
        squareSource.css('opacity', 0.4);
        squareSource.css('filter', 'grayscale(50%) blur(2px) brightness(0.8)');
    }

    if (piece === 'p' &&
        (
            (source_rank === '7' && target_rank === '8') ||
            (source_rank === '2' && target_rank === '1')
        ) &&
        (source_column === target_column ? target_type === null : true) &&
        (source_column != target_column ? target_type !== null : true)
    ) {
        promoting = true;

        // get piece images
        $('.promotion-piece-q').attr('src', getImgSrc('q'));
        $('.promotion-piece-r').attr('src', getImgSrc('r'));
        $('.promotion-piece-n').attr('src', getImgSrc('n'));
        $('.promotion-piece-b').attr('src', getImgSrc('b'));

        //show the select piece to promote to dialog
        promotion_dialog.dialog({
            modal: true,
            height: 46,
            width: 184,
            resizable: true,
            draggable: false,
            close: () => onDialogClose(move_cfg),
            closeOnEscape: false,
            dialogClass: 'noTitleStuff'
        }).dialog('widget').position({
            of: $('#myBoard'),
            my: 'middle middle',
            at: 'middle middle',
        });

        //the actual move is made after the piece to promote to
        //has been selected, in the stop event of the promotion piece selectable
        return;
    }
    makeMove(game, move_cfg, false);
}

export function onSnapEnd() {
    if (promoting) return;
    updateBoard(board);
}

export function getImgSrc(piece) {
    return piece_theme.replace('{piece}', game.turn() + piece.toLocaleUpperCase());
}

export function updateBoard(board) {
    board.position(game.fen(), false);
    promoting = false;
}

let onDialogClose = function (move_cfg) {
    console.log('promote toooooo' + promote_to);
    move_cfg.promotion = promote_to;
    makeMove(game, move_cfg, true);
}

export function makeMove(game, move_cfg, promotion = false) {
    //see if the move is legal
    //convert move to UCI format
    console.log(config);

    console.log(move_cfg.to);
    console.log(move_cfg.from);
    let move = move_cfg.from + move_cfg.to;
    //add promotion to the move only if it actually includes a promotion
    if (promotion)
        move += move_cfg.promotion;

    console.log(move);

    // illegal move
    if (!(valid_moves.includes(move))) {
        illegalMove();
        config.draggable = true;
        return 'snapback';
    }
    else {
        //make the move
        let piece = game.get(move_cfg.from);
        game.remove(move_cfg.from);
        game.put(piece, move_cfg.to);
        //send the chosen move to the backend
        socket.send(JSON.stringify({ action: 'move', move: move }));
        console.log('you moved: ' + move_cfg.from + move_cfg.to);
        config.draggable = false;
    }

}


/*-----------Sensing--------------*/

export function lightsOn(gg) {
    if (color == gg) {
        config.draggable = false;
        window.addEventListener("click", function (event) {
            if (event.target.classList.contains("square-55d63") && !light && !has_sensed){
                let position = event.target.getAttribute("data-square");
                let part1 = position.substring(0, 1);
                let part1Ascii = part1.charCodeAt(0);
                let prec
                let suc = String.fromCharCode(part1Ascii + 1);

                if (part1 != 'a') prec = String.fromCharCode(part1Ascii - 1);
                else prec = null;

                letters = [prec, part1, suc];
                part2 = position.substring(position.length - 1);
                //turn on light
                let i = 0;
                part2--;
                while (i < 3) {
                    let j = 0;
                    while (j < 3) {
                        let square = $('#myBoard .square-' + letters[j] + part2);
                        square.css('opacity', 1);
                        square.css('filter', 'none');

                        let pieceImage = square.find('img[data-piece]');
                        pieceImage.css('opacity', 1);
                        j++;
                    }
                    part2++;
                    i++;
                }
                config.draggable = true;
                light = true;
                has_sensed = true;
                //send the sense message to the backend
                socket.send(JSON.stringify({ action: 'sense', sense: position }));
            }
        }, { passive: false });
    }
}

export function lightsOff() {
    let i = 0;
    let letters = ["a", "b", "c", "d", "e", "f", "g", "h"]
    while (i < 8) {
        let y = 0;
        while (y < 8) {
            let square = $('#myBoard .square-' + letters[y] + (i + 1));
            square.css({
                'opacity': 0.4,
                'filter': 'grayscale(50%) blur(2px) brightness(0.8)'
            });
            let piece = square.find('img[data-piece]');


            if (piece.length > 0) {
                let dataPieceValue = piece.attr('data-piece');

                //check for white pieces
                if (dataPieceValue?.startsWith(color)) {
                    square.css({
                        'opacity': '1',
                        'filter': 'none'
                    });
                    piece.css({
                        'opacity': '1'
                    });
                }
                else {
                    piece.css({
                        'opacity': '0',
                        'z-index': '0',
                        'pointer-events': 'none'
                    });
                }
            }
            y++;
        }
        i++;
    }
    light = false;
}

/*-----------Rematch and Quit--------------*/

/**
 * Resigns the game.
 * @param {boolean} rematch - Indicates whether a rematch is requested.
 * @returns {void} void
 */
export function resign(rematch = false) {
    config.draggable = false;
    console.log('light ' + light);


    game.reset();
    //avoid trying to send the message while the page is loading
    if (socket.readyState == WebSocket.OPEN)
        socket.send(JSON.stringify({ action: 'resign', rematch: rematch }));

    
}

/**
 * Flips the side of the chessboard and initializes it.
 * 
 * @param {string} c - The color to set the chessboard orientation to 
 *                     ('b' for black, 'w' for white).
 * @returns {void} void
 */
export function flipSide(c) {
    color = c; // Set global colour

    // Remove eventual pre-existent CSS classes, in order to avoid colliding previous and new ruleset
    $('#myBoard').removeClass('black-side white-side');

    // Change the chessboard.js orientation bases on parameter
    if (c === 'b') {
        board.orientation('black');
        $('#myBoard').addClass('black-side');
    } else if (c === 'w') {
        board.orientation('white');
        $('#myBoard').addClass('white-side');
    }

    lightsOff();

    // Make sure that the board is initialized correctly
    board.start();
}

/*-----------Initialization--------------*/

export function set_names(enemy_name) {
    document.getElementById("black_name").innerHTML = enemy_name;
    console.log("the enemy name is " + enemy_name);
    }

board = Chessboard('myBoard', config)
$(window).on('resize', board.resize);

$("#promote-to").selectable({
    stop: function () {
        $(".ui-selected", this).each(function () {
            let selectable = $('#promote-to li');
            let index = selectable.index(this);
            if (index > -1) {
                let promote_to_html = selectable[index].innerHTML;
                let span = $('<div>' + promote_to_html + '</div>').find('span');
                promote_to = span[0].innerHTML;
            }
            promotion_dialog.dialog('close');
            $('.ui-selectee').removeClass('ui-selected');
            updateBoard(board);
        });
    }
});

export function resetFog() {
    let squares;
    //reset fog
    if (color == 'w') squares = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'f1', 'f2', 'g1', 'g2', 'h1', 'h2'];
    else squares = ['a7', 'a8', 'b7', 'b8', 'c7', 'c8', 'd7', 'd8', 'e7', 'e8', 'f7', 'f8', 'g7', 'g8', 'h7', 'h8'];
    $('#myBoard .square-55d63').css('opacity', 0.4)
    $('#myBoard .square-55d63').css('filter', 'grayscale(50%) blur(2px) brightness(0.8)')

    squares.forEach(function (square) {
        let squareTarget = $('#myBoard .square-' + square);
        squareTarget.css('opacity', 1);
        squareTarget.css('filter', 'none');
    });
}


