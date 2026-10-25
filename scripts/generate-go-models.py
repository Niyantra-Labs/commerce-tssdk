"""Bootstrap Go SDK models. Generated types still require server contract review."""
import re, pathlib, sys
project = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else project.parent / 'commerce-gosdk'
out = project / 'src/models/generated.ts'
if not root.is_dir():
    raise SystemExit(f'Go SDK directory not found: {root}')
primitive={'string':'string','bool':'boolean','int':'number','int64':'number','float64':'number','any':'unknown','time.Time':'string','Metadata':'Metadata','Address':'Address'}
def ts_type(t):
    if t.startswith('*'): return ts_type(t[1:])+' | null'
    if t.startswith('[]'): return 'ReadonlyArray<'+ts_type(t[2:])+'>'
    if t.startswith('map['):
        m=re.match(r'map\[[^]]+\](.*)',t)
        return 'Record<string, '+ts_type(m.group(1))+ '>' if m else 'Record<string, unknown>'
    return primitive.get(t,t)
lines=['// Generated once from commerce-gosdk model declarations (fe24005).','// Review against Commerce server JSON before claiming contract parity.','export type Metadata = Record<string, unknown>;','export type Address = Record<string, unknown>;','export interface ListParams { limit?: number; offset?: number; search?: string; status?: string }','export interface ListResponse<T> { readonly data: ReadonlyArray<T>; readonly total: number }','export interface DataResponse<T> { readonly data: T }','']
seen=set()
for path in sorted(root.glob('*.go')):
    if path.name.startswith(('service_','client','iterator','usage_reporter','webhook_verify','offline_verify','commerce','types')):continue
    content=path.read_text()
    for m in re.finditer(r'^type (\w+) struct \{\n(.*?)^\}',content,re.M|re.S):
        name,block=m.groups()
        if name in ('ListParams','ListResponse','DataResponse','APIError','ErrorResponse') or name in seen: continue
        seen.add(name)
        fields=[]; embeds=[]
        for raw in block.splitlines():
            raw=raw.strip()
            if not raw or raw.startswith('//'):continue
            match=re.match(r'^(\w+)\s+([^\s`]+)\s+`json:"([^",]+)(?:,([^"]+))?"`',raw)
            if match:
                go_name,typ,key,flags=match.groups()
                if key=='-':continue
                optional=typ.startswith('*') or bool(flags and 'omitempty' in flags)
                request=('Params' in name or name.endswith('Input'))
                readonly='' if request else 'readonly '
                fields.append(f'  {readonly}{key}{"?" if optional else ""}: {ts_type(typ)};')
            else:
                emb=re.match(r'^([A-Za-z]\w*)\s*$',raw)
                if emb:embeds.append(emb.group(1))
        extends=' extends '+', '.join(embeds) if embeds else ''
        if embeds and not fields:
            lines += [f'export type {name} = {embeds[0]};', '']
        else:
            lines += [f'export interface {name}{extends} {{',*fields,'}','']
out.write_text('\n'.join(lines))
print(len(seen), 'interfaces',out)
