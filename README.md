# module-acme-logging

This module wraps pino, implementing the following best practices...

- A conventional API
- Support for machine friendly logging
- Support for human friendly logging
- Support for test friendly logging
- Support for async context tracking
- Support for redaction of sensitive content
- Reporting the source of empty log messages
- Relocating the context to a subdocument to avoid name clashes (level, time, etc)
- Ensuring errors are serialised correctly (pino#862, winston#1338, bunyan#514)
- Ensuring circular references (pino#990, winston#1946, bunyan#427)
- Ensuring unserialisable context objects

This module isn't published to npm, the idea is for you to create your own organsational specific best practice module, potentially using this as an example.

## Usage

### Machine friendly logging
```js
const { init } = require('module-acme-logging');
init({ machine: true });
```

```js
const { logger } = require('module-acme-logging');
logger.info('Some message', { foo: 'bar' });
```

```json
{"level":30,"severity":"info","time":1710696070387,"ctx":{"foo":"bar"},"msg":"Some message"}
```

### Human friendly logging
```js
const { init } = require('module-acme-logging');
init({ human: true });
```

```js
const { logger } = require('module-acme-logging');
logger.info('Some message', { foo: 'bar' });
```

```
INFO: Some message
    ctx: {
      "foo": "bar"
    }
```

### Test friendly logging
```js
const { init } = require('module-acme-logging');
init({ test: true });
```

```js
const { logger } = require('module-acme-logging');

it('should log a message', (done) => {
  logger.once('message', (record) => {
    assert.equal(record.message, 'Expected message');
    done();
  });
  codeUnderTest();
})
```
No messages are written to stdout because neither machine or human is true.


### Async Context Tracing
```js
const { logger, als } = require('module-acme-logging');

als.run({ tracer: 123 }, () => {
  doStuff();
})

function doStuff() {
  logger.info('Some message', { foo: 'bar' });
}
```

```json
{"level":30,"severity":"info","time":1710696070387,"ctx":{"tracer":123,"foo":"bar"},"msg":"Some message"}
```

### Redaction
```js
const { init } = require('module-acme-logging');
const logger = init({ machine: true, redact: { paths: ['foo'] } });
logger.info('Some message', { foo: 'bar' });
```

```json
{"level":30,"severity":"info","time":1710696070387,"ctx":{"foo":"[Redacted]"},"msg":"Some message"}
```

### Reporting the source of empty log messages
```js
const { logger } = require('module-acme-logging');
logger.info(undefined);
```

```json
{"level":50,"severity":"info","time":1710696172704,"ctx":{"err":{"type":"Error","message":"Empty log message"}},"msg":"Empty log message!"}

```
The stack trace was omitted for brevity in the readme, but will be logged irl

### Error serialisation
```js
const { logger } = require('module-acme-logging');
logger.error(new Error("Oh Noes!"));
```

```json
{"level":50,"severity":"error","time":1710696172704,"ctx":{"err":{"type":"Error","message":"Oh Noes!"}},"msg":"Oh Noes!"}
```
The stack trace was omitted for brevity in the readme, but will be logged irl

