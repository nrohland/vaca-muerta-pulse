"""CKAN DataStore streams for Capítulo IV resources."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

import requests
from singer_sdk.streams import Stream

CKAN_TYPE_TO_JSONSCHEMA: dict[str, dict[str, Any]] = {
    "text": {"type": ["string", "null"]},
    "numeric": {"type": ["number", "null"]},
    "int": {"type": ["integer", "null"]},
    "int2": {"type": ["integer", "null"]},
    "int4": {"type": ["integer", "null"]},
    "int8": {"type": ["integer", "null"]},
    "float4": {"type": ["number", "null"]},
    "float8": {"type": ["number", "null"]},
    "timestamp": {"type": ["string", "null"], "format": "date-time"},
    "timestamptz": {"type": ["string", "null"], "format": "date-time"},
    "date": {"type": ["string", "null"], "format": "date"},
    "bool": {"type": ["boolean", "null"]},
    "boolean": {"type": ["boolean", "null"]},
    "json": {"type": ["object", "null"]},
    "jsonb": {"type": ["object", "null"]},
}

INTEGER_FIELDS = frozenset(
    {
        "idpozo",
        "anio",
        "mes",
        "idusuario",
        "id_base_fractura_adjiv",
        "cantidad_fracturas",
        "anio_if",
        "mes_if",
        "anio_ff",
        "mes_ff",
        "anio_carga",
        "mes_carga",
    }
)

SKIP_FIELDS = frozenset({"_id", "_full_text"})


def _as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(float(value))


def _periodo_from_anio_mes(row: Mapping[str, Any]) -> str | None:
    try:
        anio = _as_int(row.get("anio"))
        mes = _as_int(row.get("mes"))
    except (TypeError, ValueError):
        return None
    if anio is None or mes is None or not (1 <= mes <= 12):
        return None
    return f"{anio:04d}-{mes:02d}-01"


class CkanDatastoreStream(Stream):
    """Paginated CKAN DataStore extract for one resource_id."""

    primary_keys: list[str] = []
    replication_key = None
    resource_id_setting: str = ""
    add_periodo: bool = True

    @property
    def url_base(self) -> str:
        return str(self.config.get("api_url", "https://datos.energia.gob.ar")).rstrip("/")

    @property
    def page_size(self) -> int:
        return int(self.config.get("page_size", 32000))

    @property
    def resource_id(self) -> str:
        rid = self.config.get(self.resource_id_setting)
        if not rid:
            raise ValueError(f"Missing config `{self.resource_id_setting}` for stream {self.name}")
        return str(rid)

    def _datastore_search(self, *, limit: int, offset: int = 0) -> dict[str, Any]:
        url = f"{self.url_base}/api/3/action/datastore_search"
        params = {
            "resource_id": self.resource_id,
            "limit": limit,
            "offset": offset,
        }
        response = requests.get(url, params=params, timeout=120)
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"CKAN datastore_search failed for {self.resource_id}: {payload}")
        return payload["result"]

    @property
    def schema(self) -> dict[str, Any]:
        result = self._datastore_search(limit=0)
        properties: dict[str, Any] = {}
        for field in result.get("fields", []):
            name = field.get("id")
            if not name or name in SKIP_FIELDS:
                continue
            ckan_type = str(field.get("type") or "text").lower()
            if name in INTEGER_FIELDS:
                properties[name] = {"type": ["integer", "null"]}
            else:
                properties[name] = CKAN_TYPE_TO_JSONSCHEMA.get(
                    ckan_type, {"type": ["string", "null"]}
                )
        if self.add_periodo:
            properties["periodo"] = {"type": ["string", "null"], "format": "date"}
        return {
            "type": "object",
            "properties": properties,
        }

    def _normalize(self, row: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in row.items() if k not in SKIP_FIELDS}
        for name in INTEGER_FIELDS:
            if name in out:
                try:
                    out[name] = _as_int(out[name])
                except (TypeError, ValueError):
                    out[name] = None
        if self.add_periodo:
            out["periodo"] = _periodo_from_anio_mes(out)
        return out

    def get_records(self, context: dict | None) -> Iterable[dict[str, Any]]:
        del context
        offset = 0
        emitted = 0
        max_records = self.config.get("max_records")
        max_records_i = int(max_records) if max_records not in (None, "") else None
        page_size = self.page_size
        while True:
            remaining = None
            if max_records_i is not None:
                remaining = max_records_i - emitted
                if remaining <= 0:
                    break
            limit = page_size if remaining is None else min(page_size, remaining)
            result = self._datastore_search(limit=limit, offset=offset)
            records = result.get("records") or []
            if not records:
                break
            for row in records:
                yield self._normalize(row)
                emitted += 1
                if max_records_i is not None and emitted >= max_records_i:
                    return
            offset += len(records)
            total = result.get("total")
            if total is not None and offset >= int(total):
                break
            if len(records) < limit:
                break


class ProduccionPozoMesStream(CkanDatastoreStream):
    name = "produccion_pozo_mes"
    primary_keys = ["idpozo", "anio", "mes"]
    resource_id_setting = "produccion_resource_id"


class CapituloIvPozosStream(CkanDatastoreStream):
    name = "capitulo_iv_pozos"
    primary_keys = ["idpozo"]
    resource_id_setting = "pozos_resource_id"
    add_periodo = False


class FracturasAdjuntoIvStream(CkanDatastoreStream):
    name = "fracturas_adjunto_iv"
    primary_keys = ["id_base_fractura_adjiv"]
    resource_id_setting = "fracturas_resource_id"
