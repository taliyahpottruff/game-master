const reactionList = [
    '😀','😁','😅','😂','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😚','😋','😝','🤨','🧐','🤓','😎','🤩','🥳','😏','🥺','😢','😭','😤','🤬','🤯','😳','🥵','🥶','😱','😈','👺','🤡','💩','👻','💀','🤖','🎃','😺'
];

exports.getReaction = (index) => reactionList[index];
exports.fetchIndex = (reaction) => reactionList.findIndex((value) => value == reaction.toString());