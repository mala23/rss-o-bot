const { Observable: O } = require('rx')
const debug = require('debug')('rss-o-bot')

const poll = require('./lib/poll')

/* Extracts blog, link and title from a feed-item */
const callbackWrapper = callback => ({ blogTitle, link, title }) =>
  callback(blogTitle, link, title)
    .tap(() => debug('Sent notifications'))
    .retry(2)

module.exports = H => {
  const Poll = poll(H)
  /* Takes a store and a feed entity and returns an observable of new links
   * found on that feed.
   */
  const queryFeed = ({updateLatestLink, setBlogTitle}) => feed => {
    const feed$ = O.fromPromise(feed.getFilters())
      .flatMap(filters =>
        Poll(
          feed.get('url'),
          filters.map(f => [f.get('keyword'), f.get('kind')])
        )
          .retry(2)
          .catch(err => {
            const msg = `Failed downloading "${feed.get('url')}"`
            debug(`${msg}: ${err}`)
            return O.throw(err)
          })
      )
    return (
      feed$
        .flatMap(getNewLinks(feed))
        .filter(({link}) =>
          (link && link !== feed.get('latestLink')) || debug(`Old URL: ${link}`)
        )
        .flatMap(info =>
          feed.get('blogTitle')
            ? O.of(info)
            : setBlogTitle(feed.get('id'), info.blogTitle).map(info)
        )
        .flatMap(info =>
          updateLatestLink(feed.get('id'), info.link).map(info)
        )
        .filter(() => feed.get('latestLink'))
        .tap(({link}) => debug(`New URL: ${link}`))
    )
  }

  /* Takes a feed entity and a stream (curried) and checks exctracts all new
   * items from that stream. Then it returns an observable of those items.
   */
  const getNewLinks = feed => stream => {
    if (feed.get('latestLink')) {
      const latestIndex = stream.findIndex(e =>
        e.link === feed.get('latestLink')
      )
      const newLinks = stream.slice(0, latestIndex).reverse()
      return O.fromArray(newLinks)
    } else if (stream[0]) {
      return O.of(stream[0])
    } else if (stream.length < 1) {
      return O.empty()
    } else {
      throw Error('Unexpected state: stream is not an array')
    }
  }

  const PollFeeds = callback => (store, force) =>
    store.getFeeds(force)
      .flatMap(feeds =>
        O.merge(...feeds.map(queryFeed(store)))
          .flatMap(callbackWrapper(callback))
      )
  return PollFeeds
}

