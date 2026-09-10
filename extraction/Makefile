.PHONY: install extract discover tap-about

PYTHON ?= python3
VENV := .venv
MELTANO := $(VENV)/bin/meltano

install:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install "meltano==4.2.2"
	$(MELTANO) install

extract:
	$(MELTANO) run cap4-produccion

discover:
	$(MELTANO) invoke tap-ckan-datastore --discover

tap-about:
	$(MELTANO) invoke tap-ckan-datastore --about
