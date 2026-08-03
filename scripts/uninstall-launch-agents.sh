#!/bin/bash
set -u
user_id="$(id -u)"
launchctl bootout "gui/${user_id}/com.ledgerly.app" 2>/dev/null || true
launchctl bootout "gui/${user_id}/com.ledgerly.drive-sync" 2>/dev/null || true
echo "Ledgerly agents unloaded. User data was not deleted."
