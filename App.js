const discord = require('discord.js');
const { Readable } = require('stream');
const csv = require('csv');
const https = require('https');
const client = new discord.Client();
const contains = require('string-contains');

require('dotenv').config();
//contains json playerdata after !viewplayers
const _players = [];
//contains entire array of [log rows, hand no.] after parseLog() is called
const _parsed = [];

const totalHands = [-1];

const updatePlayerChips = (row, hand, startBal) => {
    let re = new RegExp(/\d+.\d+/g);
    let results = row.match(re);
    let i = 0;
    //profit/loss track
    let current;
    let updated;
    for (i; i < _players.length; i++) {
        if (hand > 0) {
            console.log(`hand: ${hand} player name: ${_players[i].game_name}\n` + _players[i].net[hand-2])
            current = _players[i].current_stack[hand-1] || startBal;
            updated = parseFloat(results[i]);
            const diff = (updated - current);
            let c = _players[i].net[hand-1];
            if (c === undefined || c === NaN) {
                //console.log((`no c so push ${0+diff}`))
                _players[i].net.push((diff));
            } else {
                console.log((`c = ${c.toFixed(2)} so push ${diff.toFixed(2)}`))
                _players[i].net.push((diff));
            }
            _players[i].current_stack.push(updated);
        }
    }
}

const parseLog = (msg, startBal) => {
    const stream = Readable.from(msg.attachments.first().attachment);
    const raw = [];
    stream.on('data', (filename) => {
        https.request(filename, res => {
            res.on('data', chunk => {
                raw.push(chunk)
            });
            res.on('end', () => {
                csv.parse(raw.toString(), {headers: false, relax_column_count: true}, (err, data) => {
                    let hand = -1;
                    totalHands.push(0);
                    let i;
                    for (i = data.length-1; i >= 0; i--) {
                        let row = data[i].toString().split(`,`)[0];
                        _parsed.push([row,hand]);
                        if (contains(row, `starting hand`)) {
                            hand++;
                            totalHands[0]++;
                        }
                        if (contains(row,`joined the game`)) {
                            getPlayerData(row);
                        }
                        if (contains(row, `Player stacks`)) {
                            updatePlayerChips(row,hand,startBal)
                        }
                    }
                    if (_parsed.length === data.length) {
                        msg.reply(`Successfully loaded data from \.csv\nParsed size: ${_parsed.length}\nHands played: ${totalHands[0]}`)
                    }
                })
            });
        }).end();
    })
}

const getPlayerData = (rowstr) => {
    let player = {
        discord_name: '',
        game_name: '',
        id: '',
        net: [],
        current_stack: []
    };
    //called when player joins game
    let id_re = new RegExp(/@(.*)"/);
    let name_re = new RegExp(/"(.*)@/);
    let id = rowstr.match(id_re)[1];
    let name = rowstr.match(name_re)[1];
    player.game_name = name;
    player.id = id;
    const exists = _players.find(e => (e.game_name === name));
    if (exists === undefined) {
        _players.push(player);
        console.log(`ADD PLAYER ${player.game_name}\n`);
    }
}

const viewPlayers = (msg) => {
    let reply = '\n';
    if (_players.length != 0) {
        for (const x of _players) {
            let replyName = 'unassigned';
            if (x.discord_name !== '') {replyName = x.discord_name.match(/.+(?=#)/)};
            reply += `@${replyName} is ${x.game_name} : ${x.id}\n`;
        }
    } else {
        reply += 'No log has been parsed yet\n';
    }
    msg.reply(reply);
}

const assignPlayer = (authortag, ig_name) => {
    let found = undefined;
    for (const x of _players) {
        if (contains(x.game_name, ig_name)) {
            found = x;
        }
    }
    if (found !== undefined) {
        const idx = _players.indexOf(found);
        let updated = {
            discord_name: authortag,
            game_name: found.game_name,
            id: found.id,
            net: found.net,
            current_stack: found.current_stack
        }
        let i = 0;
        for (i; i < _players.length; i++) {
            if (i === idx) {
                _players[i] = updated;
                console.log(`UPDATED ${ig_name.toUpperCase()} AT INDEX: ${idx}`)
            }
        }
    } else {
        console.error(`Could not find player: ${ig_name}`)
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (msg.content === '!getplayers') {
        viewPlayers(msg);
    }
    if (msg.content.startsWith('!ledger')) {
        let args = msg.content.slice('!ledger'.length).trim().split(' ');
        let hand = parseInt(args[0]);
        let reply = `\n**=== LEDGER - HAND ${hand} ===**\n`;
        for (const p of _players) {
            let net = p.net[hand-1];
            let chips = p.current_stack[hand-1];
            reply += `> ${p.game_name}:\nchips: ${chips.toFixed(2)}\nwinnings: ${net.toFixed(2)}\n`;
        }
        msg.reply(reply);
    }
    if (msg.content.startsWith('!gethand')) {
        console.log(`Parsed size: ${_parsed.length}`);
        let args = msg.content.slice('!gethand'.length).trim().split(' ');
        let hand = parseInt(args[0]);
        let reply = ``;
        for (const row of _parsed) {
            if (row[1] === hand) {
                reply += row[0] + '\n';
            }
        }
        msg.reply(reply)
    }
    if (msg.content.startsWith('!setname')) {
        let args = msg.content.slice('!setname'.length).trim().split(' ');
        assignPlayer(msg.author.tag,args[0])
        msg.reply(`Assigned ${msg.author.tag.match(/.+(?=#)/)} to ${args[0]} if it exists.`)
    }
    if (msg.content.startsWith('!parselog')) {
        let args = msg.content.slice('!parselog'.length).trim().split(' ');
        let startBal = parseInt(args[0])
        console.log(`startingBalance: ` + startBal)
        if (msg.attachments.size > 0) {
            parseLog(msg, startBal);
        }
    }
});

client.login(process.env.LOGIN_TOKEN);