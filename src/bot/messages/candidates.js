import { listNomineesInRoom } from "../election.js";
import { getCandidateOrNominee, getRandomCurrently, RandomArray } from "../random.js";
import { getScoreText } from "../score.js";
import { capitalize, getUsersCurrentlyInTheRoom, listify, makeURL, mapToName, mapToRequired, pluralize } from "../utils.js";
import { sayElectionNotStartedYet } from "./phases.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../score").CandidateScore} CandidateScore
 * @typedef {import("../election").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

/**
 * @summary builds a response to asking who is the best candidate
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 */
export const sayBestCandidate = (_config, _elections, election) => {
    const { numNominees } = election;

    const candidateOrNominee = getCandidateOrNominee();

    const everyoneIsGreat = `All ${candidateOrNominee}s are great!`;

    const responses = new RandomArray(...[
        `I do not meddle in elections!`,
        `The best candidate hasn't nominated yet! Or have they?`,
        everyoneIsGreat,
        `Define "best"`,
        ""
    ]);

    const random = responses.getRandom();

    if (numNominees > 0 && random) return random;

    /** @type {[number, string][]} */
    const nominationCountSpecificResponses = [
        [0, `How can I tell if there are no ${candidateOrNominee}s?`],
        [1, `Well, there is only one ${candidateOrNominee}...`],
        [2, `There are two. Toss your own coin!`]
    ];

    const [, response = "No idea"] = nominationCountSpecificResponses.find(
        ([count]) => count >= numNominees
    ) || [, everyoneIsGreat];

    return response;
};

/**
 * @summary builds current nominees list response message
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
 */
export const sayCurrentCandidates = (_config, _elections, election) => {
    const { phase, numNominees, electionUrl, nominees } = election;

    if (!phase) return sayElectionNotStartedYet(election);

    if (numNominees > 0) {
        const pastBe = pluralize(numNominees, "were", "was");
        const currBe = pluralize(numNominees, "are", "is");
        const future = pluralize(numNominees, "will be", "shall be");

        const rules = [
            [election.isActive(), currBe],
            [election.isNotStartedYet(), future],
            [election.isEnded(), pastBe]
        ];

        const [, modal] = rules.find(([cond]) => cond) || [, currBe];

        const link = makeURL(`${numNominees} ${getCandidateOrNominee()}${pluralize(numNominees)}`, electionUrl);
        const prefix = election.isActive() ? `${capitalize(getRandomCurrently())}, there` : "There";

        // Don't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
        return `${prefix} ${modal} ${link}: ${[...nominees.values()].map(({ userName }) => userName).join(', ')}`;
    }

    return `No users have nominated themselves yet. Why not be the first?`;
};

/**
 * @summary builds a response to whether a user does not meet requirements to be a candidate
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @param {CandidateScore} candidateScore candidate score instance
 * @returns {string}
 */
export const sayDoesNotMeetRequirements = (_config, election, candidateScore) => {
    const { repNominate = 0 } = election;

    const { isMissingReputation, isMissingRequiredBadges, score, numMissingRequiredBadges, maxScore, missingRequiredBadgeNames } = candidateScore;

    const prefix = `You are not eligible to nominate yourself in the election`;

    const underRep = isMissingReputation ? ` as you do not have at least ${repNominate} reputation` : "";

    const missing = isMissingRequiredBadges ? `${isMissingReputation ? '. You are also' : ' as you are'} missing the required badge${pluralize(numMissingRequiredBadges)}: ${missingRequiredBadgeNames.join(', ')}` : "";

    return `${prefix}${underRep}${missing}. Your candidate score is ${getScoreText(score, maxScore)}.`;
};

/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {import("chatexchange").default} client
 * @param {Room} room current chat room
 * @returns {Promise<string>}
 */
export const sayHowManyCandidatesAreHere = async (config, election, client, room) => {
    const { host } = client;

    const users = await getUsersCurrentlyInTheRoom(config, host, room);

    const nomineesInRoom = await listNomineesInRoom(config, election, host, users);

    const { length: numNomineeInRoom } = nomineesInRoom;

    const nomineeNames = listify(...nomineesInRoom.map(({ userName, userLink }) => userLink ? makeURL(userName, userLink) : userName));

    if (config.debug) {
        console.log({
            users,
            nomineesInRoom,
            numNomineeInRoom,
            nomineeNames
        });
    }

    return numNomineeInRoom ? `${numNomineeInRoom} ${getCandidateOrNominee()}${pluralize(numNomineeInRoom)} ${pluralize(numNomineeInRoom, "are", "is")} in the room: ${nomineeNames}` : "No candidates are in the room";
};

/**
 * @summary builds a response on how to nominate self or others
 * @param {Election} election current election
 * @param {object} electionBadges list of election badges
 * @param {boolean} mentionsAnother if user asks about nominating others
 * @returns {string}
 */
export const sayHowToNominate = (election, electionBadges, mentionsAnother = false) => {

    const requiredBadges = electionBadges.filter(mapToRequired);
    const requiredBadgeNames = requiredBadges.map(mapToName);

    const { siteHostname } = election;

    // Markup to bold additional text if talking about nominating others
    const mentionsAnotherBold = mentionsAnother ? '**' : '';

    let requirements = [`at least ${election.repNominate} reputation`, 'at least 18 years of age'];
    if (election.isStackOverflow()) requirements.push(`have these badges (*${requiredBadgeNames.join(', ')}*)`);
    if (siteHostname && /askubuntu\.com$/.test(siteHostname)) requirements.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
    requirements.push(`and cannot have been suspended anywhere on the [Stack Exchange network](https://stackexchange.com/sites?view=list#traffic) within the past year`);

    return `You can only nominate yourself as a candidate during the nomination phase. You'll need ${requirements.join(', ')}. ${mentionsAnotherBold}You cannot nominate another user.${mentionsAnotherBold}`;
};

/**
 * @summary builds a response on how to nominate others
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} _election current election
 * @param {string} _text message content
 * @returns {string}
 */
export const sayHowToNominateOthers = (_config, _elections, _election, _text) => {
    // https://chat.stackoverflow.com/transcript/message/53294378#53294378
    return `You can only nominate yourself. It is not possible to nominate another user.`;
};

/**
 * @summary builds a response why nomination is removed
 * @returns {string}
 */
export const sayWhyNominationRemoved = () => {
    const freeToRemove = `${capitalize(getCandidateOrNominee())}s may withdraw their nomination any time before the election phase.`;
    return `${freeToRemove} Nominations made in bad faith, or ${getCandidateOrNominee()}s who do not meet the requirements may also be removed by community managers.`;
};

/**
 * @summary builds a response to who are the withdrawn nominees
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayWithdrawnNominations = (_config, election) => {
    const { withdrawnNominees, numWithdrawals } = election;

    if (election.isNotStartedYet()) return sayElectionNotStartedYet(election);

    if (numWithdrawals > 0) {
        const isAre = pluralize(numWithdrawals, "are", "is");
        const withdrawn = [...withdrawnNominees.values()];

        const nomineeList = withdrawn.map(
            ({ userName, nominationLink }) => nominationLink ?
                makeURL(userName, nominationLink) :
                userName
        );

        return `There ${isAre} ${numWithdrawals} withdrawn ${getCandidateOrNominee()}${pluralize(numWithdrawals)}: ${listify(...nomineeList)}`;
    }

    return `No ${getCandidateOrNominee()}s have withdrawn from the election yet.`;
};