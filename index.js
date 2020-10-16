/// Developed by Trenton Pottruff
/// Base skeleton code by Lumpy

const dotenv = require('dotenv');
dotenv.config();

// DISCORD SETUP
const Discord = require('discord.js');
const bot = new Discord.Client();

// MOMENT SETUP
const moment = require('moment');

// MONGODB SETUP
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const assert = require('assert');
const db_url = `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@ds${process.env.DB_NUMBER}.mlab.com:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const db_name = process.env.DB_NAME;
var db;
var db_col_games;

// MISC
const token = process.env.TOKEN;
const prefix = "/";
var ready = false;

// CUSTOM MODULES
const databaseUtils = require('./database');
const utils = require('./utils');
const manager = require('./manager');
const reactionCollection = require('./collections/reactionCollection');

//Game variables
var activeGames = [];

bot.on('message', async msg=>{
    if (ready) {
        //Log message
        if (gameExists(msg.guild.id, msg.channel.id) > 1) {
            console.log(`(${msg.guild.name})[#${msg.channel.name}] ${msg.author.tag}: ${msg.content}`);
        }

        //Handle message
        if(msg.content.startsWith(prefix)) { // Commandsa
            var parts = msg.content.split(' ');
            var mentions = msg.mentions.users.array();
            var command = parts[0].replace(prefix, "").toLowerCase();
            var gameIndex = gameExists(msg.guild.id, msg.channel.id);
            var game = activeGames[gameIndex];

            //TODO: Turn into a switch statement so I am not YandereDev, maybe an object and called commands[commandName]
            if (command == 'create') {
                //Start a game if none is active in this channel
                if (gameIndex >= 0) { //Game already exists in this channel
                    //Do nothing because Lumi is forcing me not to send DMs
                } else { //No game exist right now, go ahead and create
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

                    //Create player role
                    msg.guild.roles.create({
                        data: {name: `${gamePrefix}-player`, permissions: new Discord.Permissions(104188992)},
                        reason: `For the game started by ${msg.author.username}` 
                    }).then((playerRole) => {
                        //Give player role the proper permissions
                        newGame.cache.playerRole = playerRole;
                        channels.primaryChannel.updateOverwrite(playerRole, {
                            SEND_MESSAGES: true
                        }).catch(console.error);

                        //Create the GM role
                        msg.guild.roles.create({
                            data: {name: `${gamePrefix}-gm`, permissions: new Discord.Permissions(104188992)},
                            reason: `For the game started by ${msg.author.username}`
                        }).then((gmRole) => {
                            //Give GM role proper permissions
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
            
                            //Add GM role to GM
                            msg.member.roles.add(gmRole);
                            msg.guild.member(bot.user).roles.add(gmRole);
                            
                            //Let everyone know
                            msg.channel.send(new Discord.MessageEmbed().setDescription(`**SIGNUPS FOR MAFIA HAVE BEGUN!**\nReact with 👍 to join this fun game!`).addField('Status', 'Signups in progress!')).then(message => {
                                message.react('👍');
                                
                                newGame.currentMessage = message;
                                const serializedGame = databaseUtils.serializeGame(newGame);
                                console.log(serializedGame);
                            
                                db_col_games.insertOne(serializedGame).then((result) => {
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
            } else if (command == 'lynch') {
                //Vote to lynch a player if available
                if (gameIndex >= 0) {
                    // Check to make sure that a mention occurs
                    if (mentions.length > 0) {
                        // Make sure the game isn't in night phase and that it's actually started
                        if (!game.night && game.day > 0) {
                            if (mentions[0].id == bot.user.id) {
                                return msg.reply("stop trying to lynch me :eyes: I will genuinely end you...");
                            }

                            const lynchee = msg.guild.member(mentions[0]);
                            var existingVote = game.votes.findIndex(vote => vote.lyncher == msg.author.id);
                            if (existingVote < 0) {
                                game.votes.push({
                                    lyncher: msg.author.id,
                                    lynchee: lynchee.id
                                });
                                db_col_games.updateOne({_id: game._id}, {$set: {votes: game.votes}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                                lynchTally(msg.channel, game);
                            } else if (existingVote >= 0 && game.votes[existingVote].lynchee != lynchee.id) {
                                game.votes[existingVote].lynchee = lynchee.id;
                                db_col_games.updateOne({_id: game._id}, {$set: {votes: game.votes}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                                lynchTally(msg.channel, game);
                            }
                        }
                    } else {
                        msg.reply(`please @mention the person you are trying to lynch in your command!`);
                    }
                } else {
                    console.log(`~ ${msg.author.username} is trying to lynch in the wrong channel.`);
                }
            } else if (command == 'unlynch') {
                //Vote to unlynch a player if a vote has been cast
                if (gameIndex >= 0) {
                    if (!game.night) {
                        var existingVote = game.votes.findIndex(vote => vote.lyncher == msg.author.id);
                        if (existingVote >= 0) {
                            game.votes.splice(existingVote, 1);
                            db_col_games.updateOne({_id: game._id}, {$set: {votes: game.votes}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                            lynchTally(msg.channel, game);
                        }
                    }
                } else {
                    console.log(`~ ${msg.author.username} is trying to lynch in the wrong channel.`);
                }
            } else if (command == 'playerlist') {
                //List all of the player; format to game
                if (gameIndex >= 0) {
                    activeGames[gameIndex].players.sort((a, b) => {
                        if (a.alive && !b.alive) return -1;
                        else if (!a.alive && b.alive) return 1;
                        else return 0;
                    });
                    var liststring = 'Player\'s currently alive:\n';
                    var deadStrike = (dead) => (dead) ? '' : '~~';
                    for (var i = 0; i < activeGames[gameIndex].players.length; i++) {
                        liststring += `${deadStrike(activeGames[gameIndex].players[i].alive)}${activeGames[gameIndex].players[i].name}${deadStrike(activeGames[gameIndex].players[i].alive)}\n`;
                    }
                    msg.channel.send(liststring);
                }
            } else if (command == 'forcestop') {
                if (gameIndex >= 0 && msg.channel.id == game.channels.controlChannel) { //Ensure a game is running here
                    forceStop(msg, game, gameIndex, false);
                }
            } else if (command == 'delete') {
                if (gameIndex >= 0 && msg.channel.id == game.channels.controlChannel) { //Ensure a game is running here
                    forceStop(msg, game, gameIndex, true);
                } else {
                    console.log(`${msg.channel.id} == ${game.channels.controlChannel}`);
                }
            } else if (command == 'tally' || command == 'lynchtally') {
                if (gameIndex >= 0) {
                    lynchTally(msg.channel, game);
                }
            } else if (command == 'next') {
                if (game) {
                    if (msg.guild.member(msg.author).roles.cache.get(game.cache.gmRole.id) && game.day > 0) { //User is GM
                        manager.nextPhase(msg.channel, prefix, game, bot);
                        db_col_games.updateOne({_id: game._id}, {$set: {day: game.day, night: game.night, timeLeft: game.timeLeft.toDate()}}).then(result => console.log('~ Successfully updated day in DB!')).catch(console.error);
                    } else {
                        console.log(msg.guild.member(msg.author).roles.cache.get(game.cache.gmRole));
                        console.log(game.day);
                    }
                }
            } else if (command == 'start') {
                if (game) {
                    if (msg.channel.id == game.channels.controlChannel && msg.author.id == game.gm && game.day < 1) {
                        //Inform that signups have ended
                        game.currentMessage.edit(new Discord.MessageEmbed()
                            .setDescription(`**A GAME OF MAFIA HAS BEGUN!**\nReact with 👍 to join this fun game!`)
                            .addField('Status', `This game is in progress!`));
                        //Start the game
                        var channel = bot.guilds.resolve(game.server).channels.resolve(game.channel);
                        game.day = 1;
                        channel.send(`**The game has begun! You have ${game.lengthOfDays} seconds to chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.\n*${utils.votesToLynch(game)} votes needed to hammer.*`).catch(console.error);
                        db_col_games.updateOne({_id: game._id}, {$set: {day: game.day}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                    }
                }
            } else if (command == 'assign') {
                if (game && msg.channel.id == game.channels.controlChannel) {
                    if (game.day < 1) {
                        if (parts.length > 1) {
                            switch (parts[1]) {
                                case 'scum':
                                    const prompt = new Discord.MessageEmbed().setDescription('Please react for which users you\'d like to assign as scum.\nReact with ❌ when you\'re done');

                                    for (let index = 0; index < game.players.length; index++) {
                                        const player = game.players[index];
                                        prompt.addField(player.name, reactionCollection.getReaction(index));
                                    }

                                    const getScumList = () => {
                                        let list = '';
                                        for (let index = 0; index < game.players.length; index++) {
                                            const player = game.players[index];
                                            if (player.scum) {
                                                list += `${(index > 0) ? '\n' : ''}${player.name}`;
                                            }
                                        }
                                        return list;
                                    };

                                    msg.channel.send(`Current scum:\n${getScumList()}`, prompt).then(promptMsg => {
                                        // Add reactions for each player
                                        for (let index = 0; index < game.players.length; index++) {
                                            const player = game.players[index];
                                            const reaction = reactionCollection.getReaction(index);
                                            promptMsg.react(reaction);
                                        }
                                        promptMsg.react('❌');

                                        const scumCollector = promptMsg.createReactionCollector((reaction, user) => {
                                            return !user.bot;
                                        }, {time: 60000});

                                        scumCollector.on('collect', (reaction, user) => {
                                            if (reaction.emoji.name == '❌') {
                                                return scumCollector.stop('Stop reaction given');
                                            }

                                            // Find and assign
                                            const playerNum = reactionCollection.fetchIndex(reaction.emoji.name);
                                            if (playerNum < game.players.length) {
                                                const player = game.players[playerNum];
                                                player.scum = true;
                                                msg.guild.channels.resolve(game.channels.scumChats[0]).updateOverwrite(player.id, {
                                                    VIEW_CHANNEL: true
                                                }).then(() => {
                                                    console.log(`${player.name} is now scum!`);
                                                }).catch(console.error);
                                                promptMsg.edit(`Current scum:\n${getScumList()}`);
                                                db_col_games.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                                            }
                                        });

                                        scumCollector.on('end', (collected, reason) => {
                                            prompt.setDescription('Scum assignment completed.');
                                            prompt.fields = [];
                                            promptMsg.edit(`Current scum:\n${getScumList()}`, prompt);
                                            promptMsg.reactions.removeAll();
                                        });
                                    }).catch(console.error);
                                    break;
                                default:
                                    console.log('Not a valid assignment...');
                            }
                        }
                    }
                }
            } else if (command == 'kill') {
                if (game) {
                    //Make sure the person calling this is the GM && 
                    if (msg.author.id == game.gm) {
                        //Player to kill must be @ mentioned
                        if (mentions.length > 0) {
                            //TODO: Make sure the player is actually in the game before killing
                            const playerToKill = msg.guild.member(mentions[0]);
                            manager.killPlayer(game, playerToKill.id, db_col_games, msg.guild);
                            
                            //Make an announcement
                            msg.guild.channels.resolve(game.channel).send(`**${playerToKill.displayName} has been killed!**`)
                        } else {
                            msg.channel.send(`You must @ mention the person you are trying to kill! Like so: /kill ${msg.author}`);
                        }
                    }
                }
            } else if (command == 'resetgmperms' && msg.author.id == '98917980645109760') {
                const ctrlChan = msg.guild.channels.resolve(game.channels.controlChannel);
                const info = msg.guild.channels.resolve(game.channels.infoBoard);
                const dead = msg.guild.channels.resolve(game.channels.deadChat);

                ctrlChan.updateOverwrite(game.cache.gmRole, {
                    VIEW_CHANNEL: true,
                    SEND_MESSAGES: true
                }).then(value => {
                    console.log(value);
                    msg.channel.send(`Reset perms in ${value}`);
                }).catch(console.error);

                info.updateOverwrite(game.cache.gmRole, {
                    VIEW_CHANNEL: true,
                    SEND_MESSAGES: true
                }).then(value => {
                    console.log(value);
                    msg.channel.send(`Reset perms in ${value}`);
                }).catch(console.error);

                dead.updateOverwrite(game.cache.gmRole, {
                    VIEW_CHANNEL: true,
                    SEND_MESSAGES: true
                }).then(value => {
                    console.log(value);
                    msg.channel.send(`Reset perms in ${value}`);
                }).catch(console.error);
            } else if (command == 'allowchat') {
                if (game && msg.channel.id == game.channels.controlChannel) { //Ensure a game is running here
                    const chan = msg.guild.channels.resolve(game.channel);
                    chan.updateOverwrite(game.cache.playerRole, {
                        SEND_MESSAGES: true
                    }).then(val => msg.reply('player chatting enabled')).catch(console.error);
                }
            } else if (command == 'denychat') {
                if (game && msg.channel.id == game.channels.controlChannel) { //Ensure a game is running here
                    const chan = msg.guild.channels.resolve(game.channel);
                    chan.updateOverwrite(game.cache.playerRole, {
                        SEND_MESSAGES: false
                    }).then(val => msg.reply('player chatting disabled')).catch(console.error);
                }
            } else if (command == 'clearscum') {
                if (game && msg.channel.id == game.channels.controlChannel) {
                    if (game.day < 1) {
                        game.players.forEach(player => {
                            player.scum = false;
                        });
                        db_col_games.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => {
                            console.log('~ Successfully updated players in DB!');
                            msg.reply('scum assignments have been cleared!');
                        }).catch(console.error);
                    }
                }
            } else if (command == 'scumchat') {
                if (game && msg.channel.id == game.channels.controlChannel && parts.length > 1) {
                    if (parts[1] == 'remove' || parts[1] == 'delete') {
                        if (game.channels.scumChats.length > 0) {
                            const chatNum = game.channels.scumChats.length;
                            const scumchan = msg.guild.channels.resolve(game.channels.scumChats[chatNum - 1]);
                            scumchan.delete('GM wanted the channel deleted.').then(() => {
                                db_col_games.updateOne({_id: game._id}, {$set: {channels: game.channels}}).then(() => {
                                    msg.reply(`Scum Chat #${chatNum} deleted!`);
                                }).catch(console.error);
                            }).catch((reason) => {
                                msg.reply(`An error has occured: \`\`\`${reason}\`\`\``);
                            });
                        } else {
                            msg.reply('sorry no scum chats currently exist');
                        }
                    }
                }
            } 
        }

        
    }
});

bot.on('messageReactionAdd', async (messageReaction, user) => {
    if (!user.bot && messageReaction._emoji.name == '👍') {
        const game = matchSignupMessage(messageReaction.message);
        if (game) {
            if (game.day > 0) { //Game is already in progress
                //msg.reply('the game you are trying to join is already in progress...');
            } else { //Game is in signup phase
                var player = {
                    id: user.id,
                    name: messageReaction.message.guild.member(user).displayName,
                    alive: true,
                    scum: false
                };
                //Make sure user isn't already playing and that they aren't the GM
                if (!game.players.find(player => player.id == user.id) && game.gm != user.id) {
                    
                    messageReaction.message.guild.member(user).roles.add(game.cache.playerRole).then(user => {
                        game.players.push(player);
                        messageReaction.message.channel.send(`${user.toString()} has joined the game!`);
                        db_col_games.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                    }).catch(console.error);
                } else {
                    console.log(`~ ${user.username} can't join either because they are already in or they are the GM!`);
                }
            }
        } else {
            console.error('~ Unable to find game linked with message');
        }
    } else if (user.id == '98917980645109760' && messageReaction._emoji.name == '⚙️') {
        const game = matchSignupMessage(messageReaction.message);
        if (game) {
            if (!game.players.find(player => player.id == user.id) && game.gm != user.id) {
                messageReaction.message.guild.member(user).roles.add(game.cache.gmRole).then(user => {
                    messageReaction.message.guild.channels.resolve(game.channels.controlChannel).send(`${user.displayName} has been given the GM role. Don't worry they are a developer on Game Master and are only here to make sure I don't break. They can't play the game.`);
                });
            }
        }
    }
});

bot.on('messageReactionRemove', async (messageReaction, user) => {
    if (!user.bot && messageReaction._emoji.name == '👍') {
        const game = matchSignupMessage(messageReaction.message);
        if (game) {
            if (game.day > 0) { //Game is already in progress
                //msg.reply('the game you are trying to join is already in progress...');
            } else { //Game is in signup phase
                var player = {
                    id: user.id,
                    name: messageReaction.message.guild.member(user).displayName,
                    alive: true,
                    scum: false
                };
                //Make sure the player is playing
                if (game.players.find(player => player.id == user.id)) {
                    messageReaction.message.guild.member(user).roles.remove(game.cache.playerRole).then(user => {
                        game.players.splice(game.players.findIndex(p => player.id == p.id), 1);
                        messageReaction.message.channel.send(`${user.toString()}, you have left the game!`);
                        db_col_games.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                    }).catch(console.error);
                }
            }
        } else {
            console.error('~ Unable to find game linked with message');
        }
    }
});

//Commands
function forceStop(msg, game, gameIndex, deleteChannels) {
    if (game.gm == msg.author.id) { //User is gm
        endGame(gameIndex, deleteChannels).then(value => {
            if (value) {
                console.log('The game has been forcibly terminated.');
            } else {
                msg.reply('the game could not be stopped. Please contact someone for support.');
            }
        }).catch(console.error);
    } else { //Not GM
        console.log(`${msg.author.username} wants to illegally stop a game`);
    }
}

//Helper functions
async function endGame(gameIndex, deleteChannels) {
    var game = activeGames[gameIndex];
    var server = bot.guilds.resolve(game.server);
    var channel = server.channels.resolve(game.channel);
    var playerRole = game.cache.playerRole;
    var gmRole = game.cache.gmRole;

    var success = false;

    //Finally remove game from active
    await db_col_games.deleteOne({_id: game._id}).then(result => {
        try {
            if (result.deletedCount > 0) {
                //Remove roles
                for (var i = 0; i < game.players.length; i++) {
                    server.member(game.players[i].id).roles.remove(playerRole);

                    if (game.players[i] == game.gm) //Remove GM
                        server.member(game.players[i]).roles.remove(gmRole);
                }

                //Reset perms
                channel.permissionOverwrites.forEach((value, key) => {
                    try {
                        if (key == playerRole.id || key == gmRole.id) {
                            console.log(`Removing role '${(key == playerRole.id) ? playerRole.name : gmRole.name}' from #${channel.name}`);
                            channel.permissionOverwrites.delete(key);
                        }
                    } catch (err2) {
                        console.error(err2);
                    } 
                });

                //Delete game roles
                game.cache.playerRole.delete('Game ended');
                game.cache.gmRole.delete('Game ended');

                activeGames.splice(gameIndex, 1);

                //Delete channels if applicable
                if (deleteChannels) {
                    channel.delete(`GM wanted game to be deleted.`);
                    server.channels.resolve(game.channels.infoBoard).delete();
                    server.channels.resolve(game.channels.deadChat).delete();
                    game.channels.scumChats.forEach(channel => {
                        server.channels.resolve(channel).delete();
                    });
                    game.channels.nightTalk.forEach(channel => {
                        server.channels.resolve(channel).delete();
                    });
                    server.channels.resolve(game.channels.controlChannel).delete();
                }

                success = true;
            }
        } catch (err) {
            console.error(err);
        }
    }).catch(console.error);

    return success;
}

function gameExists(serverID, channelID) {
    return activeGames.findIndex(game => (game.channel === channelID.toString()) || (game.channels.controlChannel === channelID.toString()));
}

function formatMinutes(minutes) {
    return `${(minutes < 1) ? "Less than " : ""}${(minutes < 1) ? 1 : minutes} minute${(minutes > 1) ? "s" : ""}`;
}

function matchSignupMessage(message) {
    return activeGames.find(game => game.currentMessage == message);
}

function lynchTally(channel, game) {
    var hammerNumber = utils.votesToLynch(game);
    var output = `Current tally (${hammerNumber} to hammer):`;
    var votes = new Map();
    game.votes.forEach(vote => {
        const lyncherName = game.players.find(player => player.id == vote.lyncher);
        const lyncheeName = game.players.find(player => player.id == vote.lynchee);

        var obj = (votes.has(lyncheeName)) ? votes.get(lyncheeName) : [];
        obj.push(lyncherName);
        votes.set(lyncheeName, obj);
    });
    var hammered;
    votes.forEach((vote, key) => {
        if (vote.length >= hammerNumber) {
            hammered = key;
            manager.killPlayer(game, key.id, db_col_games, channel.guild);
            return '';
        }

        var lynchers = '';
        for (var i = 0; i < vote.length; i++) {
            if (i > 0) lynchers += ', ';
            lynchers += vote[i].name;
        }
        output += `\n${key.name} (${vote.length}) - ${lynchers}`;
    });
    if (hammered) {
        channel.send(`${hammered.name} has been lynched!`);
        manager.nextPhase(channel, prefix, game, bot);
        db_col_games.updateOne({_id: game._id}, {$set: {day: game.day, night: game.night, timeLeft: game.timeLeft.toDate()}}).then(result => console.log('~ Successfully updated day in DB!')).catch(console.error);
    } else { 
        channel.send(output);
    }
}

// Game loop
const gameLoop = setInterval(() => {
    //Tick
    for (var i = 0; i < activeGames.length; i++) {
        var game = activeGames[i];
        var server = bot.guilds.resolve(activeGames[i].server);
        var channel = server.channels.resolve(activeGames[i].channel);
        const timeLeft = moment(game.timeLeft).diff(moment(), 'seconds');
        
        //Check for signup period
        if (game.day < 1 && timeLeft % 60 === 0) {
            if (activeGames[i].currentMessage) {
                activeGames[i].currentMessage.edit(new Discord.MessageEmbed()
                    .setDescription(`**A GAME OF MAFIA HAS BEGUN!**\nReact with 👍 to join this fun game!`)
                    .addField('Time Left', formatMinutes(timeLeft / 60 - 1)));
            }
        }

        //Game logic
        /*if (timeLeft <= 0) { //Proceed with game logic
            game.timeLeft = moment().add(game.lengthOfDays, 'seconds');
            
            if (game.type == "Mafia") {
                if (game.day > 0) { //In game
                    manager.nextPhase(channel, prefix, game, bot);
                    db_col_games.updateOne({_id: game._id}, {$set: {day: game.day, night: game.night, timeLeft: game.timeLeft.toDate()}}).then(result => console.log('~ Successfully updated day in DB!')).catch(console.error);
                }
            }
        }*/
    }
}, 1000);
gameLoop.unref();

// FINAL: START BOT PROCESSES
//Log in the bot
bot.login(token).then((value) => {
    console.log("~ Game Master is now online!");
    MongoClient.connect(db_url, {useUnifiedTopology: true}, async (err, client) => {
        try {
            assert.equal(null, err);
            console.log('~ DATABASE CONNECTION: SUCCESS');

            db = client.db(db_name);

            //Fetch info from DB
            activeGames = [];
            db_col_games = db.collection('games');
            const gameArray = await db_col_games.find().toArray();
            for (var i = 0; i < gameArray.length; i++) {
                const gameObj = await databaseUtils.deserializeGame(gameArray[i], bot);
                activeGames.push(gameObj);
            }
            console.log(`~ Finished pulling games!`);
            console.log(activeGames);
            ready = true;
        } catch (err) {
            console.error(err);
        }
    });
}).catch(console.error);