### module-acme-logging

This module wraps pino, providing the following convensions, features and safeguards

- Redacts sensitive content
- Supports machine friendly logging
- Supports human friendly logging
- Supports emitting log records as events
- Supports async context tracking
- Reports the source of empty log messages
- Allows logging to be suppressed in tests
- Relocates the context to a subdocument to avoid name clashes (level, time, etc)
- Tests errors are serialised correctly (pino#862, winston#1338, bunyan#514)
- Tests circular references (pino#990, winston#1946, bunyan#427)
- Tests unserialisable context objects
