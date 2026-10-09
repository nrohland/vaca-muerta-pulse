import type { Entity, Fluid } from "./contract.ts";
import { operatorName } from "./operators.ts";
export const tabs = [
  ["summary", "Resumen"],
  ["production", "Producción"],
  ["operators", "Operadores"],
  ["areas", "Áreas"],
  ["activity", "Actividad"],
] as const;
export type Tab = (typeof tabs)[number][0];
export type Selection = {
  tab: Tab;
  fluid: Fluid;
  mode: "volume" | "value";
  comparison: "mom" | "yoy";
  month: string;
  operator: string;
  area: string;
};
export function readSelection(search: string): Selection {
  const p = new URLSearchParams(search);
  return {
    tab: tabs.some((t) => t[0] === p.get("tab"))
      ? (p.get("tab") as Tab)
      : "summary",
    fluid: p.get("fluid") === "gas" ? "gas" : "oil",
    mode: p.get("mode") === "value" ? "value" : "volume",
    comparison: p.get("comparison") === "mom" ? "mom" : "yoy",
    month: p.get("month") ?? "",
    operator: p.get("operator") ?? "",
    area: p.get("area") ?? "",
  };
}
export function destinationLabel(
  selection: Selection,
  entities: Entity[],
  translate: (label: string) => string = (label) => label,
) {
  if (selection.tab !== "operators" && selection.tab !== "areas")
    return translate(
      tabs.find((t) => t[0] === selection.tab)?.[1] ?? "Resumen",
    );
  const dimension = selection.tab === "operators" ? "company" : "area";
  const id = dimension === "company" ? selection.operator : selection.area;
  const entity = entities.find(
    (e) => e.dimension === dimension && e.entity_id === id,
  );
  return entity
    ? dimension === "company"
      ? operatorName(entity.entity_id, entity.entity_name)
      : entity.entity_name
    : translate(tabs.find((t) => t[0] === selection.tab)?.[1] ?? "Resumen");
}
