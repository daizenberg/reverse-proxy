import Http from 'http'
import Url from 'url'

var server = new Http.Server()

server.listen(1980, '127.0.0.1')

server.on('request', (req, res) => {
  var url = parseUrl(req.url)
  if (!url) {
    console.error(`Error parsing source URL: ${req.url}`)
    res.end('Error: could not parse request URL')
    return
  }

  console.log(`Connecting to ${url.hostname}${url.path}`)
  fetchUrl(url,
    (remoteRes, body) => finishResponseSuccess(res, remoteRes, body),
    (error) => finishResponseError(res, error))
})

function parseUrl (sourceUrl) {
  var url = Url.parse(sourceUrl)
  var matches = /host=((w|.)+)/.exec(url.query)
  if (!matches || matches.length < 1) {
    return null
  }
  return {
    hostname: matches[1],
    path: url.pathname
  }
}

function fetchUrl (url, onSuccess, onError) {
  Http.get(url, (response) => {
    var body = ''
    response.on('data', (d) => body += d)
    response.on('end', () => onSuccess(response, body))
  }).on('error', (e) => onError(e))
}

function finishResponseError (localRes, error) {
  console.error(`Request error: ${error.message}`)
  localRes.end(`Remote host returned error: ${error.message}`)
}

function finishResponseSuccess (localRes, remoteRes, body) {
  // TODO: parse body, replace grammar
  console.log(`Successfully recieved response, status code ${remoteRes.statusCode}`)
  localRes.statusCode = remoteRes.statusCode
  for (var header in remoteRes.headers) {
    var headerValue = remoteRes.headers[header]
    if (header.toLowerCase() === 'location') {
      headerValue = convertUrl(headerValue)
    }
    localRes.setHeader(header, headerValue)
  }
  localRes.end(convertHtmlBody(body))
}

function convertHtmlBody (body) {
  // hyperlinks
  body = body.replace(/href="((http:\/\/|www)[^\'\"]+)/g, (href, url) => `href="${convertUrl(url)}`)
  body = body.replace(/(\w)(\w*)(?![^<]*>)/g, '$2$1ay')
  return body
}

function convertUrl (sourceUrl) {
  var url = Url.parse(sourceUrl)
  var x = `http://localhost:1980${url.pathname}?host=${url.hostname}`
  console.log(`converted url ${sourceUrl} to ${x}`)
  return x
}
