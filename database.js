const serializeGame = (game) => {
    var obj = {
        type: game.type,
        gm: game.gm,
        server: game.server,
        channel: game.channel,
        name: game.name,
        currentMessage: game.currentMessage.id,
        cache: {
            playerRole: game.cache.playerRole.id,
            gmRole: game.cache.gmRole.id
        },
        lengthOfDays: game.lengthOfDays,
        timeLeft: game.timeLeft.toString(),
        day: game.day,
        night: game.night,
        players: [],
        votes: []
    };
    return obj;
};
exports.serializeGame = serializeGame;