'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/* Mainly scenario tests for the notify module.
 * But it kindof flows into some tests for the pollFeeds module.
 */

var _require = require('ava');

var test = _require.test;

var _require2 = require('rx');

var O = _require2.Observable;


var runCLI = require('../../dist/cli.js');
var H = require('../../dist/lib/helpers');
var Poll = require('../../dist/lib/pollFeeds/lib/poll.js')(H);
var T = require('./lib/helpers');

var createDummyEntryAndPoll = function createDummyEntryAndPoll(config, url) {
  var offset = arguments.length <= 2 || arguments[2] === undefined ? 2 : arguments[2];
  return T.createDummyEntry(url, [], config, true).flatMap(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var store = _ref2[0];
    var feed = _ref2[1];
    return Poll(url, []).map(function (entries) {
      return entries.slice(0, offset);
    }).flatMap(function (entries) {
      return store.updateLatestLink(feed.get('id'), entries[offset - 1].link).map(entries.slice(0, -1));
    });
  });
};

test.cb('notifier injection', function (t) {
  var url = 'https://lucaschmid.net/feed/rss.xml';
  var config = T.getConfigWithDefaults({
    'notification-methods': [__dirname + '/lib/notifier.js']
  });
  global.NOTIFIER_TEST_OBJECT = t;
  createDummyEntryAndPoll(config, url).flatMap(function () {
    return runCLI(['node', '', 'poll-feeds'], null, config);
  }).subscribe(function () {}, T.handleError(t));
});

test.cb('notifiers/poll-feeds order', function (t) {
  var latestItem = void 0;
  var notify = function notify(config) {
    return function (blog, link, title) {
      t.is(link, latestItem.link);
      t.end();
      return O.of(true);
    };
  };
  var url = 'https://lucaschmid.net/feed/rss.xml';
  var config = T.getConfigWithDefaults({
    'notification-methods': [notify]
  });
  createDummyEntryAndPoll(config, url).tap(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 1);

    var latest = _ref4[0];
    latestItem = latest;
  }).flatMap(function () {
    return runCLI(['node', '', 'poll-feeds'], null, config);
  }).subscribe(function () {}, T.handleError(t));
});

test.cb('poll-feeds multiple new posts', function (t) {
  var latestItems = void 0;
  var i = 0;
  var notify = function notify(config) {
    return function (blog, link, title) {
      t.is(link, latestItems[i].link);
      if (++i === 1) t.end();
      return O.of(true);
    };
  };
  var url = 'https://lucaschmid.net/feed/rss.xml';
  var config = T.getConfigWithDefaults({
    'notification-methods': [notify]
  });
  createDummyEntryAndPoll(config, url, 3).tap(function (latest) {
    latestItems = latest.reverse();
  }).flatMap(function () {
    return runCLI(['node', '', 'poll-feeds'], null, config);
  }).subscribe(function () {}, T.handleError(t));
});