const moment = require('moment');
const Discord = require('discord.js');
const databaseUtils = require('./database');

let utils, manager, db, activeGames;

const init = (u, m, d, a) => {
    utils = u;
    manager = m;
    db = d;
    activeGames = a;
}

// Helper functions
async function controlMessage(channel, game) {
    // Purge control panel
    const messages = await channel.messages.fetch({limit: 100});
    channel.bulkDelete(messages);

    // Send control message
    const embed = new Discord.MessageEmbed().setTitle(game.name);
    const message = await channel.send(embed);
    game.controlMessage = message;
}

// Export
module.exports = {
    init,
    create: async function(bot, msg, mentions, parts, game) {
        // Start a game if none is active in this channel
        if (game) { //Game already exists in this channel
            // Do nothing because Lumi is forcing me not to send DMs
        } else { // No game exist right now, go ahead and create
            if (parts.length < 2) {
                return msg.reply('please specify a game name!');
            }

            const firstSpace = msg.content.indexOf(' ');
            const gameName = msg.content.slice(firstSpace+1);
            const gamePrefix = utils.parseGameName(gameName);

            console.log(`~ Creating "${gameName}" in #${gamePrefix}:`);

            const channels = await manager.initializeChannels(msg.guild, msg.channel.parent, gamePrefix, bot);

            var newGame = {
                type: "Mafia",
                gm: msg.author.id,
                server: msg.guild.id,
                channel: channels.primaryChannel.id,
                channels: {
                    controlChannel: channels.controlChannel.id,
                    infoBoard: channels.infoBoard.id,
                    scumChats: channels.scumChats.map(channel => channel.id),
                    nightTalk: channels.nightTalk.map(channel => channel.id),
                    deadChat: channels.deadChat.id
                },
                name: gameName,
                currentMessage: null,
                controlMessage: null,
                cache: {
                    playerRole: null,
                    gmRole: null
                },
                lengthOfDays: 36000,
                timeLeft: moment().add(30, 'seconds'),
                day: 0,
                night: false,
                players: [],
                votes: []
            };

            // Create player role
            msg.guild.roles.create({
                data: {name: `${gamePrefix}-player`, permissions: new Discord.Permissions(104188992)},
                reason: `For the game started by ${msg.author.username}` 
            }).then((playerRole) => {
                // Give player role the proper permissions
                newGame.cache.playerRole = playerRole;
                channels.primaryChannel.updateOverwrite(playerRole, {
                    SEND_MESSAGES: true
                }).catch(console.error);

                // Create the GM role
                msg.guild.roles.create({
                    data: {name: `${gamePrefix}-gm`, permissions: new Discord.Permissions(104188992)},
                    reason: `For the game started by ${msg.author.username}`
                }).then(async (gmRole) => {
                    // Give GM role proper permissions
                    newGame.cache.gmRole = gmRole;
                    channels.controlChannel.updateOverwrite(gmRole, {
                        VIEW_CHANNEL: true
                    }).catch(console.error);
                    channels.infoBoard.updateOverwrite(gmRole, {
                        SEND_MESSAGES: true
                    }).catch(console.error);
                    channels.primaryChannel.updateOverwrite(gmRole, {
                        SEND_MESSAGES: true
                    }).catch(console.error);
                    channels.scumChats.forEach(channel => {
                        console.log(channel.name);
                        channel.updateOverwrite(gmRole, {
                            VIEW_CHANNEL: true,
                            SEND_MESSAGES: true
                        });
                    });
                    channels.nightTalk.forEach(channel => {
                        channel.updateOverwrite(gmRole, {
                            VIEW_CHANNEL: true,
                            SEND_MESSAGES: true
                        });
                    });
                    channels.deadChat.updateOverwrite(gmRole, {
                        VIEW_CHANNEL: true
                    });
    
                    // Add GM role to GM
                    msg.member.roles.add(gmRole);
                    msg.guild.member(bot.user).roles.add(gmRole);

                    // Create control message
                    await controlMessage(channels.controlChannel, newGame);

                    // Let everyone know
                    msg.channel.send(new Discord.MessageEmbed().setDescription(`**SIGNUPS FOR MAFIA HAVE BEGUN!**\nReact with 👍 to join this fun game!`).addField('Status', 'Signups in progress!')).then(message => {
                        message.react('👍');
                        
                        newGame.currentMessage = message;
                        const serializedGame = databaseUtils.serializeGame(newGame);
                        console.log(serializedGame);
                    
                        // TODO: Insertion should happen before successful message.
                        // NOTE: Since it looks like currentMessage needs to be set, perhaps delete the message on insertion failure instead
                        db.insertOne(serializedGame).then((result) => {
                            console.log('Game has successfully been created!');
                            newGame._id = result.ops[0]._id;
                            activeGames.push(newGame);
                        }).catch((err) => {
                            console.log("CRITICAL ERROR IN INSERTION!");
                            console.log(err);
                        });
                    });
                }).catch((reason) => {
                    msg.reply(new Discord.MessageEmbed().setTitle('ERROR: Couldn\'t create GM role!').setDescription('Sorry, I was unable to start the game due to an internal error. I was unable to create the GM role. Please kindly ask the server admin(s) if I have the proper permissions to create roles, pretty please?').setColor('#FF0000'));
                    console.log(reason);
                });
            }).catch((reason) => {
                msg.reply(new Discord.MessageEmbed().setTitle('ERROR: Couldn\'t create player role!').setDescription('Sorry, I was unable to start the game due to an internal error. I was unable to create the player role. Please kindly ask the server admin(s) if I have the proper permissions to create roles, pretty please?').setColor('#FF0000'));
                console.log(reason);
            });
        }
    },
    controlpanel: async function(bot, msg, mentions, parts, game) {
        if (game && msg.channel.id == game.channels.controlChannel) {
            controlMessage(msg.channel, game);
        }
    }
};