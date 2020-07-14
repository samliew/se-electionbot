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
 * @summary checks if the message asked why a nomination was removed
 * @param {string} text
 * @returns {boolean}
 */
const isAskedWhyNominationRemoved = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['why', 'what'].some(textStarts) &&
        ['nomination', 'nominees', 'candidate'].some(textIncludes) &&
        ['removed', 'withdraw', 'fewer', 'lesser', 'resign'].some(textIncludes);
};

/**
 * @summary checks if the message asked if mods are paid
 * @param {string} text 
 * @returns {boolean}
 */
const isAskedIfModsArePaid = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['why', 'what', 'are', 'how'].some(textStarts) &&
        ['reward', 'paid', 'compensat', 'money'].some(textIncludes) &&
        ['mods', 'moderators'].some(textIncludes);
};

/**
 * @summary builds a response why nomination is removed
 * @returns {string}
 */
const sayWhyNominationRemoved = () => {

    const freeToRemove = `Candidates may withdraw their nomination any time before the election phase.`;

    return `${freeToRemove} Nominations made in bad faith, or candidates who do not meet the requirements may also be removed by community managers.`;
};

/**
 * @summary builds a response if mods are paid
 * @param {function(string,string) : string} urlMaker
 * @param {Election} election
 * @returns {string}
 */
const sayAreModsPaid = (urlMaker, election) => {
    const { siteUrl } = election;

    const modsURI = urlMaker("Elected ♦ moderators", `${siteUrl}/help/site-moderators`);

    return `${modsURI} is an entirely voluntary role, and they are not paid by Stack Exchange.`;
};

module.exports = {
    isAskedWhyNominationRemoved,
    isAskedIfModsArePaid,
    sayAreModsPaid,
    sayWhyNominationRemoved,
    sayHI
};