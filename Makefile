SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help setup lint format format-check test scan ci clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-16s %s\n", $$1, $$2}'

setup: ## Install toolchains and project dependencies
	./scripts/setup.sh

lint: ## Run JS + Python linting
	./scripts/lint.sh

format: ## Auto-format JS + Python code
	./scripts/format.sh write

format-check: ## Verify formatting without changing files
	./scripts/format.sh check

test: ## Run all tests
	./scripts/test.sh

scan: ## Run dependency + static security scans
	./scripts/scan.sh

ci: ## Run the full local CI gate
	./scripts/ci.sh

clean: ## Remove common local caches/artifacts
	rm -rf .venv .pytest_cache .ruff_cache .coverage coverage dist node_modules
