const { expect } = require("chai");

const { RandomizableArray } = require("../src/random.js");

describe('RandomizableArray', function () {
    
    describe('methods', function () {
        
        describe('getRandom', function () {
            
            it('should return nothing on no elems', function () {
                const tested = new RandomizableArray();
                const elem = tested.getRandom();
                expect(elem).to.be.undefined;
            });

            it('should return a random elem', function () {
                const tested = new RandomizableArray(1,2,3,4,5);

                const output = [];

                do {
                    const rnd = tested.getRandom();
                    output.includes(rnd) || output.push(rnd);
                }
                while (!tested.every(e => output.includes(e)));

                expect(tested.every(e => output.includes(e))).to.be.true;
            });

        });

        describe('sortByRandom', function () {
            const tested = new RandomizableArray(1, 2, 3, 4, 5);

            let sorted = tested;

            do { sorted = tested.sortByRandom(); }
            while (tested.every((e,i) => sorted[i] === e ));
            
            expect(sorted).to.not.be.deep.equal(tested);
        });

    });

});