const moment = require('moment');

const serializeGame = (game) => {
    var obj = {
        type: game.type,
        gm: game.gm,
        server: game.server,
        channel: game.channel,
        name: game.name,
        currentMessage: `${game.currentMessage.channel.id}/${game.currentMessage.id}`,
        cache: {
            playerRole: game.cache.playerRole.id,
            gmRole: game.cache.gmRole.id
        },
        lengthOfDays: game.lengthOfDays,
        timeLeft: game.timeLeft.toDate(),
        day: game.day,
        night: game.night,
        players: [],
        votes: []
    };
    return obj;
};
exports.serializeGame = serializeGame;

const deserializeGame = async (game, bot) => {
    const server = bot.guilds.resolve(game.server);
    const channel = server.channels.resolve(game.channel);

    var obj = {
        _id: game._id,
        type: game.type,
        gm: game.gm,
        server: game.server,
        channel: game.channel,
        name: game.name,
        currentMessage: await server.channels.resolve(game.currentMessage.split('/')[0]).messages.fetch(game.currentMessage.split('/')[1]),
        cache: {
            playerRole: await channel.guild.roles.fetch(game.cache.playerRole),
            gmRole: await channel.guild.roles.fetch(game.cache.gmRole)
        },
        lengthOfDays: game.lengthOfDays,
        timeLeft: moment(game.timeLeft),
        day: game.day,
        night: game.night,
        players: [],
        votes: []
    };

    return obj;
};
exports.deserializeGame = deserializeGame;