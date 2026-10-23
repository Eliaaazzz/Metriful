import { buildNextStep } from '../nextStep';

describe('buildNextStep', () => {
  it('suggests a protein range when a meaningful gap remains before evening', () => {
    const step = buildNextStep({ kcalRemaining: 600, proteinRemaining: 40, hour: 13 });
    expect(step).toMatch(/protein at dinner/);
    expect(step).toMatch(/30–40 g|40 g/);
  });

  it('uses neutral, non-shaming language when above target', () => {
    const step = buildNextStep({ kcalRemaining: -300, proteinRemaining: 10, hour: 20 });
    expect(step).toMatch(/Above today/);
    expect(step.toLowerCase()).not.toMatch(/fail|bad|cheat|guilt/);
  });

  it('reports remaining calories when protein is covered', () => {
    const step = buildNextStep({ kcalRemaining: 500, proteinRemaining: 5, hour: 12 });
    expect(step).toMatch(/500 kcal left/);
  });

  it('celebrates landing near the target', () => {
    const step = buildNextStep({ kcalRemaining: 20, proteinRemaining: 3, hour: 21 });
    expect(step).toMatch(/around today/i);
  });

  it('never suggests an absurd protein range', () => {
    const step = buildNextStep({ kcalRemaining: 900, proteinRemaining: 200, hour: 12 });
    expect(step).toMatch(/60 g/); // capped
  });
});
