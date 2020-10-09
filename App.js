const discord = require('discord.js');
const { Readable } = require('stream');
const csv = require('csv');
const https = require('https');
const client = new discord.Client();
const contains = require('string-contains');

require('dotenv').config();

const _players = [];

const _parsed = [];

const assignPlayer = (authortag, ig_name, str) => {
    let player = {
        discord_name: authortag,
        game_name: '',
        id: '',
        current_stack: 0
    };
    //Function called when player joined the game in log
    let id_re = new RegExp(/@(.*)"/);
    let name_re = new RegExp(/"(.*)@/);
    let id = str.match(id_re)[1];
    let name = str.match(name_re)[1];
    player.game_name = name;
    player.id = id;
    if (!_players.includes(player)) {
        _players.push(player);
    }
    console.log(player);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (msg.content === '!viewplayers') {
        let reply = '\n';
        if (_players.length != 0) {
            for (const x of _players) {
                reply += `@${x.discord_name.match(/(.*)#/)[1]} is ${x.game_name} in the game. (${x.id}) \n`;
            }
        } else {
            reply += 'No log has been parsed yet\n';
        }
        msg.reply(reply);
    }
    if (msg.content.startsWith('!assignMeTo')) {
        let args = msg.content.slice('!assignMeTo'.length).trim().split(' ');
        assignPlayer(msg.author.tag,args[0],)
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
                            let i;
                            for (i = data.length-1; i >= 0; i--) {
                                let row = data[i].toString();
                                reply += row + '\n';
                                _parsed.push(row);
                                assignPlayer('','',row);
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