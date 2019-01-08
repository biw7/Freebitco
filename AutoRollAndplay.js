// ==UserScript==
// @name         Waiting
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Themacprod
// @match        https://freebitco.in/*
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==
var stopPercentage = 0.001;

var startBalance = 0;
var startSerieBalance = 0;
var gMartingaleStartBalance = 0;

var startTime = 0;

var gPreviousBets = 0;

const consLooseTrigger = 5;
const constBaseMultiplicator = 2.0;
const constBaseExpectedProfit = 4;
const constSafeMultiplicator = 1.9;
const const_ultra_safe_multiplicator = 1.8;
const const_safe_expected_profit = 1;
const const_click_types = ['R', 'L', 'H'];

var cons_hi_count = 0;
var cons_lo_count = 0;
var last_click = null;
var g_current_click = null;
var lots_of_loose_case = false;
var g_expected_profit = constBaseExpectedProfit;
var g_multiplicator = constBaseMultiplicator;
const minWagered = 8;
var g_martingal_idx = 0;
var g_click_type = const_click_types[0];

// The High and Low buttons to trigger the click
const $loButton = $('#double_your_btc_bet_lo_button');
const $hiButton = $('#double_your_btc_bet_hi_button');

/**
 * Return string filled with 0.
 * @param {string} x Input string to fill with 0s.
 * @param {int} n Number of 0s to add.
 * @returns {string} Input string filled with 0.
 */
const addZero = function (x, n) { 
    let ret = x;
    while (ret.toString().length < n) {
        ret = `0${ret}`;
    }

    return ret;
};

/**
 * Return string filled with current time.
 * @returns {string} String filled with current time.
 */
const buildTimePrefix = function () {
    const date = new Date();
    const hours = addZero(date.getHours(), 2);
    const minutes = addZero(date.getMinutes(), 2);
    const seconds = addZero(date.getSeconds(), 2);
    const milliseconds = addZero(date.getMilliseconds(), 3);

    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
};

const buildPrefix = function () {
    return `${buildTimePrefix()} | Start = ${startBalance}`;
};

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function computeBetAmount(previousBets, multiplicator, expectedProfit) {
	// (Bet * multiplicator) - previousBets - Bet = expectedProfit
	// 1 * 2 - (1 + 0) = 1
	// 2 * 2 - (2 + 1) = 1
	//
    // (Bet * multiplicator) - Bet = expectedProfit + previousBets
    // Bet * (multiplicator - 1) = expectedProfit + previousBets
	//  1 * 2 + 1 = 1 + 0
	//  2 * 2 = 1 + (2 + 1)
	//
	// Bet = (expectedProfit + previousBets) / (multiplicator + 1)
	//  1 = (1 + 1) / 2
	//  2 = (1 + (2 + 1)) / 2

	return Math.ceil((expectedProfit + previousBets) / (multiplicator - 1));
}

//Generate a random wait time
function get_random_wait() {
    return getRandomInt(400, 1000);
}

function click_button() {
	let $buttonToUse = $loButton;

	if (g_click_type === 'H') {
		$buttonToUse = $hiButton;
	} else if (g_click_type === 'R') {
		if (Math.random() < 0.5) {
			$buttonToUse = $loButton;
		} else {
			$buttonToUse = $hiButton;
		}
	}

    g_current_click = $buttonToUse;
	$buttonToUse.trigger('click');
}

function set_click_type(type) {
    if (type !== g_click_type) {
        console.log(`${buildPrefix()} | Changed click type ${g_click_type} => ${type}`);
    }

    g_click_type = type;
}

function set_multiplicator(value) {
    if (value !== g_multiplicator) {
        console.log(`${buildPrefix()} | Changed multiplier factor ${g_multiplicator} => ${value}`);
    }
    g_multiplicator = value;
    $('#double_your_btc_payout_multiplier').val(value);
}

function reset_log_data() {
    startTime = new Date();
    startSerieBalance = getBalanceInSatoshi();
}

function get_number_of_iteration(previousBets) {
    const current_balance = getBalanceInSatoshi();
    var total = previousBets;
    var iteration = 0;
    var i_still_have_money = true;

    while (i_still_have_money) {
        total += computeBetAmount(total , 2, 1);

        if (total < current_balance) {
            iteration += 1;
        } else {
            i_still_have_money = false;
        }
    }

    return iteration;
}

function reset_game() {
    g_expected_profit = 1;
    g_martingal_idx = 0;
    g_reset_script = false;
    lots_of_loose_case = false;
    set_click_type('R');
    set_multiplicator(constBaseMultiplicator);
    reset_log_data();
    display_log();
    set_bet_value(0, g_multiplicator, g_expected_profit);
}

function handle_martingal(cons_lost_count, string) {
    g_martingal_idx += 1;

    let szTmp = `${buildPrefix()} | Lots of ${string} (${g_martingal_idx + consLooseTrigger}) | `;

    if (g_martingal_idx === 1) {
        gMartingaleStartBalance = getBalanceInSatoshi();
        gPreviousBets = Math.max(get_serie_lost(), minWagered);
        szTmp += `Serie profit = ${get_serie_profit()}`;
    }

    if (g_martingal_idx === 1) {
        g_expected_profit = 16;
        if (string === 'LO') {
            set_click_type('L');
        } else {
            set_click_type('H');
        }
    } else if (g_martingal_idx === 2) {
        set_click_type('R');
        g_expected_profit = 3;
    } else if (g_martingal_idx === 3) {
        set_click_type('R');
        g_expected_profit = 1;
        set_multiplicator(constSafeMultiplicator);
    } else if (g_martingal_idx === 6) {
        set_click_type('R');
        g_expected_profit = 1;
        set_multiplicator(const_ultra_safe_multiplicator);
    }

    const currentBet = set_bet_value(gPreviousBets, g_multiplicator, g_expected_profit);
    gPreviousBets += currentBet;

    const bet_limit = gMartingaleStartBalance / 3;
    if (currentBet >= bet_limit) {
        szTmp += ` | Current bet is too big ${currentBet} >= ${bet_limit} ... reset game ...`;
        g_reset_script = true;
    } else {
        szTmp += ` | Bet = ${currentBet}`;
    }

    console.log(szTmp);

    lots_of_loose_case = true;
}

function add_bet(click, outcome) {
    if (click === $loButton && outcome === "Win") {
        cons_lo_count = 0;

        if (last_click === $hiButton) {
            cons_hi_count += 1;
        }

        if (lots_of_loose_case) {
            reset_game();
        }
    }
    if(click === $loButton && outcome === "Loose") {
        if (last_click === $loButton) {
            cons_lo_count += 1;
        }
    }
    if(click === $hiButton && outcome === "Win") {
        cons_hi_count = 0;

        if (last_click === $loButton) {
            cons_lo_count += 1;
        }

        if (lots_of_loose_case) {
            reset_game();
        }
    }
    if(click === $hiButton && outcome === "Loose") {
        if (last_click === $hiButton) {
            cons_hi_count += 1;
        }
    }

    if (cons_lo_count >= consLooseTrigger) {
        handle_martingal(cons_lo_count, 'LO');
    } else if (cons_hi_count >= consLooseTrigger) {
        handle_martingal(cons_hi_count, 'HI');
    } else {
        set_click_type('R');
        set_bet_value(0, g_multiplicator, g_expected_profit);
    }

    if (g_reset_script) {
        reset_game()
    } else {
        click_button();
        last_click = click;
    }
}

//Trigger game start
function start_game() {
    startBalance = getBalanceInSatoshi();

    if (get_number_of_iteration(0) === 0) {
        console.log(`${buildPrefix()} | Cannot start game: not enough money ...`);
        return;
    }
    
    reset_game();
	click_button();
}

function set_bet_value(previousBets, multiplicator, expectedProfit) {
	const bet_value = computeBetAmount(previousBets, multiplicator, expectedProfit);
    const to_btc = bet_value / 100000000;

	$('#double_your_btc_stake').val(to_btc);

	return bet_value;
}

//Hack for smaller amounts of BTC
function de_exponentize(number) {
	return number * 100000000;
}

function getBalance() {
    return parseFloat($('#balance').text());
}

function getBalanceInSatoshi() {
    return de_exponentize(getBalance()).toFixed(0);
}

//Verify balance
function check_balance() {
	var balance = de_exponentize(parseFloat($('#balance').text()));
	var current = de_exponentize($('#double_your_btc_stake').val());

	return ((balance)*multiplicator/100) * (current*multiplicator) > stopPercentage/100;
}

function get_profit() {
    return getBalanceInSatoshi() - startBalance;
}

function get_serie_profit() {
    return getBalanceInSatoshi() - startSerieBalance;
}

function get_serie_lost() {
    const profit = get_serie_profit();
    if (profit < 0) {
        return profit * -1;
    }

    return 0;
}

function display_log() {
	var endTime = new Date();
  	var timeDiff = endTime - startTime; //in ms
  	// strip the ms
  	timeDiff /= 1000;

  	// get seconds
	const seconds = Math.round(timeDiff);
	let profit = get_profit();

	if (profit > 0) {
		profit = `+${profit}`;
    }

    console.log(`${buildPrefix()} | Balance = ${getBalanceInSatoshi()} (${profit}) | Wait = ${seconds}s`);
}

//Unbind old unused variables
$('#double_your_btc_bet_lose').unbind();
$('#double_your_btc_bet_win').unbind();

//Event: on loose
$('#double_your_btc_bet_lose').bind("DOMSubtreeModified", function(event) {
    if ($(event.currentTarget).is(':contains("lose")')) {
        let random_wait_range = [400, 600];
        if (cons_lo_count >= (consLooseTrigger + 2)) {
            random_wait_range = [1500, 2500];
        }

        if (cons_lo_count >= (consLooseTrigger + 4)) {
            random_wait_range = [2500, 3500];
        }

        let random_wait = getRandomInt(random_wait_range[0], random_wait_range[1]);

        setTimeout(function(){
            add_bet(g_current_click, "Loose");
        }, random_wait);
    }
});

//Event: on win
$('#double_your_btc_bet_win').bind("DOMSubtreeModified", function(event) {
    if ($(event.currentTarget).is(':contains("win")')) {
        setTimeout(function(){
            add_bet(g_current_click, "Win");
        }, get_random_wait());
    }
});

start_game();
