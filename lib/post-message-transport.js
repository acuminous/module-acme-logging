const { parentPort } = require("node:worker_threads");
const build = require('pino-abstract-transport');

module.exports = function() {
  return build(function(source) {
    source.on('data', function(record) {
      parentPort.postMessage({ code: 'EVENT', name: 'message', args: [record]});
    })
  })
}