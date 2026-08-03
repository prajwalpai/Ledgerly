#!/bin/bash
set -euo pipefail
user_id="$(id -u)"
launchctl kickstart -k "gui/${user_id}/com.ledgerly.app"
launchctl kickstart "gui/${user_id}/com.ledgerly.drive-sync"
echo "Ledgerly app restarted and Drive sync requested."
