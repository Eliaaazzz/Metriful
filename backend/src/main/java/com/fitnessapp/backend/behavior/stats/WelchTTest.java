package com.fitnessapp.backend.behavior.stats;

import org.apache.commons.math3.distribution.TDistribution;
import org.apache.commons.math3.exception.OutOfRangeException;

/**
 * Welch's two-sample t-test plus Cohen's <i>d</i>. Library-backed by Apache
 * Commons Math (Lentz continued fraction beta CDF) so p-values match scipy's
 * {@code stats.ttest_ind(equal_var=False)} to ~1e-3 on standard fixtures.
 */
public final class WelchTTest {

  /** Defensive minimum so we never ask a TDistribution for df ≤ 0. */
  private static final double MIN_DF = 1.0;

  private WelchTTest() {}

  public record Result(
      double tStat,
      double df,
      /** Two-tailed p-value. */
      double pValue,
      /** Effect size — pooled-SD normalized mean delta. */
      double cohensD,
      double meanA,
      double meanB
  ) {}

  /**
   * @param a yes-day outcome samples (length ≥ 2)
   * @param b no-day outcome samples (length ≥ 2)
   * @return Welch result; if either sample is too small, returns a degenerate
   *         result with {@code pValue = 1.0} and {@code cohensD = 0.0}.
   */
  public static Result run(double[] a, double[] b) {
    if (a == null || b == null || a.length < 2 || b.length < 2) {
      double meanA = mean(a);
      double meanB = mean(b);
      return new Result(0.0, MIN_DF, 1.0, 0.0, meanA, meanB);
    }

    double meanA = mean(a);
    double meanB = mean(b);
    double varA  = sampleVariance(a, meanA);
    double varB  = sampleVariance(b, meanB);
    double nA = a.length;
    double nB = b.length;

    double seSquared = varA / nA + varB / nB;
    if (seSquared <= 0.0) {
      return new Result(0.0, MIN_DF, 1.0, 0.0, meanA, meanB);
    }

    double t = (meanA - meanB) / Math.sqrt(seSquared);

    // Welch–Satterthwaite degrees of freedom
    double dfNum = seSquared * seSquared;
    double dfDen = (varA * varA) / (nA * nA * (nA - 1))
                 + (varB * varB) / (nB * nB * (nB - 1));
    double df = Math.max(MIN_DF, dfDen <= 0.0 ? MIN_DF : dfNum / dfDen);

    double p;
    try {
      TDistribution dist = new TDistribution(df);
      double cdf = dist.cumulativeProbability(Math.abs(t));
      p = 2.0 * (1.0 - cdf);
    } catch (OutOfRangeException e) {
      p = 1.0;
    }
    if (Double.isNaN(p) || p < 0.0) p = 0.0;
    if (p > 1.0) p = 1.0;

    // Cohen's d with pooled SD
    double pooledSd = Math.sqrt(((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2));
    double d = pooledSd == 0.0 ? 0.0 : (meanA - meanB) / pooledSd;

    return new Result(t, df, p, d, meanA, meanB);
  }

  // ----------------------------------------------------------------- helpers

  private static double mean(double[] x) {
    if (x == null || x.length == 0) return 0.0;
    double s = 0.0;
    for (double v : x) s += v;
    return s / x.length;
  }

  private static double sampleVariance(double[] x, double mean) {
    if (x.length < 2) return 0.0;
    double s = 0.0;
    for (double v : x) s += (v - mean) * (v - mean);
    return s / (x.length - 1);
  }
}
