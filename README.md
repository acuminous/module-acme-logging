# module-acme-logging

This module wraps pino, implementing the following best practices...

- A conventional API
- Support for machine friendly logging
- Support for human friendly logging
- Support for test friendly logging
- Support for async context tracking
- Support for redaction of sensitive content
- Reporting the source of empty log messages
- Reporting the source of overised log records
- Relocating the context to a subdocument to avoid name clashes (level, time, etc)
- Ensuring dates are serialised correctly 
- Ensuring errors are serialised correctly ([pino#862](https://github.com/pinojs/pino/issues/862), [winston#1338](https://github.com/winstonjs/winston/issues/1338), [bunyan#514](https://github.com/trentm/node-bunyan/issues/514))
- Ensuring circular references are tolerated ([pino#990](https://github.com/pinojs/pino/issues/990), [winston#1946](https://github.com/winstonjs/winston/issues/1946), [bunyan#427](https://github.com/trentm/node-bunyan/issues/427))
- Ensuring unserialisable context objects are tolerated

This module isn't published to npm, the idea is for you to create your own organsational specific best practice module, potentially using this as an example.

## Usage

### Initialisation
```js
const { init } = require('module-acme-logging');
const logger = init(options);
logger.info('Some message', { foo: 'bar' });
```

### Once initialised
```js
const { logger } = require('module-acme-logging');
logger.info('Some message', { foo: 'bar' });
```

## Options

| Name    | Type                        | Required | Default  | Notes |
|---------|-----------------------------|----------|----------|-------|
| machine | boolean / transport options | no       | true     | Supported transport options are level and destination         |
| human   | boolean                     | no       |          | Supported transport options are level and destination         |
| test    | boolean                     | no       |          | Supported transport options are level                         |
| als     | AsyncLocalStorage           | no       | *        | Defaults to an instance of AsyncLocalStorate                  |
| maxSize | integer                     | no       | 10,000   | Replaces oversize log records with one indicating the problem |
| sync    | boolean                     | no       | false    | See pino documentation                                        |

## Examples

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
{"level":50,"severity":"info","time":1710696070387,"ctx":{"err":{"type":"Error","message":"Empty log message"}},"msg":"Empty log message"}

```
The stack trace was omitted for brevity in the readme, but will be logged irl

### Reporting the source of oversized log messages
```js
const { logger } = require('module-acme-logging');
logger.info(new Array(10000).fill('x').join(''));
```

```json
{"level":50,"severity":"info","time":1710696070387,"ctx":{"err":{"type":"Error","message":"Log record size of 10,007 bytes exceeds maximum of 10,000 bytes"}},"msg":"Log record size of 10,007 bytes exceeds maximum of 10,000 bytes"}

```

```js
const { logger } = require('module-acme-logging');
logger.info('Some message', { x: new Array(10000).fill('x').join('') });
```

```json
{"level":50,"severity":"info","time":1710696070387,"ctx":{"err":{"type":"Error","message":"Log record size of 10,025 bytes exceeds maximum of 10,000 bytes"}},"msg":"Log record size of 10,007 bytes exceeds maximum of 10,000 bytes"}

```

The stack trace was omitted for brevity in the readme, but will be logged irl

### Error serialisation
```js
const { logger } = require('module-acme-logging');
logger.error(new Error('Oh Noes!'));
```

```js
const { logger } = require('module-acme-logging');
logger.error({ err: new Error('Oh Noes!') });
```

```js
const { logger } = require('module-acme-logging');
logger.error({ error: new Error('Oh Noes!') });
```

all result in...

```json
{"level":50,"severity":"error","time":1710696070387,"ctx":{"err":{"type":"Error","message":"Oh Noes!","stack":"..."}},"msg":"Oh Noes!"}
```


```js
const { logger } = require('module-acme-logging');
logger.error('Some message', new Error('Oh Noes!'));
```

```js
const { logger } = require('module-acme-logging');
logger.error('Some message', { err: new Error('Oh Noes!') });
```

```js
const { logger } = require('module-acme-logging');
logger.error('Some message', { error: new Error('Oh Noes!') });
```

all result in...

```json
{"level":50,"severity":"error","time":1710696070387,"ctx":{"err":{"type":"Error","message":"Oh Noes!","stack":"..."}},"msg":"Some message"}
```

### Date serialisation
```js
const { logger } = require('module-acme-logging');
logger.info(new Date('2024-02-02T00:00:00.000Z'));
```

```json
{"level":30,"severity":"info","time":1710696070387,"ctx":{"ts":"2024-02-02T00:00:00.000Z"}}
```

```js
const { logger } = require('module-acme-logging');
logger.info("Some message", new Date('2024-02-02T00:00:00.000Z'));
```

```json
{"level":30,"severity":"info","time":1710696070387,"msg":"Some Message","ctx":{"ts":"2024-02-02T00:00:00.000Z"}}
```

```js
const { logger } = require('module-acme-logging');
logger.info("Some message", { groundhogDay: new Date('2024-02-02T00:00:00.000Z') });
```

```json
{"level":30,"severity":"info","time":1710696070387,"msg":"Some Message","ctx":{"groundhogDay":"2024-02-02T00:00:00.000Z"}}
```
