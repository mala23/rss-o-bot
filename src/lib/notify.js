/**
 * notifiy
 * This module notifies about new entries users.
 */
const { Observable: O } = require('rx')
const debug = require('debug')('rss-o-bot')

module.exports = H => config => {
  const setMethods = config.get('notification-methods') || []
  const notifierFunctions = getNotifierFunctions(H, config, setMethods)

  return (blog, link, title) =>
    /* Call all registered notifiers */
    O.merge(...notifierFunctions)
      .flatMap(f => f(blog, link, title))
      /* The results should be ignored here */
      .last()
      .map(() => null)
}

const isFunction = x => {
  if (typeof x === 'function') return x
  throw new Error('x is not a function.')
}

const getNotifierFunctions = (H, config, setMethods) =>
  /* Map over all configured notification methods and check if there
   * are installed modules by that name. require and isDirectory both
   * throw errors if the directory or module doesn't exist.
   */
  setMethods.map(module =>
    O.onErrorResumeNext(
      O.of(module).map(isFunction),
      H.isDirectory(`${__dirname}/../../../rss-o-bot-${module}`).map(require),
      H.isDirectory(`${__dirname}/../../../${module}`).map(require),
      O.of(module).map(require),
      O.of(`rss-o-bot-${module}`).map(require),
      H.isDirectory(module).map(require)
    )
      .catch(() => { console.error(`Failed to load notifier ${module}`) })
      .filter(f => f) /* Exclude all notifiers, that weren't found */
      .map(f => f(config))
      .tap(() => debug(`Successfully loaded notifier: ${module}`))
  )

