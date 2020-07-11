class RandomizableArray extends Array {

    constructor(...init) {
        super(...init);
    }

    /**
     * @summary gets a random element
     * @returns {RandomizableArray}
     */
    getRandom() {
        const rnd = Math.floor(Math.random() * this.length);
        return this[rnd];
    }

    /**
     * @summary sorts in random order
     * @returns {RandomizableArray}
     */
    sortByRandom() {
        // https://stackoverflow.com/a/46545530
        return this.map((a) => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map((a) => a.value);
    };

}

const getRandomModal = () => new RandomizableArray(`should`, `have to`, `must`).getRandom();
const getRandomPlop = () => new RandomizableArray(`I'm back.`, '*plop*', 'Hello there!', 'testing... 1 2 3').getRandom();
const getRandomOops = () => new RandomizableArray('very funny,', 'oops!', 'hmm...', 'hey,', 'sorry,').getRandom() + ' ';

module.exports = {
    RandomizableArray,
    getRandomModal,
    getRandomPlop,
    getRandomOops
};