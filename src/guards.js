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
        /\b(?:deleted?|vanish(?:ed)?|erased?|removed?|unpublish(?:ed)?|cancel(?:led)?|withdrawn?|fewer|less(?:er)?|resign)\b/.test(text);
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
 * @param {string|null} apiSlug current site's apiSlug
 * @returns {boolean}
 */
export const isAskedForCurrentMods = (text, apiSlug = null) => {
    return new RegExp(`^whois ${apiSlug} mod(?:erator)?s$`).test(text) ||
        /^who(?: are| is|'s) the current mod(?:erator)?s?/.test(text) ||
        /^how many mod(?:erator)?s? (are there|do we have)/.test(text) ||
        /^how.*\bcontact\b.*mod(?:erator)?s?/.test(text);
};

/**
 * @summary checks if the message asked to tell who winners are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentWinners = (text) => {
    return /^(?:who|how many)/.test(text) && /winners|new mod|will win|future mod/.test(text);
};

/**
 * @summary checks if the message asked to tell how many positions are due
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedForCurrentPositions = (text) => {
    return /^how many (?:positions|mod(?:erator)?s) (?:are|were|will be)(?: being)? (?:elected|there)/.test(text);
};

/**
 * @summary checks if the message asked to tell who nominees are
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForCurrentNominees = (text) => {
    return /(?:who|what) (?:are|were|was|is|has)(?: the)? (?:nomin(?:ee|ation|ated)|particip(?:ant|ated)|candidate)s?(?!\s+score)/.test(text) ||
        /how many (?:nomin(?:ee|ation|ated)|participant|candidate)s?(?!\s+score)/.test(text);
};

/**
 * @summary checks if the message asked for current election schedule
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForElectionSchedule = (text) => {
    return /(?:when|how)(?: is|'s) the election(?: scheduled)?|election schedule/.test(text);
};

/**
 * @summary checks if the message asked if anyone can edit in a ♦ in their username
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedAboutUsernameDiamond = (text) => {
    return /(?:edit|insert|add).+?(?:\u2666|diamond).+?(?:user)?name/.test(text);
};

/**
 * @summary checks if the message asked who created or maintains the bot
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedWhoMadeMe = (text) => {
    return /who(?: (?:are|is) your)?\s+(?:made|created|own(?:s|ers?)|develop(?:s|ed|ers?)|maintain(?:s|ers?))(?:\s+you)?/.test(text);
};

/**
 * @summary checks if the message asked for one's candidate score
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForOwnScore = (text) => {
    return /can i nominate myself/.test(text) ||
        /what(?: is|'s)\b.*\bm[ye](?: candidate)? score(?:$|\?)/.test(text);
};

/**
 * @summary checks if the message asked for candidate score of another user
 * @param {string} text
 * @returns {boolean}
 */
export const isAskedForOtherScore = (text) => {
    return /what(?: is|'s)(?: the)? candidate score (?:for|of)\s+(?:\d+|https:\/\/.+\/users\/\d+.*)(?:$|\?)/.test(text);
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

/**
 * @summary checks if the message is asking about user eligibility
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedForUserEligibility = (text) => {
    return /^(?:can|is) user \d+(?: be)? (?:eligible|(?:nominate|electe)d?)/.test(text);
};

/**
 * @fun
 * @summary checks if a message is asking how many mods it takes to change a lightbulb
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedAboutLightbulb = (text) => {
    return /how (?:many|much) mod(?:erator)?s(?: does)? it takes? to (?:change|fix|replace)(?: a| the)? light\s?bulb/.test(text);
};

/**
 * @fun
 * @summary checks if a message is asking for a joke
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedAboutJokes = (text) => {
    return /tell\b.*\bjoke$/.test(text);
};

/**
 * @summary checks if a message is asking if bot's responses are canned
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedIfResponsesAreCanned = (text) => {
    return /bot\b.+?says?\b.+?canned/i.test(text);
};

/**
 * @summary checks if a message is asking to list badges of a certain type
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedAboutBadgesOfType = (text) => {
    return /^(?:what|list)(?: are)?(?: the)?.+?\b(participation|editing|moderation)\s+badges/i.test(text);
};

/**
 * @summary checks if a message is asking how to vote or who to vote for
 * @param {string} text message text
 * @returns {boolean}
 */
export const isAskedHowOrWhoToVote = (text) => {
    return /^(?:how|whom?) (?:should i|to) (?:(?:choose|pick|decide|determine)?.+?\bvote\b|vote)/.test(text);
};