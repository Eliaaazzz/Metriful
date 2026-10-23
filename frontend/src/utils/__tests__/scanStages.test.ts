import { deriveScanStages, mealSlotForHour } from '../scanStages';

describe('deriveScanStages', () => {
  it('marks everything pending when idle', () => {
    const view = deriveScanStages('idle', 0, 6000);
    expect(view.stages).toHaveLength(5);
    expect(view.stages.every((s) => s.state === 'pending')).toBe(true);
    expect(view.etaSeconds).toBeNull();
  });

  it('shows optimize active while compressing', () => {
    const view = deriveScanStages('compressing', 500, 6000);
    expect(view.stages[0].state).toBe('done'); // photo
    expect(view.stages[1].state).toBe('active'); // optimize
    expect(view.stages[2].state).toBe('pending');
    expect(view.etaSeconds).toBe(6);
  });

  it('walks identify → portion → nutrition across the analyzing window', () => {
    const early = deriveScanStages('analyzing', 1000, 6000); // 17%
    expect(early.stages[2].state).toBe('active');
    expect(early.stages[3].state).toBe('pending');

    const mid = deriveScanStages('analyzing', 3600, 6000); // 60%
    expect(mid.stages[2].state).toBe('done');
    expect(mid.stages[3].state).toBe('active');

    const late = deriveScanStages('analyzing', 5000, 6000); // 83%
    expect(late.stages[3].state).toBe('done');
    expect(late.stages[4].state).toBe('active');
    expect(late.etaSeconds).toBe(1);
  });

  it('reports overdue (no fake countdown) once past the expected duration', () => {
    const view = deriveScanStages('analyzing', 9000, 6000);
    expect(view.overdue).toBe(true);
    expect(view.etaSeconds).toBeNull();
  });

  it('completes every stage when ready', () => {
    const view = deriveScanStages('ready', 4000, 6000);
    expect(view.stages.every((s) => s.state === 'done')).toBe(true);
  });

  it('guards against a zero expected duration', () => {
    const view = deriveScanStages('analyzing', 1000, 0);
    expect(view.overdue).toBe(false);
    expect(view.etaSeconds).toBeGreaterThan(0);
  });
});

describe('mealSlotForHour', () => {
  it.each([
    [7, 'Breakfast'],
    [12, 'Lunch'],
    [19, 'Dinner'],
    [23, 'Snack'],
    [2, 'Snack'],
  ] as const)('maps hour %i to %s', (hour, slot) => {
    expect(mealSlotForHour(hour)).toBe(slot);
  });
});
