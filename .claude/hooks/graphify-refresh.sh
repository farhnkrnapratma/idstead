#!/usr/bin/env bash
command -v graphify >/dev/null 2>&1 && (graphify update . >/dev/null 2>&1 &)
echo '{}'
