import ExpoModulesCore
import HealthKit

public class MetrifulHealthModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("MetrifulHealth")
    Function("isAvailable") { HKHealthStore.isHealthDataAvailable() }

    AsyncFunction("requestAuthorization") { () async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else { return false }
      let types: Set<HKObjectType> = [
        HKQuantityType.quantityType(forIdentifier: .stepCount)!,
        HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKQuantityType.quantityType(forIdentifier: .appleExerciseTime)!,
        HKQuantityType.quantityType(forIdentifier: .bodyMass)!,
        HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
      ]
      try await self.store.requestAuthorization(toShare: [], read: types)
      // Completion means the sheet finished. Apple conceals read permission decisions.
      return true
    }

    AsyncFunction("readDailySummary") { (day: String) async throws -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable() else { throw HealthReadError.unavailable }
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = .current
      let formatter = DateFormatter()
      formatter.calendar = calendar
      formatter.locale = Locale(identifier: "en_US_POSIX")
      formatter.timeZone = calendar.timeZone
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.isLenient = false
      guard let start = formatter.date(from: day), formatter.string(from: start) == day,
            let end = calendar.date(byAdding: .day, value: 1, to: start) else {
        throw HealthReadError.invalidDate
      }

      async let steps = self.sum(.stepCount, unit: .count(), start: start, end: end)
      async let energy = self.sum(.activeEnergyBurned, unit: .kilocalorie(), start: start, end: end)
      async let exercise = self.sum(.appleExerciseTime, unit: .minute(), start: start, end: end)
      async let weight = self.latestWeight(start: start, end: end)
      async let sleep = self.sleepMinutes(start: start, end: end)
      let values = try await (steps, energy, exercise, weight, sleep)
      func nullable(_ value: Double?) -> Any { value.map { $0 as Any } ?? NSNull() }
      return ["date": day, "timeZone": calendar.timeZone.identifier,
              "capturedAt": ISO8601DateFormatter().string(from: Date()),
              "steps": nullable(values.0), "activeEnergyKcal": nullable(values.1),
              "exerciseMinutes": nullable(values.2), "weightKg": nullable(values.3),
              "sleepMinutes": nullable(values.4)]
    }
  }

  private func sum(_ identifier: HKQuantityTypeIdentifier, unit: HKUnit,
                   start: Date, end: Date) async throws -> Double? {
    let type = HKQuantityType.quantityType(forIdentifier: identifier)!
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
    return try await withCheckedThrowingContinuation { continuation in
      let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate,
                                    options: .cumulativeSum) { _, result, error in
        if let error = error, !self.isHiddenOrEmpty(error) {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit))
        }
      }
      self.store.execute(query)
    }
  }

  private func samples(_ type: HKSampleType, start: Date, end: Date,
                       limit: Int = HKObjectQueryNoLimit) async throws -> [HKSample] {
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
    return try await withCheckedThrowingContinuation { continuation in
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: limit,
                                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate,
                                                                  ascending: false)]) { _, samples, error in
        if let error = error, !self.isHiddenOrEmpty(error) {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: samples ?? [])
        }
      }
      self.store.execute(query)
    }
  }

  private func latestWeight(start: Date, end: Date) async throws -> Double? {
    let type = HKQuantityType.quantityType(forIdentifier: .bodyMass)!
    let results = try await samples(type, start: start, end: end, limit: 1)
    return (results.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
  }

  private func sleepMinutes(start: Date, end: Date) async throws -> Double? {
    let type = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
    let results = try await samples(type, start: start, end: end)
    // Union asleep intervals from all sources to avoid counting watch/phone duplicates.
    // Raw value 1 is asleep/unspecified; 3, 4, 5 are core, deep and REM on iOS 16+.
    let intervals = results.compactMap { sample -> (Date, Date)? in
      guard let sample = sample as? HKCategorySample, [1, 3, 4, 5].contains(sample.value) else { return nil }
      let lower = max(start, sample.startDate), upper = min(end, sample.endDate)
      return upper > lower ? (lower, upper) : nil
    }.sorted { $0.0 < $1.0 }
    guard var current = intervals.first else { return nil }
    var seconds: TimeInterval = 0
    for next in intervals.dropFirst() {
      if next.0 <= current.1 {
        current.1 = max(current.1, next.1)
      } else {
        seconds += current.1.timeIntervalSince(current.0)
        current = next
      }
    }
    return (seconds + current.1.timeIntervalSince(current.0)) / 60
  }

  private func isHiddenOrEmpty(_ error: Error) -> Bool {
    let error = error as NSError
    return error.domain == HKErrorDomain &&
      [HKError.Code.errorAuthorizationDenied.rawValue, HKError.Code.errorNoData.rawValue].contains(error.code)
  }
}

private enum HealthReadError: Error { case unavailable, invalidDate }
