/// Base skeleton code by Lumpy

const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const bot = new Discord.Client();

const token = process.env.TOKEN;
const prefix = "!";

//Game variables
var activeGames = [];

bot.on('message', msg=>{
    if(msg.content.startsWith(prefix)) { // Commandsa
        var parts = msg.content.split(' ');
        var mentions = msg.mentions.users.array();
        var command = parts[0].replace(prefix, "");
        var gameIndex = gameExists(msg.guild.id, msg.channel.id);
        var game = activeGames[gameIndex];

        if (command == 'start') {
            //Start a game if none is active in this channel
            if (gameIndex >= 0) { //Game already exists in this channel
                //msg.author.send("A game already exists there silly goose.")
                //Do nothing because Lumi is forcing me not to send DMs
            } else { //No game exist right now, go ahead and create
                var newGame = activeGames.push({
                    type: "Mafia",
                    gm: msg.author.id,
                    server: msg.guild.id,
                    channel: msg.channel.id,
                    name: msg.channel.name,
                    currentMessage: null,
                    lengthOfDays: 120,
                    timeLeft: 120,
                    day: 0,
                    night: false,
                    players: [],
                    votes: []
                });

                console.log(msg.channel.name);

                //Create roles
                msg.guild.roles.create({
                    data: {name: `${msg.channel.name}-player`},
                    reason: `For the game started by ${msg.author.username}` 
                });
                msg.guild.roles.create({
                    data: {name: `${msg.channel.name}-gm`},
                    reason: `For the game started by ${msg.author.username}`
                });

                //Setup perms
                msg.channel.updateOverwrite(msg.guild.roles.cache.find(role => role.name == `${msg.channel.name}-player`), {
                    SEND_MESSAGES: true
                }).catch(console.error);
                msg.channel.updateOverwrite(msg.guild.roles.cache.find(role => role.name == `${msg.channel.name}-gm`), {
                    SEND_MESSAGES: true
                }).catch(console.error);

                //Add GM role to GM
                msg.member.roles.add(msg.guild.roles.cache.find(role => role.name == `${msg.channel.name}-gm`));

                //Let everyone know
                msg.channel.send(new Discord.MessageEmbed().setDescription(`**SIGNUPS FOR MAFIA HAVE BEGUN!**\nType \`${prefix}join\` to join this fun game!`).addField('Time Left', formatMinutes(activeGames[newGame - 1].timeLeft / 60 - 1))).then(message => {
                    activeGames[newGame - 1].currentMessage = message;
                });
            }
        } else if (command == 'join') {
            //Join the current game active in the channel if available
            if (gameIndex >= 0) { //There is a game to join
                var player = {
                    id: msg.author.id,
                    name: msg.guild.member(msg.author).displayName,
                    alive: true
                };
                if (!activeGames[gameIndex].players.find(player => player.id == msg.author.id)) {
                    activeGames[gameIndex].players.push(player);
                    msg.member.roles.add(msg.guild.roles.cache.find(role => role.name == `${msg.channel.name}-player`));
                    msg.reply(`You have joined the game!`);
                    msg.channel.updateOverwrite(msg.author.id, {SEND_MESSAGES: true});
                } else {
                    console.log(`${msg.author.username} is trying to double join!`);
                }
            } else { //No game to join
                msg.reply("Sorry brudda, there is no game running right now.");
            }
        } else if (command == 'lynch') {
            //Vote to lynch a play if available
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
            if (gameIndex >= 0) {
                if (game.gm == msg.author.id) { //User is gm
                    activeGames.splice(gameIndex);
                    msg.reply('the game has been forcibly terminated :(');
                } else { //Not GM
                    console.log(`${msg.author.username} wants to illegally stop a game`);
                }
            }
        }
    }
})

bot.login(token);

function gameExists(serverID, channelID) {
    return activeGames.filter(game => game.server == serverID).findIndex(game => game.channel == channelID);
}

function formatMinutes(minutes) {
    return `${(minutes < 1) ? "Less than " : ""}${(minutes < 1) ? 1 : minutes} minute${(minutes > 1) ? "s" : ""}`;
}

const gameLoop = setInterval(() => {
    //Tick
    for (var i = 0; i < activeGames.length; i++) {
        var game = activeGames[i];
        activeGames[i].timeLeft--;
        
        //Check for signup period
        if (activeGames[i].day < 1 && activeGames[i].timeLeft % 60 === 0) {
            if (activeGames[i].currentMessage) {
                activeGames[i].currentMessage.edit(new Discord.MessageEmbed()
                    .setDescription(`**A GAME OF MAFIA HAS BEGUN!**\nType \`${prefix}join\` to join this fun game!`)
                    .addField('Time Left', formatMinutes(activeGames[i].timeLeft / 60 - 1)));
            }
        }

        //Game logic
        if (activeGames[i].timeLeft <= 0) { //Proceed with game logic
            activeGames[i].timeLeft = activeGames[i].lengthOfDays;
            
            if (activeGames[i].type == "Mafia") {
                if (activeGames[i].day > 0) { //In game
                    if (activeGames[i].night) activeGames[i].day++;
                    activeGames[i].night = !activeGames[i].night;
                    activeGames[i].votes = [];
                    bot.guilds.resolve(activeGames[i].server).channels.resolve(activeGames[i].channel).send(`**${(activeGames[i].night) ? "Night" : "Day"} ${activeGames[i].day} has begun! You have ${activeGames[i].lengthOfDays} seconds to ${(activeGames[i].night) ? "perform your night actions!**" : `chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.`}`);
                } else {
                    //Start the game
                    var channel = bot.guilds.resolve(game.server).channels.resolve(game.channel);
                    channel.updateOverwrite(channel.guild.roles.everyone, {
                        SEND_MESSAGES: false
                    });
                    activeGames[i].day = 1;
                    bot.guilds.resolve(activeGames[i].server).channels.resolve(activeGames[i].channel).send(`**The game has begun! You have ${activeGames[i].lengthOfDays} seconds to chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.`);
                }
            }
        }
    }
}, 1000);
gameLoop.unref();