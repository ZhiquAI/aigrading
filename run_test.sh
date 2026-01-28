#!/bin/bash
cd /Users/hero/Desktop/ai-grading
echo "Running test at $(date)"
/usr/local/bin/node test_opus.js
echo "Execution finished with status $?"
