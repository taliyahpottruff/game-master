const initializeChannels = async (server, category, prefix) => {
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
            {id: server.roles.everyone, deny: "VIEW_CHANNEL"}
        ]
    });

    const deadChat = await server.channels.create(`${prefix}-deadchat`, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: "VIEW_CHANNEL"}
        ]
    });

    return {primaryChannel, infoBoard, scumChats: [scumChat], nightTalk: [], deadChat};
};
exports.initializeChannels = initializeChannels;