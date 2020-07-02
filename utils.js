const parseGameName = (name) => {
    return name.toLowerCase().replace(/[^a-z|A-Z| ]/g, '').replace(/\s/g, '-').replace(/-{2,}/g,'-');
};
exports.parseGameName = parseGameName;