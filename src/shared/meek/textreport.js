/**
 * Pluralise
 * @param {string} word
 * @param {number} count
 */
function pluralise(word, count) {
    if (count === 1) return word;

    if (word === 'is') return 'are';
    else if (word === 'has') return 'have';
    else return `${word}s`;
}

/**
 * @typedef {import("./meekstv").default} MeekSTV
 */

export default class TextReport {

    maxWidth = 79;

    /** @type {string[]} */
    out = [];

    /**
     * @param {MeekSTV} results
     */
    constructor(results) {
        this.results = results;
    }

    /** Pretty print election results in text format. */
    generate() {
        const {
            numCandidates,
            numBallots,
            names,
            surplus,
            thresh,
            count,
            p,
            prec,
            dirtyBallotsCount,
            title,
            withdrawn,
            numSeats,
            numRounds,
            winners
        } = this.results;

        // Find the largest number to appear on the report
        const maxValue = Math.max(
            ...surplus,
            ...thresh,
            ...count.flatMap(counts => counts)
        ) / p;

        // From the max value, compute the minimum column width needed
        this.maxColWidth = Math.floor(Math.log10(maxValue)) + prec + 2;

        // nCol is the total number of columns
        // + exhausted + surplus + thresh (= +3)
        const nCol = numCandidates + 3;

        // maxnSubCol is the maximum number of columns that can fit in a
        // single row. This is used to determine how many rows we need.
        const maxnSubCol = Math.floor((this.maxWidth - 2) / (this.maxColWidth + 1));

        // nRow is the number of rows needed to display all of the columns
        let nRow = Math.floor(nCol / maxnSubCol);
        const rRow = nCol % maxnSubCol;
        if (rRow > 0) nRow += 1;

        // nSubCol is the number of columns per row (distributed evenly across rows)
        let nSubCol = Math.floor(nCol / nRow);
        const rCol = nCol % nRow;
        if (rCol > 0) nSubCol += 1;

        // colWidth is the width of a column in characters
        const colWidth = Math.floor((this.maxWidth - 2) / nSubCol) - 1;

        // width is the actual width of the table
        const width = 2 + nSubCol * (colWidth + 1);

        // Find length of longest string in the table header
        const nameLengths = names.map(name => name.length);
        const maxL = Math.max(...nameLengths, 9);// 9 letters in "Exhausted"
        // Pad strings for table header to a multiple of colWidth
        const maxNameLen = maxL + colWidth - (maxL % colWidth);

        const header = [];
        header.push(...[
            ...names,
            'Exhausted',
            'Surplus',
            'Threshold'
        ].map(value => value.padEnd(maxNameLen, ' ')));

        // nSubRow is the number of rows needed to display the full candidate names
        let nSubRow = Math.floor(maxNameLen / colWidth);
        const rSubRow = maxNameLen % colWidth;
        if (rSubRow > 0) nSubRow += 1;

        const topText = this.generateHeader(dirtyBallotsCount, withdrawn, numBallots, title, numCandidates, numSeats);
        this.out.push(topText);

        // table header
        [...Array(nRow).keys()].forEach(r => {
            [...Array(nSubRow).keys()].forEach(sr => {
                let line = '';

                if (r === 0 && sr === 0) line += ' R';
                else line += '  ';

                const b = sr * colWidth;
                const e = b + colWidth;

                for (const sc of Array(nSubCol).keys()) {
                    const h = r * nSubCol + sc;
                    if (h === header.length) break;

                    line += `|${header[h].slice(b, e)}`;
                }

                this.out.push(`${line}\n`);
            });

            if (r < nRow - 1) {
                const dashes = '-'.repeat(colWidth);
                this.out.push(`  |${(dashes + "+").repeat(nSubCol - 1)}${dashes}\n`);
            }
        });

        // Rounds
        [...Array(numRounds).keys()].forEach(R => {
            this.generateTextRoundResults(R, width, nSubCol, colWidth);
        });

        this.out.push('\n');
        this.out.push(this.getWinnerText(winners));

        return this.out.join('');
    }

    generateHeader(dirtyBCount, withdrawn, numBallots, title, numCandidates, numSeats) {
        const dirtyCount = numCandidates + (withdrawn?.length || 0);

        return `Ballot file contains ${dirtyCount} candidates and ${dirtyBCount} ballots.\n`
            + `${this.generateWithdrawnText(withdrawn)}\n`
            + `Ballot file contains ${numBallots} non-empty ballots.\n`
            + '\n'
            + `Counting votes for ${title} using Meek STV.\n`
            + `${numCandidates} candidates running for ${numSeats} ${pluralise('seat', numSeats)}.\n\n`;
    }

    generateWithdrawnText(withdrawn) {
        let withdrawnText;
        if (!withdrawn?.length) {
            withdrawnText = 'No candidates have withdrawn.';
        } else if (withdrawn.length === 1) {
            withdrawnText = `Removed withdrawn candidate ${withdrawn[0]} from the ballots.`;
        } else {
            const sorted = withdrawn.sort((a, b) => a - b);
            withdrawnText = `Removed withdrawn candidates ${this.results.joinList(sorted, true)} from the ballots.`;
        }

        return withdrawnText;
    }

    generateTextRoundResults(R, width, nSubCol, colWidth) {
        const values = this.getValuesForRound(R);
        this.printTableRow(values, width, nSubCol, colWidth);

        // Pring message
        this.out.push(`  |${'-'.repeat(width - 3)}\n`);

        const roundMessage = this.results.messages[R].trim();
        const totalW = width - 4; // + '  | '
        // https://stackoverflow.com/a/51506718
        const padded = roundMessage.replace(
            new RegExp(`(?![^\\n]{1,${totalW}}$)([^\\n]{1,${totalW}})\\s`, 'g'), '$1\n'
        );
        const complete = padded.split('\n').map(line => `  | ${line}`).join('\n');

        this.out.push(complete + "\n");
    }

    getValuesForRound(round) {
        const {
            count,
            losers,
            lostAtRound,
            p,
            exhausted,
            surplus,
            thresh
        } = this.results;

        const values = [];
        values.push(round + 1);

        // Candidate vote totals for the round
        count[round].forEach((numVotes, candidate) => {
            // If candidate has lost and has no votes, leave blank
            if (losers.has(candidate)
                && lostAtRound[candidate] <= round
                && numVotes === 0
            ) {
                values.push('');
            } else { // otherwise print the total.
                values.push(numVotes / p);
            }
        });

        // exhausted, surplus and threshold
        values.push(exhausted[round] / p);
        values.push(surplus[round] / p);
        values.push(thresh[round] / p);

        return values;
    }

    printTableRow(values, width, nSubCol, colWidth) {
        // separator line
        this.out.push('='.repeat(width) + '\n');

        let line = values.shift().toString().padStart(2, ' '); // round number
        values.forEach((value, index) => {
            if (index % nSubCol === 0 && index > 0) {
                line += '\n  ';
            }

            let field = value;
            // convert to specified precision (6)
            if (typeof value === 'number') {
                field = value.toFixed(this.results.prec);
            }

            line += `|${field.padStart(colWidth)}`;
        });

        line += '\n';
        this.out.push(line);
    }

    getWinnerText(winners) {
        const sorted = [...winners].sort((a, b) => a - b);

        if (sorted.length === 1) {
            return `Winner is ${this.results.joinList(sorted)}.`;
        } else {
            return `Winners are ${this.results.joinList(sorted)}.`;
        }
    }
}
