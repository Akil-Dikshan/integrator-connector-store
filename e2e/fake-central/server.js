/*
 Copyright (c) 2026 WSO2 LLC. (http://www.wso2.com) All Rights Reserved.

 WSO2 LLC. licenses this file to you under the Apache License,
 Version 2.0 (the "License"); you may not use this file except
 in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
*/

// Minimal stand-in for Ballerina Central's search-packages endpoint, for E2E tests.
// Serves packages from a JSON fixture: { "packages": [ { organization, name, ... } ] }.
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 9091);
const fixturePath =
  process.env.FIXTURE || path.join(__dirname, '..', 'fixtures', 'search-packages.json');

function loadPackages() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')).packages;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/__health') {
    res.writeHead(200);
    return res.end('ok');
  }
  if (url.pathname !== '/2.0/registry/search-packages') {
    res.writeHead(404);
    return res.end();
  }

  let packages = loadPackages();
  const sort = url.searchParams.get('sort') || '';
  if (sort.startsWith('pullCount')) {
    const dir = sort.endsWith('ASC') ? 1 : -1;
    packages = [...packages].sort((a, b) => dir * ((a.pullCount || 0) - (b.pullCount || 0)));
  }
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 30);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ count: packages.length, packages: packages.slice(offset, offset + limit) }));
});

server.listen(port, () => console.log(`fake Central listening on ${port}`));
