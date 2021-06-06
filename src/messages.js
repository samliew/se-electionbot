const { default: Election } = require("./Election.js");

/**
 * @summary makes bot remind users that they are here
 * @param {function(string,string) : string} urlMaker
 * @param {{ sendMessage(text:string): Promise<void> }} room //TODO: redefine
 * @param {Election} election
 * @returns {Promise<void>}
 */
const sayHI = async (urlMaker, room, election) => {
    let responseText = 'Welcome to the election chat room! ';

    const { arrNominees, electionUrl, phase } = election;

    const phaseTab = urlMaker("election", `${electionUrl}?tab=${phase}`);

    const { length } = arrNominees;

    //TODO: change 'null' to empty string (no type hopping)
    const phaseMap = {
        "null": `The ${phaseTab} has not begun yet`,
        "ended": `The ${phaseTab} has ended`,
        "cancelled": `The ${phaseTab} has been cancelled`,
        "nomination": ` and currently there are ${length} candidates`,
        "primary": ` and currently there are ${length} candidates`,
    };

    if (!phase || ["ended", "cancelled"].includes(phase)) {
        responseText += `The ${phaseTab} is in the ${phase} phase`;
    }

    responseText += phaseMap[JSON.stringify(phase)];

    const helpCommand = `@ElectionBot help`;

    responseText += `. I can answer frequently-asked questions about the election - type *${helpCommand}* for more info.`;

    await room.sendMessage(responseText);
};

module.exports = {
    sayHI
};