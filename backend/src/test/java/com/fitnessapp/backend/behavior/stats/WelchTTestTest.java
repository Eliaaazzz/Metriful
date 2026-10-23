package com.fitnessapp.backend.behavior.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class WelchTTestTest {

  /**
   * Fixture: yes=[70,80,75,85,78], no=[60,55,65,50,58].
   * Hand-computed (and cross-checked w/ scipy.stats.ttest_ind(equal_var=False)):
   *   t  ≈  5.652
   *   df ≈  8.000
   *   p  ≈  0.0005
   *   d  ≈  3.575 (pooled SD)
   */
  @Test
  void run_matchesHandComputedReference() {
    double[] yes = { 70, 80, 75, 85, 78 };
    double[] no  = { 60, 55, 65, 50, 58 };

    WelchTTest.Result r = WelchTTest.run(yes, no);

    assertThat(r.tStat()).isCloseTo(5.652, within(0.05));
    assertThat(r.df()).isCloseTo(8.0, within(0.2));
    assertThat(r.pValue()).isLessThan(0.001);
    assertThat(r.cohensD()).isCloseTo(3.575, within(0.05));
    assertThat(r.meanA()).isCloseTo(77.6, within(0.0001));
    assertThat(r.meanB()).isCloseTo(57.6, within(0.0001));
  }

  @Test
  void run_returnsLargePValueForOverlappingDistributions() {
    double[] yes = { 50, 51, 49, 50, 50 };
    double[] no  = { 50, 49, 51, 50, 50 };

    WelchTTest.Result r = WelchTTest.run(yes, no);

    assertThat(r.pValue()).isGreaterThan(0.5);
    assertThat(Math.abs(r.cohensD())).isLessThan(0.1);
  }

  @Test
  void run_handlesUndersizedSamples() {
    WelchTTest.Result r = WelchTTest.run(new double[]{1.0}, new double[]{2.0, 3.0});
    assertThat(r.pValue()).isEqualTo(1.0);
    assertThat(r.cohensD()).isZero();
  }

  @Test
  void run_handlesIdenticalConstants() {
    double[] yes = { 80, 80, 80, 80, 80 };
    double[] no  = { 80, 80, 80, 80, 80 };
    WelchTTest.Result r = WelchTTest.run(yes, no);
    // SE = 0 → degenerate; we surface a non-significant result rather than NaN.
    assertThat(r.pValue()).isEqualTo(1.0);
    assertThat(r.cohensD()).isZero();
  }

  @Test
  void run_pValueTwoTailed_isSymmetricAcrossSign() {
    double[] yes = { 70, 80, 75, 85, 78 };
    double[] no  = { 60, 55, 65, 50, 58 };
    WelchTTest.Result a = WelchTTest.run(yes, no);
    WelchTTest.Result b = WelchTTest.run(no, yes);
    assertThat(a.pValue()).isCloseTo(b.pValue(), within(1e-6));
    assertThat(Math.abs(a.cohensD())).isCloseTo(Math.abs(b.cohensD()), within(1e-6));
    assertThat(a.cohensD()).isCloseTo(-b.cohensD(), within(1e-6));
  }
}
