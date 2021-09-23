export class RandomArray extends Array {
    /**
     * @param {...any} init
     */
    constructor(...init) {
        super(...init);
    }

    /**
     * @summary gets a random element
     * @returns {any}
     */
    getRandom() {
        const rnd = Math.floor(Math.random() * this.length);
        return this[rnd];
    }

    /**
     * @summary sorts in random order
     * @returns {RandomArray}
     */
    sortByRandom() {
        // https://stackoverflow.com/a/46545530
        this.map((a) => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
        return this;
    };

}

export const getRandomModal = () => new RandomArray(`want to`, `have to`, `ought to`, `gotta`, `must`).getRandom();
export const getRandomPlop = () => new RandomArray(`I'm back.`, `*plop*`, `I am reborn`, `Hello world!`, `mic check`, `testing 1, 2, 3`).getRandom();
export const getRandomOops = () => new RandomArray(`very funny,`, `oops!`, `hmm...`, `hey,`, `sorry,`).getRandom() + ` `;
export const getRandomGoodThanks = () => new RandomArray(
    `I know, right?`,
    `You're welcome.`,
    `Thanks! You're awesome!`,
    `I'm only as good as the one who made me.`,
).getRandom();