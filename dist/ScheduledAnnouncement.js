"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _nodeCron = _interopRequireDefault(require("node-cron"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const utils = require('./utils');

class ScheduledAnnouncement {
  constructor(room, election) {
    this._room = room;
    this._election = election; // Run the sub-functions once only

    this._nominationSchedule = null;
    this._primarySchedule = null;
    this._electionSchedule = null;
    this._winnerSchedule = null; // Store task so we can stop if needed

    this._nominationTask = null;
    this._primaryTask = null;
    this._electionTask = null;
    this._winnerTask = null;
  }

  get hasPrimary() {
    return !this._primarySchedule;
  }

  get schedules() {
    return {
      nomination: this._nominationSchedule,
      primary: this._primarySchedule,
      election: this._electionSchedule,
      ended: this._winnerSchedule
    };
  }

  setRoom(room) {
    this._room = room;
  }

  setElection(election) {
    this._election = election;
  }

  initWinner(date) {
    var _this = this;

    if (this._winnerSchedule != null || this._winnerTask != null) return false;

    const _endedDate = new Date(date);

    if (_endedDate > Date.now()) {
      const cs = "0 ".concat(_endedDate.getHours(), " ").concat(_endedDate.getDate(), " ").concat(_endedDate.getMonth() + 1, " *");
      this._winnerTask = _nodeCron.default.schedule(cs,
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        yield _this._election.scrapeElection();
        yield _this._room.sendMessage("**The [election](".concat(_this._election.url, "?tab=election) has now ended.** You can [view the results online via OpaVote](").concat(_this._election.resultsUrl, ").")); // Congratulate the winners

        if (_this._election.arrWinners.length > 0) {
          yield _this._room.sendMessage("Congratulations to the winner".concat(_this._election.arrWinners.length == 1 ? '' : 's', " ").concat(_this._election.arrWinners.map(v => "[".concat(v.userName, "](").concat(_this._election.siteUrl + '/users/' + v.userId, ")")).join(', '), "!"));
        }
      }), {
        timezone: "Etc/UTC"
      });
      console.log('CRON - election end     - ', cs);
      this._winnerSchedule = cs;
    }
  }

  initElection(date) {
    var _this2 = this;

    if (this._electionSchedule != null || this._electionTask != null || typeof date == 'undefined') return false;

    const _electionDate = new Date(date);

    if (_electionDate > Date.now()) {
      const cs = "0 ".concat(_electionDate.getHours(), " ").concat(_electionDate.getDate(), " ").concat(_electionDate.getMonth() + 1, " *");
      this._electionTask = _nodeCron.default.schedule(cs,
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        yield _this2._election.scrapeElection();
        yield _this2._room.sendMessage("**The [election phase](".concat(_this2._election.url, "?tab=election) is now open.** You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!"));
      }), {
        timezone: "Etc/UTC"
      });
      console.log('CRON - election start   - ', cs);
      this._electionSchedule = cs;
    }
  }

  initPrimary(date) {
    var _this3 = this;

    if (this._primarySchedule != null || this._primaryTask != null || typeof date == 'undefined') return false;

    const _primaryDate = new Date(date);

    if (_primaryDate > Date.now()) {
      const cs = "0 ".concat(_primaryDate.getHours(), " ").concat(_primaryDate.getDate(), " ").concat(_primaryDate.getMonth() + 1, " *");
      this._primaryTask = _nodeCron.default.schedule(cs,
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        yield _this3._election.scrapeElection();
        yield _this3._room.sendMessage("**The [primary phase](".concat(_this3._election.url, "?tab=primary) is now open.** We can begin voting on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!"));
      }), {
        timezone: "Etc/UTC"
      });
      console.log('CRON - primary start    - ', cs);
      this._primarySchedule = cs;
    }
  }

  initNomination(date) {
    var _this4 = this;

    if (this._nominationSchedule != null || this._nominationTask != null || typeof date == 'undefined') return false;

    const _nominationDate = new Date(date);

    if (_nominationDate > Date.now()) {
      const cs = "0 ".concat(_nominationDate.getHours(), " ").concat(_nominationDate.getDate(), " ").concat(_nominationDate.getMonth() + 1, " *");
      this._nominationTask = _nodeCron.default.schedule(cs,
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        yield _this4._election.scrapeElection();
        yield _this4._room.sendMessage("**The [nomination phase](".concat(_this4._election.url, "?tab=nomination) is now open.** Qualified users may now begin to submit their nominations. **You cannot vote yet.**"));
      }), {
        timezone: "Etc/UTC"
      });
      console.log('CRON - nomination start - ', cs);
      this._nominationSchedule = cs;
    }
  } // Test if cron works and if scrapeElection() can be called from cron.schedule


  initTest() {
    var _this5 = this;

    const dNow = new Date();
    const cs = "".concat(dNow.getMinutes() + 2, " ").concat(dNow.getHours(), " ").concat(dNow.getDate(), " ").concat(dNow.getMonth() + 1, " *");

    _nodeCron.default.schedule(cs,
    /*#__PURE__*/
    _asyncToGenerator(function* () {
      console.log('TEST CRON STARTED');
      yield _this5._election.scrapeElection();
      yield _this5._room.sendMessage("Test cron job succesfully completed at ".concat(utils.dateToTimestamp(_this5._election.updated), "."));
      console.log('TEST CRON ENDED', _this5._election, '\n', _this5._room);
    }), {
      timezone: "Etc/UTC"
    });

    console.log('CRON - testing cron     - ', cs);
  }

  initAll() {
    this.initNomination(this._election.dateNomination);
    this.initPrimary(this._election.datePrimary);
    this.initElection(this._election.dateElection);
    this.initWinner(this._election.dateEnded);
  }

  cancelAll() {
    if (this._nominationTask == null) this._nominationTask.stop();
    if (this._primaryTask == null) this._primaryTask.stop();
    if (this._electionTask == null) this._electionTask.stop();
    if (this._winnerTask == null) this._winnerTask.stop();
    this._nominationSchedule = null;
    this._primarySchedule = null;
    this._electionSchedule = null;
    this._winnerSchedule = null;
  }

}

exports.default = ScheduledAnnouncement;