function pluralise(word, count) {
    if (count === 1) return word;

    if (word === 'is') return 'are';
    else if (word === 'has') return 'have';
    else return `${word}s`;
}

function arrayEqual(array1, array2) {
    return array1.length === array2.length && array1.every((value, index) => value === array2[index]);
}

export default class MeekSTV {
    tree = {};

    keepFactor = [];

    surplus = [];
    thresh = [];

    messages = [];
    roundInfo = [];
    count = [];
    exhausted = [];

    round = 0;
    numRounds = 0;
    p = 0;
    prec = 6;

    firstEliminationRound = true;

    winners = new Set();
    winnersOver = new Set();
    wonAtRound = [];
    lostAtRound = [];
    losers = new Set();
    continuing = new Set();

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

    get continuingAndWinners() {
        const continuingAndWinners = [...this.winners].concat([...this.continuing]);

        return [...new Set(continuingAndWinners)];
    }

    /** Get all elements common between two arrays */
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
        this.allocateRound();
        this.initialVoteTally();
        this.updateRound();
        this.describeRound();

        while (!this.electionOver()) {
            this.round += 1;
            this.allocateRound();

            if (this.isSurplusToTransfer()) this.transferSurplusVotes();
            else this.eliminateCandidates();

            this.updateRound();
            this.describeRound();
        }

        this.updateCandidateStatus();
        this.numRounds = this.round + 1;
    }

    /** Add keep factor allocation. */
    allocateRound() {
        const toFill = Array(this.numCandidates).fill(0);

        this.messages.push('');
        this.roundInfo.push({});
        this.count.push([...toFill]);
        this.exhausted.push(0);

        this.surplus.push(0);
        this.thresh.push(0);

        this.keepFactor.push([...toFill]);

        this.wonAtRound = toFill;
    }

    /** Initialize the tree data structure and candidate keep factors. */
    initialVoteTally() {
        this.roundInfo[this.round].action = ['first', []];
        [...Array(this.numCandidates).keys()].forEach(index => {
            this.keepFactor[0][index] = this.p;
        });

        [...Array(this.uniqueBallots.length).keys()].forEach((_, index) => {
            this.addBallotToTree(this.tree, index);
        });
    }

    /** Add one ballot to the tree. */
    addBallotToTree(tree, ballotIndex, ballotPassed) {
        const weight = this.uniqueBallotsWeight[ballotIndex];
        const ballot = ballotPassed || this.uniqueBallots[ballotIndex];

        // empty array
        if (ballot instanceof Array && ballot.length === 0) return;

        const candidates = ballot instanceof Array
            ? ballot // already an array, no need to split
            : ballot.split(' ').map(Number);
        let candidate = null;

        for (const c of candidates) {
            const isTopChoice = this.continuingAndWinners.includes(c);
            if (isTopChoice) {
                candidate = c;
                break;
            }
        }

        if (candidate === null) return;

        if (!tree[candidate]) {
            tree[candidate] = {};
            tree[candidate].n = 0;
            tree[candidate].bi = [];
        }

        tree[candidate].n += weight;

        if (this.winners.has(candidate)) {
            const index = candidates.indexOf(candidate);
            const ballot2 = candidates.slice(index + 1);
            this.addBallotToTree(tree[candidate], ballotIndex, ballot2);
        } else {
            tree[candidate].bi.push(ballotIndex);
        }
    }

    updateRound() {
        this.updateCount();
        this.updateExhaustedVotes();
        this.updateThresh();
        this.updateSurplus();
        this.updateWinners();
    }

    /** Traverse the tree to count the ballots. */
    updateCount(treePassed, remainderPassed, roundCount, kf, pPassed, thisF) {
        const tree = treePassed || this.tree;
        const remainder = remainderPassed || this.p;

        const count = roundCount || this.count[this.round];
        const keepFactor = kf || this.keepFactor[this.round];
        const p = pPassed || this.p;
        const updateCount = thisF || this.updateCount;

        for (const candidate of Object.keys(tree)) {
            if (candidate === 'n' || candidate === 'bi') continue;

            let rrr = remainder;

            count[candidate] += Math.floor(rrr * keepFactor[candidate] * tree[candidate].n / p);
            rrr = Math.floor(rrr * (p - keepFactor[candidate]) / p);

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

    /** Perform basic accounting when a new winner is found. */
    newWinners(winners, status = 'over') {
        const newWinnersList = [...winners].sort((a, b) => a - b);

        newWinnersList.forEach(winner => {
            if (this.count[this.round][winner] <= 0) return;

            this.continuing.delete(winner);
            this.winnersOver.add(winner);
            this.wonAtRound[winner] = this.round;
        });

        this.winners = this.winnersOver;

        return this.getNewWinnersText(newWinnersList);
    }

    /** Joins candidate names and returns winning announcement. */
    getNewWinnersText(candidates, status = 'over') {
        const list = this.joinList(candidates);

        const textStart = `${pluralise('Candidate', candidates.length)} ${list}`;
        const textEnd = `${pluralise('is', candidates.length)} elected. `;

        return status === 'over'
            ? `${textStart} ${pluralise('has', candidates.length)} reached the threshold and ${textEnd}`
            : `${textStart} ${textEnd}`
    }

    /** Perform basic accounting when a new loser is found. */
    newLosers(newLosersList) {
        newLosersList.forEach(loser => {
            this.continuing.delete(loser);
            this.losers.add(loser);
            this.lostAtRound[loser] = this.round;
        });
    }

    /** Convert a list of candidate ids to a readable one. */
    joinList(candidates, isThreshold) {
        const names = isThreshold
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

        switch (roundInfo.action[0]) {
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

        if (roundInfo.hasOwnProperty('winners')) {
            text += roundInfo.winners;
        }

        this.messages[this.round] = text;
    }

    /** Determine whether the election is over. */
    electionOver() {
        return this.winners.size === this.numSeats
            || this.continuing.size + this.winners.size <= this.numSeats
            || this.round > 1000; // oops! something went wrong
    }

    /** Decide whether to transfer surplus votes or eliminate candidates. */
    isSurplusToTransfer() {
        return this.surplus[this.round - 1] >= 1
            && this.getSureLosers()?.length === 0
            && !this.inInfiniteLoop();
    }

    /**
     * Return all candidates who are sure losers.
     * @returns {number[]}
     */
    getSureLosers() {
        const round = this.round - 1;
        const maxNumLosers = this.continuing.size + this.winners.size - this.numSeats;
        if (maxNumLosers >= this.continuing.size) return [];

        let losers = [];
        const totalContinuingVote = [...this.continuing]
            .map(candidate => this.count[round][candidate])
            .reduce((a, b) => a + b);

        if (totalContinuingVote === 0 && this.surplus[round] === 0) {
            return [...this.continuing];
        }

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

    /** Update the tree data structure to account for new winners and losers. */
    updateTree(tree, loserSet) {
        this.updateLoserTree(tree, loserSet);
        this.updateWinnerTree(tree, loserSet);
    }

    /** Update the tree data structure to account for new winners. */
    updateWinnerTree(tree, loserSet) {
        const treeCandidates = Object.keys(tree).map(Number);

        for (const candidate of this.intersect(treeCandidates, this.winners)) {
            if (tree[candidate].bi.length > 0) {
                tree[candidate].bi.forEach(index => {
                    const ballot = this.uniqueBallots[index].split(' ').map(Number);
                    const j = ballot.indexOf(candidate);
                    const ballot2 = ballot.slice(j + 1);
                    this.addBallotToTree(tree[candidate], index, ballot2);
                });

                tree[candidate].bi = [];
            } else {
                this.updateTree(tree[candidate], loserSet);
            }
        }
    }

    /** Update the tree data structure to account for new losers. */
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

    /** Update the candidate keep factors. */
    updateKeepFactors() {
        const winners = [];
        let desc = this.winners.size
            ? 'Keep factors of candidates who have exceeded the threshold: '
            : '';

        const candidateList = this.continuingAndWinners.sort((a, b) => a - b);
        for (const candidate of candidateList) {
            if (this.count[this.round - 1][candidate] > this.thresh[this.round - 1]) {
                this.roundInfo[this.round].action[1].push(candidate);

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

    /** Transfer votes from losing candidates */
    transferVotesFromCandidates(elimList) {
        const sorted = elimList.sort((a, b) => a - b);

        return `Count after eliminating ${this.joinList(sorted)} and transferring votes. `;
    }

    /** Eliminate any losing candidates. */
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

            if (!this.firstEliminationRound || elimList.length === 0) {
                elimList = this.getSureLosers();

                if (elimList.length === 0) {
                    const [c, desc2] = this.breakWeakTie(this.round - 1, [...this.continuing], 'candidates to eliminate');
                    elimList = [c];
                    desc += desc2;
                }
            }

            this.firstEliminationRound = false;
            this.newLosers(elimList);

            return [elimList, desc];
        }
    }

    /** Update the candidate keep factors. */
    copyKeepFactors() {
        this.continuingAndWinners.forEach(c => {
            this.keepFactor[this.round][c] = this.keepFactor[this.round - 1][c];
        });
    }

    /** Update candidate status at end of election. */
    updateCandidateStatus() {
        let desc = '';

        if (this.winners.size === this.numSeats) {
            this.newLosers([...this.continuing]);
        } else {
            for (const candidate of this.continuing) {
                if (this.count[this.round][candidate] === 0) {
                    this.newLosers([candidate]);
                }
            }

            if (this.continuing.size + this.winners.size > this.numSeats) {
                let candidate;
                [candidate, desc] = this.breakWeakTie(this.round, [...this.continuing], 'winners');
                this.newLosers([candidate]);
            }

            if (this.continuing.size > 0) {
                desc += this.newWinners([...this.continuing], 'under');
            }
        }

        this.messages[this.round] += desc;
    }

    /** Break ties using previous rounds. */
    breakWeakTie(round, candidateList, what = '') {
        // weakTieBreakMethod is 'backward'

        const tiedCandidates = this.findTiedCand(candidateList, this.count[round]);

        if (tiedCandidates.length === 1) {
            return [tiedCandidates[0], '']; // no ties
        }

        const sorted = tiedCandidates.sort((a, b) => a - b);
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

        const randomIndex = Math.floor(Math.random() * sorted.length)
        const tieWinner = sorted[randomIndex];
        const randomChosenDesc = `Candidate ${this.names[tieWinner]} was chosen by breaking the tie randomly. `;

        return [tieWinner, desc + randomChosenDesc];
    }

    /** Return a list of candidates tied for first or last. */
    findTiedCand(candidateList, values) {
        if (candidateList.length === 0) return;

        const candidateListValues = candidateList.map(c => values[c]);
        const minValue = Math.min(...candidateListValues);

        const tied = candidateList.filter(c => values[c] === minValue);

        return tied;
    }
}
