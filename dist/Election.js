"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const request = require('request-promise');

const cheerio = require('cheerio');

class Election {
  constructor(electionUrl) {
    this.electionUrl = electionUrl; // private

    this._prevObj = null;
  }

  get prev() {
    return this._prevObj;
  }

  scrapeElection() {
    var _this = this;

    return _asyncToGenerator(function* () {
      // Save prev values so we can compare changes after
      _this._prevObj = Object.assign({}, _this); // fast way of cloning an object

      _this._prevObj._prevObj = null;
      const electionPageUrl = "".concat(_this.electionUrl, "?tab=nomination");

      try {
        const html = yield request({
          gzip: true,
          simple: false,
          resolveWithFullResponse: false,
          headers: {
            'User-Agent': 'Node.js/ElectionBot'
          },
          uri: electionPageUrl
        }); // Parse election page

        const $ = cheerio.load(html);
        let electionPost = $('#mainbar .post-text .wiki-ph-content');
        let sidebarValues = $('#sidebar').find('.label-value').map((i, el) => $(el).attr('title') || $(el).text()).get(); // Insert null value in second position for elections with no primary phase

        if (sidebarValues.length == 5) {
          sidebarValues.splice(1, 0, null);
        }

        _this.updated = Date.now();
        _this.url = _this.electionUrl;
        _this.sitename = $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
        _this.siteurl = 'https://' + _this.electionUrl.split('/')[2];
        _this.title = $('#content h1').first().text().trim();
        _this.dateNomination = sidebarValues[0];
        _this.datePrimary = sidebarValues[1];
        _this.dateElection = sidebarValues[2];
        _this.dateEnded = sidebarValues[3];
        _this.numCandidates = Number(sidebarValues[4]);
        _this.numPositions = Number(sidebarValues[5]);
        _this.repVote = 150;
        _this.repNominate = Number($('#sidebar .module.newuser b').eq(1).text().replace(/\D+/g, ''));
        _this.arrNominees = $('#mainbar .candidate-row').map((i, el) => {
          return {
            userId: Number($(el).find('.user-details a').attr('href').split('/')[2]),
            userName: $(el).find('.user-details a').text(),
            userYears: $(el).find('.user-details').contents().map(function () {
              if (this.type === 'text') return this.data.trim();
            }).get().join(' ').trim(),
            userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)[0],
            permalink: electionPageUrl + '#' + $(el).attr('id')
          };
        }).get();
        _this.qnaUrl = electionPost.find('a[href*="questionnaire"], a[href*="uestion"]').attr('href');
        if (typeof _this.qnaUrl === 'undefined') _this.qnaUrl = process.env.ELECTION_QA; // if cannot be found (esp on non-eng sites), needs to be set via env var

        _this.chatUrl = electionPost.find('a[href*="/rooms/"]').attr('href') || process.env.ELECTION_CHATROOM; // Calculate phase of election

        const now = Date.now();
        _this.phase = new Date(_this.dateEnded) <= now ? 'ended' : new Date(_this.dateElection) <= now ? 'election' : _this.datePrimary && new Date(_this.datePrimary) <= now ? 'primary' : new Date(_this.dateNomination) <= now ? 'nomination' : null; // If election has ended (or cancelled)

        if (_this.phase === 'ended') {
          // Get results URL
          _this.resultsUrl = $('#mainbar').find('.question-status h2').first().find('a').first().attr('href');
          let winnerElem = $('#mainbar').find('.question-status h2').eq(1); // Election cancelled?

          if (winnerElem.text().includes('cancelled')) {
            _this.phase = 'cancelled'; // convert link to chat-friendly markup

            _this.statVoters = winnerElem.html().replace(/<a href="/g, 'See [meta](').replace(/">.+/g, ') for details.').trim();
          } // Election ended
          else {
              // Get election stats
              _this.statVoters = winnerElem.contents().map(function () {
                if (this.type === 'text') return this.data.trim();
              }).get().join(' ').trim(); // Get winners

              let winners = winnerElem.find('a').map((i, el) => Number($(el).attr('href').split('/')[2])).get();
              _this.arrWinners = _this.arrNominees.filter(v => winners.includes(v.userId));
            }
        }

        console.log("SCRAPE - Election page ".concat(_this.electionUrl, " has been scraped successfully at ").concat(_this.updated, ".\n") + "         PHASE ".concat(_this.phase, "; CANDIDATES ").concat(_this.arrNominees.length));
      } catch (err) {
        console.error("SCRAPE - Failed scraping ".concat(_this.electionUrl), err);
      }
    })();
  }

}

exports.default = Election;