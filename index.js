/// Base skeleton code by Danny (Lumpy)

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
const db_url = `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@ds135540.mlab.com:35540/game-master`;
const db_name = 'game-master';
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

//Game variables
var activeGames = [];

bot.on('message', async msg=>{
    if (ready) {
        //Log message
        if (gameExists(msg.guild.id, msg.author.id) > 1) {
            console.log(`(${msg.guild.name})[#${msg.channel.name}] ${msg.author.tag}: ${msg.content}`);
        }

        //Handle message
        if(msg.content.startsWith(prefix)) { // Commandsa
            var parts = msg.content.split(' ');
            var mentions = msg.mentions.users.array();
            var command = parts[0].replace(prefix, "");
            var gameIndex = gameExists(msg.guild.id, msg.channel.id);
            var game = activeGames[gameIndex];

            if (command == 'start') {
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
            
                            //Add GM role to GM
                            msg.member.roles.add(gmRole);
                            msg.guild.member(bot.user).roles.add(gmRole);
                            
                            //Let everyone know
                            msg.channel.send(new Discord.MessageEmbed().setDescription(`**SIGNUPS FOR MAFIA HAVE BEGUN!**\nReact with 👍 to join this fun game!`).addField('Time Left', formatMinutes(newGame.timeLeft.diff(moment(), 'seconds') / 60 - 1))).then(message => {
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
                //Vote to lynch a play if available
                if (gameIndex >= 0) {
                    if (mentions.length > 0) {
                        if (!game.night) {
                            const lynchee = msg.guild.member(mentions[0]);
                            var existingVote = game.votes.findIndex(vote => vote.lyncher == msg.author.id);
                            if (existingVote < 0) {
                                game.votes.push({
                                    lyncher: msg.author.id,
                                    lynchee: lynchee.id
                                });
                                lynchTally(msg.channel, game);
                            } else if (existingVote >= 0 && game.votes[existingVote].lynchee != lynchee.id) {
                                game.votes[existingVote].lynchee = lynchee.id;
                                lynchTally(msg.channel, game);
                            }
                        }
                    } else {
                        msg.reply(`please @mention the person you are trying to lynch in your command!`);
                    }
                } else {
                    console.log(`~ ${msg.author.username} is trying to lynch in the wrong channel.`);
                }
            } else if (command == 'playerlist') {
                //List all of the player; format to game
                if (gameIndex >= 0) {
                    var liststring = 'Player\'s currently alive:\n'
                    for (var i = 0; i < activeGames[gameIndex].players.length; i++) {
                        liststring += `${activeGames[gameIndex].players[i].name}\n`;
                    }
                    msg.channel.send(liststring);
                }
            } else if (command == 'forcestop') {
                if (gameIndex >= 0) { //Ensure a game is running here
                    forceStop(msg, game, gameIndex, false);
                } else {
                    console.log(activeGames);
                }
            } else if (command == 'delete') {
                if (gameIndex >= 0) { //Ensure a game is running here
                    forceStop(msg, game, gameIndex, true);
                } else {
                    console.log(activeGames);
                }
            } else if (command == 'tally' || command == 'lynchtally') {
                if (gameIndex >= 0) {
                    lynchTally(msg.channel, game);
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
                    alive: true
                };
                if (!game.players.find(player => player.id == user.id)) {
                    
                    messageReaction.message.guild.member(user).roles.add(game.cache.playerRole).then(user => {
                        game.players.push(player);
                        messageReaction.message.channel.send(`${user.toString()} has joined the game!`);
                        db_col_games.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
                    }).catch(console.error);
                } else {
                    console.log(`${user.username} is trying to double join!`);
                }
            }
        } else {
            console.error('Unable to find game linked with message');
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
                    } catch (prom) {
                        console.error(prom);
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
    return activeGames.filter(game => game.server == serverID).findIndex(game => game.channel == channelID);
}

function formatMinutes(minutes) {
    return `${(minutes < 1) ? "Less than " : ""}${(minutes < 1) ? 1 : minutes} minute${(minutes > 1) ? "s" : ""}`;
}

function matchSignupMessage(message) {
    return activeGames.find(game => game.currentMessage == message);
}

function votesToLynch(game) {
    var aliveCount = 0;
    game.players.forEach(player => {
        if (player.alive) aliveCount++;
    });
    return Math.round((aliveCount + 1) / 2);
}

function lynchTally(channel, game) {
    var output = `Current tally (${votesToLynch(game)} to hammer):`;
    var votes = new Map();
    game.votes.forEach(vote => {
        const lyncherName = game.players.find(player => player.id == vote.lyncher);
        const lyncheeName = game.players.find(player => player.id == vote.lynchee);

        var obj = (votes.has(lyncheeName)) ? votes.get(lyncheeName) : [];
        obj.push(lyncherName);
        votes.set(lyncheeName, obj);
    });
    votes.forEach((vote, key) => {
        var lynchers = '';
        for (var i = 0; i < vote.length; i++) {
            if (i > 0) lynchers += ', ';
            lynchers += vote[i].name;
        }
        output += `\n${key.name} (${vote.length}) - ${lynchers}`;
    });
    channel.send(output);
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
        if (timeLeft <= 0) { //Proceed with game logic
            game.timeLeft = moment().add(game.lengthOfDays, 'seconds');
            
            if (game.type == "Mafia") {
                if (game.day > 0) { //In game
                    if (game.night) {
                        game.day++;
                        game.night = false;
                        channel.updateOverwrite(game.cache.playerRole, {
                            SEND_MESSAGES: true
                        }).catch(console.error);
                    } else {
                        game.night = true;
                        channel.updateOverwrite(game.cache.playerRole, {
                            SEND_MESSAGES: false
                        }).catch(console.error);
                    }
                    game.votes = [];
                    bot.guilds.resolve(game.server).channels.resolve(game.channel).send(`**${(game.night) ? "Night" : "Day"} ${game.day} has begun! You have ${game.lengthOfDays} seconds to ${(game.night) ? "perform your night actions!**" : `chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.\n*${votesToLynch(game)} votes needed to hammer.*`}`).catch(console.error);
                } else {
                    //Inform that signups have ended
                    activeGames[i].currentMessage.edit(new Discord.MessageEmbed()
                        .setDescription(`**A GAME OF MAFIA HAS BEGUN!**\nReact with 👍 to join this fun game!`)
                        .addField('Time Left', `This game is in progress!`));
                    //Start the game
                    var channel = bot.guilds.resolve(game.server).channels.resolve(game.channel);
                    game.day = 1;
                    channel.send(`**The game has begun! You have ${game.lengthOfDays} seconds to chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.\n*${votesToLynch(game)} votes needed to hammer.*`).catch(console.error);
                }
            }
        }
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