/**
 * @summary checks if the message asked why a nomination was removed
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedWhyNominationRemoved = (text) => {
    return /^(?:why|what)\b/.test(text) &&
        /\b(?:nomination|nominees|candidate)\b/.test(text) &&
        /\b(?:removed|withdraw|fewer|lesser|resign)\b/.test(text);
};

/**
 * @summary checks if the message asked if mods are paid
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedIfModsArePaid = (text) => {
    return /^(?:why|what|are|how)\b/.test(text) &&
        /\b(?:reward|paid|compensated|money)\b/.test(text) &&
        /\b(?:mods|moderators)\b/.test(text);
};

/**
 * @summary checks if the message asked what do moderators do or what privileges they have
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutModPowers = (text) => {
    return /^(?:why|what|should|does)\b/.test(text) && 
        /\b(?:should i be|is a|do(?:es) (?:mod|moderator)s?|benefit|privileges?|powers?|responsibilit(?:y|ies))\b/.test(text) && 
        /\b(?:mod|moderator)s?\b/.test(text);
};

/**
 * @summary checks if the message asked how or where to vote
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutVoting = (text) => {
    return /^(?:where|how|want|when)\b/.test(text) &&
        /\b(?:do|can|to|give|cast|should)\b/.test(text) &&
        /\b(?:voting|vote|elect)\b/.test(text);
};

/**
 * @summary checks if the message asked to tell one's candidate score
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCandidateScore = (text) => {
    return /my candidate score/.test(text) ||
        /can i /.test(text) &&
        /be|become|nominate|run/.test(text) &&
        /mod|election/.test(text);
};


/**
 * @summary checks if the message asked to tell who the current mods are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentMods = (text) => {
    return ['who', 'current', 'mod'].every((t) => text.includes(t));
};

/**
 * @summary checks if the message asked to tell who winners are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentWinners = (text) => {
    return /^who/.test(text) && /winners|new mod|will win|future mod/.test(text);
};

/**
 * @summary checks if the message asked to tell who nominees are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentNominees = (text) => {
    return /(?:who|what) (?:are|were|was|is)/.test(text) && /(?:nomin(?:ee|ation)|participant|candidate)s?/.test(text);
};

/**
 * @summary checks if the message asked for current election schedule
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForElectionSchedule = (text) => {
    return /(?:when|how) is the election(?: scheduled)?|election schedule/.test(text);
};

/**
 * @summary checks if the message asked if anyone can edit in a ♦ in their username
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutUsernameDiamond = (text) => {
    return /(?:edit|insert|add).+?(?:\u2666|diamond).+?(?:user)?name/.test(text);
};