const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const pino = require('pino');
const stringify = require('safe-stable-stringify');

module.exports = {
  init
}

function init(options = { machine: true }) {

  // https://github.com/pinojs/pino-pretty?tab=readme-ov-file#usage-with-jest
  const sync = options?.sync || Boolean(options?.test) || false;
  const maxSize = options?.maxSize || 10000;
  const als = options?.als || new AsyncLocalStorage();

  function configureMachineLogger() {
    return (options?.machine) ? [{
      target: 'pino/file',
      level: options?.machine?.level || 'info',
      options: {
        destination: options?.machine?.destination || 1,
        sync,
      }
    }] : [];
  }

  function configureHumanLogger() {
    return (options?.human) ? [{
      target: 'pino-pretty',
      level: options?.human?.level || 'info',
      options: {
        destination: options?.human?.destination || 1,
        ignore: 'time,severity',
        sync,
      }
    }] : [];
  }

  function configureTestLogger() {
    return (options?.test) ? [{
      target: path.resolve(path.join('lib', 'post-message-transport')),
      level: options?.test?.level || 'info',
    }] : [];
  };

  const formatters = {
    level(label, number) {
      return { level: number, severity: label }
    },
    log(object) {
      const { error, ...context } = object;
      return { err: error, ...context }
    },
  }

  const hooks = {
    /*
      Defines a custom logMethod that:
        1. Exposes a conventional logging API, i.e. logger.info(message, [context])
        2. Merges the asynchronous local storage store and the context, prefering the latter
        3. Reports oversized messages
    */
    logMethod(inputArgs, method, level) {
      const [message, ctx] = getArgs(inputArgs);
      const store = als.getStore() || {};
      const outputArgs = [{ ...store, ...ctx }, message ];

      const size =  Buffer.byteLength(stringify(outputArgs));
      return size > maxSize
        ? method.apply(this, [fail(`Log record size of ${(size).toLocaleString()} bytes exceeds maximum of ${(maxSize).toLocaleString()} bytes`)])
        : method.apply(this, outputArgs);
    }
  }

  const targets = [].concat(
    configureMachineLogger(),
    configureHumanLogger(),
    configureTestLogger(),
  )

  const transport = pino.transport({
    targets: targets
  });

  const logger = pino({
    base: null,
    formatters,
    hooks,
    nestedKey: 'ctx',
    redact: {
      // pino's redaction library is severely limited :(
      // https://github.com/davidmarkclements/fast-redact/issues/5
      paths: [
        'password',
        'email',
        '*.password',
        '*.email',
        '*[*].password',
        '*[*].email',
        'req.headers.*',
        'request.headers.*',
        'res.headers.*',
        'resp.headers.*',
        'response.headers.*',
        'res.req.headers.*',
        'resp.req.headers.*',
        'response.request.headers.*',
        'err.req.headers.*',
        'err.request.headers.*',
        'err.res.headers.*',
        'err.resp.headers.*',
        'err.response.headers.*',
        'err.res.req.headers.*',
        'err.resp.req.headers.*',
        'err.response.request.headers.*',
      ].concat(options?.redact?.paths || []),
    }
  }, transport);

  transport.on('message', (...args) => {
    logger.emit('message', ...args);
  })

  module.exports.logger = logger;
  module.exports.als = als;

  return logger;
}

function getArgs(inputArgs) {
  let args;
  if (inputArgs.length >= 2 && inputArgs[1] instanceof Date) args = [inputArgs[0], { ts: inputArgs[1] }];
  else if (inputArgs.length >= 2 && inputArgs[1] instanceof Error) args = [inputArgs[0], { err: inputArgs[1] }];
  else if (inputArgs.length >= 2) args = inputArgs.slice(0, 2);
  else if (inputArgs.length === 1 && ['boolean', 'number', 'string'].includes(typeof inputArgs[0])) args = inputArgs;
  else if (inputArgs.length === 1 && typeof inputArgs[0] === 'bigint') args = [String(inputArgs[0])];
  else if (inputArgs.length === 1 && inputArgs[0] instanceof Date) args = [undefined, { ts: inputArgs[0] }];
  else if (inputArgs.length === 1 && inputArgs[0] instanceof Error) args = [undefined, { err: inputArgs[0] }];
  else if (inputArgs.length === 1) args = [undefined].concat(inputArgs);
  else args = inputArgs;

  return args.some(isNotEmpty) ? args : [undefined, fail('Empty log message')];
}

function isNotEmpty(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  if (typeof value === 'string' && value.trim().length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

function fail(message) {
  return { err: new Error(message) }
}

