#!/bin/bash
# Auto-restart monitor for Ss_Wakeel_bot
cd "$(dirname "$0")"
BOT_PID_FILE="bot.pid"
LOG_FILE="bot.log"
RESTART_COUNT_FILE="restart_count.txt"

echo "[$(date)] run.sh started" >> "$LOG_FILE"

while true; do
  node bot.js >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE - restarting in 3s..." >> "$LOG_FILE"
  
  # Increment restart count
  if [ -f "$RESTART_COUNT_FILE" ]; then
    COUNT=$(cat "$RESTART_COUNT_FILE")
    echo $((COUNT + 1)) > "$RESTART_COUNT_FILE"
  else
    echo "1" > "$RESTART_COUNT_FILE"
  fi
  
  sleep 3
done