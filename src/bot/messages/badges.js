import { uniquify } from "../../shared/utils/arrays.js";
import { safeCapture } from "../../shared/utils/expressions.js";
import { makeURL, pluralize, pluralizePhrase } from "../utils.js";

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
    // https://regex101.com/r/xanwAH/2
    const type = safeCapture(/(?<!\/)\b(participation|editing|moderation)\b(?!\/)/, text);
    if (!type) {
        config.awaitingConfirmation.set(user.id, sayBadgesByType);
        const types = uniquify(election.electionBadges.map(({ type }) => type));
        return `Can you clarify which type (${types.join(", ")}) to list, @${user.name.replace(/\s/g, "")}?`;
    }

    const filtered = election.electionBadges.filter((b) => b.type === type);

    const { length } = filtered;

    const numBadgesPrefix = `The ${length} ${type} badge${pluralize(length)} ${pluralize(length, "are", "is")}: `;

    return numBadgesPrefix + (
        election.isStackOverflow() ?
            filtered.map(({ badge_id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${badge_id}`)) :
            filtered.map(({ name }) => name)
    ).join(", ");
};

/**
 * @summary builds missing badges response message
 * @param {string[]} badgeNames
 * @param {number} count
 * @param {boolean} [required]
 * @returns {string}
 */
export const sayMissingBadges = (badgeNames, count, ownSelf = false, required = false) =>
    ` ${ownSelf ? "You are" : "The user is"} missing ${pluralizePhrase(count, "these", "this")} ${required ? "required" : ""} badge${pluralize(count)}: ${badgeNames.join(', ')}.`;

/**
 * @summary builds a response to the required badges query
 * @param {Election} election election to check required badges for
 * @returns {string}
 */
export const sayRequiredBadges = (election) => {

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