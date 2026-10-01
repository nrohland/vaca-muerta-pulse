"""CKAN DataStore streams for Capítulo IV resources."""

from __future__ import annotations

from typing import Any, Iterable, Mapping
from decimal import Decimal, InvalidOperation
from datetime import datetime
import math
from jsonschema import Draft7Validator, FormatChecker
import json
import os
from pathlib import Path

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
    if isinstance(value, bool):
        raise ValueError("Boolean is not an integral identifier")
    try:
        number = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Invalid integral value") from exc
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError("Expected finite integral value")
    return int(number)


def _periodo_from_anio_mes(row: Mapping[str, Any]) -> str | None:
    anio = _as_int(row.get("anio"))
    mes = _as_int(row.get("mes"))
    if anio is None or mes is None or not (1 <= anio <= 9999 and 1 <= mes <= 12):
        raise ValueError("Invalid production year/month")
    return f"{anio:04d}-{mes:02d}-01"


def field_contract(fields: list[dict]) -> dict[str, str]:
    contract = {f["id"]: f["type"] for f in fields if f["id"] not in SKIP_FIELDS}
    if len(contract) != len([f for f in fields if f["id"] not in SKIP_FIELDS]):
        raise ValueError("Duplicate schema field")
    return contract


def validate_production_fields(fields: list[dict]) -> None:
    expected = json.loads(Path(__file__).with_name("production_contract.json").read_text())
    if field_contract(fields) != expected:
        raise ValueError("Production source schema differs from reviewed contract")



SOURCE_FORMATS = FormatChecker()


@SOURCE_FORMATS.checks("date-time", raises=(ValueError, TypeError))
def _source_timestamp(value: Any) -> bool:
    # CKAN PostgreSQL timestamp has no timezone; do not invent one on raw rows.
    if not isinstance(value, str):
        return True
    if "T" not in value and " " not in value:
        return False
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return True


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
            "sort": ",".join(f"{key} asc" for key in self.primary_keys) if self.primary_keys else "_id asc",
            "include_total": True,
        }
        response = requests.get(url, params=params, timeout=120)
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"CKAN datastore_search failed for {self.resource_id}")
        return payload["result"]

    def _schema_from_datastore(self) -> dict[str, Any]:
        result = self._datastore_search(limit=0)
        if self.name == "produccion_pozo_mes":
            validate_production_fields(result.get("fields", []))
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
            "additionalProperties": False,
            "required": list(properties) if self.name == "produccion_pozo_mes" else list(self.primary_keys),
        }

    @property
    def schema(self) -> dict[str, Any]:
        # Singer SDK reads `schema` on every RECORD (mask + type conformance).
        # Hitting datastore_search per row is ~1 rec/s and cannot load ~991k.
        if self._schema is None:
            self._schema = self._schema_from_datastore()
        return self._schema

    def _normalize(self, row: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in row.items() if k not in SKIP_FIELDS}
        for name in INTEGER_FIELDS:
            if name in out:
                out[name] = _as_int(out[name])
        for key in self.primary_keys:
            if out.get(key) is None:
                raise ValueError(f"Missing required key {key}")
        if self.name == "produccion_pozo_mes" and out["idpozo"] <= 0:
            raise ValueError("idpozo must be positive")
        if self.add_periodo:
            out["periodo"] = _periodo_from_anio_mes(out)
        if self.name == "produccion_pozo_mes":
            for name, property_schema in self.schema["properties"].items():
                value = out.get(name)
                if value is not None and "number" in property_schema.get("type", []):
                    if isinstance(value, bool):
                        raise ValueError(f"Invalid numeric field {name}")
                    try:
                        number = float(value)
                    except (ValueError, TypeError, OverflowError) as exc:
                        raise ValueError(f"Invalid numeric field {name}") from exc
                    if not math.isfinite(number):
                        raise ValueError(f"Nonfinite numeric field {name}")
                    out[name] = number
        return out

    def get_records(self, context: dict | None) -> Iterable[dict[str, Any]]:
        del context
        max_records = self.config.get("max_records")
        cap = _as_int(max_records)
        if cap is not None and cap <= 0:
            raise ValueError("max_records must be positive")
        if cap is not None and (self.config.get("reemit") or os.environ.get("REEMIT", "").lower() == "true"):
            raise ValueError("Capped reemit is forbidden")
        page_size = _as_int(self.config.get("page_size", 32000))
        if page_size is None or not 1 <= page_size <= 32000:
            raise ValueError("page_size must be 1..32000")
        initial = self._datastore_search(limit=0)
        fields = initial.get("fields", [])
        if self.name == "produccion_pozo_mes":
            validate_production_fields(fields)
        total = _as_int(initial.get("total"))
        if total is None or total < 0 or initial.get("total_was_estimated"):
            raise ValueError("Exact source total required")
        expected = total if cap is None else min(total, cap)
        offset = 0
        previous_order_key = None
        seen_keys = set()
        validator = Draft7Validator(self.schema, format_checker=SOURCE_FORMATS)
        while offset < expected:
            limit = min(page_size, expected - offset)
            result = self._datastore_search(limit=limit, offset=offset)
            if (_as_int(result.get("total")) != total or result.get("total_was_estimated")
                    or field_contract(result.get("fields", [])) != field_contract(fields)):
                raise ValueError("Source total/schema changed during paging")
            records = result.get("records") or []
            if not records or len(records) > limit or offset + len(records) > expected:
                raise ValueError("Incomplete or oversized page")
            for row in records:
                normalized = self._normalize(row)
                error = next(validator.iter_errors(normalized), None)
                if error is not None:
                    # Do not echo raw row values into logs on failure.
                    field = ".".join(str(part) for part in error.path) or "record"
                    raise ValueError(f"Record schema validation failed: {field} ({error.validator})")
                key = tuple(normalized[k] for k in self.primary_keys)
                if self.primary_keys and key in seen_keys:
                    raise ValueError("Duplicate source grain")
                order_key = key if self.primary_keys else (_as_int(row.get("_id")),)
                if any(value is None for value in order_key) or (
                    previous_order_key is not None and order_key <= previous_order_key
                ):
                    raise ValueError("Non-increasing source key across pages")
                previous_order_key = order_key
                seen_keys.add(key)
                yield normalized
            offset += len(records)
        final = self._datastore_search(limit=0)
        if (_as_int(final.get("total")) != total or final.get("total_was_estimated")
                or field_contract(final.get("fields", [])) != field_contract(fields)):
            raise ValueError("Source changed before verification")



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
