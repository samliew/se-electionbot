/**
 * @typedef {{
 * names: string[];
 * numCandidates: number;
 * numSeats: number;
 * title: string;
 * withdrawn?: number[];
 * uniqueBallots: string[];
 * uniqueBallotsWeight: number[];
 * dirtyBallotsCount: number;
 * }} ElectionInfo
 */

export default class BallotParser {
    /**
     * @summary parses a ballot file
     * @param {string} fileContent the text contents of the .blt file
     * @returns {ElectionInfo}
     */
    parse(fileContent) {
        /** @type {Pick<ElectionInfo, "uniqueBallots"|"uniqueBallotsWeight"|"names"> & Partial<ElectionInfo>} */
        const info = {
            /** @type string[] */ uniqueBallots: [],
            /** @type number[] */ uniqueBallotsWeight: [],
            /** @type string[] */ names: []
        };
        const candidateNameRegex = /# Candidate \d+$/

        fileContent.split('\n').forEach((line, lineIndex) => {
            if (lineIndex === 0) { // first line: get number of candidates and seats
                // "x y" => x candidates running for y seats
                const [candidates, seats] = line.split(' ').map(Number);
                info.numCandidates = candidates;
                info.numSeats = seats;
            } else if (line.startsWith('-')) { // withdrawn/excluded candidates
                const withdrawnIds = line
                    .split(' ')
                    .map(Number)
                    .map(id => Math.abs(id))
                    .filter(Number);
                info.withdrawn = withdrawnIds.map(id => id - 1);
            } else if (line.startsWith('1 ') && line.endsWith('0')) { // ballots have weight 1 on SE elections
                const ballot = line
                    .slice(2, -2)
                    .split(' ')
                    .map(choice => Number(choice) - 1)
                    .join(' ');

                const ballotIndex = info.uniqueBallots.indexOf(ballot);
                if (ballotIndex === -1) { // first time ballot is seen => push to arrays
                    info.uniqueBallots.push(ballot);
                    info.uniqueBallotsWeight.push(1);
                } else { // ballot exists => increase weight
                    info.uniqueBallotsWeight[ballotIndex] += 1;
                }
            } else if (candidateNameRegex.test(line)) { // candidate names
                const [, candidateName] = line.split('"');
                info.names.push(candidateName);
            } else if (line.endsWith('"')) { // election title
                info.title = line.slice(1, -1);
            }
        });

        info.dirtyBallotsCount = info.uniqueBallotsWeight.reduce((a, b) => a + b);

        return this.clean(/** @type {ElectionInfo} */(info));
    }

    /**
     * @summary cleans dirty ballots by removing withdrawn candidates
     * @param {ElectionInfo} parsed the election info object
     * @returns {ElectionInfo}
     */
    clean(parsed) {
        const withdrawnCandidates = parsed.withdrawn;

        /** @type number[] */
        let c2c = [...Array(parsed.numCandidates).keys()];
        let n = 0;

        if (withdrawnCandidates?.length) {
            [...Array(parsed.numCandidates).keys()].forEach(candidate => {
                if (withdrawnCandidates.includes(candidate)) {
                    c2c[candidate] = -1;
                    n += 1;
                } else {
                    c2c[candidate] -= n;
                }
            });
        }

        const cleanedBallots = [];
        const cleanedBallotsWeight = [];

        parsed.uniqueBallots.forEach(key => {
            const cleanedKey = key
                .split(' ') // candidate ids in a ballot are separated by a space
                .map(Number) // convert ids to integers
                .map(candidateId => c2c[candidateId]) // replace with new id
                .filter(id => id !== -1); // exclude nulls

            const uniqueC = [...new Set(cleanedKey)].join(' '); // remove dupes
            if (!uniqueC) return; // only withdrawn candidates were voted

            const parsedIndex = parsed.uniqueBallots.indexOf(key);
            const ballotWeight = parsed.uniqueBallotsWeight[parsedIndex];

            const cleanedIndex = cleanedBallots.indexOf(uniqueC);

            // work as in this.parse(), just increase or set to already parsed ballot weight
            if (cleanedIndex === -1) {
                cleanedBallots.push(uniqueC);
                cleanedBallotsWeight.push(ballotWeight);
            } else {
                cleanedBallotsWeight[cleanedIndex] += ballotWeight;
            }
        });

        parsed.uniqueBallots = cleanedBallots;
        parsed.uniqueBallotsWeight = cleanedBallotsWeight;

        parsed.names = parsed.names.filter((_, nameIndex) => !withdrawnCandidates?.includes(nameIndex));
        parsed.numCandidates -= withdrawnCandidates?.length || 0;

        return parsed;
    }
}
