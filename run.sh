#!/bin/bash

# Configuration
POSTGRES_PORT=5432
NODEJS_PORT=5750
POSTGRES_EXE_PATH="/c/path/to/your/postgresportable.exe"  # Adjust the path to your postgresportable.exe
NODE_APP_PATH="/c/path/to/your/app.js"  # Adjust the path to your Node.js application entry file

# Kill any existing PostgreSQL and Node.js processes on their ports
echo "Stopping any existing PostgreSQL or Node.js processes..."
netstat -aon | grep ":$POSTGRES_PORT" | grep LISTENING | awk '{print $5}' | uniq | xargs -I {} taskkill /PID {} /F
netstat -aon | grep ":$NODEJS_PORT" | grep LISTENING | awk '{print $5}' | uniq | xargs -I {} taskkill /PID {} /F

# Start PostgreSQL
echo "Starting PostgreSQL..."
"$POSTGRES_EXE_PATH"

# Start the Node.js application
echo "Starting Node.js application..."
node "$NODE_APP_PATH"
