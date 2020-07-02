const parseGameName = (name) => {
    return name.toLowerCase().replace(/[^a-z|A-Z| |0-9]/g, '').replace(/\s/g, '-').replace(/-{2,}/g,'-');
};
exports.parseGameName = parseGameName;