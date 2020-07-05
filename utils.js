const parseGameName = (name) => {
    return name.toLowerCase().replace(/[^a-z|A-Z| |0-9]/g, '').replace(/\s/g, '-').replace(/-{2,}/g,'-');
};
exports.parseGameName = parseGameName;

exports.votesToLynch = (game) => {
    var aliveCount = 0;
    game.players.forEach(player => {
        if (player.alive) aliveCount++;
    });
    return Math.round((aliveCount + 1) / 2);
}