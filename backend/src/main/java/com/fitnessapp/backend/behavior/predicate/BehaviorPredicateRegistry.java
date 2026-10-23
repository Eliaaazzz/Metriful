package com.fitnessapp.backend.behavior.predicate;

import jakarta.annotation.PostConstruct;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Registry of {@link BehaviorPredicate}s used by both the Insights deriver
 * (feature #221) and Challenges evaluation (feature #222).
 */
@Component
public class BehaviorPredicateRegistry {

  private final Map<String, BehaviorPredicate> byKey = new LinkedHashMap<>();

  @PostConstruct
  void init() {
    for (BehaviorPredicate p : DefaultBehaviorPredicates.all()) {
      byKey.put(p.key(), p);
    }
  }

  public List<BehaviorPredicate> all() {
    return List.copyOf(byKey.values());
  }

  public Optional<BehaviorPredicate> find(String key) {
    return Optional.ofNullable(byKey.get(key));
  }

  public boolean contains(String key) {
    return byKey.containsKey(key);
  }
}
