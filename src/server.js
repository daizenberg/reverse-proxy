import Http from 'http'
import Url from 'url'
import Parse from 'parse5'

var server = new Http.Server()
server.listen(1980, '127.0.0.1')

server.on('request', (req, res) => {
  var url = proxyUrl.proxyToReal(req.url)
  if (!url) {
    console.error(`Error parsing source URL: ${req.url}`)
    res.end('Error: could not parse request URL')
    return
  }

  console.log(`Connecting to ${url.hostname}${url.path}`)
  requestUrl(url,
    (instream) => finishResponseSuccess(instream, res),
    (error) => finishResponseError(res, error))
})

function requestUrl (url, onSuccess, onError) {
  Http.get(url, (response) => onSuccess(response))
      .on('error', (e) => onError(e))
}

function finishResponseError (outstream, error) {
  console.error(`Request error: ${error.message}`)
  outstream.statusCode = 500
  outstream.end(`Request error: ${error.message}`)
}

function finishResponseSuccess (instream, outstream) {
  var isHtml = translateHeaders(instream, outstream)
  if (isHtml) {
    outstream = attachPiggyTransformation(outstream)
  }
  instream.pipe(outstream)
}

function translateHeaders (instream, outstream) {
  let isHtml = true
  console.log(`Successfully recieved response, status code ${instream.statusCode}`)
  outstream.statusCode = instream.statusCode
  for (let header in instream.headers) {
    let headerValue = instream.headers[header]
    header = header.toLowerCase()
    if (header === 'location') {
      headerValue = proxyUrl.realToProxy(headerValue)
    }
    if (header === 'content-type' && headerValue.indexOf('html') < 0) {
      isHtml = false
    }
    outstream.setHeader(header, headerValue)
  }
  return isHtml
}

function attachPiggyTransformation (outstream) {
  let parser = new Parse.SAXParser()
  let piggy = (text) => text.replace(/(\w)(\w*)/g, '$2$1ay')
  let direct = (text) => text
  let textConverter = piggy
  parser.on('text', (t) => {
    outstream.write(textConverter(t))
  })
  parser.on('startTag', (name, attrs, selfClosing) => {
    if (selfClosing || name === 'script' || name === 'style') {
      textConverter = direct
    } else {
      textConverter = piggy
    }
    outstream.write(`<${name}`)
    attrs.forEach(a => {
      if (a.name === 'href') {
        a.value = proxyUrl.realToProxy(a.value)
      }
      outstream.write(` ${a.name}="${a.value}"`)
    })
    if (selfClosing) {
      outstream.write('/')
    }
    outstream.write('>')
  })
  parser.on('endTag', function (name) {
    outstream.write(`</${name}>`)
    textConverter = piggy
  })
  parser.on('doctype', function (name) {
    outstream.write(`<!DOCTYPE ${name}>`)
  })
  parser.on('end', () => outstream.end())
  return parser
}

const proxyUrl = {
  proxyToReal: function (proxyUrl) {
    var url = Url.parse(proxyUrl)
    var matches = /host=((w|.|-|_)+)/.exec(url.query)
    if (!matches || matches.length < 1) {
      return null
    }
    return {
      hostname: matches[1],
      path: url.pathname
    }
  },
  realToProxy: function (realUrl) {
    var url = Url.parse(realUrl)
    var x = `http://localhost:1980${url.pathname}?host=${url.hostname}`
    console.log(`converted url ${realUrl} to ${x}`)
    return x
  }
}
