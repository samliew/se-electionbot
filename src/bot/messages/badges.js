import { uniquify } from "../../shared/utils/arrays.js";
import { safeCapture } from "../../shared/utils/expressions.js";
import { getBadges, getStackApiKey } from "../api.js";
import { getSiteUserIdFromChatStackExchangeId, listify, makeURL, pluralize, pluralizePhrase } from "../utils.js";

/**
 * @typedef {import("../index").ElectionBadge} Badge
 * @typedef {import("../election").default} Election
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 */

/**
 * @summary builds a response to badges of a certain type query
 * @type {MessageBuilder}
 */
export const sayBadgesByType = (config, _es, election, text, user) => {
    // https://regex101.com/r/xanwAH/3
    const type = safeCapture(/(?<!\/)\b(participation|edit(?:ing|or)?|mod(?:eration)?)\b(?!\/)/, text);
    if (!type) {
        config.awaitingConfirmation.set(user.id, sayBadgesByType);
        const types = uniquify(election.electionBadges.map(({ type }) => type));
        return `Can you clarify which type (${types.join(", ")}) to list, @${user.name.replace(/\s/g, "")}?`;
    }

    const typeNormalizationMap = {
        editor: "editing",
        mod: "moderation",
    }

    const normalizedType = typeNormalizationMap[type] || type

    const filtered = election.electionBadges.filter((b) => b.type === normalizedType);

    const { length } = filtered;
    if(!length) {
        return `There are no ${normalizedType} badges`
    }

    const numBadgesPrefix = `The ${length} ${normalizedType} badge${pluralize(length)} ${pluralize(length, "are", "is")}: `;

    return numBadgesPrefix + (
        election.isStackOverflow() ?
            filtered.map(({ badge_id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${badge_id}`)) :
            filtered.map(({ name }) => name)
    ).join(", ");
};

/**
* @summary builds missing badges response
* @param {string[]} badgeNames missing election badge names
* @param {number} count number of missing badges
* @param {"required"|"moderation"|"editing"|""} type election badge type
* @param {boolean} [self] is requesting for self
* @returns {string}
*/
export const buildMissingElectionBadgesResponse = (badgeNames, count, type, self = false) => {
    const selfPrefix = self ? "You are" : "The user is";
    const modal = pluralizePhrase(count, "these", "this");
    const prefix = `${selfPrefix} missing ${modal}${type && ` ${type}`} badge${pluralize(count)}`; 
    return `${prefix}: ${listify(...badgeNames)}.`;
}

/**
 * @summary builds missing badges response message
 * @type {MessageBuilder}
 */
export const sayMissingBadges = async (config, _es, election, _t, user) =>{
    const { apiSlug, electionBadges, siteHostname } = election;

    const siteUserId = await getSiteUserIdFromChatStackExchangeId(
        config, 
        user.id, 
        config.chatDomain, 
        siteHostname, 
        getStackApiKey(config.apiKeyPool) 
    )

    if(!siteUserId) {
        return ""
    }

    const userBadges = await getBadges(config, [siteUserId], apiSlug, {type: "named" });
    const userBadgeIds = userBadges.map((badge) => badge.badge_id);

    const missingBadges = electionBadges.filter(
        (badge) => !userBadgeIds.includes(badge.badge_id)
    );

    const missingBadgeNames = missingBadges.map((badge) => badge.name);

    return buildMissingElectionBadgesResponse(
        missingBadgeNames,
        missingBadgeNames.length,
        "",
        true // TODO: add ability to request for other users
    );
}

/**
 * @summary builds a response to the required badges query
 * @type {MessageBuilder}
 */
export const sayRequiredBadges = (_c, _es, election) => {

    if (!election.isStackOverflow()) {
        return "There are no required badges for elections on this site.";
    }

    const { repNominate, requiredBadges } = election;

    const { length } = requiredBadges;

    const numBadgesPrefix = `The ${length} required badge${pluralize(length)} to nominate yourself ${pluralize(length, "are", "is")}: `;

    const badgeList = requiredBadges.map(({ badge_id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${badge_id}`)).join(", ");

    const repPostfix = repNominate ? ` You'll also need ${repNominate} reputation.` : "";

    return `${numBadgesPrefix}${badgeList}.${repPostfix}`;
};