"""Build test/fixtures/routes.json from the Commerce server's Go handlers.

For every registered /api/v1 route it records the success status and the
response envelope the handler writes:
  data    {"data": X}
  list    {"data": [...], "total": N}
  status  {"status": "..."}
  direct  any other JSON value (e.g. {"results": [...]}, {"valid": ...})
  raw     a non-JSON body (file download, CSV, PDF)
and whether the handler requires a JSON request body ("required": an empty
body is a 400), accepts one ("optional"), takes multipart, or reads none.

usage: python3 -I scripts/route-manifest.py <commerce repo> > test/fixtures/routes.json
"""
import glob
import json
import os
import re
import sys

root = sys.argv[1]
sources = {}
for path in glob.glob(os.path.join(root, 'internal', '**', '*.go'), recursive=True):
    if not path.endswith('_test.go') and '/web/' not in path:
        sources[path] = open(path).read()

REG = re.compile(r'mux\.Handle(?:Func)?\("([A-Z]+ /api/v1/[^"]*)",\s*(?:auth\.\w+\((?:[\w.]+\("[^"]*"\)\()?)?(?:http\.HandlerFunc\()?(?:h|s)\.(\w+)')
WRITE_CALL = re.compile(r'write\w*JSON\(w,\s*(http\.Status(\w+)|status),\s*')
ENCODE_CALL = re.compile(r'json\.NewEncoder\(w\)\.Encode\(')

def balanced(text, start):
    """The argument text from start up to the matching close paren."""
    depth, i = 1, start
    while i < len(text) and depth:
        depth += {'(': 1, ')': -1}.get(text[i], 0)
        i += 1
    return text[start:i - 1]

def writes_in(body):
    """(status name or 'status', expression) for each JSON write in a handler."""
    out = []
    for m in WRITE_CALL.finditer(body):
        out.append((m.group(2) or 'status', balanced(body, m.end())))
    for m in ENCODE_CALL.finditer(body):
        out.append(('OK', balanced(body, m.end())))
    return out

def handler_body(src, name):
    m = re.search(r'^func \([a-z]+ \*?\w+\) ' + name + r'\(.*?\n\}\n', src, re.S | re.M)
    return m.group(0) if m else None

def classify(expr):
    expr = ' '.join(expr.split())
    if re.match(r'map\[string\](any|interface\{\})\{ ?"data":.*"count":', expr):
        return 'direct'  # {data, count}: the whole object is the result
    if re.match(r'map\[string\](any|interface\{\})\{ ?"data":.*"total":', expr):
        return 'list'
    if re.match(r'map\[string\](any|interface\{\})\{ ?"data":', expr):
        return 'data'
    if re.match(r'map\[string\]string\{ ?"status":', expr):
        return 'status'
    if re.match(r'map\[string\](any|interface\{\})\{ ?"error":', expr):
        return 'error'
    return 'direct'

SUCCESS = {'OK': 200, 'Created': 201, 'Accepted': 202, 'NoContent': 204}
routes = {}
for path, src in sources.items():
    for pattern, name in REG.findall(src):
        body = handler_body(src, name)
        entry = {'source': os.path.relpath(path, root) + ':' + name}
        if body is None:
            entry['envelope'] = 'unknown'
        else:
            if 'ParseMultipartForm' in body:
                entry['body'] = 'multipart'
            elif re.search(r'if err := json\.NewDecoder\(r\.Body\)\.Decode\(|io\.ReadAll\((?:io\.LimitReader\()?r\.Body', body):
                entry['body'] = 'required'  # an empty body is rejected with 400
            elif 'json.NewDecoder(r.Body).Decode(' in body:
                entry['body'] = 'optional'
            else:
                entry['body'] = 'none'
            writes = []
            for status, expr in writes_in(body):
                if status == 'status':
                    # Domain results written with a computed status: 200, or 422
                    # when the result reports itself invalid.
                    entry['statuses'] = [200, 422] if 'StatusUnprocessableEntity' in body else [200]
                    writes.append((200, classify(expr)))
                elif status in SUCCESS:
                    writes.append((SUCCESS[status], classify(expr)))
            writes = [w for w in writes if w[1] != 'error']
            raw = bool(re.search(r'io\.Copy\(w|w\.Write\(|csv\.NewWriter\(w|writeCSV\(w', body))
            if writes:
                entry['status'], entry['envelope'] = writes[-1]
                kinds = sorted({k for _, k in writes} | ({'raw'} if raw else set()))
                if len(kinds) > 1:
                    entry['alternatives'] = kinds
            elif raw:
                entry.update(status=200, envelope='raw')
            else:
                entry['envelope'] = 'unknown'
        routes[pattern] = entry
# Inline handlers registered with a closure (e.g. GET /api/v1/signing-key).
for path, src in sources.items():
    for m in re.finditer(r'mux\.HandleFunc\("([A-Z]+ /api/v1/[^"]*)",\s*func\(', src):
        found = writes_in(src[m.end():m.end() + 800])
        routes[m.group(1)] = {'source': os.path.relpath(path, root) + ':inline',
                              'status': SUCCESS.get(found[0][0], 200) if found else 200,
                              'envelope': classify(found[0][1]) if found else 'unknown'}
# Routes the server's tenant guard serves without credentials (license key,
# signed token, or provider signature is the credential).
rules = open(os.path.join(root, 'internal', 'tenant', 'routes.go')).read()
for pattern in re.findall(r'"([A-Z]+ /api/v1/[^"]*)":\s*\{Access: Public', rules):
    if pattern in routes:
        routes[pattern]['public'] = True
json.dump(dict(sorted(routes.items())), sys.stdout, indent=1)
print()
