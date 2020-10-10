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

const initState = (row,hand) => {
    if (contains(row,`joined the game`)) {
        getPlayerData(row);
    }
    if (contains(row, `Player stacks`)) {
        updatePlayerChips(row)
    }
}

const updatePlayerChips = (row, hand) => {
    let re = new RegExp(/\d+.\d+/g);
    let results = row.match(re);
    let i = 0;
    //profit/loss track
    let current;
    let updated;
    for (i; i < _players.length; i++) {
        current = _players[i].current_stack;
        updated = parseFloat(results[i]);
        const diff = (updated - current);
        if (hand > 1) {
            let c = parseFloat(_players[i].net);
            _players[i].net = (c + diff);
        }
        console.log(`${_players[i].game_name} adjusting \$${diff}`);
        _players[i].current_stack = updated;
    }
}


const parseLog = (msg) => {
    const stream = Readable.from(msg.attachments.first().attachment);
    const raw = [];
    stream.on('data', (filename) => {
        https.request(filename, res => {
            res.on('data', chunk => {
                raw.push(chunk)
            });
            res.on('end', () => {
                csv.parse(raw.toString(), {headers: false, relax_column_count: true}, (err, data) => {
                    let hand = 0;
                    let i;
                    for (i = data.length-1; i >= 0; i--) {
                        let row = data[i].toString().split(`,`)[0];
                        _parsed.push([row,hand]);
                        if (contains(row, `starting hand`)) {
                            hand++;
                        }
                        initState(row,hand);
                    }
                    if (_parsed.length === data.length) {
                        msg.reply(`Successfully loaded data from \.csv`)
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
        net: 0.0,
        current_stack: 0
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

const displayHand = (hand) => {
    let reply = ``;
    for (const x of _parsed) {
        if (x[1] === hand) {
            reply += x[0] + '\n';
        }
    }
    console.log(`reply ${reply}`)
    return reply;
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (msg.content === '!viewplayers') {
        viewPlayers(msg);
    }
    if (msg.content === '!gethand') {
        let args = msg.content.slice('!gethand'.length).trim().split(' ');
        let hand = parseInt(args[0]);
        let reply = displayHand(hand);
        console.log(reply);
        msg.reply(reply)
    }
    if (msg.content.startsWith('!setname')) {
        let args = msg.content.slice('!setname'.length).trim().split(' ');
        assignPlayer(msg.author.tag,args[0])
        msg.reply(`Assigned ${msg.author.tag.match(/.+(?=#)/)} to ${args[0]} if it exists.`)
    }
    if (msg.content === '!parselog') {
        if (msg.attachments.size > 0) {
            parseLog(msg);
        }
    }
});

client.login(process.env.LOGIN_TOKEN);