const initializeChannels = async (server, category, prefix) => {
    //Create the primary channel
    const primaryChannel = await server.channels.create(prefix, {
        parent: category,
        permissionOverwrites: [
            {id: server.roles.everyone, deny: "SEND_MESSAGES"}
        ]
    });

    return {primaryChannel};
};
exports.initializeChannels = initializeChannels;