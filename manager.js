const utils = require('./utils');

const initializeChannels = async (server, category, prefix, bot) => {
    //Create the primary channel
    const primaryChannel = await server.channels.create(prefix, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: "SEND_MESSAGES"}
        ]
    });

    const infoBoard = await server.channels.create(`${prefix}-infoboard`, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: "SEND_MESSAGES"}
        ]
    });

    const scumChat = await server.channels.create(`${prefix}-scumchat`, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: ["VIEW_CHANNEL", "SEND_MESSAGES"]},
            {id: bot.user.id, allow: "VIEW_CHANNEL"}
        ]
    });

    const deadChat = await server.channels.create(`${prefix}-deadchat`, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: ["VIEW_CHANNEL", "SEND_MESSAGES"]},
            {id: bot.user.id, allow: "VIEW_CHANNEL"}
        ]
    });

    return {primaryChannel, infoBoard, scumChats: [scumChat], nightTalk: [], deadChat};
};
exports.initializeChannels = initializeChannels;

const nextPhase = (channel, prefix, game, bot) => {
    if (game.night) {
        game.day++;
        game.night = false;
        channel.updateOverwrite(game.cache.playerRole, {
            SEND_MESSAGES: true
        }).catch(console.error);
        game.channels.scumChats.forEach(sc => {
            chat = channel.guild.channels.resolve(sc);
            chat.updateOverwrite(channel.guild.roles.everyone, {
                SEND_MESSAGES: false
            });
        });
        game.channels.nightTalk.forEach(nt => {
            chat = channel.guild.channels.resolve(nt);
            chat.updateOverwrite(channel.guild.roles.everyone, {
                SEND_MESSAGES: false
            });
        });
    } else {
        game.night = true;
        channel.updateOverwrite(game.cache.playerRole, {
            SEND_MESSAGES: false
        }).catch(console.error);
        game.channels.scumChats.forEach(sc => {
            chat = channel.guild.channels.resolve(sc);
            chat.updateOverwrite(channel.guild.roles.everyone, {
                SEND_MESSAGES: true
            });
        });
        game.channels.nightTalk.forEach(nt => {
            chat = channel.guild.channels.resolve(sc);
            chat.updateOverwrite(channel.guild.roles.everyone, {
                SEND_MESSAGES: true
            });
        });
    }
    game.votes = [];
    bot.guilds.resolve(game.server).channels.resolve(game.channel).send(`**${(game.night) ? "Night" : "Day"} ${game.day} has begun! You have ${game.lengthOfDays} seconds to ${(game.night) ? "perform your night actions!**" : `chat and decide if you want to lynch.**\nUse \`${prefix}lynch @[player]\` to vote to lynch.\n*${utils.votesToLynch(game)} votes needed to hammer.*`}`).catch(console.error);
};
exports.nextPhase = nextPhase;

exports.killPlayer = (game, player, db, server) => {
    const playerIndex = game.players.findIndex(value => value.id == player);
    if (playerIndex >= 0) {
        let playerObj = game.players[playerIndex];
        playerObj.alive = false;
        game.players[playerIndex] = playerObj; //Reset in local game array
        server.channels.resolve(game.channels.deadChat).updateOverwrite(player, {VIEW_CHANNEL: true, SEND_MESSAGES: true}); //Give deadchat perms
        db.updateOne({_id: game._id}, {$set: {players: game.players}}).then(result => console.log('~ Successfully updated players in DB!')).catch(console.error);
        return true;
    }
    return false;
};