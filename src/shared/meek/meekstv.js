function pluralise(word, count) {
    if (count === 1) return word;

    if (word === 'is') return 'are';
    else if (word === 'has') return 'have';
    else return `${word}s`;
}

/**
 * @summary Compare two arrays
 * @param {number[]} array1
 * @param {number[]} array2
 * @returns {boolean} whether the arrays are equal
 */
function arrayEqual(array1, array2) {
    return array1.length === array2.length && array1.every((value, index) => value === array2[index]);
}

/**
 * @typedef {import("./ballotparser").ElectionInfo} ElectionInfo
 */

export default class MeekSTV {
    /**
     * @summary A data structure that stores the votes in a tree and allows for faster
     *          algorithms. The first level (below the root) contains the current active
     *          first choices. When a candidate has exceeded the winning threshold, then
     *          that node of the tree is expanded to another level. When a candidate is
     *          eliminated, the tree is rebuilt to remove that canddiate entirely as if
     *          the candidate had never been in the election.
     */
    tree = {};

    /**
     * @summary Each candidate is assigned a keep factor that is initially set to 1.
     *          When a candidate's vote exceeds the winning threshold, the keep
     *          factor is reduced to transfer surplus votes to other candidates.
     * @type {number[][]}
     */
    keepFactor = [];

    /**
     * @summary A list containing the surplus votes at each round.
     * @type {number[]}
     */
    surplus = [];

    /**
     * @summary A list contiaining the winning threshold at each round.
     * @type {number[]}
     */
    thresh = [];

    /**
     * @summary A list containing strings describing each round of the count.
     * @type {string[]}
     */
    messages = [];

    /**
     * @summary Stores information about what happened during each round.
     *          `roundInfo[r]` is an array that stores information
     *          about round `r`.
     *          Possible values include
     *
     *          - `roundInfo[r].action = ["first", []]`
     *          - `roundInfo[r].action = ["surplus", [list of candidates]]`
     *          - `roundInfo[r].action = ["eliminate", [list of candidates]]`
     *          - `roundInfo[r].winners = "Text describing winners"`
     *          - `roundInfo[r].surplus = "Text describing surplus transfer"`
     *          - `roundInfo[r].eliminate = "Text describing candidate elimination"`
     * @type {{
     *  action?: ["first" | "surplus" | "eliminate", number[]];
     *  eliminate?: string;
     *  surplus?: string;
     *  winners?: string;
     * }[]}
     */
    roundInfo = [];

    /**
     * @summary Contains the vote counts for candidates for each round.
     *          `count[r][c]` stores candidate `c`'s vote count at
     *          round `r`.
     * @type {number[][]}
     */
    count = [];

    /**
     * @summary A list of exhausted votes at each round.
     * @type {number[]}
     */
    exhausted = [];

    /**
     * @summary The number of the current round.
     * @type {number}
     */
    round = 0;

    /**
     * @summary The total number of rounds.
     * @type {number}
     */
    numRounds = 0;

    /**
     * @summary A scale factor for doing fixed-point computations.
     *          Set to `10 ** this.prec`.
     * @type {number}
     */
    p = 0;

    /**
     * @summary The number of digits of precision for the Meek method.
     * @type {number}
     */
    prec = 6;

    /**
     * @summary Initially set to `true`. Set to `false` after the first
     *          elimination round.
     * @type {boolean}
     */
    firstEliminationRound = true;

    /**
     * @summary Index numbers of winning candidates.
     * @type {Set<number>}
     */
    winners = new Set();

    /**
     * @summary Index numbers of winning candidates who still have a surplus.
     * @type {Set<number>}
     */
    winnersOver = new Set();

    /**
     * @summary Contains the rounds at which a winner was determined.
     *          Candidate `r` won at round `wonAtRound[r]`.
     * @type {number[]}
     */
    wonAtRound = [];

    /**
     * @summary Contains the rounds at which a candidate was elimincated.
     *          Candidate `r` was eliminated at round `wonAtRound[r]`.
     * @type {number[]}
     */
    lostAtRound = [];

    /**
     * @summary Index numbers of candidates who have been eliminated.
     * @type {Set<number>}
     */
    losers = new Set();

    /**
     * @summary Index numbers of candidates who are not losers or winners.
     * @type {Set<number>}
     */
    continuing = new Set();

    /**
     * @param {ElectionInfo} electionInfo
     */
    constructor(electionInfo) {
        this.numCandidates = electionInfo.numCandidates;
        this.numSeats = electionInfo.numSeats;
        this.names = electionInfo.names;

        this.uniqueBallots = electionInfo.uniqueBallots;
        this.uniqueBallotsWeight = electionInfo.uniqueBallotsWeight;
        this.numBallots = this.uniqueBallotsWeight.reduce((a, b) => a + b);

        this.dirtyBallotsCount = electionInfo.dirtyBallotsCount;
        this.title = electionInfo.title;
        this.withdrawn = electionInfo.withdrawn;

        this.continuing = new Set([...Array(this.numCandidates).keys()]);

        this.p = 10 ** this.prec;
    }

    /**
     * Get the union of continuing and winners
     * @returns {number[]} The non-losing candidates
     */
    get continuingAndWinners() {
        const continuingAndWinners = [...this.winners].concat([...this.continuing]);

        return [...new Set(continuingAndWinners)];
    }

    /**
     * Get all elements common between two arrays
     * @param {any[] | Set<number>} array1 the first array
     * @param {any[] | Set<number>} array2 the second array
     * @returns {any[]} the intersection
     */
    intersect(array1, array2) {
        const arr1 = [...array1];
        const arr2 = [...array2];

        const intersection = arr1
            .concat(arr2)
            .filter(value => arr1.includes(value) && arr2.includes(value));

        return [...new Set(intersection)];
    }

    /** Count the votes with MeekSTV. */
    countBallots() {
        // Count first place votes
        this.allocateRound();
        this.initialVoteTally();
        this.updateRound();
        this.describeRound();

        // Transfer surplus votes or eliminate candidates until done
        while (!this.electionOver()) {
            this.round += 1;
            this.allocateRound();

            if (this.isSurplusToTransfer()) this.transferSurplusVotes();
            else this.eliminateCandidates();

            this.updateRound();
            this.describeRound();
        }

        this.updateCandidateStatus();
        // this.round is zero-based
        this.numRounds = this.round + 1;
    }

    /** Add keep factor allocation. */
    allocateRound() {
        /** @type {number[]} */
        const toFill = Array(this.numCandidates).fill(0);

        this.messages.push('');
        this.roundInfo.push({});
        this.count.push([...toFill]);
        this.exhausted.push(0);

        this.surplus.push(0);
        this.thresh.push(0);

        this.keepFactor.push([...toFill]);
    }

    /** Initialize the tree data structure and candidate keep factors. */
    initialVoteTally() {
        // The tree stores exactly the ballot information needed to count the
        // votes. The first level of the tree is the top active candidate
        // (winner or in continuing). Since for winning candidates, a portion
        // of the ballot goes to the next candidate, the tree is extended until
        // it reaches a candidate in continuing or the ballot is exhausted.

        // In the beginning, all candidates are in continuing so there is only
        // one level in the tree.

        this.roundInfo[this.round].action = ['first', []];

        [...Array(this.numCandidates).keys()].forEach(index => {
            this.keepFactor[0][index] = this.p;
        });

        [...Array(this.uniqueBallots.length).keys()].forEach((_, index) => {
            this.addBallotToTree(this.tree, index);
        });
    }

    /**
     * @summary The root of the tree is an object that has as keys the indicies of all
     *          continuing and winning candidates. For each candidate, the value is also
     *          an object, and the keys of that dictionary include `n` and `bi`.
     *          - `tree[c].n` is the number of ballots that rank candidate `c` first.
     *          - `tree[c].bi` is a list of ballot indices where the ballots rank `c` first.
     *
     *          If candidate `c` is a winning candidate, then that portion of the tree
     *          is expanded to indicate the breakdown of the subsequently ranked candidates.
     *          In this situation, additional keys are added to the tree[c] object corresponding
     *          to subsequently ranked candidates.

     *          - `tree[c].n` is the number of ballots that rank candidate `c` first.
     *          - `tree[c].bi` is a list of ballot indices where the ballots rank `c` first.
     *          - `tree[c][d].n` is the number of ballots that rank `c` first and `d` second.
     *          - `tree[c][d].bi` is a list of the corresponding ballot indices.
     *
     *          Where the second ranked candidates is also a winner, then the tree is
     *          expanded to the next level.
     *
     *          Losing candidates are ignored and treated as if they do not appear on the
     *          ballots. For example, `tree[c][d].n` is the total number of ballots
     *          where candidate `c` is the first non-losing candidate, `c` is a winner,
     *          and `d` is the next non-losing candidate. This will include the following
     *          ballots, where `x` represents a losing candidate:
     *
     *          - `[c d]`
     *          - `[x c d]`
     *          - `[c x d]`
     *          - `[x c x x d]`
     *
     *          During the count, the tree is dynamically updated as candidates change
     *          their status.
     * @param {any} tree The root of the tree or a sub-tree
     * @param {number} ballotIndex The ballot index (bi)
     * @param {number[] | string} [ballotPassed] A ballot optionally passed
     */
    addBallotToTree(tree, ballotIndex, ballotPassed) {
        const weight = this.uniqueBallotsWeight[ballotIndex];
        // Add the complete ballot to the tree
        const biArr = this.uniqueBallots[ballotIndex].split(' ').map(Number);

        // empty array
        if (Array.isArray(ballotPassed) && ballotPassed.length === 0) return;

        const candidates = ballotPassed || biArr;

        /** @type {number | null} */
        let candidate = null;

        // Get the top choice among candidates still in the running
        for (const c of candidates) {
            const isTopChoice = this.continuingAndWinners.includes(Number(c));

            if (isTopChoice) {
                candidate = Number(c);
                break; // c is the top choice so stop
            }
        }

        // No candidates left on this ballot.
        // This will happen if the ballot contains only winning and losing
        // candidates. The ballot index will not need to be transferred
        // again so it can be thrown away.
        if (candidate === null) return;

        // Create space if necessary.
        if (!tree[candidate]) {
            tree[candidate] = {};
            tree[candidate].n = 0;
            tree[candidate].bi = [];
        }

        tree[candidate].n += weight;

        if (this.winners.has(candidate)) {
            // Because candidate is a winner, a portion of the ballot goes to
            // the next candidate. Pass on a truncated ballot so that the same
            // candidate doesn't get counted twice.
            // @ts-ignore
            const index = candidates.indexOf(candidate);
            const ballot2 = candidates.slice(index + 1);
            this.addBallotToTree(tree[candidate], ballotIndex, ballot2);
        } else {
            // Candidate is in continuing so we stop here.
            tree[candidate].bi.push(ballotIndex);
        }
    }

    /** Update count, exhausted, threshold, and surplus and find new winners. */
    updateRound() {
        this.updateCount();
        this.updateExhaustedVotes();
        this.updateThresh();
        this.updateSurplus();
        this.updateWinners();
    }

    /**
     * Traverse the tree to count the ballots.
     * @param {any} [treePassed] The root of the tree or a sub-tree
     * @param {number} [remainderPassed] The remainder from the previous call
     * @param {number[]} [roundCount] The counts for a given round
     * @param {number[]} [kf] The keep factors for a given round
     * @param {number} [pPassed] Make `this.p` accessible
     * @param {Function} [thisF] This function, as used previously
     */
    updateCount(treePassed, remainderPassed, roundCount, kf, pPassed, thisF) {
        const tree = treePassed || this.tree;
        const remainder = remainderPassed || this.p;

        const count = roundCount || this.count[this.round];
        const keepFactor = kf || this.keepFactor[this.round];
        const p = pPassed || this.p;
        // note: since we can't access this after we assign
        // this.updateCount to updateCount and call it,
        // we have to pass the necessary properties as parameters
        const updateCount = thisF || this.updateCount;

        // Iterate over the next candidates on the ballots
        for (const candidate of Object.keys(tree)) {
            if (candidate === 'n' || candidate === 'bi') continue;

            let rrr = remainder;

            count[candidate] += Math.floor(rrr * keepFactor[candidate] * tree[candidate].n / p);
            rrr = Math.floor(rrr * (p - keepFactor[candidate]) / p);

            // If ballot not used up, keep going
            if (rrr > 0) {
                updateCount(tree[candidate], rrr, count, keepFactor, p, updateCount);
            }
        }
    }

    /** Compute the number of exhausted votes */
    updateExhaustedVotes() {
        const votesSum = this.count[this.round].reduce((a, b) => a + b);
        const exhausted = (this.p * this.numBallots) - votesSum;

        this.exhausted[this.round] = exhausted;
    }

    /** Compute the value of the winning threshold. */
    updateThresh() {
        // droop
        const threshDen = this.numSeats + 1;
        // dynamic
        const threshNum = this.p * this.numBallots - this.exhausted[this.round];
        // fractional
        const threshold = Math.floor(threshNum / threshDen) + 1;

        this.thresh[this.round] = threshold;
    }

    /** Compute the surplus for current round. */
    updateSurplus() {
        this.surplus[this.round] = 0;

        for (const candidate of this.continuingAndWinners) {
            const candidateVotes = this.count[this.round][candidate];
            const roundThresh = this.thresh[this.round];

            if (candidateVotes > roundThresh) {
                this.surplus[this.round] += candidateVotes - roundThresh;
            }
        }
    }

    /** Find new winning candidates. */
    updateWinners() {
        const winners = [...this.continuing]
            .filter(candidate => this.count[this.round][candidate] >= this.thresh[this.round]);
        if (!winners.length) return; // no winners

        const text = this.newWinners(winners);
        this.roundInfo[this.round].winners = text;
    }

    /**
     * @summary Perform basic accounting when a new winner is found.
     * @param {Set<number> | number[]} winners
     * @param {"over" | "under"} [status = "over"] whether the winners have reached the threshold
     * @returns {string} Text announcing the new winners
     */
    newWinners(winners, status = 'over') {
        const newWinnersList = [...winners].sort((a, b) => a - b);

        newWinnersList.forEach(winner => {
            if (this.count[this.round][winner] <= 0) return;

            this.continuing.delete(winner);
            this.winnersOver.add(winner);
            this.wonAtRound[winner] = this.round;
        });

        this.winners = this.winnersOver;

        return this.getNewWinnersText(newWinnersList, status);
    }

    /**
     * @summary Joins candidate names and returns winning announcement.
     * @param {number[]} candidates the list of new winners
     * @param {"over" | "under"} [status = "over"] whether the winners have reached the threshold
     * @returns {string} the winning announcement
     */
    getNewWinnersText(candidates, status = 'over') {
        const list = this.joinList(candidates);

        const textStart = `${pluralise('Candidate', candidates.length)} ${list}`;
        const textEnd = `${pluralise('is', candidates.length)} elected. `;

        return status === 'over'
            ? `${textStart} ${pluralise('has', candidates.length)} reached the threshold and ${textEnd}`
            : `${textStart} ${textEnd}`
    }

    /**
     * @summary Perform basic accounting when a new loser is found.
     * @param {number[]} newLosersList The list of candidates to eliminate
     */
    newLosers(newLosersList) {
        newLosersList.forEach(loser => {
            this.continuing.delete(loser);
            this.losers.add(loser);
            this.lostAtRound[loser] = this.round;
        });
    }

    /**
     * @summary Convert a list of candidate ids to a readable one.
     * @param {(number | string)[]} candidates The candidate list
     * @param {boolean} [mapNames] Whether to convert candidate ids to names
     */
    joinList(candidates, mapNames) {
        const names = mapNames
            ? candidates
            : candidates.map(candidateId => this.names[candidateId]);

        // change separator from , to ; if at least one name contains a comma
        const containComma = names.some(name => name.includes?.(','));
        const separator = containComma ? ';' : ',';

        if (names.length === 1) {
            return names[0];
        } else if (names.length === 2) {
            return names.join(' and ');
        } else {
            const allExceptLast = names.slice(0, -1).join(separator + ' ');
            const lastName = names[names.length - 1];

            return `${allExceptLast}${separator} and ${lastName}`;
        }
    }

    /** Update round information */
    describeRound() {
        const roundInfo = this.roundInfo[this.round];
        let text;

        switch (roundInfo.action?.[0]) {
            case 'first':
                text = 'Count of first choices. ';
                break;
            case 'surplus':
                text = roundInfo.surplus;
                break;
            case 'eliminate':
                text = roundInfo.eliminate;
                break;
        }

        if (roundInfo.winners) {
            text += roundInfo.winners;
        }

        if (text) {
            this.messages[this.round] = text;
        }
    }

    /**
     * @summary Determine whether the election is over.
     * @returns {boolean} whether the election has ended
     */
    electionOver() {
        // Election is over when:
        return this.winners.size === this.numSeats // all winners have been identified
            || this.continuing.size + this.winners.size <= this.numSeats // fewer than N candidates remain
            || this.round > 1000; // oops! something went wrong
    }

    /**
     * @summary Decide whether to transfer surplus votes or eliminate candidates.
     * @returns {boolean} whether to transfer surplus votes
     */
    isSurplusToTransfer() {
        return this.surplus[this.round - 1] >= 1 // the surplus is below the surplus limit
            && this.getSureLosers()?.length === 0 // there are losers
            && !this.inInfiniteLoop(); // we are stuck in an infinite loop.
    }

    /**
     * Return all candidates who are sure losers.
     * @returns {number[]} the candidates to eliminate
     */
    getSureLosers() {
        // Return all candidates who are sure losers but do not look at previous
        // rounds to break ties.

        const round = this.round - 1;

        const maxNumLosers = this.continuing.size + this.winners.size - this.numSeats;
        if (maxNumLosers >= this.continuing.size) return [];
        let losers = [];

        // If all continuing candidates have zero votes and there is no surplus
        // then they are all sure losers.
        const totalContinuingVote = [...this.continuing]
            .map(candidate => this.count[round][candidate])
            .reduce((a, b) => a + b);

        if (totalContinuingVote === 0 && this.surplus[round] === 0) {
            return [...this.continuing];
        }

        // We need to make sure that all candidates with the same number of votes
        // are treated the same, so group candidates with the same number of votes
        // together and sort clusters in order of votes (fewest first).
        const continuing = [...this.continuing].sort((a, b) => {
            const roundCount = this.count[round];

            return roundCount[a] - roundCount[b];
        });
        const clustered = [[continuing[0]]];

        for (const candidate of continuing.slice(1)) {
            const roundCount = this.count[round];
            const lastElement = clustered[clustered.length - 1];

            if (roundCount[candidate] === roundCount[lastElement?.[0]]) {
                lastElement?.push(candidate);
            } else {
                clustered.push([candidate]);
            }
        }

        const potentialLosers = [];
        let s = this.surplus[round];

        clustered.slice(0, -1).forEach((cluster, i) => {
            const currentClusterCount = this.count[round][cluster[0]];
            const nextClusterCount = this.count[round][clustered[i + 1][0]];

            s += cluster.length * currentClusterCount;
            potentialLosers.push(...cluster);

            if (s < nextClusterCount && potentialLosers.length <= maxNumLosers) {
                losers.push(...potentialLosers);
            }
        });

        return [...new Set(losers)];
    }

    /** Detect stable state as infinite loop. */
    inInfiniteLoop() {
        return this.round > 1 && arrayEqual(this.keepFactor[this.round - 1], this.keepFactor[this.round - 2]);
    }

    /** Transfer the surplus votes */
    transferSurplusVotes() {
        this.roundInfo[this.round].action = ['surplus', []];
        this.updateTree(this.tree, this.losers);

        const description = this.updateKeepFactors();
        this.roundInfo[this.round].surplus = 'Count after transferring surplus votes. ' + description;
    }

    /**
     * @summary Update the tree data structure to account for new winners and losers.
     * @param {any} tree The tree to update
     * @param {Set<number>} loserSet The losers
     */
    updateTree(tree, loserSet) {
        this.updateLoserTree(tree, loserSet);
        this.updateWinnerTree(tree, loserSet);
    }

    /**
     * @summary Update the tree data structure to account for new winners.
     * @param {any} tree The tree to update
     * @param {Set<number>} loserSet The losers
     */
    updateWinnerTree(tree, loserSet) {
        const treeCandidates = Object.keys(tree).map(Number);

        for (const candidate of this.intersect(treeCandidates, this.winners)) {
            if (tree[candidate].bi.length > 0) {
                // The current candidate is a new winner (has ballot indices), so
                // expand this node to the next level. There is no need to call
                // updateTree() recursively since addBallotToTree() will appropriately
                // expand lower nodes.
                tree[candidate].bi.forEach(index => {
                    const ballot = this.uniqueBallots[index].split(' ').map(Number);
                    const j = ballot.indexOf(candidate);
                    const ballot2 = ballot.slice(j + 1);
                    this.addBallotToTree(tree[candidate], index, ballot2);
                });

                tree[candidate].bi = [];
            } else {
                // The current candidate is an old winner, so recurse to see if
                // anything needs to be done at lower levels.
                this.updateTree(tree[candidate], loserSet);
            }
        }
    }

    /**
     * Update the tree data structure to account for new losers.
     * @param {any} tree The root of the tree to update or a sub-tree
     * @param {Set<number>} loserSet The losing candidates
     */
    updateLoserTree(tree, loserSet) {
        const treeCandidates = Object.keys(tree).map(Number);

        for (const candidate of this.intersect(treeCandidates, loserSet)) {

            tree[candidate].bi.forEach(index => {
                const ballot = this.uniqueBallots[index].split(' ').map(Number);
                const j = ballot.indexOf(candidate);
                const ballot2 = ballot.slice(j + 1);
                this.addBallotToTree(tree, index, ballot2);
            });

            delete tree[candidate];
        }
    }

    /**
     * @summary Update the candidate keep factors.
     * @returns {string} Text that announces winning candidates' keep factors.
     */
    updateKeepFactors() {
        const winners = [];
        let desc = this.winners.size
            ? 'Keep factors of candidates who have exceeded the threshold: '
            : '';

        const candidateList = this.continuingAndWinners.sort((a, b) => a - b);
        for (const candidate of candidateList) {
            if (this.count[this.round - 1][candidate] > this.thresh[this.round - 1]) {
                this.roundInfo[this.round].action?.[1].push(candidate);

                const prevKeep = this.keepFactor[this.round - 1][candidate];
                const prevThresh = this.thresh[this.round - 1];
                const keepThresh = prevKeep * prevThresh;
                const prevCount = this.count[this.round - 1][candidate];

                let kf = keepThresh / prevCount;
                const rem = keepThresh % prevCount;

                if (rem > 0) kf += 1;

                this.keepFactor[this.round][candidate] = Math.floor(kf);

                const candidateName = this.names[candidate];
                const keepF = this.keepFactor[this.round][candidate] / this.p;
                winners.push(`${candidateName}, ${keepF.toPrecision(6)}`);
            } else {
                this.keepFactor[this.round][candidate] = this.keepFactor[this.round - 1][candidate];
            }
        }

        if (this.winners.size) {
            desc += this.joinList(winners, true) + '. ';
        }

        return desc;
    }

    /** Eliminate candidates. */
    eliminateCandidates() {
        const [elimList, descChoose] = this.selectCandidatesToEliminate();
        this.roundInfo[this.round].action = ['eliminate', elimList];

        const descTrans = this.transferVotesFromCandidates(elimList);
        this.roundInfo[this.round].eliminate = descTrans + descChoose;
        this.updateTree(this.tree, this.losers);
        this.copyKeepFactors();
    }

    /**
     * @summary Transfer votes from losing candidates
     * @param {number[]} elimList The list of candidates to transfer votes from
     * @returns {string} Text regarding elimination and vote transferral
     */
    transferVotesFromCandidates(elimList) {
        const sorted = elimList.sort((a, b) => a - b);

        return `Count after eliminating ${this.joinList(sorted)} and transferring votes. `;
    }

    /**
     * @summary Eliminate any losing candidates.
     * @returns {[number[], string]} The list of losing candidates and text describing the elimination
     */
    selectCandidatesToEliminate() {

        if (this.inInfiniteLoop()) {
            const continuing = [...this.continuing];
            const [candidate, desc] = this.breakWeakTie(this.round - 1, continuing, 'candidates to eliminate');

            this.newLosers([candidate]);
            this.firstEliminationRound = false;

            return [[candidate], `Candidates tied within precision of computations. ${desc}`];
        } else {
            let desc = 'All losing candidates are eliminated. ';
            let elimList = this.getSureLosers();

            // First elimination round is different for some methods
            // Skipped if no candidates would be eliminated
            //
            // We can eliminate one more candidate if all of the following are satisfied:
            // 1. The surplus is zero
            // 2. The candidates selected for elimination all have zero votes
            // 3. There are enough candidates remaining
            if (this.firstEliminationRound && this.surplus[this.round - 1] === 0) {
                const ctng = [...this.continuing].filter(c => !elimList.includes(c));

                if (ctng.length + this.winners.size > this.numSeats) {
                    const counts = elimList.map(c => this.count[this.round - 1][c]);
                    const elimListTotalCount = counts?.reduce((a, b) => a + b) || 0;

                    if (elimListTotalCount === 0) {
                        const [c, desc2] = this.breakWeakTie(this.round - 1, ctng, 'candidates to eliminate');
                        elimList.push(c);
                        desc += desc2;
                    }
                }
            }

            // Normal elimination round
            // This happens if not firstEliminationRound or if the first
            // elimination round didn't eliminate any candidates.
            if (!this.firstEliminationRound || elimList.length === 0) {
                elimList = this.getSureLosers();

                if (elimList.length === 0) {
                    const [c, desc2] = this.breakWeakTie(this.round - 1, [...this.continuing], 'candidates to eliminate');
                    elimList = [c];
                    desc += desc2;
                }
            }

            // Don't do first elimination again.
            this.firstEliminationRound = false;

            // Put losing candidates in the proper list
            this.newLosers(elimList);

            return [elimList, desc];
        }
    }

    /** Update the candidate keep factors. */
    copyKeepFactors() {
        const { keepFactor, round } = this;

        const prevRound = round - 1;

        this.continuingAndWinners.forEach((c) => {
            keepFactor[round][c] = keepFactor[prevRound][c];
        });
    }

    /** Update candidate status at end of election. */
    updateCandidateStatus() {
        let desc = '';

        if (this.winners.size === this.numSeats) {
            // All others are losers
            this.newLosers([...this.continuing]);
        } else {
            // Candidates with no votes are losers
            for (const candidate of this.continuing) {
                if (this.count[this.round][candidate] === 0) {
                    this.newLosers([candidate]);
                }
            }

            // Eliminate (N+1)th candidate
            if (this.continuing.size + this.winners.size > this.numSeats) {
                let candidate;
                [candidate, desc] = this.breakWeakTie(this.round, [...this.continuing], 'winners');
                this.newLosers([candidate]);
            }

            // Everyone else is a winner
            if (this.continuing.size > 0) {
                desc += this.newWinners([...this.continuing], 'under');
            }
        }

        this.messages[this.round] += desc;
    }

    /**
     * @summary Break ties using previous rounds.
     *          A weak tie is a tie at a given round, and may be able to be broken by
     *          looking at other rounds. A strong tie occurs when candidates are tied at
     *          all rounds. Here, the weak tie is broken by starting at the previous round
     *          and going backward (backward).
     * @param {number} round The round to start checking
     * @param {number[]} candidateList The list to check ties from
     * @param {string} what Info regarding when the tie occurred
     * @returns {[number, string]} The tie winner and text related to the tie
     */
    breakWeakTie(round, candidateList, what = '') {
        // weakTieBreakMethod is 'backward'

        const tiedCandidates = this.findTiedCand(candidateList, this.count[round]);

        if (tiedCandidates.length === 1) {
            return [tiedCandidates[0], '']; // no tie
        }

        const sorted = tiedCandidates.sort((a, b) => a - b);
        // Let the user know what is going on.
        let desc = `Candidates ${this.joinList(sorted)} were tied when choosing ${what}. `;

        const order = [...Array(round).keys()].reverse();
        for (const round of order) {
            const tiedAtRound = this.findTiedCand(sorted, this.count[round]);

            if (tiedAtRound?.length === 1) {
                const [winnerFromTie] = tiedAtRound;
                desc += `Candidate ${this.names[winnerFromTie]} was chosen by breaking`
                      + `the tie at round ${round + 1}`;

                return [winnerFromTie, desc];
            }
        }

        // The tie can't be broken with other rounds so do strong tie break (random).
        const randomIndex = Math.floor(Math.random() * sorted.length)
        const tieWinner = sorted[randomIndex];
        const randomChosenDesc = `Candidate ${this.names[tieWinner]} was chosen by breaking the tie randomly. `;

        return [tieWinner, desc + randomChosenDesc];
    }

    /**
     * @summary Find candidates tied for first or last.
     * @param {number[]} candidateList Thee list of candidates to be considered.
     * @param {number[]} values The metric to be used for comparing candidates.
     *                          Usually `self.count[r]`, but could be anything.
     * @returns {number[]} The tied candidates
     */
    findTiedCand(candidateList, values) {
        if (candidateList.length === 0) return [];

        const candidateListValues = candidateList.map(c => values[c]);
        const minValue = Math.min(...candidateListValues);

        const tied = candidateList.filter(c => values[c] === minValue);

        return tied;
    }
}
