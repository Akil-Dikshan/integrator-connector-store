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

import { interleaveByArea, AREA_ORDER } from './area-interleave';

type Item = { name: string; keywords: string[] };
const item = (name: string, ...keywords: string[]): Item => ({ name, keywords });
const names = (items: Item[]) => items.map((i) => i.name);

describe('interleaveByArea', () => {
  it('takes one package per Area per round, in the agreed Area order, skipping exhausted Areas', () => {
    const ranked = [
      item('erp1', 'Area/ERP & Business Operations'),
      item('erp2', 'Area/ERP & Business Operations'),
      item('hrms1', 'Area/HRMS'),
      item('crm1', 'Area/CRM & Sales'),
      item('erp3', 'Area/ERP & Business Operations'),
      item('hrms2', 'Area/HRMS'),
      item('db1', 'Area/Database'),
    ];
    expect(names(interleaveByArea(ranked))).toEqual([
      'crm1',
      'erp1',
      'db1',
      'hrms1',
      'erp2',
      'hrms2',
      'erp3',
    ]);
  });

  it('lists the 16 agreed Areas in order, CRM & Sales first and HRMS last', () => {
    expect(AREA_ORDER).toHaveLength(16);
    expect(AREA_ORDER[0]).toBe('CRM & Sales');
    expect(AREA_ORDER[15]).toBe('HRMS');
    expect(AREA_ORDER.indexOf('Cloud & Infrastructure')).toBe(AREA_ORDER.indexOf('E-Commerce') + 1);
    expect(AREA_ORDER.indexOf('Finance & Accounting')).toBe(
      AREA_ORDER.indexOf('Cloud & Infrastructure') + 1
    );
  });

  it('puts packages outside the 16 Areas after everything else, in rate order', () => {
    const ranked = [
      item('dev1', 'Area/Developer Tools'),
      item('fin1', 'Area/Finance'),
      item('ml1', 'Area/AI & Machine Learning'),
      item('ana1', 'Area/Analytics'),
      item('proto1', 'Area/Network & Protocols'),
      item('none1'),
      item('crm1', 'Area/CRM & Sales'),
      item('crm2', 'Area/CRM & Sales'),
    ];
    expect(names(interleaveByArea(ranked))).toEqual([
      'crm1',
      'proto1',
      'ml1',
      'crm2',
      'dev1',
      'fin1',
      'ana1',
      'none1',
    ]);
  });

  it('uses the first listed Area when a package also has an unlisted one', () => {
    const ranked = [
      item('both', 'Area/Finance', 'Area/Healthcare'),
      item('crm1', 'Area/CRM & Sales'),
    ];
    expect(names(interleaveByArea(ranked))).toEqual(['crm1', 'both']);
  });

  it('orders Connector, Trigger, Library, other inside an Area, keeping rate order per type', () => {
    const ranked = [
      item('lib1', 'Area/ERP & Business Operations', 'Type/Library'),
      item('con1', 'Area/ERP & Business Operations', 'Type/Connector'),
      item('oth1', 'Area/ERP & Business Operations', 'Type/Driver'),
      item('trg1', 'Area/ERP & Business Operations', 'Type/Trigger'),
      item('con2', 'Area/ERP & Business Operations', 'Type/Connector'),
      item('none1', 'Area/ERP & Business Operations'),
    ];
    expect(names(interleaveByArea(ranked))).toEqual([
      'con1',
      'con2',
      'trg1',
      'lib1',
      'oth1',
      'none1',
    ]);
  });

  it('keeps every package once: multi-Area uses its first usable Area, no-Area goes last', () => {
    const ranked = [
      item('none', 'Type/Connector'),
      item('multi', 'Area/Finance & Accounting', 'Area/CRM & Sales'),
      item('crm', 'Area/CRM & Sales'),
    ];
    const out = names(interleaveByArea(ranked));
    expect(out).toEqual(['crm', 'multi', 'none']);
    expect(new Set(out).size).toBe(ranked.length);
  });

  it('ignores Area/Built-in, and Area/Communication on Built-in packages', () => {
    const ranked = [
      item('http', 'Area/Built-in', 'Area/Communication', 'Area/Storage'),
      item('plain', 'Area/Built-in'),
      item('chat', 'Area/Communication'),
    ];
    expect(names(interleaveByArea(ranked))).toEqual(['chat', 'http', 'plain']);
  });

  it('is deterministic and does not mutate its input', () => {
    const ranked = [item('b', 'Area/B'), item('a', 'Area/A'), item('b2', 'Area/B')];
    const copy = [...ranked];
    expect(names(interleaveByArea(ranked))).toEqual(names(interleaveByArea(ranked)));
    expect(ranked).toEqual(copy);
  });
});
