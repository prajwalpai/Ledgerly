#!/bin/bash
set -u
launchctl print "gui/$(id -u)/com.ledgerly.app"
launchctl print "gui/$(id -u)/com.ledgerly.drive-sync"
