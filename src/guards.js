/**
 * @summary checks if the message asked how or where to nominate
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForNominatingInfo = (text) => {
    return (/^(?:how|where|can i)/.test(text) && /\b(?:nominate|submit|register|enter|apply|elect)\b/.test(text)) ||
        /^(?:how to|how can|can i).+be (?:a )?mod/.test(text);
};

/**
 * @summary checks if the message asked why a nomination was removed
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedWhyNominationRemoved = (text) => {
    return /^(?:why|what)\b/.test(text) &&
        /\b(?:nomination|nominee|candidate)s?\b/.test(text) &&
        /\b(?:removed|withdraw|fewer|lesser|resign)\b/.test(text);
};

/**
 * @summary checks if the message asked if mods are paid
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedIfModsArePaid = (text) => {
    return /^(?:why|what|are|how)\b/.test(text) &&
        /\b(?:reward|rewarded|paid|compensated|money)\b/.test(text) &&
        /\b(?:mods|moderators)\b/.test(text);
};

/**
 * @summary checks if the message asked what do moderators do or what privileges they have
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutModsOrModPowers = (text) => {
    return /^(?:why|what|should|does)\b/.test(text) &&
        /\b(?:should i (?:be|become)|is a|(?:do|does)(?: a)? (?:mod|moderator)s?|benefits?|privileges?|powers?|responsibilit(?:y|ies))\b/.test(text) &&
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
    return /^who/.test(text) && /winners|new mod|will win|future mod/i.test(text);
};

/**
 * @summary checks if the message asked to tell how many positions are due
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedForCurrentPositions = (text) => {
    return /^how many (?:positions|mod(?:erator)?s) (?:are|will be)(?: being)? elected/i.test(text);
};

/**
 * @summary checks if the message asked to tell who nominees are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentNominees = (text) => {
    return /(?:who|what) (?:are|were|was|is|has)(?: the)? (?:nomin(?:ee|ation|ated)|particip(?:ant|ated)|candidate)s?(?!\s+score)/i.test(text);
};

/**
 * @summary checks if the message asked for current election schedule
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForElectionSchedule = (text) => {
    return /(?:when|how) is the election(?: scheduled)?|election schedule/i.test(text);
};

/**
 * @summary checks if the message asked if anyone can edit in a ♦ in their username
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutUsernameDiamond = (text) => {
    return /(?:edit|insert|add).+?(?:\u2666|diamond).+?(?:user)?name/i.test(text);
};

/**
 * @summary checks if the message asked who created or maintains the bot
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedWhoMadeMe = (text) => {
    return /who(?:\s+(?:are|is) your)?\s+(?:made|created|own(?:s|ers?)|develop(?:s|ed|ers?)|maintain(?:s|ers?))(?:\s+you)?/i.test(text);
};

/**
 * @summary checks if the message asked for one's candidate score
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForOwnScore = (text) => {
    return /can i nominate myself/.test(text) ||
        /what(?: i|')s\s+my(?:\s+candidate)?\s+score(?:$|\?)/i.test(text);
};

/**
 * @summary checks if the message asked for candidate score of another user
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForOtherScore = (text) => {
    return /what(?: i|')s(?: the)? candidate score (?:for|of)\s+(?:\d+|https:\/\/.+\/users\/\d+.*)(?:$|\?)/i.test(text);
};

/**
 * @summary checks if the message asked for candidate score calculation formula
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForScoreFormula = (text) => {
    return /(?:what|how)\b.+\bcandidate score\b.*\b(?:calculated|formula)?(?:$|\?)/.test(text) ||
        /what\b.+\bformula\b.+\bcandidate score(?:$|\?)/.test(text);
};

/**
 * @summary checks if the message asked for candidate score leaderboard
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForScoreLeaderboard = (text) => {
    return /who\b.*\b(?:highest|greatest|most)\b.*\bcandidate score/.test(text) ||
        /candidate score leaderboard(?:$|\?)/.test(text);
};

/**
 * @summary detects if someone is thanking the bot
 * @param {string} text
 * @returns {boolean}
 */
export const isThankingTheBot = (text) => {
    return /thanks?(?= you|,? bot|[!?]|$)/.test(text);
};

/**
 * @summary detects if someone is thanking, praising, or loving the bot
 * @param {string} text
 * @returns {boolean}
 */
export const isLovingTheBot = (text) => {
    return text.includes('bot') && (
        /(?:^the|^this)?.*(?:nice|good|great|wonderful|awesome|excellent)/.test(text) ||
        /^i (?:like|love) (?:the|this|electionbot)/.test(text)
    );
};

/**
 * @summary detects if someone hates the bot
 * @param {string} text
 * @returns {boolean}
 */
export const isHatingTheBot = (text) => {
    return text.includes('bot') && (
        /(?:^the|^this)?.*(?:bad|terrible|horrible|broken|buggy)/.test(text) ||
        /^i (?:dislike|hate|detest) (?:the|this|electionbot)/.test(text)
    );
};