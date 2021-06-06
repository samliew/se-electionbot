class RandomArray extends Array {

    constructor(...init) {
        super(...init);
    }

    /**
     * @summary gets a random element
     * @returns {RandomArray}
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

const getRandomModal = () => new RandomArray(`want to`, `have to`, `must`).getRandom();
const getRandomPlop = () => new RandomArray(`I'm back.`, '*plop*', 'Hello there!', 'testing... 1 2 3').getRandom();
const getRandomOops = () => new RandomArray('very funny,', 'oops!', 'hmm...', 'hey,', 'sorry,').getRandom() + ' ';

module.exports = {
    RandomArray,
    getRandomModal,
    getRandomPlop,
    getRandomOops
};