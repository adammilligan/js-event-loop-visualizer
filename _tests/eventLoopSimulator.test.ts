import { describe, expect, it } from 'vitest';

import { EventLoopSimulator, formatLogLine } from '@/shared/lib/event-loop';

describe('EventLoopSimulator', () => {
  it('поддерживает setTimeout(handler) с delay=0 по умолчанию', () => {
    const sim = new EventLoopSimulator();

    sim.loadUserCode([
      "console.log('start')",
      '',
      'setTimeout(() => {',
      "  console.log('setTimeout')",
      '})',
      '',
      'Promise.resolve().then(() => {',
      "  console.log('resolve')",
      '})',
      '',
      "console.log('end')",
    ].join('\n'));

    const afterLoad = sim.getState().logs.map((l) => formatLogLine(l));
    expect(afterLoad).toEqual(['[sync] start', '[sync] end']);

    for (let i = 0; i < 50; i += 1) {
      const did = sim.step();
      if (!did) break;
    }

    const final = sim.getState().logs.map((l) => formatLogLine(l));
    expect(final).toEqual(['[sync] start', '[sync] end', '[micro] resolve', '[macro] setTimeout']);
  });

  it('поддерживает new Promise(executor) без падения', () => {
    const sim = new EventLoopSimulator();

    sim.loadUserCode([
      "console.log('start');",
      'new Promise((resolve) => {',
      '  console.log(1);',
      '  resolve(42);',
      '}).then((v) => console.log(v));',
      "console.log('end');",
    ].join('\n'));

    const afterLoad = sim.getState().logs.map((l) => formatLogLine(l));
    expect(afterLoad).toEqual(['[sync] start', '[sync] 1', '[sync] end']);

    for (let i = 0; i < 50; i += 1) {
      const did = sim.step();
      if (!did) break;
    }

    const final = sim.getState().logs.map((l) => formatLogLine(l));
    expect(final).toEqual(['[sync] start', '[sync] 1', '[sync] end', '[micro] 42']);
  });

  it('выполняет типовый пример: A, D, затем B, C, затем T', () => {
    const sim = new EventLoopSimulator();

    sim.loadUserCode([
      "console.log('A');",
      'Promise.resolve().then(() => {',
      "  console.log('B');",
      "  Promise.resolve().then(() => console.log('C'));",
      '});',
      "setTimeout(() => console.log('T'), 0);",
      "console.log('D');",
    ].join('\n'));

    const afterLoad = sim.getState().logs.map((l) => formatLogLine(l));
    expect(afterLoad).toEqual(['[sync] A', '[sync] D']);

    for (let i = 0; i < 50; i += 1) {
      const did = sim.step();
      if (!did) break;
    }

    const final = sim.getState().logs.map((l) => formatLogLine(l));
    expect(final).toEqual(['[sync] A', '[sync] D', '[micro] B', '[micro] C', '[macro] T']);
  });
});

