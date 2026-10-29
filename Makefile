.DEFAULT_GOAL := help
COMPOSE ?= docker compose

.PHONY: help demo up down test logs

help: ## Mostra i comandi disponibili
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-6s %s\n", $$1, $$2}'

demo: ## Avvia con i dati finti, nessuna configurazione (http://localhost:8080)
	DEMO_MODE=true $(COMPOSE) up -d --build --wait
	@echo "Git Wrapped (demo) su http://localhost:8080"

# `make up` usa sempre i dati reali: DEMO_MODE=false prevale sul valore scritto in .env.
up: ## Avvia con i dati GitLab reali da .env
	@test -f .env || { echo "Manca .env: copia .env.example in .env e compilalo (cp .env.example .env)."; exit 1; }
	@grep -Eq '^GITLAB_TOKEN=.+' .env || { echo "Manca GITLAB_TOKEN in .env (vedi docs/gitlab-token.md). Per provare senza token: make demo."; exit 1; }
	@grep -Eq '^GITLAB_GROUP=.+' .env || { echo "Manca GITLAB_GROUP in .env, per esempio azienda/team."; exit 1; }
	DEMO_MODE=false $(COMPOSE) up -d --build --wait
	@echo "Git Wrapped su http://localhost:8080"

down: ## Ferma e rimuove i container
	$(COMPOSE) --profile test down --remove-orphans

test: ## Unit ed end-to-end dentro un container (immagine Playwright)
	DEMO_MODE=true $(COMPOSE) --profile test up -d --build --wait web
	$(COMPOSE) --profile test run --rm --build test; status=$$?; \
	$(COMPOSE) --profile test down --remove-orphans; exit $$status

logs: ## Log dei servizi (gia' privi di dati personali)
	$(COMPOSE) logs -f --tail=100
