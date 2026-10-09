import {operatorName} from './operators.ts';

export type Fluid = 'oil' | 'gas';
export type Dimension = 'company' | 'area';
export type Row = { fluid: Fluid; periodo: string; volume_unit: string; rate: number; volume: number; positive_producing_wells: number; yoy_rate_pct: number | null; mom_rate_pct: number | null; yoy_rate_delta: number | null; yoy_volume_pct: number | null; top5_company_share_pct?: number | null; top5_area_share_pct?: number | null; top5_company_share_yoy_pp?: number | null; top5_area_share_yoy_pp?: number | null; [key: string]: unknown };
export type Entity = Row & { dimension: Dimension; entity_id: string; entity_name: string; volume_rank: number; yoy_contribution_selected: boolean; yoy_rest_rate_delta: number | null };
export type AssetRef = {path:string;sha256:string;bytes:number;compression?:'gzip'};
export type Grouping = {rule_version:string;seed_sha256:string;mappings:{legal_operator_id:string;operator_group_id:string;operator_group_name:string;valid_from:string;valid_to:string}[]};
export type Release = { schema_version: 1; status: 'candidate'; production: Row[]; entities: Entity[]; map?:{schema_version:1;index:AssetRef};operator_grouping?:Grouping };
export type Manifest = { schema_version: 1; status: 'candidate'; version: string; data_sha256: string; generated_at: string; source: { data_kind: 'official'; ingested_at?: string; published_at?: string | null; approved_period: string; accepted_periods: string[]; accepted_at: string; commit: string; resources: { id: string; url: string; sha256?: string; hash_unavailable_reason?: string; source_last_modified?: string; extracted_at?: string; year?: number }[]; snapshot_revisions_note: string } };
const numeric = ['volume','rate','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta','yoy_volume_pct','yoy_rate_pct','mom_volume_pct','mom_rate_pct'];
const concentration = ['top5_company_share_pct','yoy_top5_company_share_pct','top5_company_share_yoy_pp','top5_area_share_pct','yoy_top5_area_share_pct','top5_area_share_yoy_pp'];
const entityNumeric = ['top5_share_pct','yoy_top5_share_pct','top5_share_yoy_pp','yoy_rest_rate_delta'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(v);
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error(message); }
function row(v: unknown, entity: boolean) {
 assert(record(v), 'Fila inválida');
 assert((v.fluid === 'oil' || v.fluid === 'gas') && date(v.periodo), 'Fluido o período inválido');
 assert(v.volume_unit === (v.fluid === 'oil' ? 'bbl' : 'million_m3'), 'Unidad inválida');
 assert(numeric.every(k => k in v && (v[k] === null || finite(v[k]))) && finite(v.volume) && finite(v.rate), 'Métrica inválida');
 assert(['positive_producing_wells','reported_well_rows','valid_volume_rows'].every(k => Number.isInteger(v[k]) && Number(v[k]) >= 0), 'Conteo inválido');
 assert(Number(v.volume) >= 0 && Number(v.rate) >= 0 && v.coverage === 1 && v.is_complete === true && v.acceptance_basis === 'approved_complete_snapshot', 'Cobertura o volumen inválido');
 assert((entity ? entityNumeric : concentration).every(k => k in v && (v[k] === null || finite(v[k]))), 'Agregado preparado inválido');
 if (entity) {
  assert((v.dimension === 'company' || v.dimension === 'area') && typeof v.entity_id === 'string' && typeof v.entity_name === 'string', 'Entidad inválida');
  assert(Number.isInteger(v.volume_rank) && Number(v.volume_rank) >= 1 && typeof v.yoy_contribution_selected === 'boolean', 'Ranking inválido');
 } else assert(Number.isInteger(v.days_in_month) && Number(v.days_in_month) >= 28 && Number(v.days_in_month) <= 31 && typeof v.source_loaded_at === 'string', 'Mes inválido');
}
export function validateRelease(v: unknown): Release {
 assert(record(v) && v.schema_version === 1 && v.status === 'candidate' && Array.isArray(v.production) && Array.isArray(v.entities), 'Contrato de release inválido');
 const seen = new Set<string>();
 for (const r of v.production) { row(r,false); const k = `${r.fluid}/${r.periodo}`; assert(!seen.has(k),'Mes duplicado'); seen.add(k); }
 const entities = new Set<string>();
 for (const r of v.entities) { row(r,true); const k = `${r.fluid}/${r.dimension}/${r.entity_id}/${r.periodo}`; assert(!entities.has(k),'Entidad duplicada'); entities.add(k); assert(seen.has(`${r.fluid}/${r.periodo}`),'Entidad sin mes aceptado'); }
 if(v.map!==undefined){assert(record(v.map)&&v.map.schema_version===1,'Mapa inválido');validateRef(v.map.index);}
 if(v.operator_grouping!==undefined){const g=v.operator_grouping;assert(record(g)&&g.rule_version==='estrato-operator-groups-v1'&&typeof g.seed_sha256==='string'&&/^[a-f0-9]{64}$/.test(g.seed_sha256)&&Array.isArray(g.mappings)&&g.mappings.length===2,'Agrupación inválida');const mappings=g.mappings as unknown[];assert(['PCN','PLU'].every(id=>mappings.some(m=>record(m)&&m.legal_operator_id===id&&m.operator_group_id==='PLUSPETROL'&&m.valid_from==='2023-01-01')),'Mapping inválido');for(const e of v.entities){if(e.dimension==='company'){assert(e.operator_group_rule_version===null||e.operator_group_rule_version===g.rule_version,'Regla de operador inválida');assert(e.legal_operator_provenance===null||Array.isArray(e.legal_operator_provenance)&&e.legal_operator_provenance.every((p:unknown)=>record(p)&&typeof p.idempresa==='string'&&typeof p.empresa==='string'),'Procedencia legal inválida');}}}
 return v as unknown as Release;
}
export function validateManifest(v: unknown): Manifest {
 assert(record(v) && v.schema_version === 1 && v.status === 'candidate' && typeof v.version === 'string' && typeof v.generated_at === 'string' && Number.isFinite(Date.parse(v.generated_at)) && typeof v.data_sha256 === 'string' && /^[a-f0-9]{64}$/.test(v.data_sha256), 'Manifiesto inválido');
 const s = v.source;
 assert(record(s) && s.data_kind === 'official' && date(s.approved_period) && Array.isArray(s.accepted_periods) && s.accepted_periods.every(date) && s.accepted_periods.includes(s.approved_period) && typeof s.accepted_at === 'string' && Number.isFinite(Date.parse(s.accepted_at)) && typeof s.commit === 'string' && /^[a-f0-9]{7,40}$/.test(s.commit) && typeof s.snapshot_revisions_note === 'string', 'Proveniencia inválida');
 assert(new Set(s.accepted_periods as string[]).size === s.accepted_periods.length && [...s.accepted_periods as string[]].sort().at(-1) === s.approved_period, 'Períodos aceptados duplicados o cutoff inconsistente');
 assert(Array.isArray(s.resources) && s.resources.length > 0 && s.resources.every(r => record(r) && typeof r.id === 'string' && typeof r.url === 'string' && r.url.startsWith('https://datos.energia.gob.ar/') && ((typeof r.sha256 === 'string' && /^[a-f0-9]{64}$/.test(r.sha256)) || typeof r.hash_unavailable_reason === 'string')), 'Recursos inválidos');
 return v as unknown as Manifest;
}
export function validatePair(release: Release, manifest: Manifest) {
 assert(release.production.every(r => manifest.source.accepted_periods.includes(r.periodo)), 'Mes fuera del manifiesto');
 if (release.production.length) assert(manifest.source.accepted_periods.every(p => ['oil','gas'].every(f => release.production.some(r => r.fluid === f && r.periodo === p))), 'Snapshot aceptado ausente');
 assert(['oil','gas'].every(f => release.production.length === 0 || release.production.some(r => r.fluid === f && r.periodo === manifest.source.approved_period)), 'Falta último mes de un fluido');
}
export const number = (v: number | null | undefined, decimals = 1) => v == null ? 'Sin comparador' : new Intl.NumberFormat('es-AR',{maximumFractionDigits: decimals,minimumFractionDigits: decimals}).format(v);
export const signed = (v: number | null | undefined, suffix = '%') => v == null ? 'Sin comparador' : `${v > 0 ? '+' : ''}${number(v)}${suffix}`;
export const month = (v: string) => new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${v}T00:00:00Z`));
export function trend(rows: Row[], fluid: Fluid, period: string, months: number) {
 const end = new Date(`${period}T00:00:00Z`); const byDate = new Map(rows.filter(r=>r.fluid===fluid).map(r=>[r.periodo,r]));
 return Array.from({length:months},(_,i)=>{const d = new Date(end);d.setUTCMonth(d.getUTCMonth() - (months-1-i)); const periodo = d.toISOString().slice(0,10);return {periodo,label:month(periodo),rate:byDate.get(periodo)?.rate ?? null};});
}
export function availableRanges(rows: Row[], fluid: Fluid, period: string) { const first = rows.filter(r=>r.fluid===fluid).map(r=>r.periodo).sort()[0]; if(!first) return []; const standard = [12,24,36].filter(n=>trend(rows,fluid,period,n)[0].periodo >= first); return standard.length ? standard : [(Number(period.slice(0,4))-Number(first.slice(0,4)))*12+Number(period.slice(5,7))-Number(first.slice(5,7))+1]; }
export function prepareEntities(rows: Entity[], fluid: Fluid, dimension: Dimension, period: string) {
 const selected = rows.filter(r=>r.fluid===fluid&&r.dimension===dimension&&r.periodo===period);
 return {top:selected.filter(r=>r.volume_rank<=5).sort((a,b)=>a.volume_rank-b.volume_rank), contributions:[...selected.filter(r=>r.yoy_contribution_selected).sort((a,b)=>(b.yoy_rate_delta??0)-(a.yoy_rate_delta??0)).map(r=>({name:r.entity_name,id:r.entity_id,delta:r.yoy_rate_delta})), ...(selected.length ? [{name:'Resto',id:'rest',delta:selected[0].yoy_rest_rate_delta}] : [])]};
}
export function answer(question: string, r: Row, dimension: Dimension, top: Entity[]) {
 const q = question.trim().toLocaleLowerCase('es-AR');
 const unit = r.fluid==='oil'?'bbl/d':'MMm³/d'; const vol = r.fluid==='oil'?'bbl':'MMm³';
 const source = ` Período: ${month(r.periodo)}. Fuente: Secretaría de Energía, Capítulo IV, formación Vaca Muerta, recurso no convencional.`;
 if (q==='¿cuánto se produce?') return `${number(r.rate,r.fluid==='oil'?0:2)} ${unit}. Fórmula: volumen mensual / días calendario.${source}`;
 if (q==='¿cómo cambió frente al año anterior?') return `Variación interanual de tasa: ${signed(r.yoy_rate_pct)}; delta: ${signed(r.yoy_rate_delta,` ${unit}`)}. Fórmula: (tasa actual / tasa del mismo mes del año anterior − 1) × 100; sin base válida, comparación no disponible.${source}`;
 if (q==='¿quiénes producen más?') return `${top.map(e=>`${dimension==='company'?operatorName(e.entity_id,e.entity_name):e.entity_name}: ${number(e.volume)} ${vol}`).join('; ')}. Criterio: mayor volumen mensual (${dimension==='company'?'empresas':'áreas'}).${source}`;
 if (q==='¿cuál es la concentración?') return `Cuota del top 5: ${number(r[`top5_${dimension}_share_pct`] as number|null)}%; cambio interanual: ${signed(r[`top5_${dimension}_share_yoy_pp`] as number|null,' pp')}. Fórmula: volumen top 5 / volumen total × 100.${source}`;
 return 'Esta consulta está fuera del alcance. Elegí una pregunta preparada sobre producción, variación, ranking o concentración. No hay pronósticos, precios ni explicaciones causales.';
}
export type Approval = {schema_version:1;status:'approved';version:string;data_sha256:string;manifest_sha256:string;approved_at:string;approved_by:string};
export function validateApproval(v:unknown,manifest:Manifest,manifestHash?:string):Approval {
 assert(record(v)&&v.schema_version===1&&v.status==='approved'&&v.version===manifest.version&&v.data_sha256===manifest.data_sha256&&typeof manifestHash==='string'&&v.manifest_sha256===manifestHash&&typeof v.approved_at==='string'&&Number.isFinite(Date.parse(v.approved_at))&&typeof v.approved_by==='string'&&v.approved_by.trim().length>0,'Aprobación no corresponde a esta versión y manifiesto');
 return v as Approval;
}
export function validateRef(v:unknown):AssetRef {assert(record(v)&&typeof v.path==='string'&&/^map\/[a-zA-Z0-9_./-]+$/.test(v.path)&&!v.path.split('/').some(p=>p==='..'||p==='.'||p==='')&&typeof v.sha256==='string'&&/^[a-f0-9]{64}$/.test(v.sha256)&&Number.isInteger(v.bytes)&&Number(v.bytes)>0&&(v.compression===undefined||v.compression==='gzip'),'Referencia geográfica inválida');return v as AssetRef;}
export async function sha256(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');}
