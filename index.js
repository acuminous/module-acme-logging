const path = require('node:path');
const pino = require('pino');

module.exports = function factory(options = { machine: true }) {

  function configureMachineLogger() {
    return (options?.machine) ? [{
      target: 'pino/file',
      level: options?.machine?.level || 'info',
      options: {
        destination: options?.machine?.destination || 1
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
        sync: true, // https://github.com/pinojs/pino-pretty?tab=readme-ov-file#usage-with-jest
      }
    }] : [];
  }

  function configureTestLogger() {
    return (options?.test) ? [{
      target: path.resolve(path.join('lib', 'post-message-transport')),
      level: options?.test?.level || 'info',
    }] : [];
  };

  const hooks = {
    /*
      Defines a custom logMethod that:

        1. Exposes a conventional logging API, i.e. logger.info(message, [context])
        2. Logs the message severity
        3. Merges the asynchronous local storage store and the context, prefering the latter
    */
    logMethod(inputArgs, method, level) {
      const [message, ctx] = getArgs(inputArgs);
      const store = options.als?.getStore() || {};
      const severity = pino.levels.labels[level];
      return method.apply(this, [{ severity, ...ctx, ...store }, message ]);
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
    hooks,
    nestedKey: 'ctx',
    redact: {
      // pino's redaction library is severely limited :(
      // https://github.com/davidmarkclements/fast-redact/issues/5
      paths: [
        'email',
        'password',
        '*.email',
        '*.password',
        '*.headers.*',
        '*.*.headers.*',
      ].concat(options?.redact?.paths || []),
    }
  }, transport);

  transport.on('message', (...args) => {
    logger.emit('message', ...args);
  })

  return logger;
}

function getArgs(inputArgs) {
  let args;
  if (inputArgs.length >= 2) args = inputArgs.slice(0, 2);
  else if (inputArgs.length === 1 && ['boolean', 'number', 'string'].includes(typeof inputArgs[0])) args = inputArgs;
  else if (inputArgs.length === 1 && typeof inputArgs[0] === 'bigint') args = [String(inputArgs[0])];
  else if (inputArgs.length === 1 && inputArgs[0] instanceof Error) args = [undefined, { err: inputArgs[0] }];
  else if (inputArgs.length === 1) args = [undefined].concat(inputArgs);
  else args = inputArgs;

  return args.some(isNotEmpty) ? args : [undefined, { err: new Error('Empty log message') }];
}

function isNotEmpty(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  if (typeof value === 'string' && value.trim().length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

