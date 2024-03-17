const { EOL } = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks');
const { ok, strictEqual: eq, deepStrictEqual: deq, match } = require('node:assert');
const { before, describe, it } = require('zunit');

const { init } = require('..');

describe('Logging Conventions', () => {

  before(() => {
    const directory = path.join('test', 'logs');
    fs.readdirSync(directory)
      .filter((filename) => path.extname(filename) === '.log')
      .map((filename) => path.join(directory, filename))
      .forEach((filename) => fs.unlinkSync(filename));
  });

  it('should expose a conventional API supporting both message and context parameters', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(Object.keys(record).sort(), ['ctx', 'level', 'msg', 'severity', 'time'])
      deq(record.ctx, { foo: 'bar' })
      eq(record.level, 30)
      eq(record.msg, 'Some message')
      eq(record.severity, 'info');
      done();
    });
    logger.info('Some message', { foo: 'bar' } );
  });

  it('should expose a conventional API supporting just a string parameter', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(Object.keys(record).sort(), ['level', 'msg', 'severity', 'time'])
      eq(record.level, 30)
      eq(record.msg, 'Some message')
      eq(record.severity, 'info');
      done();
    });
    logger.info('Some message');
  });

  it('should expose a conventional API supporting just a numeric parameter', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      eq(record.msg, 1)
      done();
    });
    logger.info(1);
  });

  it('should expose a conventional API supporting just a bigint parameter', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      eq(record.msg, '12345678901234567890')
      done();
    });
    logger.info(12345678901234567890n);
  });

  it('should expose a conventional API supporting just a boolean parameter', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      eq(record.msg, 1)
      done();
    });
    logger.info(1);
  });

  it('should expose a conventional API supporting just an error parameter', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(Object.keys(record).sort(), ['ctx', 'level', 'msg', 'severity', 'time'])
      deq(record.ctx.err.type, 'Error');
      deq(record.ctx.err.message, 'Oh Noes!');
      ok(record.ctx.err.stack);
      eq(record.level, 50)
      eq(record.msg, 'Oh Noes!')
      eq(record.severity, 'error');
      done();
    });
    logger.error(new Error('Oh Noes!'));
  });

  it('should serialise custom error properties', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(record.ctx.err.wibble, 123);
      done();
    });
    logger.error(Object.assign(new Error('Oh Noes!'), { wibble: 123 }));
  });

  it('should report the source of empty logs', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      eq(record.msg, 'Empty log message');
      eq(record.ctx.err.message, 'Empty log message');
      match(record.ctx.err.stack, /index.test.js/);
      done();
    });
    logger.info();
  });

  it('should support human friendly format', (t, done) => {
    const destination = path.join('test', 'logs', t.name.replace(/ /g, '-')) + '.log';
    const logger = init({ human: { destination }});
    logger.info('Some message', { foo: 'bar' } );

    setTimeout(() => {
      const output = fs.readFileSync(destination, 'utf-8').split(EOL);
      eq(output[0], '\x1B[32mINFO\x1B[39m: \x1B[36mSome message\x1B[39m');
      done();
    }, 500);
  });

  it('should support asynchronous context tracking', (t, done) => {
    const als = new AsyncLocalStorage();
    const logger = init({ als, test: true });
    logger.once('message', (record) => {
      deq(record.ctx, { foo: 'bar', tracer: 123 })
      done();
    });

    als.run({ tracer: 123 }, () => {
      logger.info('Some message', { foo: 'bar' } );
    });
  });

  it('should prefer context object attributes to asynchronous context tracking ones', (t, done) => {
    const als = new AsyncLocalStorage();
    const logger = init({ als, test: true });
    logger.once('message', (record) => {
      deq(record.ctx, { foo: 'bar', tracer: 123 })
      done();
    });

    als.run({ tracer: 123, foo: 'baz' }, () => {
      logger.info('Some message', { foo: 'bar' } );
    });
  });

  it('should tolerate context objects with circular references', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(record.ctx, { foo: 'bar', context: { context: '[Circular]', foo: 'bar' } })
      done();
    });
    context = { foo: 'bar' };
    context.context = context;
    logger.info('Some message', context );
  });

  it('should tolerate context objects with unserialisable types', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(record.ctx, { foo: 'bar' })
      done();
    });
    logger.info('Some message', { foo: 'bar', fn: () => {} });
  });


  it('should redact sensitive information', (t, done) => {
    const logger = init({ test: true });
    logger.once('message', (record) => {
      deq(Object.keys(record).sort(), ['ctx', 'level', 'msg', 'severity', 'time'])
      deq(record.ctx, {
        password: '[Redacted]',
        email: '[Redacted]',
        user: {
          password: '[Redacted]',
          email: '[Redacted]',
        },
        users: [{
          password: '[Redacted]',
          email: '[Redacted]',
        }],
        request: {
          headers: {
            'Authorization': '[Redacted]',
          }
        },
        response: {
          request: {
            headers: {
              'Authorization': '[Redacted]',
            }
          }
        }
      });
      eq(record.level, 30)
      eq(record.msg, 'Some message')
      done();
    });
    logger.info('Some message', {
      password: 'secret',
      email: 'secret',
      user: {
        password: 'secret',
        email: 'secret',
      },
      users: [
        {
          password: 'secret',
          email: 'secret',
        }
      ],
      request: {
        headers: {
          Authorization: 'secret'
        }
      },
      response: {
        request: {
          headers: {
            Authorization: 'secret'
          }
        }
      }
    });
  });
})