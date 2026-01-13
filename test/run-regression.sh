#!/bin/bash

# Regression Test Runner
# Runs all regression tests with detailed output

echo "=========================================="
echo "  Book of Mormon Online - Regression Tests"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Run regression tests
echo "Running regression test suite..."
echo ""

npx jest test/regression --verbose --coverage --coverageDirectory=coverage/regression
EXIT_CODE=$?

# Check exit code
if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All regression tests passed!${NC}"
else
    echo ""
    echo -e "${RED}✗ Some regression tests failed${NC}"
    exit $EXIT_CODE
fi
