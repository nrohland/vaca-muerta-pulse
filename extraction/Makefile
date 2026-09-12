.PHONY: install extract extract-fracturas discover tap-about ensure-table ensure-fracturas

PYTHON ?= python3
VENV := .venv
MELTANO := $(VENV)/bin/meltano

install:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install "meltano==4.2.2" "google-cloud-bigquery"
	$(MELTANO) install

ensure-table:
	$(VENV)/bin/python scripts/prepare_year_load.py --dataset $${BIGQUERY_DATASET:-raw_cap4_dev}

ensure-fracturas:
	$(VENV)/bin/python scripts/prepare_fracturas_load.py --dataset $${BIGQUERY_DATASET:-raw_cap4_dev}

extract:
	$(MELTANO) run cap4-produccion

extract-fracturas:
	$(MELTANO) run cap4-fracturas

discover:
	$(MELTANO) invoke tap-ckan-datastore --discover

tap-about:
	$(MELTANO) invoke tap-ckan-datastore --about
