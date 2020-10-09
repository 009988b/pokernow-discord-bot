const discord = require('discord.js');
const { Readable } = require('stream');
const csv = require('csv');
const https = require('https');
const client = new discord.Client();

const parsed_data = [];

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
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
                            let reply = '*RESULTS:*\n';
                            let count = 0;
                            let i;
                            for (i = data.length-1; i >= 0; i--) {
                                //Do stuff here
                                let row = data[i];
                                reply += row[0] + '\n';
                                parsed_data.push(row[0]);
                                console.log(row[0]);
                            }
                            if (parsed_data.length === data.length) {
                                msg.reply(reply.slice(0,1900));
                            }
                        })
                    });
                }).end();
            })
        }
    }
});

client.login('NzYzOTE5NTYxMDUyMzg5Mzc3.X3-tiA.pPRNqzykIn1IJMY0QPQlJy42TG4');