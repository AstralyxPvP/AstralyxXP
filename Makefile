SHELL := /bin/bash
.DEFAULT_GOAL := help

# ─── AstralyxXP Makefile ────────────────────────────────────────────────────────
# Everything you need to develop, test and deploy the AstralyxXP bot + plugin.

.PHONY: help setup install dev deploy dry-run preview register test check \
		lint plugin plugin-build schema schema-local migrate migrate-local \
		logs tail clean

## 📟 help            : show this help
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | sort

## 📦 setup           : install everything (npm deps)
setup: install

## 🌱 install         : npm install (worker deps)
install:
	npm install

## 🧪 dev             : run locally with wrangler (http://localhost:8787)
dev:
	npx wrangler dev --local

## 🧪 preview         : run with remote state (needs wrangler login)
preview:
	npx wrangler dev

## 🚀 deploy          : manual deploy straight to Cloudflare
deploy:
	npx wrangler deploy

## 🔍 dry-run         : validate worker code without deploying
dry-run:
	npx wrangler deploy --dry-run

## 🧪 test            : run worker JS syntax check + unit tests
test: check
	node .tests/test-games.mjs

## ✅ check           : syntax-check every src file
check:
	@echo "→ node --check src/**/*.js"
	@find src -name '*.js' -print0 | xargs -0 -n1 node --check
	@echo "→ all files OK"

## 🧹 lint            : alias for check
lint: check

## 🃏 register        : register Discord slash commands (needs .dev.vars)
register:
	npm run register

## 📄 schema          : apply schema.sql to the PRODUCTION D1
schema:
	npx wrangler d1 execute astralyx-xp --remote --file=schema.sql

## 💾 schema-local    : apply schema.sql to the LOCAL D1
schema-local:
	npx wrangler d1 execute astralyx-xp --local --file=schema.sql

## 🏗  plugin         : build the Paper plugin jar (paper-plugin/target)
plugin: plugin-build

plugin-build:
	(cd paper-plugin && mvn -q clean package)

## 🏭 plugin-install  : build + copy jar into the local server plugins folder
plugin-install: plugin-build
	mkdir -p ../plugins
	cp paper-plugin/target/AstralyxXP.jar ../plugins/

## 📜 logs            : tail live worker logs with wrangler
logs:
	npx wrangler tail

## 🧹 clean           : remove build artifacts
clean:
	rm -rf paper-plugin/target dist
	npm run clean 2>/dev/null || true