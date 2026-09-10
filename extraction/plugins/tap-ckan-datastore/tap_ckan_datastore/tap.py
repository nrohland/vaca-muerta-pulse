"""TapCkanDatastore — Capítulo IV via CKAN DataStore (no HTML scraping)."""

from __future__ import annotations

from singer_sdk import Tap
from singer_sdk import typing as th

from tap_ckan_datastore.streams import (
    CapituloIvPozosStream,
    CkanDatastoreStream,
    FracturasAdjuntoIvStream,
    ProduccionPozoMesStream,
)

STREAM_TYPES: list[type[CkanDatastoreStream]] = [
    ProduccionPozoMesStream,
    CapituloIvPozosStream,
    FracturasAdjuntoIvStream,
]


class TapCkanDatastore(Tap):
    """Singer SDK tap for datos.energia.gob.ar CKAN DataStore."""

    name = "tap-ckan-datastore"

    config_jsonschema = th.PropertiesList(
        th.Property(
            "api_url",
            th.StringType,
            default="https://datos.energia.gob.ar",
            description="CKAN site origin (no trailing slash required).",
        ),
        th.Property(
            "produccion_resource_id",
            th.StringType,
            required=True,
            description="CKAN resource UUID for annual pozo-mes production.",
        ),
        th.Property(
            "pozos_resource_id",
            th.StringType,
            description="CKAN resource UUID for Capítulo IV - Pozos (well dim / coords).",
        ),
        th.Property(
            "fracturas_resource_id",
            th.StringType,
            description="CKAN resource UUID for Adjunto IV fracturas.",
        ),
        th.Property(
            "page_size",
            th.IntegerType,
            default=32000,
            description="datastore_search page size (CKAN typically caps at 32000).",
        ),
        th.Property(
            "max_records",
            th.IntegerType,
            description="Optional cap for local smoke (unset in prod / full-year load).",
        ),
    ).to_dict()

    def discover_streams(self) -> list[CkanDatastoreStream]:
        streams: list[CkanDatastoreStream] = []
        for stream_class in STREAM_TYPES:
            setting = stream_class.resource_id_setting
            if self.config.get(setting):
                streams.append(stream_class(self))
        return streams


if __name__ == "__main__":
    TapCkanDatastore.cli()
