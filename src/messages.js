const Election = require("./Election.js").default;

/**
 * @summary makes bot remind users that they are here
 * @param {function(string,string) : string} urlMaker 
 * @param {*} room 
 * @param {Election} election 
 * @returns {Promise<void>}
 */
const sayHI = async (urlMaker, room, election) => {
    let responseText = 'Welcome to the election chat room! ';

    const { arrNominees, electionUrl, phase } = election;

    const phaseTab = urlMaker("election", `${electionUrl}?tab=${phase}`);

    if (phase == null) {
        responseText += `The ${phaseTab} has not begun yet`;
    }
    else if (phase === 'ended' || phase === 'cancelled') {
        responseText += `The ${phaseTab} has ended`;
    }
    // Nomination, primary, or election phase
    else {
        responseText += `The ${phaseTab} is in the ${phase} phase`;

        if (phase === 'nomination' || phase === 'primary') {
            responseText += ` and currently there are ${arrNominees.length} candidates`;
        }
    }

    const helpCommand = `@ElectionBot help`;

    responseText += `. I can answer frequently-asked questions about the election - type *${helpCommand}* for more info.`;

    await room.sendMessage(responseText);
};

/**
 * @summary checks if the message asked if mods are paid
 * @param {string} text 
 * @returns {boolean}
 */
const isAskedIfModsArePaid = async (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['why', 'what', 'are', 'how'].some(textStarts) && 
        ['reward', 'paid', 'compensat', 'money'].some(textIncludes) && 
        ['mods', 'moderators'].some(textIncludes);
};

/**
 * @summary builds a response if mods are paid
 * @param {function(string,string) : string} urlMaker
 * @param {Election} election
 * @returns {string}
 */
const sayAreModsPaid = async (urlMaker, election) => {
    const { siteUrl } = election;

    const modsURI = urlMaker("Elected ♦ moderators", `${siteUrl}/help/site-moderators`);

    return `${modsURI} is an entirely voluntary role, and they are not paid by Stack Exchange.`;
}

};

module.exports = {
    isAskedIfModsArePaid,
    sayAreModsPaid,
    sayHI
};