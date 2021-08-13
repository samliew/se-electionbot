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
 * @summary checks if the message asked how or where to vote
 * @param {string} text
 * @returns {boolean}
 */
const isAskedAboutVoting = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['where', 'how', 'want', 'when'].some(textStarts) &&
        ['do', 'can', 'to', 'give', 'cast', 'should'].some(textIncludes) &&
        ['voting', 'vote', 'elect'].some(textIncludes);
};

/**
 * @summary checks if the message asked to tell candidate score
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCandidateScore = (text) => {
    const textIncludes = text.includes.bind(text);

    return text.includes('candidate score') ||
        (['can i '].some(textIncludes) &&
            ['be', 'become', 'nominate', 'run'].some(textIncludes) &&
            ['mod', 'election'].some(textIncludes));
};

/**
 * @summary checks if the message asked to tell who the current mods are
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCurrentMods = (text) => {
    const textIncludes = text.includes.bind(text);
    return ['who', 'current', 'mod'].every(textIncludes);
};

/**
 * @summary checks if the message asked to tell who winners are
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCurrentWinners = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['who'].some(textStarts) && ['winners', 'new mod', 'will win', 'future mod'].some(textIncludes);
};

module.exports = {
    isAskedWhyNominationRemoved,
    isAskedIfModsArePaid,
    isAskedAboutVoting,
    isAskedForCandidateScore,
    isAskedForCurrentMods,
    isAskedForCurrentWinners
};