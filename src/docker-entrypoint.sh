#!/bin/sh
# Entrypoint script to properly pass all arguments to Node.js
exec node dist/src/main.js "$@"


