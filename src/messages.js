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

module.exports = {
    sayHI,
    sayWhyNominationRemoved,
    sayAreModsPaid,
    isAskedWhyNominationRemoved,
    isAskedIfModsArePaid
};