import Http from 'http'
import Url from 'url'
import Parse from 'parse5'

function main () {
  let server = new Http.Server()
  let port = proxyUrl.getPort()
  server.listen(port)
  console.log(`listening to port ${port}`)
  server.on('request', onIncomingRequest)
}

function onIncomingRequest (req, res) {
  console.log(`Recieved request for ${req.url}`)
  var url = proxyUrl.proxyToReal(req.url)
  if (url) {
    requestUrl(url,
      (instream) => onResponseSuccess(instream, res),
      (error) => onResponseError(res, error))
  } else {
    console.error(`Error parsing source URL: ${req.url}`)
    res.statusCode = 400
    res.end('Error: could not parse request URL')
  }
}

function requestUrl (url, onSuccess, onError) {
  console.log(`Requesting original page from ${url.hostname}${url.path}`)
  Http.get(url, (response) => onSuccess(response))
      .on('error', (e) => onError(e))
}

function onResponseError (outstream, error) {
  console.error(`Request error: ${error.message}`)
  outstream.statusCode = 500
  outstream.end(`Request error: ${error.message}`)
}

function onResponseSuccess (instream, outstream) {
  console.log('Successfully recieved response')
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

function ProxyUrl () {
  let port
  this.getPort = function () {
    if (!port) {
      port = parseInt(process.argv[1], 10)
      if (isNaN(port)) {
        port = 1980
        console.log(`Port is not provided or not a valid number. Using default value ${port}`)
      }
    }
    return port
  }
  this.proxyToReal = function (proxyUrl) {
    var url = Url.parse(proxyUrl)
    var matches = /host=((w|.|-|_)+)/.exec(url.query)
    if (!matches || matches.length < 1) {
      return null
    }
    return {
      hostname: matches[1],
      path: url.pathname
    }
  }
  this.realToProxy = function (realUrl) {
    var url = Url.parse(realUrl)
    var x = `http://localhost:${this.getPort()}${url.pathname}?host=${url.hostname}`
    console.log(`converted url ${realUrl} to ${x}`)
    return x
  }
}

let proxyUrl = new ProxyUrl()
main()
