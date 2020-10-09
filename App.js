const discord = require('discord.js');
const { Readable } = require('stream');
const csv = require('csv');
const https = require('https');
const client = new discord.Client();
const contains = require('string-contains');

require('dotenv').config();
//contains json playerdata after !viewplayers
const _players = [];
//contains entire array of [log rows, hand no.] after !parselog
const _parsed = [];

const getPlayerDataFromLog = (rowstr) => {
    let player = {
        discord_name: '',
        game_name: '',
        id: '',
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
    if (msg.content === '!viewplayers') {
        let reply = '\n';
        if (_players.length != 0) {
            for (const x of _players) {
                let replyName = 'unassigned';
                if (x.discord_name !== '') {replyName = x.discord_name};
                reply += `@${replyName} is ${x.game_name} : ${x.id}\n`;
            }
        } else {
            reply += 'No log has been parsed yet\n';
        }
        msg.reply(reply);
    }
    if (msg.content.startsWith('!assignMeTo')) {
        let args = msg.content.slice('!assignMeTo'.length).trim().split(' ');
        assignPlayer(msg.author.tag,args[0])
    }
    if (msg.content === '!parselog') {
        if (msg.attachments.size > 0) {
            const stream = Readable.from(msg.attachments.first().attachment)
            const raw = [];
            stream.on('data', (filename) => {
                https.request(filename, res => {
                    res.on('data', chunk => {
                        raw.push(chunk)
                    });
                    res.on('end', () => {
                        csv.parse(raw.toString(), {headers: false, relax_column_count: true}, (err, data) => {
                            let reply = '\n';
                            let hand = 0;
                            let i;
                            for (i = data.length-1; i >= 0; i--) {
                                let row = data[i].toString();
                                _parsed.push([row,hand]);
                                if (contains(row,`joined the game`)) {
                                    getPlayerDataFromLog(row);
                                }
                                if (contains(row, `starting hand`)) {
                                    hand++;
                                }
                                if (contains(row, `Player stacks`)) {
                                    reply += `hand ${hand} : ${row}\n`;
                                }
                            }
                            if (_parsed.length === data.length) {
                                msg.reply(reply.slice(0,1900));
                            }
                        })
                    });
                }).end();
            })
        }
    }
});

client.login(process.env.LOGIN_TOKEN);