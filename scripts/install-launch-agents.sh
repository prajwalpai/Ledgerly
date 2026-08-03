#!/bin/bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
user_home="${HOME}"
user_id="$(id -u)"
node_path="$(command -v node)"
app_dir="${user_home}/Library/Application Support/Ledgerly/app"
agent_dir="${user_home}/Library/LaunchAgents"
log_dir="${user_home}/Library/Logs/Ledgerly"

mkdir -p "${app_dir}" "${agent_dir}" "${log_dir}"
mkdir -p "${repo_dir}/.next/standalone/.next/static"
cp -R "${repo_dir}/.next/static/." "${repo_dir}/.next/standalone/.next/static/"
cp -R "${repo_dir}/.next/standalone/." "${app_dir}/"
cp "${repo_dir}/scripts/start-server.mjs" "${repo_dir}/scripts/run-drive-sync.mjs" "${app_dir}/"

for label in com.ledgerly.app com.ledgerly.drive-sync; do
  source_plist="${repo_dir}/launchd/${label}.plist"
  target_plist="${agent_dir}/${label}.plist"
  sed -e "s|/Users/prajpai|${user_home}|g" -e "s|/opt/homebrew/bin/node|${node_path}|g" "${source_plist}" > "${target_plist}.new"
  plutil -lint "${target_plist}.new"
  launchctl bootout "gui/${user_id}" "${target_plist}" 2>/dev/null || true
  mv "${target_plist}.new" "${target_plist}"
  loaded=false
  for attempt in 1 2 3; do
    if launchctl bootstrap "gui/${user_id}" "${target_plist}"; then loaded=true; break; fi
    sleep "${attempt}"
  done
  if [[ "${loaded}" != "true" ]]; then echo "Could not load ${label}." >&2; exit 1; fi
done

launchctl kickstart -k "gui/${user_id}/com.ledgerly.app"
echo "Ledgerly installed. Open http://127.0.0.1:4317"
